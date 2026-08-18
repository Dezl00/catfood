import { NextResponse } from 'next/server';

export const maxDuration = 60; // Max duration for Vercel Hobby

export async function POST(request) {
  let browser = null;
  
  try {
    const { html, css } = await request.json();
    
    let puppeteer;
    let executablePath = null;
    let args = [];
    let headless = true;

    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      // In Vercel, use @sparticuz/chromium-min and fetch the binary at runtime
      const chromium = await import('@sparticuz/chromium-min').then(mod => mod.default || mod);
      puppeteer = await import('puppeteer-core').then(mod => mod.default || mod);
      
      const packUrl = 'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar';
      executablePath = await chromium.executablePath(packUrl);
      args = chromium.args;
      headless = chromium.headless;
    } else {
      // Local development
      puppeteer = await import('puppeteer').then(mod => mod.default || mod);
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
      headless = 'new';
    }
    
    browser = await puppeteer.launch({
      args: args,
      executablePath: executablePath || undefined,
      headless: headless,
    });
    
    const page = await browser.newPage();
    
    // Build a complete standalone HTML page with all styles and fonts
    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${css}
    
    /* Override for PDF rendering */
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
      width: 595px;
      min-height: 842px;
      box-shadow: none;
      border-radius: 0;
      page-break-after: always;
      margin: 0;
    }
    
    .catalog-page:last-child {
      page-break-after: avoid;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
    
    await page.setContent(fullHtml, { 
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000 
    });
    
    // Wait for fonts and images to load
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
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


