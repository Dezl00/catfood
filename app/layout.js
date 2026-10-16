import './globals.css';

export const metadata = {
  title: 'أداة كتالوج المنتجات | Product Catalog Tool',
  description: 'أداة احترافية لإنشاء صفحات كتالوج المنتجات بتصميم عصري مع إمكانية التحميل كـ PDF',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&family=Mulish:wght@200;300;350;400;600&family=Noto+Kufi+Arabic:wght@400;500;700&family=Tajawal:wght@400;500;700;800&family=Inter:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
