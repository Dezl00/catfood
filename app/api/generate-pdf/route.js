import { NextResponse } from 'next/server';
import { existsSync } from 'fs';

export const maxDuration = 60; // Max duration for Vercel Hobby

export async function POST(request) {
  let browser = null;
  
  try {
    const { html, css } = await request.json();
    if (typeof html !== 'string' || typeof css !== 'string' || !html.trim()) {
      return NextResponse.json({ error: 'Invalid document payload' }, { status: 400 });
    }
    if (html.length > 8_000_000 || css.length > 2_000_000) {
      return NextResponse.json({ error: 'Document is too large to export' }, { status: 413 });
    }
    
    let puppeteer;
    let executablePath = null;
    let args = [];
    let headless = true;

    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      // Force Sparticuz to use AL2023 binaries by mocking the AWS Lambda env var
      // This fixes the missing libnss3.so error on Vercel Node 20+
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x';
      
      // In Vercel, use @sparticuz/chromium-min and fetch the binary at runtime
      const chromium = await import('@sparticuz/chromium-min').then(mod => mod.default || mod);
      puppeteer = await import('puppeteer-core').then(mod => mod.default || mod);
      
      const packUrl = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
      executablePath = await chromium.executablePath(packUrl);
      args = chromium.args;
      headless = chromium.headless;
    } else {
      // Local development
      puppeteer = await import('puppeteer').then(mod => mod.default || mod);
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
      headless = true;
      const browserCandidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ].filter(Boolean);
      executablePath = browserCandidates.find((candidate) => existsSync(candidate)) || null;
    }
    
    browser = await puppeteer.launch({
      args: args,
      executablePath: executablePath || undefined,
      headless: headless,
    });
    
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (interceptedRequest) => {
      const url = interceptedRequest.url();
      const resourceType = interceptedRequest.resourceType();

      // Allow embedded assets (data URIs), about:blank
      if (url.startsWith('data:') || url === 'about:blank') {
        return interceptedRequest.continue();
      }

      // Block SSRF / private networks
      if (
        url.includes('localhost') ||
        url.includes('127.0.0.1') ||
        url.includes('169.254.169.254') ||
        url.includes('0.0.0.0') ||
        url.startsWith('file:')
      ) {
        return interceptedRequest.abort();
      }

      // Allow all images (Cloudinary, external image URLs, brand logos)
      // and stylesheets, fonts, and documents
      if (
        resourceType === 'image' ||
        resourceType === 'font' ||
        resourceType === 'stylesheet' ||
        url.startsWith('https://res.cloudinary.com/') ||
        url.startsWith('http://res.cloudinary.com/') ||
        url.startsWith('https://fonts.googleapis.com/') ||
        url.startsWith('https://fonts.gstatic.com/')
      ) {
        return interceptedRequest.continue();
      }

      // Abort non-essential requests like scripts, trackers, websockets
      interceptedRequest.abort();
    });
    
    // Build a complete standalone HTML page with all styles and fonts
    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&family=Mulish:wght@200;300;350;400;600&family=Noto+Kufi+Arabic:wght@400;500;700&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
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
    
    await page.setContent(fullHtml, { waitUntil: ['load', 'networkidle0'], timeout: 35000 }).catch(async () => {
      // Fallback if networkidle0 times out on slow assets
      await page.setContent(fullHtml, { waitUntil: 'load', timeout: 30000 });
    });
    
    // Explicitly wait for fonts and ALL <img> elements to be completely loaded and decoded
    await page.evaluate(async () => {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch {}

      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            let done = false;
            const finish = () => {
              if (!done) {
                done = true;
                resolve();
              }
            };
            img.addEventListener('load', finish);
            img.addEventListener('error', finish);
            setTimeout(finish, 7000);
          });
        })
      );
    });

    // Small delay to ensure browser layout and painting are committed
    await new Promise((resolve) => setTimeout(resolve, 500));
    
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
    return NextResponse.json(
      { error: 'Failed to generate PDF: ' + error.message },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


