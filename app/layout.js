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
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
          onError={(e) => e.target.remove()}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
