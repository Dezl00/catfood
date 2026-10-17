import { NextResponse } from 'next/server';
import { existsSync } from 'fs';

export const maxDuration = 60; // Max duration for Vercel Hobby

let globalBrowser = null;

async function getBrowser() {
  if (globalBrowser && globalBrowser.isConnected()) {
    return globalBrowser;
  }

  let puppeteer;
  let executablePath = null;
  let args = [];
  let headless = true;

  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    // Force Sparticuz to use AL2023 binaries by mocking the AWS Lambda env var
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x';
    
    const chromium = await import('@sparticuz/chromium-min').then(mod => mod.default || mod);
    puppeteer = await import('puppeteer-core').then(mod => mod.default || mod);
    
    const packUrl = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
    executablePath = await chromium.executablePath(packUrl);
    args = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
    ];
    headless = chromium.headless;
  } else {
    // Local development with fast, stable launch flags (NO --single-process to prevent Windows crash)
    puppeteer = await import('puppeteer').then(mod => mod.default || mod);
    args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--disable-extensions',
      '--allow-file-access-from-files',
    ];
    headless = true;
    const browserCandidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ].filter(Boolean);
    executablePath = browserCandidates.find((candidate) => existsSync(candidate)) || null;
  }

  globalBrowser = await puppeteer.launch({
    args,
    executablePath: executablePath || undefined,
    headless,
  });

  globalBrowser.on('disconnected', () => {
    globalBrowser = null;
  });

  return globalBrowser;
}

export async function POST(request) {
  let page = null;
  
  try {
    const { html, css } = await request.json();
    if (typeof html !== 'string' || typeof css !== 'string' || !html.trim()) {
      return NextResponse.json({ error: 'محتوى الكتالوج غير صالح للتصدير' }, { status: 400 });
    }
    if (html.length > 8_000_000 || css.length > 2_000_000) {
      return NextResponse.json({ error: 'حجم الكتالوج كبير جداً' }, { status: 413 });
    }
    
    const origin = new URL(request.url).origin;
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Fast standalone HTML page with 100% local fonts and exact styling
    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${origin}/fonts/local-fonts.css">
  <style>
    /* Injected Runtime Styles */
    ${css}
    
    /* Exact Cat Food PDF Page Geometry */
    @page {
      size: 595.28pt 841.89pt;
      margin: 0;
    }
    
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    
    html, body {
      background: #FEFDFA;
      margin: 0;
      padding: 0;
      font-family: 'KO Sans', 'Noto Kufi Arabic', 'Tajawal', sans-serif;
    }
    
    .catfood-page {
      width: 595.28pt !important;
      height: 841.89pt !important;
      max-width: 595.28pt !important;
      min-height: 841.89pt !important;
      max-height: 841.89pt !important;
      box-shadow: none !important;
      border: 0 !important;
      border-radius: 0 !important;
      page-break-after: always;
      page-break-inside: avoid;
      break-after: page;
      break-inside: avoid;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      position: relative !important;
      background: #FEFDFA !important;
    }
    
    .catfood-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
    
    await page.goto(origin + '/fonts/local-fonts.css');
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Quick check for fonts and images
    await page.evaluate(async () => {
      try {
        if (document.fonts) {
          await document.fonts.ready;
        }
      } catch {}

      const pendingImages = Array.from(document.images).filter((img) => !img.complete);
      if (pendingImages.length > 0) {
        await Promise.all(
          pendingImages.map((img) =>
            Promise.race([
              img.decode ? img.decode() : (img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = img.onerror = resolve; })),
              new Promise((resolve) => setTimeout(resolve, 10000)),
            ])
          )
        );
      }
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="catalog.pdf"',
      },
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    if (globalBrowser && !globalBrowser.isConnected()) {
      globalBrowser = null;
    }
    return NextResponse.json(
      { error: 'فشل في إنشاء ملف PDF: ' + error.message },
      { status: 500 }
    );
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}
