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
      '--disable-web-security',
      '--allow-running-insecure-content',
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

function optimizeCloudinaryUrl(url, { width = 640, quality = 'auto:eco', format = 'jpg', background = 'white' } = {}) {
  if (!url || typeof url !== 'string') return url || '';
  if (!url.includes('cloudinary.com') || !url.includes('/upload/')) return url;

  const [prefix, rest] = url.split('/upload/');
  if (!rest) return url;

  const transformParts = [];
  if (background) transformParts.push(`b_${background}`);
  if (format) transformParts.push(`f_${format}`);
  if (quality) transformParts.push(`q_${quality}`);
  if (width) transformParts.push(`w_${width},c_limit`);
  const transformStr = transformParts.join(',');

  let cleanRest = rest;
  const versionMatch = rest.match(/(^|\/)(v\d+\/.*)$/);
  if (versionMatch) {
    cleanRest = versionMatch[2];
  } else {
    const segments = rest.split('/');
    while (segments.length > 1 && (segments[0].includes('_') || segments[0].includes(':'))) {
      segments.shift();
    }
    cleanRest = segments.join('/');
  }

  return transformStr
    ? `${prefix}/upload/${transformStr}/${cleanRest}`
    : `${prefix}/upload/${cleanRest}`;
}

export async function POST(request) {
  let page = null;
  
  try {
    const { html, css } = await request.json();
    if (typeof html !== 'string' || typeof css !== 'string' || !html.trim()) {
      return NextResponse.json({ error: 'محتوى الكتالوج غير صالح للتصدير' }, { status: 400 });
    }
    if (html.length > 50_000_000 || css.length > 5_000_000) {
      return NextResponse.json({ error: 'حجم الكتالوج كبير جداً' }, { status: 413 });
    }
    
    // Ensure eager loading and compress all catalog images to lightweight JPEG for small PDF file sizes
    const cleanHtml = html
      .replace(/\sloading=["']lazy["']/gi, ' loading="eager"')
      .replace(/\sdecoding=["']async["']/gi, ' decoding="sync"')
      .replace(/(<img\s+[^>]*src=["'])(https?:\/\/[^"']*cloudinary\.com\/[^"']*\/upload\/[^"']*)(["'])/gi, (match, before, url, after) => {
        return before + optimizeCloudinaryUrl(url, { width: 640, quality: 'auto:eco', format: 'jpg', background: 'white' }) + after;
      });

    const origin = new URL(request.url).origin;
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1800, deviceScaleFactor: 1 });
    
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
  ${cleanHtml}
</body>
</html>`;
    
    await page.goto(origin + '/fonts/local-fonts.css');
    await page.setContent(fullHtml, { waitUntil: ['domcontentloaded'], timeout: 20000 });
    
    // Ensure all fonts and images are completely loaded and decoded
    await page.evaluate(async () => {
      try {
        if (document.fonts) await document.fonts.ready;
      } catch {}

      const imgs = Array.from(document.images);
      for (const img of imgs) {
        img.loading = 'eager';
        img.decoding = 'sync';
      }

      await Promise.all(
        imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            const finish = () => resolve();
            img.addEventListener('load', finish, { once: true });
            img.addEventListener('error', finish, { once: true });
            if (img.decode) {
              img.decode().then(finish).catch(finish);
            }
            if (img.complete && img.naturalWidth > 0) resolve();
            setTimeout(finish, 12000);
          });
        })
      );
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
        'Content-Length': String(pdfBuffer.length),
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
