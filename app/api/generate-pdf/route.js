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
      const isEmbeddedAsset = url.startsWith('data:') || url === 'about:blank';
      const isGoogleFont = url.startsWith('https://fonts.googleapis.com/') || url.startsWith('https://fonts.gstatic.com/');
      const cloudinaryBase = process.env.CLOUDINARY_CLOUD_NAME
        ? 'https://res.cloudinary.com/' + process.env.CLOUDINARY_CLOUD_NAME + '/'
        : '';
      const isCloudinaryAsset = cloudinaryBase && url.startsWith(cloudinaryBase);
      if (isEmbeddedAsset || isGoogleFont || isCloudinaryAsset) {
        interceptedRequest.continue();
      } else {
        interceptedRequest.abort();
      }
    });
    
    // Build a complete standalone HTML page with all styles and fonts
    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${css}
    
    /* Override for PDF rendering */
    @page {
      size: A4;
      margin: 0;
    }
    
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background: white;
      margin: 0;
      padding: 0;
    }
    
    .catalog-page {
      width: 210mm !important;
      height: 297mm !important;
      max-width: none !important;
      min-height: 297mm !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      page-break-after: always;
      margin: 0 !important;
      padding: 0;
      overflow: hidden;
    }
    
    .catalog-page:last-child {
      page-break-after: auto;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
    
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // A bounded font wait avoids a failed third-party request blocking PDF export.
    await page.evaluate(async () => {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
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


