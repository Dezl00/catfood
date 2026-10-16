import './globals.css';

export const metadata = {
  title: 'أداة كتالوج المنتجات | Product Catalog Tool',
  description: 'أداة احترافية لإنشاء صفحات كتالوج المنتجات بتصميم عصري مع إمكانية التحميل كـ PDF',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="stylesheet" href="/fonts/local-fonts.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
