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
      '--single-process',
      '--no-zygote',
      '--disable-extensions',
    ];
    headless = chromium.headless;
  } else {
    // Local development with fast launch flags
    puppeteer = await import('puppeteer').then(mod => mod.default || mod);
    args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
    ];
    headless = true;
    const browserCandidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
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
      return NextResponse.json({ error: 'Invalid document payload' }, { status: 400 });
    }
    if (html.length > 8_000_000 || css.length > 2_000_000) {
      return NextResponse.json({ error: 'Document is too large to export' }, { status: 413 });
    }
    
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Fast standalone HTML page with fonts and styles
    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600&family=Mulish:wght@200;300;350&family=Noto+Kufi+Arabic:wght@400;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
  <style>
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
    
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Quick parallel check for fonts and images without arbitrary blocking delays
    await page.evaluate(async () => {
      try {
        if (document.fonts) {
          await Promise.race([
            document.fonts.ready,
            new Promise((resolve) => setTimeout(resolve, 800)),
          ]);
        }
      } catch {}

      const pendingImages = Array.from(document.images).filter((img) => !img.complete);
      if (pendingImages.length > 0) {
        await Promise.all(
          pendingImages.map((img) =>
            new Promise((resolve) => {
              img.onload = img.onerror = resolve;
              setTimeout(resolve, 1500);
            })
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
    // If browser crashed, reset globalBrowser
    if (globalBrowser && !globalBrowser.isConnected()) {
      globalBrowser = null;
    }
    return NextResponse.json(
      { error: 'Failed to generate PDF: ' + error.message },
      { status: 500 }
    );
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}
