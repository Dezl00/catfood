'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_SETTINGS = {
  footerText: 'السعر غير شامل الضريبة',
  currency: 'ج.م',
  visible: { category: true, description: true, prices: true, cartonPrice: true, carton: true, barcode: true },
};

const UNIT_MAP = {
  'جم': 'g',
  'جرام': 'g',
  'غرام': 'g',
  'كجم': 'kg',
  'كيلو': 'kg',
  'كيلوغرام': 'kg',
  'لتر': 'L',
  'ليتر': 'L',
  'مل': 'ml',
  'ملل': 'ml',
  'حبة': 'pcs',
  'قطعة': 'pcs',
  'حبه': 'pcs',
  'قطع': 'pcs',
};

const normalizeUnit = (unit) => {
  if (!unit) return '';
  const trimmed = String(unit).trim();
  return UNIT_MAP[trimmed] || UNIT_MAP[trimmed.toLowerCase()] || trimmed;
};

const newId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
const emptyVariant = () => ({ id: newId(), weight: '', unit: 'g', sku: '', qtyPerCarton: '', pricePerPiece: '', pricePerCarton: '' });
const emptyProduct = () => ({ id: newId(), nameAr: '', nameEn: '', categoryAr: '', categoryEn: '', descriptionAr: '', descriptionEn: '', barcode: '', imageUrl: '', variants: [emptyVariant()] });
const mergeSettings = (settings) => ({ ...DEFAULT_SETTINGS, ...(settings || {}), visible: { ...DEFAULT_SETTINGS.visible, ...((settings || {}).visible || {}) } });
const price = (value, currency) => value === '' || value === undefined ? '—' : String(value) + ' ' + currency;

function Icon({ name, size = 20 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const shapes = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    tag: <><path d="M20 13 11 22 2 13V4h9Z" /><circle cx="7" cy="9" r="1" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    upload: <><path d="M12 16V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
    download: <><path d="M12 3v13" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></>,
    folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.5a5 5 0 0 0-.6-1.4l1.1-1.8-2.1-2.1-1.8 1.1A5 5 0 0 0 12.2 5L11.5 3h-3l-.5 2a5 5 0 0 0-1.4.6L4.8 4.5 2.7 6.6l1.1 1.8A5 5 0 0 0 3.2 10l-2 .5v3l2 .5a5 5 0 0 0 .6 1.4l-1.1 1.8 2.1 2.1 1.8-1.1a5 5 0 0 0 1.4.6l.5 2h3l.5-2a5 5 0 0 0 1.4-.6l1.8 1.1 2.1-2.1-1.1-1.8a5 5 0 0 0 .6-1.4Z" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    edit: <><path d="M12 20H5a1 1 0 0 1-1-1v-7" /><path d="m16 4 4 4" /><path d="m14 6 4 4-8.5 8.5L5 19l.5-4.5Z" /></>,
    trash: <path d="M4 7h16M10 11v5M14 11v5M6 7l1 14h10l1-14M9 7V4h6v3" />,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    grip: <><circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/></>,
    arrowUp: <path d="m18 15-6-6-6 6" />,
    arrowDown: <path d="m6 9 6 6 6-6" />,
  };
  return <svg {...props}>{shapes[name] || shapes.grid}</svg>;
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function BrandBadge({ brand, large = false }) {
  return <div className={['brand-badge', large && 'brand-badge--large'].filter(Boolean).join(' ')}>
    {brand?.logoUrl ? <img src={brand.logoUrl} alt="" /> : <b>{(brand?.nameAr || brand?.nameEn || 'B').slice(0, 1)}</b>}
  </div>;
}

function UploadZone({ preview, onFile, label, note, compact = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const useFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    onFile(file);
  };
  return <div className={['upload-zone', compact && 'upload-zone--compact', dragging && 'is-dragging', preview && 'has-preview'].filter(Boolean).join(' ')} role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); useFile(event.dataTransfer.files?.[0]); }}>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => useFile(event.target.files?.[0])} />
    {preview ? <img src={preview} alt="معاينة" /> : <><Icon name="upload" size={compact ? 22 : 28} /><strong>{label}</strong><span>{note}</span></>}
  </div>;
}

function estimateDescHeight(product, hasBoth) {
  const arText = String(product.descriptionAr || '').trim();
  const enText = String(product.descriptionEn || '').trim();
  if (!arText && !enText) return 0;

  const charsPerLineAr = hasBoth ? 30 : 65;
  const charsPerLineEn = hasBoth ? 28 : 60;

  const linesAr = arText ? arText.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil((line.length || 1) / charsPerLineAr)), 0) : 0;
  const linesEn = enText ? enText.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil((line.length || 1) / charsPerLineEn)), 0) : 0;

  const heightAr = linesAr > 0 ? 26 + linesAr * 20 : 0;
  const heightEn = linesEn > 0 ? 26 + linesEn * 18 : 0;

  const rawHeight = Math.max(heightAr, heightEn);
  // Flexible: min 52pt, max 165pt
  return Math.min(165, Math.max(52, Math.round(rawHeight)));
}

function getTableColumns(visible, variants = []) {
  const showWeight = true; // Always visible
  const showCarton = visible?.carton !== false;
  const showPrice = visible?.prices !== false;
  const showBarcode = visible?.barcode !== false;
  const showCartonPrice = visible?.cartonPrice !== false && variants.some((v) => Boolean(String(v.pricePerCarton || '').trim()));

  // If carton price is enabled and present, render 5-column layout across 516.50pt
  // Barcode widened to 146.50pt, Carton count reduced to 98.00pt
  if (showCartonPrice) {
    const barcodeCol = 146.50;
    const cartonPriceCol = 96.00;
    const priceCol = 86.00;
    const cartonCol = 98.00;
    const weightCol = 70.00;

    return [
      { key: 'barcode', title: 'باركود', left: 32.50, width: barcodeCol, align: 'ltr' },
      { key: 'cartonPrice', title: 'سعر الكرتون', left: 32.50 + barcodeCol + 5.0, width: cartonPriceCol, align: 'ltr' },
      { key: 'price', title: 'سعر الحبة', left: 32.50 + barcodeCol + 5.0 + cartonPriceCol + 5.0, width: priceCol, align: 'ltr' },
      { key: 'carton', title: 'العدد بالكرتون', left: 32.50 + barcodeCol + 5.0 + cartonPriceCol + 5.0 + priceCol + 5.0, width: cartonCol, align: 'ltr' },
      { key: 'weight', title: 'الوزن', left: 32.50 + barcodeCol + 5.0 + cartonPriceCol + 5.0 + priceCol + 5.0 + cartonCol + 5.0, width: weightCol, align: 'ltr' },
    ];
  }

  // Exact Cat Food spec numbers when standard 4 columns are visible
  // Barcode widened to 199.50pt, Carton count reduced to 108.00pt
  if (showWeight && showCarton && showPrice && showBarcode) {
    const barcodeCol = 199.50;
    const priceCol = 112.00;
    const cartonCol = 108.00;
    const weightCol = 82.00;

    return [
      { key: 'barcode', title: 'باركود', left: 32.50, width: barcodeCol, align: 'ltr' },
      { key: 'price', title: 'السعر', left: 32.50 + barcodeCol + 5.0, width: priceCol, align: 'ltr' },
      { key: 'carton', title: 'العدد بالكرتون', left: 32.50 + barcodeCol + 5.0 + priceCol + 5.0, width: cartonCol, align: 'ltr' },
      { key: 'weight', title: 'الوزن', left: 32.50 + barcodeCol + 5.0 + priceCol + 5.0 + cartonCol + 5.0, width: weightCol, align: 'ltr' },
    ];
  }

  // Reflow logic for hidden columns with barcode widened and carton reduced
  const activeCols = [];
  if (showBarcode) activeCols.push({ key: 'barcode', title: 'باركود', weight: 1.8, align: 'ltr' });
  if (showPrice) activeCols.push({ key: 'price', title: 'السعر', weight: 1.0, align: 'ltr' });
  if (showCarton) activeCols.push({ key: 'carton', title: 'العدد بالكرتون', weight: 1.1, align: 'ltr' });
  if (showWeight) activeCols.push({ key: 'weight', title: 'الوزن', weight: 0.75, align: 'ltr' });

  const gap = 5.0;
  const totalGaps = Math.max(0, activeCols.length - 1) * gap;
  const availableContentWidth = 516.50 - totalGaps;
  const totalWeight = activeCols.reduce((sum, c) => sum + c.weight, 0);

  let currentLeft = 32.50;
  return activeCols.map((col) => {
    const width = Number(((col.weight / totalWeight) * availableContentWidth).toFixed(2));
    const left = Number(currentLeft.toFixed(2));
    currentLeft += width + gap;
    return { ...col, left, width };
  });
}

function computeProductLayout(product, settings, variants) {
  const hasDescAr = settings?.visible?.description !== false && Boolean(product.descriptionAr?.trim());
  const hasDescEn = settings?.visible?.description !== false && Boolean(product.descriptionEn?.trim());
  const hasDescriptions = hasDescAr || hasDescEn;

  const rowCount = Math.max(1, variants.length);
  const tableHeight = 22.5 + rowCount * 28;

  const availableTotalHeight = 623.0; // from y = 145.8 to 768.8
  const descHeight = hasDescriptions ? estimateDescHeight(product, hasDescAr && hasDescEn) : 0;
  const descGap1 = hasDescriptions ? 32.0 : 0;
  const descGap2 = hasDescriptions ? 30.0 : 36.0;

  // Flexible image card height absorbs the difference (min 160pt)
  const cardHeight = Math.max(160, availableTotalHeight - descHeight - tableHeight - descGap1 - descGap2);
  const cardBottom = 145.8 + cardHeight;

  // Name pill centered on card bottom border (y = cardBottom)
  const pillHeight = 17.93;
  const pillTop = cardBottom - pillHeight / 2;
  const nameArTop = pillTop - 19;

  // Descriptions top
  const descTop = hasDescriptions ? cardBottom + descGap1 : 0;

  // Table top
  const tableTop = hasDescriptions ? descTop + descHeight + descGap2 : cardBottom + descGap2;

  return {
    cardHeight,
    cardBottom,
    pillTop,
    nameArTop,
    hasDescAr,
    hasDescEn,
    hasDescriptions,
    descHeight,
    descTop,
    tableTop,
  };
}

function formatVariantCell(variant, product, key) {
  switch (key) {
    case 'weight': {
      const w = String(variant.weight || '').trim();
      const u = normalizeUnit(variant.unit || '').trim();
      if (!w) return '—';
      if (u && !w.toLowerCase().includes(u.toLowerCase())) return `${w} ${u}`;
      return w;
    }
    case 'carton':
      return String(variant.qtyPerCarton || '').trim() || '—';
    case 'price':
      return String(variant.pricePerPiece || variant.price || '').trim() || '—';
    case 'cartonPrice':
      return String(variant.pricePerCarton || '').trim() || '—';
    case 'barcode':
      return String(variant.sku || product.barcode || '').trim() || '—';
    default:
      return '—';
  }
}

function CatalogWelcomeSheet({ brand }) {
  const brandAr = brand?.nameAr || 'كـات فـود';
  const brandEn = brand?.nameEn || 'CAT FOOD';
  const logoUrl = brand?.logoUrl;

  return (
    <section className="catfood-page" id="welcome" aria-label="صفحة الترحيب">
      <div className="cf-header-band" />
      <div className="cf-header-ar">{brandAr}</div>
      <div className="cf-header-en">{brandEn}</div>

      <div className="cf-dash-left" />
      <div className="cf-dash-right" />
      <div className="cf-alhamdulillah">بحمد الله</div>
      <div className="cf-received-ar">وصلنا منتجات من شركة</div>
      <div className="cf-received-en-pill">
        <span className="cf-received-en-text">WE HAVE RECEIVED NEW PRODUCTS FROM</span>
      </div>

      <div className="cf-logo-card">
        {logoUrl ? (
          <img src={logoUrl} alt={brandAr} className="cf-brand-logo-img" />
        ) : (
          <div className="cf-logo-fallback">{brandAr}</div>
        )}
      </div>

      <div className="cf-welcome-footer-text">{brandEn}</div>
      <div className="cf-welcome-footer-line" />
    </section>
  );
}

function CatalogClosingSheet({ brand }) {
  const brandAr = brand?.nameAr || 'كـات فـود';
  const brandEn = brand?.nameEn || 'CAT FOOD';

  return (
    <section className="catfood-page" id="closing" aria-label="صفحة الختام">
      <div className="cf-navy-arch" />
      <div className="cf-thanks-ar">خدمتكم تسعدنا</div>
      <div className="cf-thanks-en">THANK YOU</div>
      <div className="cf-brand-ar">{brandAr}</div>
      <div className="cf-brand-en">{brandEn}</div>
      <div className="cf-closing-footer-text">{brandEn}</div>
      <div className="cf-closing-footer-line" />
    </section>
  );
}

function ProductSheet({ brand, product, compact = false }) {
  const brandAr = brand?.nameAr || 'كـات فـود';
  const brandEn = brand?.nameEn || 'CAT FOOD';
  const settings = mergeSettings(brand?.settings);
  const variants = product.variants?.length ? product.variants : [emptyVariant()];

  const layout = computeProductLayout(product, settings, variants);
  const columns = getTableColumns(settings.visible, variants);

  return (
    <article className="catfood-page" id="product" aria-label={product.nameAr || product.nameEn || 'صفحة المنتج'}>
      {/* Header Band */}
      <div className="cf-header-band" />
      <div className="cf-header-ar">{brandAr}</div>
      <div className="cf-header-en">{brandEn}</div>

      {/* Image Card */}
      <div className="cf-image-card" style={{ height: `${layout.cardHeight}pt` }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.nameAr || product.nameEn || ''}
            className="cf-product-image-img"
            style={{ maxHeight: `${layout.cardHeight - 52}pt` }}
          />
        ) : (
          <div className="cf-product-image-empty">
            <Icon name="image" size={48} />
            <span>صورة المنتج</span>
          </div>
        )}
      </div>

      {/* Product Names */}
      {product.nameAr && (
        <div className="cf-name-ar" style={{ top: `${layout.nameArTop}pt` }}>
          <span>{product.nameAr}</span>
        </div>
      )}
      {product.nameEn && (
        <div className="cf-name-pill" style={{ top: `${layout.pillTop}pt` }}>
          <span>{product.nameEn}</span>
        </div>
      )}

      {/* Descriptions */}
      {layout.hasDescriptions && (
        <>
          {layout.hasDescAr && layout.hasDescEn ? (
            <>
              {/* Arabic Description on Right */}
              <div
                className="cf-desc-box"
                style={{
                  left: '299.00pt',
                  top: `${layout.descTop}pt`,
                  width: '250.00pt',
                  height: `${layout.descHeight}pt`,
                  borderRadius: `${Math.min(26, layout.descHeight / 2)}pt`,
                }}
              >
                <div className="cf-desc-ar-text">{product.descriptionAr}</div>
              </div>

              {/* English Description on Left */}
              <div
                className="cf-desc-box"
                style={{
                  left: '32.50pt',
                  top: `${layout.descTop}pt`,
                  width: '250.00pt',
                  height: `${layout.descHeight}pt`,
                  borderRadius: `${Math.min(26, layout.descHeight / 2)}pt`,
                }}
              >
                <div className="cf-desc-en-text">{product.descriptionEn}</div>
              </div>
            </>
          ) : layout.hasDescAr ? (
            <div
              className="cf-desc-box"
              style={{
                left: '32.50pt',
                top: `${layout.descTop}pt`,
                width: '516.50pt',
                height: `${layout.descHeight}pt`,
                borderRadius: `${Math.min(26, layout.descHeight / 2)}pt`,
              }}
            >
              <div className="cf-desc-ar-text" style={{ fontSize: '11.5pt', lineHeight: '18pt' }}>
                {product.descriptionAr}
              </div>
            </div>
          ) : (
            <div
              className="cf-desc-box"
              style={{
                left: '32.50pt',
                top: `${layout.descTop}pt`,
                width: '516.50pt',
                height: `${layout.descHeight}pt`,
                borderRadius: `${Math.min(26, layout.descHeight / 2)}pt`,
              }}
            >
              <div className="cf-desc-en-text" style={{ fontSize: '12pt', lineHeight: '17pt' }}>
                {product.descriptionEn}
              </div>
            </div>
          )}
        </>
      )}

      {/* Variant Table */}
      {/* Header Cells */}
      {columns.map((col) => (
        <div
          key={col.key}
          className="cf-th-cell"
          style={{
            left: `${col.left}pt`,
            top: `${layout.tableTop}pt`,
            width: `${col.width}pt`,
          }}
        >
          {col.title}
        </div>
      ))}

      {/* Body Rows */}
      {variants.map((variant, vIdx) => {
        const rowTop = layout.tableTop + 23.80 + 2.90 + vIdx * 28.00;
        return (
          <div key={variant.id || vIdx}>
            {columns.map((col) => (
              <div
                key={col.key}
                className="cf-body-cell"
                style={{
                  left: `${col.left}pt`,
                  top: `${rowTop}pt`,
                  width: `${col.width}pt`,
                  direction: col.align || 'ltr',
                }}
              >
                {formatVariantCell(variant, product, col.key)}
              </div>
            ))}
          </div>
        );
      })}

      {/* Footer */}
      <div className="cf-product-footer-line" />
      <div className="cf-tax-pill">
        {settings.footerText || 'السعر غير شامل الضريبة'}
      </div>
    </article>
  );
}

function ProductCard({
  brand,
  product,
  index,
  total,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onMoveUp,
  onMoveDown,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const variant = product.variants?.[0] || {};
  return (
    <article
      className={['product-card', isDragging && 'is-dragging', isDragOver && 'is-drag-over'].filter(Boolean).join(' ')}
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, index)}
      onDragOver={(e) => onDragOver && onDragOver(e, index)}
      onDrop={(e) => onDrop && onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      <div className="product-card-topbar">
        <div className="drag-handle" title="اسحب لإعادة ترتيب موضع الصفحة في الكتالوج">
          <Icon name="grip" size={15} />
          <span className="page-order-badge">صفحة {index + 1}</span>
        </div>
        <div className="card-quick-order">
          <button
            type="button"
            className="move-button"
            disabled={index === 0}
            onClick={() => onMoveUp && onMoveUp(index)}
            title="تقديم الصفحة للأمام"
            aria-label="تقديم الصفحة"
          >
            <Icon name="arrowUp" size={13} />
          </button>
          <button
            type="button"
            className="move-button"
            disabled={index === total - 1}
            onClick={() => onMoveDown && onMoveDown(index)}
            title="تأخير الصفحة للخلف"
            aria-label="تأخير الصفحة"
          >
            <Icon name="arrowDown" size={13} />
          </button>
        </div>
      </div>
      <div className="product-card-body">
        <div className="product-card-image" onClick={onPreview} title="معاينة شكل الصفحة A4" style={{ cursor: 'pointer' }}>
          {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Icon name="image" size={31} />}
        </div>
        <div className="product-card-content">
          <div className="product-card-heading">
            <div>
              <h3>{product.nameAr || product.nameEn || 'صفحة بدون اسم'}</h3>
              <p>{product.nameEn || 'Unnamed Page'}</p>
            </div>
            <button className="icon-button" onClick={onEdit} aria-label="تعديل الصفحة" title="تعديل"><Icon name="edit" size={16} /></button>
          </div>
          <div className="card-meta">
            <span>{product.variants?.length || 0} مقاسات</span>
            {product.barcode && <span dir="ltr">#{product.barcode}</span>}
          </div>
          <strong className="card-price">
            {variant.weight ? variant.weight + ' ' + normalizeUnit(variant.unit) : 'وزن افتراضي'}{' '}
            <small>{price(variant.pricePerPiece, mergeSettings(brand?.settings).currency)}</small>
            {variant.pricePerCarton ? <small style={{ color: '#00497A', fontWeight: 700, marginInlineStart: '4px' }}>· كرتون: {price(variant.pricePerCarton, mergeSettings(brand?.settings).currency)}</small> : null}
          </strong>
        </div>
      </div>
      <div className="card-actions">
        <button type="button" onClick={onPreview} title="معاينة شكل الصفحة A4"><Icon name="eye" size={14} /> معاينة</button>
        <button type="button" onClick={onEdit} title="تعديل"><Icon name="edit" size={14} /> تعديل</button>
        <button type="button" onClick={onDuplicate} title="نسخ / تكرار الصفحة"><Icon name="copy" size={14} /> تكرار</button>
        <button type="button" className="danger" onClick={onDelete} title="حذف الصفحة"><Icon name="trash" size={14} /> حذف</button>
      </div>
    </article>
  );
}

function Modal({ title, subtitle, children, onClose, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <section className={['modal', wide && 'modal--wide'].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق"><Icon name="close" /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'تعذر تنفيذ العملية.');
  return body;
}

function mappedValue(row, names) {
  const keys = Object.keys(row);
  const wanted = names.map((name) => name.toLowerCase().replace(/[\s_-]/g, ''));
  const match = keys.find((key) => wanted.includes(key.toLowerCase().replace(/[\s_-]/g, '')));
  return match ? String(row[match] ?? '').trim() : '';
}

function variantsFromRow(row) {
  const rawVariants = mappedValue(row, ['variants', 'المقاسات', 'الأوزان', 'weights']);
  if (rawVariants) {
    try {
      const parsed = JSON.parse(rawVariants);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((variant) => ({
          ...emptyVariant(),
          ...variant,
          unit: normalizeUnit(variant.unit || 'g'),
          id: newId(),
        }));
      }
    } catch {
      const parts = rawVariants.split(/[|،,]/).map((part) => part.trim()).filter(Boolean);
      if (parts.length) return parts.map((weight) => ({ ...emptyVariant(), weight, unit: 'g' }));
    }
  }
  return [{
    ...emptyVariant(),
    weight: mappedValue(row, ['weight', 'الوزن']),
    unit: normalizeUnit(mappedValue(row, ['unit', 'الوحدة']) || 'g'),
    sku: mappedValue(row, ['sku', 'كود', 'code']),
    qtyPerCarton: mappedValue(row, ['qtyPerCarton', 'quantityPerCarton', 'عدد الكرتون', 'عدد بالكرتون']),
    pricePerPiece: mappedValue(row, ['pricePerPiece', 'piecePrice', 'سعر الحبة']),
    pricePerCarton: mappedValue(row, ['pricePerCarton', 'cartonPrice', 'سعر الكرتون']),
  }];
}

const MAPPABLE_FIELDS = [
  { key: 'nameAr', label: 'الاسم بالعربي', required: true, hint: 'الاسم العربي الأساسي لصفحة المنتج' },
  { key: 'nameEn', label: 'الاسم بالإنجليزي', required: false, hint: 'الاسم الإنجليزي في الشارة المستطيلة' },
  { key: 'pricePerPiece', label: 'سعر الحبة', required: false, hint: 'سعر القطعة الفردية في الجدول' },
  { key: 'pricePerCarton', label: 'سعر الكرتون', required: false, hint: 'سعر كرتون المنتج في الجدول' },
  { key: 'qtyPerCarton', label: 'العدد في الكرتون', required: false, hint: 'عدد الحبات المعبأة بالكرتون' },
  { key: 'weight', label: 'الوزن / الحجم', required: false, hint: 'الوزن أو السعة (مثل: 5 أو 400)' },
  { key: 'unit', label: 'وحدة الوزن (Unit)', required: false, hint: 'الوحدة (g, kg, L, ml, pcs)' },
  { key: 'barcode', label: 'الباركود (Barcode)', required: false, hint: 'رقم الباركود أو رمز الصنف' },
  { key: 'descriptionAr', label: 'الوصف بالعربي', required: false, hint: 'النص في الصندوق الأيمن' },
  { key: 'descriptionEn', label: 'الوصف بالإنجليزي', required: false, hint: 'النص في الصندوق الأيسر' },
  { key: 'imageUrl', label: 'رابط الصورة', required: false, hint: 'رابط مباشر لصورة المنتج (اختياري)' },
];

function extractUnitFromWeight(str) {
  if (!str) return '';
  const s = String(str).toLowerCase();
  if (s.includes('kg') || s.includes('كغ') || s.includes('كيلو')) return 'kg';
  if (s.includes('ml') || s.includes('مل')) return 'ml';
  if (s.includes('l') || s.includes('لتر')) return 'L';
  if (s.includes('pcs') || s.includes('حبة') || s.includes('قطع')) return 'pcs';
  if (s.includes('oz') || s.includes('أونصة')) return 'oz';
  if (s.includes('lb') || s.includes('باوند')) return 'lb';
  if (s.includes('g') || s.includes('جرام') || s.includes('جم')) return 'g';
  return '';
}

function autoDetectMapping(headers) {
  const mapping = {};
  for (const f of MAPPABLE_FIELDS) mapping[f.key] = '';

  for (const rawHeader of headers) {
    const raw = String(rawHeader || '').trim();
    if (!raw) continue;
    const clean = raw.toLowerCase().replace(/[\s_\-]+/g, '');

    if (!mapping.nameAr && (
      (clean.includes('عرب') && clean.includes('اسم')) ||
      clean.includes('namear') ||
      clean.includes('arabicname') ||
      clean === 'اسم' ||
      clean === 'الاسم' ||
      clean === 'اسمالمنتج' ||
      clean === 'المنتج' ||
      clean === 'اسم_المنتج'
    )) {
      mapping.nameAr = raw;
      continue;
    }

    if (!mapping.nameEn && (
      clean.includes('انجليز') ||
      clean.includes('إنجليز') ||
      clean.includes('nameen') ||
      clean.includes('englishname') ||
      clean === 'itemname' ||
      clean === 'english' ||
      clean === 'ename' ||
      clean === 'name'
    )) {
      mapping.nameEn = raw;
      continue;
    }

    if (!mapping.pricePerPiece && (
      clean.includes('سعرالحبة') ||
      clean.includes('سعرحبة') ||
      clean.includes('سعرالقطعة') ||
      clean.includes('سعرقطعة') ||
      clean.includes('priceperpiece') ||
      clean.includes('pieceprice') ||
      clean.includes('unitprice') ||
      clean === 'سعر' ||
      clean === 'السعر' ||
      clean === 'price'
    )) {
      mapping.pricePerPiece = raw;
      continue;
    }

    if (!mapping.pricePerCarton && (
      clean.includes('سعرالكرتون') ||
      clean.includes('سعركرتون') ||
      clean.includes('cartonprice') ||
      clean.includes('boxprice') ||
      clean.includes('pricepercarton')
    )) {
      mapping.pricePerCarton = raw;
      continue;
    }

    if (!mapping.qtyPerCarton && (
      clean.includes('عددالكرتون') ||
      clean.includes('عددبالكرتون') ||
      clean.includes('كميةالكرتون') ||
      clean.includes('qtypercarton') ||
      clean.includes('quantitypercarton') ||
      clean.includes('pcspercarton') ||
      clean.includes('كرتون') ||
      clean === 'عدد' ||
      clean === 'العدد' ||
      clean === 'الكمية' ||
      clean === 'qty'
    )) {
      mapping.qtyPerCarton = raw;
      continue;
    }

    if (!mapping.weight && (
      clean.includes('وزن') ||
      clean.includes('الوزن') ||
      clean.includes('حجم') ||
      clean.includes('الحجم') ||
      clean.includes('weight') ||
      clean.includes('size')
    )) {
      mapping.weight = raw;
      continue;
    }

    if (!mapping.unit && (
      clean.includes('وحدة') ||
      clean.includes('الوحدة') ||
      clean === 'unit'
    )) {
      mapping.unit = raw;
      continue;
    }

    if (!mapping.barcode && (
      clean.includes('باركود') ||
      clean.includes('الباركود') ||
      clean.includes('barcode') ||
      clean.includes('sku') ||
      clean.includes('كود') ||
      clean.includes('code')
    )) {
      mapping.barcode = raw;
      continue;
    }

    if (!mapping.descriptionAr && (
      (clean.includes('وصف') && clean.includes('عرب')) ||
      clean.includes('descar') ||
      clean.includes('وصف') ||
      clean.includes('الوصف')
    )) {
      mapping.descriptionAr = raw;
      continue;
    }

    if (!mapping.descriptionEn && (
      (clean.includes('وصف') && (clean.includes('انجليز') || clean.includes('إنجليز'))) ||
      clean.includes('descen') ||
      clean.includes('description')
    )) {
      mapping.descriptionEn = raw;
      continue;
    }

    if (!mapping.imageUrl && (
      clean.includes('صورة') ||
      clean.includes('الصورة') ||
      clean.includes('image') ||
      clean.includes('photo') ||
      clean.includes('img')
    )) {
      mapping.imageUrl = raw;
      continue;
    }
  }

  return mapping;
}

function rowToProductWithMapping(row, mapping) {
  const get = (key) => {
    const col = mapping[key];
    if (!col) return '';
    return String(row[col] ?? '').trim();
  };

  const rawWeight = get('weight');
  let unit = get('unit');
  if (!unit) {
    unit = extractUnitFromWeight(rawWeight) || 'g';
  } else {
    unit = normalizeUnit(unit);
  }

  const barcode = get('barcode');
  const pricePiece = get('pricePerPiece');
  const priceCarton = get('pricePerCarton');
  const qtyCarton = get('qtyPerCarton');

  return {
    id: newId(),
    nameAr: get('nameAr'),
    nameEn: get('nameEn'),
    categoryAr: get('categoryAr'),
    categoryEn: get('categoryEn'),
    descriptionAr: get('descriptionAr'),
    descriptionEn: get('descriptionEn'),
    barcode: barcode,
    imageUrl: get('imageUrl'),
    variants: [
      {
        ...emptyVariant(),
        weight: rawWeight,
        unit: unit,
        sku: barcode,
        qtyPerCarton: qtyCarton,
        pricePerPiece: pricePiece,
        pricePerCarton: priceCarton,
      },
    ],
  };
}

function productFromRow(row) {
  return {
    id: newId(),
    nameAr: mappedValue(row, ['nameAr', 'arabicName', 'اسم المنتج بالعربي', 'الاسم بالعربي']),
    nameEn: mappedValue(row, ['nameEn', 'englishName', 'اسم المنتج بالإنجليزية', 'الاسم بالإنجليزية']),
    categoryAr: mappedValue(row, ['categoryAr', 'arabicCategory', 'التصنيف بالعربي']),
    categoryEn: mappedValue(row, ['categoryEn', 'englishCategory', 'التصنيف بالإنجليزية']),
    descriptionAr: mappedValue(row, ['descriptionAr', 'descAr', 'arabicDescription', 'الوصف بالعربي']),
    descriptionEn: mappedValue(row, ['descriptionEn', 'descEn', 'englishDescription', 'الوصف بالإنجليزية']),
    barcode: mappedValue(row, ['barcode', 'barCode', 'الباركود']),
    imageUrl: '',
    variants: variantsFromRow(row),
  };
}

function BrandEditor({ brand, onClose, onSaved, notify }) {
  const [nameAr, setNameAr] = useState(brand?.nameAr || '');
  const [nameEn, setNameEn] = useState(brand?.nameEn || '');
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState(brand?.logoUrl || '');
  const [busy, setBusy] = useState(false);
  const useLogo = (file) => {
    setLogo(file);
    setPreview(URL.createObjectURL(file));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!nameAr.trim()) return notify('اسم البراند بالعربي مطلوب.', 'warning');
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set('nameAr', nameAr);
      formData.set('nameEn', nameEn);
      formData.set('settings', JSON.stringify(mergeSettings(brand?.settings)));
      formData.set('logoUrl', brand?.logoUrl || '');
      if (logo) formData.set('logo', logo);
      const url = brand ? '/api/brands/' + brand.id : '/api/brands';
      const result = await request(url, { method: brand ? 'PATCH' : 'POST', body: formData });
      notify(brand ? 'تم حفظ تعديل البراند.' : 'تم إنشاء البراند.');
      onSaved(result.brand);
    } catch (error) {
      notify(error.message, 'warning');
    } finally {
      setBusy(false);
    }
  };
  return <Modal title={brand ? 'تعديل البراند' : 'براند جديد'} subtitle="الاسم والشعار يظهران في كل صفحة من صفحات الكتالوج." onClose={onClose}><form className="modal-form" onSubmit={submit}><UploadZone preview={preview} onFile={useLogo} label="ارفع شعار البراند" note="PNG أو JPG أو WEBP حتى 6MB" compact /><div className="form-grid two"><Field label="اسم البراند بالعربي *"><input value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder="مثال: كات فود" autoFocus /></Field><Field label="اسم البراند بالإنجليزية"><input value={nameEn} dir="ltr" onChange={(event) => setNameEn(event.target.value)} placeholder="CAT FOOD" /></Field></div><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>إلغاء</button><button className="button button-primary" disabled={busy}>{busy ? 'جاري الحفظ…' : brand ? 'حفظ التعديل' : 'إنشاء البراند'}</button></div></form></Modal>;
}

function ProductEditor({ brand, product, title, onClose, onSaved, notify }) {
  const [draft, setDraft] = useState(() => ({ ...emptyProduct(), ...product, variants: product.variants?.length ? product.variants : [emptyVariant()] }));
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const edit = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const editVariant = (id, key, value) => setDraft((current) => ({ ...current, variants: current.variants.map((variant) => variant.id === id ? { ...variant, [key]: value } : variant) }));
  const uploadImage = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('folder', brand.id + '/products');
      const result = await request('/api/upload', { method: 'POST', body: formData });
      edit('imageUrl', result.url);
      notify('تم رفع الصورة إلى Cloudinary.');
    } catch (error) {
      notify(error.message, 'warning');
    } finally {
      setUploading(false);
    }
  };
  const save = async (event) => {
    event.preventDefault();
    if (!draft.nameAr.trim() && !draft.nameEn.trim()) return notify('أدخل اسم المنتج بالعربية أو بالإنجليزية.', 'warning');
    setBusy(true);
    try {
      await onSaved(draft);
    } finally {
      setBusy(false);
    }
  };
  return <Modal title={title} subtitle="يمكنك إضافة أكثر من وزن أو مقاس لنفس صفحة المنتج." onClose={onClose} wide><form className="product-editor" onSubmit={save}><div className="product-editor-main"><UploadZone preview={draft.imageUrl} onFile={uploadImage} label={uploading ? 'جارٍ رفع الصورة…' : 'اسحب صورة المنتج أو اضغط للرفع'} note="تُخزّن الصورة في Cloudinary" /><button type="button" className="text-danger" onClick={() => edit('imageUrl', '')}>إزالة الصورة</button><div className="form-grid two"><Field label="اسم المنتج بالعربي *"><input value={draft.nameAr} onChange={(event) => edit('nameAr', event.target.value)} /></Field><Field label="اسم المنتج بالإنجليزية (Product Name - English)"><input value={draft.nameEn} dir="ltr" onChange={(event) => edit('nameEn', event.target.value)} placeholder="e.g. Quik Cat Litter Lavender" /></Field></div><div className="form-grid two"><Field label="الوصف بالعربي"><textarea value={draft.descriptionAr} onChange={(event) => edit('descriptionAr', event.target.value)} rows={3} /></Field><Field label="الوصف بالإنجليزية"><textarea value={draft.descriptionEn} dir="ltr" onChange={(event) => edit('descriptionEn', event.target.value)} rows={3} /></Field></div><Field label="الباركود"><input value={draft.barcode} dir="ltr" onChange={(event) => edit('barcode', event.target.value.replace(/\s/g, ''))} /></Field></div>
    <section className="variants-editor"><div className="variants-title"><div><h3>الأحجام والأوزان</h3><p>كل صف يمثل مقاسًا أو وزنًا ضمن جدول أسعار صفحة المنتج.</p></div><button type="button" className="button button-ghost" onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, emptyVariant()] }))}><Icon name="plus" size={17} /> إضافة مقاس</button></div><div className="variant-edit-list">{draft.variants.map((variant, index) => <div className="variant-edit-card" key={variant.id}><div className="variant-edit-top"><b>مقاس {index + 1}</b>{draft.variants.length > 1 && <button type="button" className="text-danger" onClick={() => setDraft((current) => ({ ...current, variants: current.variants.filter((item) => item.id !== variant.id) }))}>حذف</button>}</div><div className="form-grid variant-grid"><Field label="الوزن / الحجم"><input value={variant.weight} onChange={(event) => editVariant(variant.id, 'weight', event.target.value)} placeholder="5 L أو 400" /></Field><Field label="الوحدة (Unit)"><select value={normalizeUnit(variant.unit)} onChange={(event) => editVariant(variant.id, 'unit', event.target.value)}><option value="">بدون وحدة</option><option value="g">g (جرام)</option><option value="kg">kg (كيلوجرام)</option><option value="L">L (لتر)</option><option value="ml">ml (مل)</option><option value="pcs">pcs (حبة)</option><option value="oz">oz (أونصة)</option><option value="lb">lb (باوند)</option></select></Field><Field label="الباركود (Barcode)"><input value={variant.sku} dir="ltr" onChange={(event) => editVariant(variant.id, 'sku', event.target.value)} placeholder="8681299606443" /></Field><Field label="عدد الكرتون"><input value={variant.qtyPerCarton} inputMode="numeric" onChange={(event) => editVariant(variant.id, 'qtyPerCarton', event.target.value)} placeholder="1" /></Field><Field label={'سعر الحبة (' + mergeSettings(brand.settings).currency + ')'}><input value={variant.pricePerPiece} inputMode="decimal" onChange={(event) => editVariant(variant.id, 'pricePerPiece', event.target.value)} placeholder="7.83" /></Field><Field label={'سعر الكرتون (' + mergeSettings(brand.settings).currency + ')'}><input value={variant.pricePerCarton} inputMode="decimal" onChange={(event) => editVariant(variant.id, 'pricePerCarton', event.target.value)} placeholder="120.00" /></Field></div></div>)}</div></section><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>إلغاء</button><button className="button button-primary" disabled={busy || uploading}>{busy ? 'جاري الحفظ…' : 'حفظ الصفحة'}</button></div></form></Modal>;
}

const CACHE_BRANDS_KEY = 'catfood_brands_cache_v3';
const CACHE_ACTIVE_KEY = 'catfood_active_brand_cache_v3';

export default function Home() {
  const [view, setView] = useState('dashboard');
  const [brands, setBrands] = useState([]);
  const [activeBrand, setActiveBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [brandModal, setBrandModal] = useState(null);
  const [productModal, setProductModal] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [rawFileState, setRawFileState] = useState(null);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [previewModal, setPreviewModal] = useState(null);
  const [catalogPreviewModal, setCatalogPreviewModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const importInput = useRef(null);
  const pdfRef = useRef(null);
  const notify = useCallback((message, tone = 'success') => setToast({ message, tone }), []);

  const loadBrands = useCallback(async () => {
    const result = await request('/api/brands');
    setBrands(result.brands);
    try {
      localStorage.setItem(CACHE_BRANDS_KEY, JSON.stringify(result.brands));
    } catch {}
    return result.brands;
  }, []);
  const loadBrand = useCallback(async (id) => {
    const result = await request('/api/brands/' + id);
    setActiveBrand(result.brand);
    try {
      localStorage.setItem(CACHE_ACTIVE_KEY, JSON.stringify(result.brand));
    } catch {}
    return result.brand;
  }, []);
  const refresh = useCallback(async (brandId) => {
    const list = await loadBrands();
    const targetId = brandId || activeBrand?.id || list[0]?.id;
    if (targetId) await loadBrand(targetId);
    else setActiveBrand(null);
  }, [activeBrand?.id, loadBrand, loadBrands]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_BRANDS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) setBrands(parsed);
      }
      const cachedActive = localStorage.getItem(CACHE_ACTIVE_KEY);
      if (cachedActive) {
        const parsed = JSON.parse(cachedActive);
        if (parsed && parsed.id) setActiveBrand(parsed);
      }
    } catch {}
    refresh().catch((error) => notify(error.message, 'warning'));
  }, [refresh, notify]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const go = (next) => { setView(next); setMobileMenu(false); };
  const chooseBrand = async (brand) => {
    try {
      await loadBrand(brand.id);
      go('catalog');
    } catch (error) { notify(error.message, 'warning'); }
  };
  const onBrandSaved = async (brand) => {
    setBrandModal(null);
    await refresh(brand.id);
    go('catalog');
  };
  const saveProduct = async (draft) => {
    if (!activeBrand) return;
    try {
      if (productModal?.mode === 'import') {
        setImportRows((current) => current.map((item, index) => index === productModal.index ? draft : item));
        setProductModal(null);
        notify('تم تعديل الصف قبل الإدراج.');
        return;
      }
      if (productModal?.mode === 'edit') {
        await request('/api/products/' + draft.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: activeBrand.id, product: draft }) });
        notify('تم حفظ تعديلات الصفحة.');
      } else {
        await request('/api/brands/' + activeBrand.id + '/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product: draft }) });
        notify('تمت إضافة صفحة المنتج.');
      }
      setProductModal(null);
      await refresh(activeBrand.id);
    } catch (error) { notify(error.message, 'warning'); }
  };
  const duplicateProduct = async (product) => {
    if (!activeBrand) return;
    try {
      const clone = {
        ...product,
        id: newId(),
        nameAr: product.nameAr ? product.nameAr + ' (نسخة)' : '',
        nameEn: product.nameEn ? product.nameEn + ' (Copy)' : '',
        variants: product.variants?.map((v) => ({ ...v, id: newId() })) || [emptyVariant()],
      };
      await request('/api/brands/' + activeBrand.id + '/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: clone }),
      });
      notify('تم نسخ وتكرار صفحة المنتج.');
      await refresh(activeBrand.id);
    } catch (error) {
      notify(error.message, 'warning');
    }
  };
  const removeProduct = async (product) => {
    if (!activeBrand || !window.confirm('حذف صفحة «' + (product.nameAr || product.nameEn) + '»؟')) return;
    try {
      await request('/api/products/' + product.id + '?brandId=' + activeBrand.id, { method: 'DELETE' });
      notify('تم حذف الصفحة.');
      await refresh(activeBrand.id);
    } catch (error) { notify(error.message, 'warning'); }
  };
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
  };
  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (sourceIndex === null || sourceIndex === targetIndex || !activeBrand) return;

    const currentProducts = [...activeBrand.products];
    const [moved] = currentProducts.splice(sourceIndex, 1);
    currentProducts.splice(targetIndex, 0, moved);

    setActiveBrand((curr) => ({ ...curr, products: currentProducts }));
    try {
      setSavingOrder(true);
      await request('/api/brands/' + activeBrand.id + '/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: currentProducts.map((p) => p.id) }),
      });
      notify('تم تحديث ترتيب الصفحات في الكتالوج.');
    } catch (err) {
      notify(err.message || 'تعذر حفظ الترتيب', 'warning');
      await refresh(activeBrand.id);
    } finally {
      setSavingOrder(false);
    }
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  const moveProduct = async (fromIndex, toIndex) => {
    if (!activeBrand || toIndex < 0 || toIndex >= activeBrand.products.length) return;
    const currentProducts = [...activeBrand.products];
    const [moved] = currentProducts.splice(fromIndex, 1);
    currentProducts.splice(toIndex, 0, moved);

    setActiveBrand((curr) => ({ ...curr, products: currentProducts }));
    try {
      setSavingOrder(true);
      await request('/api/brands/' + activeBrand.id + '/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: currentProducts.map((p) => p.id) }),
      });
      notify('تم نقل الصفحة إلى الموضع ' + (toIndex + 1));
    } catch (err) {
      notify(err.message || 'تعذر حفظ الترتيب', 'warning');
      await refresh(activeBrand.id);
    } finally {
      setSavingOrder(false);
    }
  };
  const removeBrand = async (brand) => {
    if (!window.confirm('حذف براند «' + brand.nameAr + '» وكل صفحاته؟')) return;
    try {
      await request('/api/brands/' + brand.id, { method: 'DELETE' });
      notify('تم حذف البراند.');
      await refresh(activeBrand?.id === brand.id ? undefined : activeBrand?.id);
    } catch (error) { notify(error.message, 'warning'); }
  };
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const rows = [[
      'nameAr', 'nameEn', 'descriptionAr', 'descriptionEn', 'barcode', 'weight', 'unit', 'qtyPerCarton', 'pricePerPiece', 'pricePerCarton', 'variants',
    ], [
      'طعام قطط بالدجاج', 'Chicken Cat Food', 'وجبة متوازنة للقطط', 'Balanced meal for adult cats', '6281234567890', '400', 'جم', '12', '85', '1020', '[{"weight":"400","unit":"جم","qtyPerCarton":"12","pricePerPiece":"85","pricePerCarton":"1020"},{"weight":"1","unit":"كجم","qtyPerCarton":"6","pricePerPiece":"180","pricePerCarton":"1080"}]',
    ]];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = rows[0].map((label) => ({ wch: Math.max(label.length + 4, 18) }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Products');
    const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brand-products-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };
  const readExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rawRows.length) throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات.');
      const headers = Object.keys(rawRows[0]);
      const initialMapping = autoDetectMapping(headers);
      setRawFileState({
        filename: file.name,
        headers,
        rows: rawRows,
        mapping: initialMapping,
      });
      setImportRows([]);
      notify('تمت قراءة ' + rawRows.length + ' صف من «' + file.name + '». طابق الأعمدة أدناه واضغط تطبيق للمعاينة.');
    } catch (error) {
      notify(error.message || 'تعذر قراءة ملف Excel.', 'warning');
    } finally {
      event.target.value = '';
    }
  };

  const updateColumnMapping = (fieldKey, colName) => {
    setRawFileState((curr) => curr ? ({
      ...curr,
      mapping: { ...curr.mapping, [fieldKey]: colName }
    }) : null);
  };

  const applyColumnMapping = () => {
    if (!rawFileState) return;
    const { rows, mapping } = rawFileState;
    const mapped = rows
      .map((row) => rowToProductWithMapping(row, mapping))
      .filter((p) => p.nameAr || p.nameEn);
    if (!mapped.length) {
      return notify('يرجى تحديد عامود الاسم العربي أو الإنجليزي على الأقل لتحديد المنتجات.', 'warning');
    }
    setImportRows(mapped);
    notify('تم تجهيز ' + mapped.length + ' صف للمعاينة! راجع الجدول أدناه قبل الإدراج.');
  };

  const resetImport = () => {
    setRawFileState(null);
    setImportRows([]);
  };

  const insertImportRows = async () => {
    if (!activeBrand || !importRows.length) return;
    setBusy(true);
    try {
      const result = await request('/api/brands/' + activeBrand.id + '/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: importRows }) });
      setImportRows([]);
      setRawFileState(null);
      notify('تم إدراج ' + result.products.length + ' صفحة في البراند.');
      await refresh(activeBrand.id);
      go('catalog');
    } catch (error) { notify(error.message, 'warning'); } finally { setBusy(false); }
  };

  const exportDirectPdf = async () => {
    if (!activeBrand?.products?.length || !pdfRef.current) return notify('اختر براندًا يحتوي على صفحة واحدة على الأقل أولًا.', 'warning');
    setBusy(true);
    notify('جاري تجهيز وتصدير كتالوج PDF فائق السرعة…');
    try {
      let css = '';
      for (const style of Array.from(document.querySelectorAll('style'))) {
        css += (style.textContent || '') + '\n';
      }
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.cssRules) {
            for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + '\n';
          }
        } catch {}
      }
      const result = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: pdfRef.current.innerHTML, css }),
      });
      if (!result.ok) {
        const errorData = await result.json().catch(() => ({}));
        throw new Error(errorData.error || 'تعذر إنشاء وتصدير ملف PDF.');
      }
      const blob = await result.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (activeBrand.nameEn || activeBrand.nameAr || 'catalog').replace(/\s+/g, '-') + '-catalog.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('تم تصدير وتحميل كتالوج ' + activeBrand.nameAr + ' بصيغة PDF بنجاح!');
    } catch (error) {
      notify(error.message, 'warning');
    } finally {
      setBusy(false);
    }
  };
  const updateBrandSettings = async (event) => {
    event.preventDefault();
    if (!activeBrand) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set('nameAr', activeBrand.nameAr);
      formData.set('nameEn', activeBrand.nameEn);
      formData.set('logoUrl', activeBrand.logoUrl || '');
      formData.set('settings', JSON.stringify(mergeSettings(activeBrand.settings)));
      await request('/api/brands/' + activeBrand.id, { method: 'PATCH', body: formData });
      notify('تم حفظ إعدادات التصميم.');
      await refresh(activeBrand.id);
    } catch (error) { notify(error.message, 'warning'); } finally { setBusy(false); }
  };
  const updateSettings = (key, value) => setActiveBrand((current) => ({ ...current, settings: { ...mergeSettings(current.settings), [key]: value } }));
  const toggleVisible = (key) => setActiveBrand((current) => ({ ...current, settings: { ...mergeSettings(current.settings), visible: { ...mergeSettings(current.settings).visible, [key]: !mergeSettings(current.settings).visible[key] } } }));

  const products = activeBrand?.products || [];
  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => [product.nameAr, product.nameEn, product.barcode].some((value) => value && value.toLowerCase().includes(term)));
  }, [products, query]);
  const nav = [{ id: 'dashboard', label: 'لوحة التحكم', icon: 'grid' }, { id: 'brands', label: 'البراندات', icon: 'tag', count: brands.length }, { id: 'catalog', label: 'صفحات البراند', icon: 'folder', disabled: !activeBrand, count: products.length }, { id: 'import', label: 'استيراد Excel', icon: 'upload', disabled: !activeBrand }, { id: 'settings', label: 'إعدادات البراند', icon: 'settings', disabled: !activeBrand }];

  return <main className="studio-shell" suppressHydrationWarning>
    <aside className={['app-sidebar', mobileMenu && 'is-open'].filter(Boolean).join(' ')}><div className="sidebar-brand"><span className="brand-mark">C</span><div><strong>Catalog Studio</strong><small>لوحة إدارة الكتالوجات</small></div></div><nav className="sidebar-nav">{nav.map((item) => <button key={item.id} disabled={item.disabled} className={view === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}</button>)}</nav><div className="sidebar-active-brand">{activeBrand ? <><BrandBadge brand={activeBrand} /><div><small>البراند النشط</small><strong>{activeBrand.nameAr}</strong></div></> : <span>أنشئ براندًا للبدء</span>}</div></aside>{mobileMenu && <button className="sidebar-backdrop" onClick={() => setMobileMenu(false)} aria-label="إغلاق القائمة" />}
    <section className="workspace"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileMenu(true)}><Icon name="menu" /></button><div><p className="eyebrow">BRAND CATALOG MANAGER</p><h1>{view === 'dashboard' ? 'لوحة التحكم' : view === 'brands' ? 'البراندات' : view === 'catalog' ? 'صفحات كتالوج ' + (activeBrand?.nameAr || '') : view === 'import' ? 'استيراد ومراجعة الملف' : 'إعدادات التصميم'}</h1></div><div className="topbar-actions"><button className="button button-ghost" onClick={() => setBrandModal({})}><Icon name="plus" size={17} /> <span>براند جديد</span></button>{activeBrand && <button className="button button-primary btn-direct-export" disabled={busy || !products.length} onClick={exportDirectPdf} title="تصدير وتحميل ملف PDF المباشر فائق السرعة"><Icon name="download" size={17} /> <span>{busy ? 'جاري التصدير…' : '⚡ تصدير PDF مباشر'}</span></button>}</div></header>
      {view === 'dashboard' && <section className="page-shell dashboard"><div className="dashboard-hero"><div><p className="eyebrow">MULTI-BRAND CATALOGS</p><h2>كل براند ومنتجاته في مكان واحد.</h2><p>أنشئ براند، ارفع الشعار، راجع Excel قبل الإدراج، ثم عدّل أي صفحة يدويًا وصدّر كتالوج PDF.</p><div className="hero-actions"><button className="button button-primary" onClick={() => setBrandModal({})}><Icon name="plus" size={18} /> براند جديد</button>{activeBrand && <button className="button button-ghost" onClick={() => go('catalog')}><Icon name="folder" size={18} /> فتح الصفحات</button>}</div></div><div className="dashboard-brand-card">{activeBrand ? <><BrandBadge brand={activeBrand} large /><div><span>البراند النشط</span><strong>{activeBrand.nameAr}</strong><small>{products.length} صفحة منتج</small></div></> : <><span className="hero-icon"><Icon name="tag" size={27} /></span><p>لا يوجد براند نشط</p></>}</div></div><div className="stats-grid"><Stat icon="tag" label="إجمالي البراندات" value={brands.length} /><Stat icon="file" label="صفحات البراند النشط" value={products.length} /><Stat icon="image" label="صور محفوظة" value={products.filter((item) => item.imageUrl).length} /><Stat icon="grid" label="مقاسات مسجلة" value={products.reduce((total, item) => total + (item.variants?.length || 0), 0)} /></div><section className="dashboard-section"><div className="section-bar"><div><h2>آخر البراندات</h2><p>اختر براندًا لتعديل صفحاته أو إعداداته.</p></div><button className="button button-ghost" onClick={() => go('brands')}>كل البراندات <Icon name="arrow" size={16} /></button></div>{brands.length ? <div className="brand-grid">{brands.slice(0, 4).map((brand) => <BrandCard key={brand.id} brand={brand} selected={activeBrand?.id === brand.id} onOpen={() => chooseBrand(brand)} onEdit={() => setBrandModal(brand)} />)}</div> : <EmptyState onNew={() => setBrandModal({})} />}</section></section>}
      {view === 'brands' && <section className="page-shell"><div className="section-bar"><div><h2>إدارة البراندات</h2><p>أضف براندات متعددة وغيّر الشعار والهوية في أي وقت.</p></div><button className="button button-primary" onClick={() => setBrandModal({})}><Icon name="plus" size={18} /> براند جديد</button></div>{brands.length ? <div className="brand-grid brand-grid--full">{brands.map((brand) => <BrandCard key={brand.id} brand={brand} selected={activeBrand?.id === brand.id} onOpen={() => chooseBrand(brand)} onEdit={() => setBrandModal(brand)} onDelete={() => removeBrand(brand)} />)}</div> : <EmptyState onNew={() => setBrandModal({})} />}</section>}
      {view === 'catalog' && <section className="page-shell">{activeBrand ? <><div className="catalog-toolbar"><div className="brand-page-heading"><BrandBadge brand={activeBrand} large /><div><div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}><h2>{activeBrand.nameAr}</h2>{brands.length > 1 && <select className="brand-select-dropdown" value={activeBrand.id} onChange={(e) => { const found = brands.find((b) => b.id === e.target.value); if (found) chooseBrand(found); }} title="التبديل بين كتالوجات البراندات">{brands.map((b) => <option key={b.id} value={b.id}>{b.nameAr} {b.nameEn ? '(' + b.nameEn + ')' : ''}</option>)}</select>}</div><p>{activeBrand.nameEn || 'Product catalog'} · كتالوج كامل بـ {products.length} صفحة</p></div></div><div className="catalog-toolbar-actions"><label className="search-box"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث بالاسم أو الباركود" /></label><button className="button button-ghost" onClick={() => setCatalogPreviewModal(true)} disabled={!products.length} title="معاينة صفحات الكتالوج بالكامل"><Icon name="eye" size={18} /> معاينة الكتالوج</button><button className="button button-ghost" onClick={() => go('import')}><Icon name="upload" size={18} /> استيراد Excel</button><button className="button button-primary" onClick={() => setProductModal({ mode: 'new', product: emptyProduct() })}><Icon name="plus" size={18} /> صفحة جديدة</button><button className="button button-primary btn-direct-export" disabled={busy || !products.length} onClick={exportDirectPdf} title="تصدير وتحميل ملف PDF المباشر فائق السرعة"><Icon name="download" size={18} /> <span>{busy ? 'جاري التصدير…' : '⚡ تصدير PDF مباشر (' + products.length + ')'}</span></button></div></div>{products.length > 1 && !query && <div className="catalog-reorder-banner"><span><Icon name="grip" size={16} />اسحب وأفلت أي كرت لإعادة ترتيب موضع الصفحات في الكتالوج، أو استخدم أزرار الأسهم. الترتيب ينعكس تلقائياً في ملف PDF.</span>{savingOrder && <small>جاري حفظ الترتيب…</small>}</div>}{products.length ? <><div className="product-grid">{filteredProducts.map((product, idx) => { const actualIndex = products.findIndex((p) => p.id === product.id); return <ProductCard key={product.id} brand={activeBrand} product={product} index={actualIndex >= 0 ? actualIndex : idx} total={products.length} isDragging={draggedIndex === actualIndex} isDragOver={dragOverIndex === actualIndex} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} onDragEnd={handleDragEnd} onMoveUp={() => moveProduct(actualIndex, actualIndex - 1)} onMoveDown={() => moveProduct(actualIndex, actualIndex + 1)} onPreview={() => setPreviewModal(product)} onEdit={() => setProductModal({ mode: 'edit', product })} onDuplicate={() => duplicateProduct(product)} onDelete={() => removeProduct(product)} />; })}</div>{!filteredProducts.length && <div className="search-empty">لا توجد صفحات تطابق البحث.</div>}</> : <EmptyState onNew={() => setProductModal({ mode: 'new', product: emptyProduct() })} onImport={() => go('import')} />}</> : <NeedsBrand onCreate={() => setBrandModal({})} />}</section>}
      {view === 'import' && <section className="page-shell import-page">{activeBrand ? <><div className="import-hero"><span className="hero-icon"><Icon name="upload" size={27} /></span><p className="eyebrow">EXCEL COLUMN MAPPING & PREVIEW</p><h2>استيراد صفحات {activeBrand.nameAr}</h2><p>ارفع ملف Excel، حدد مطابقة كل عامود مع العنصر المناسب له، عاين البيانات، ثم أدرج الصفحات في الكتالوج.</p></div>{!rawFileState && !importRows.length && <div className="import-actions"><button className="import-card" onClick={downloadTemplate}><span><Icon name="download" size={23} /></span><div><strong>1. تنزيل قالب Excel</strong><p>يشمل الأعمدة الافتراضية وحقل variants للمقاسات المتعددة.</p></div><Icon name="arrow" size={19} /></button><button className="import-card" onClick={() => importInput.current?.click()}><span><Icon name="upload" size={23} /></span><div><strong>2. اختيار ملف Excel</strong><p>يدعم أي ملف XLSX أو XLS بأي ترتيب للأعمدة ويفتح واجهة المطابقة.</p></div><Icon name="arrow" size={19} /></button><input ref={importInput} type="file" accept=".xlsx,.xls" onChange={readExcel} /></div>}{rawFileState && !importRows.length && <section className="import-mapping"><div className="mapping-header"><div><h3><Icon name="tag" size={18} /> تحديد ومطابقة أعمدة الملف</h3><p>اختر لكل عنصر في الكتالوج العامود المقابل له في ملف Excel المرفوع:</p></div><div className="mapping-file-info"><span className="mapping-badge">الملف: {rawFileState.filename} ({rawFileState.rows.length} صف)</span><button className="button button-ghost" onClick={resetImport}>إلغاء الملف</button></div></div><div className="mapping-grid">{MAPPABLE_FIELDS.map((field) => <div key={field.key} className={['mapping-field-card', field.required && 'is-required'].filter(Boolean).join(' ')}><div className="mapping-field-label"><span>{field.label}</span>{field.required ? <span className="req">مطلوب</span> : <small className="mapping-field-hint">{field.hint}</small>}</div><select className="mapping-select" value={rawFileState.mapping[field.key] || ''} onChange={(e) => updateColumnMapping(field.key, e.target.value)}><option value="">-- تجاهل هذا الحقل --</option>{rawFileState.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>)}</div><div className="mapping-preview-section"><h4>معاينة حية للمطابقة (أول {Math.min(3, rawFileState.rows.length)} صفوف):</h4><div className="table-wrap"><table><thead><tr><th>الاسم بالعربي</th><th>الاسم بالإنجليزي</th><th>سعر الحبة</th><th>سعر الكرتون</th><th>عدد الكرتون</th><th>الوزن / الحجم</th><th>الباركود</th></tr></thead><tbody>{rawFileState.rows.slice(0, 3).map((r, i) => { const p = rowToProductWithMapping(r, rawFileState.mapping); const v = p.variants[0] || {}; return <tr key={i}><td><strong>{p.nameAr || '—'}</strong></td><td>{p.nameEn || '—'}</td><td>{v.pricePerPiece || '—'}</td><td>{v.pricePerCarton || '—'}</td><td>{v.qtyPerCarton || '—'}</td><td>{v.weight ? (v.weight + ' ' + (v.unit || '')) : '—'}</td><td dir="ltr">{p.barcode || '—'}</td></tr>; })}</tbody></table></div></div><div className="mapping-actions-bar"><button className="button button-ghost" onClick={resetImport}>إلغاء واختيار ملف آخر</button><button className="button button-primary" onClick={applyColumnMapping}><Icon name="check" size={17} /> تطبيق المطابقة ومعاينة البيانات ({rawFileState.rows.length} صف)</button></div></section>}{importRows.length > 0 && <section className="import-review"><div className="review-header"><div><h3>معاينة البيانات قبل الإدراج</h3><p>{importRows.length} صف جاهز للمراجعة. يمكنك تعديل أي صف أو حذفه، ثم الضغط على إدراج الصفحات في الكتالوج.</p></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{rawFileState && <button className="button button-ghost" onClick={() => setImportRows([])} title="العودة لشاشة مطابقة وتحديد الأعمدة"><Icon name="settings" size={15} /> تعديل مطابقة الأعمدة</button>}<button className="button button-ghost" onClick={resetImport}>إلغاء الملف</button><button className="button button-primary" disabled={busy} onClick={insertImportRows}><Icon name="check" size={17} /> {busy ? 'جاري الإدراج…' : 'إدراج ' + importRows.length + ' صفحة'}</button></div></div><div className="table-wrap"><table><thead><tr><th>المنتج</th><th>المقاسات</th><th>الباركود</th><th>إجراء</th></tr></thead><tbody>{importRows.map((row, index) => <tr key={row.id}><td><strong>{row.nameAr || 'بدون اسم عربي'}</strong><small>{row.nameEn}</small></td><td>{row.variants.map((variant) => variant.weight ? variant.weight + ' ' + normalizeUnit(variant.unit) : '—').join('، ')}</td><td dir="ltr">{row.barcode || '—'}</td><td><button className="table-action" onClick={() => setProductModal({ mode: 'import', index, product: row })}><Icon name="edit" size={15} /> تعديل</button><button className="table-action danger" onClick={() => setImportRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="trash" size={15} /> حذف</button></td></tr>)}</tbody></table></div></section>}</> : <NeedsBrand onCreate={() => setBrandModal({})} />}</section>}
      {view === 'settings' && <section className="page-shell settings-page">{activeBrand ? <form className="settings-card" onSubmit={updateBrandSettings}><div className="settings-intro"><p className="eyebrow">ACTIVE BRAND DESIGN</p><h2>إعدادات {activeBrand.nameAr}</h2><p>تُطبّق على المعاينة وجميع صفحات PDF للبراند الحالي.</p></div><div className="settings-section"><h3>التذييل والعملة</h3><div className="form-grid two"><Field label="نص التذييل"><input value={mergeSettings(activeBrand.settings).footerText} onChange={(event) => updateSettings('footerText', event.target.value)} /></Field><Field label="رمز العملة"><input value={mergeSettings(activeBrand.settings).currency} onChange={(event) => updateSettings('currency', event.target.value)} /></Field></div></div><div className="settings-section"><h3>الحقول الظاهرة في صفحة المنتج</h3><div className="visibility-options">{[{ key: 'description', label: 'الوصف' }, { key: 'prices', label: 'سعر الحبة' }, { key: 'cartonPrice', label: 'سعر الكرتون' }, { key: 'carton', label: 'عدد الكرتون' }, { key: 'barcode', label: 'الباركود' }].map((option) => <label key={option.key} className="switch-row"><span>{option.label}</span><input type="checkbox" checked={mergeSettings(activeBrand.settings).visible[option.key] !== false} onChange={() => toggleVisible(option.key)} /><i /></label>)}</div></div><div className="settings-save"><button className="button button-primary" disabled={busy}><Icon name="check" size={18} />{busy ? 'جاري الحفظ…' : 'حفظ الإعدادات'}</button></div></form> : <NeedsBrand onCreate={() => setBrandModal({})} />}</section>}
    </section>
    <div className="pdf-stage" ref={pdfRef} aria-hidden="true">
      {activeBrand && (
        <>
          <CatalogWelcomeSheet brand={activeBrand} />
          {activeBrand?.products?.map((product) => (
            <ProductSheet key={product.id} brand={activeBrand} product={product} />
          ))}
          <CatalogClosingSheet brand={activeBrand} />
        </>
      )}
    </div>
    {brandModal && <BrandEditor brand={brandModal.id ? brandModal : null} onClose={() => setBrandModal(null)} onSaved={onBrandSaved} notify={notify} />}
    {productModal && activeBrand && <ProductEditor brand={activeBrand} product={productModal.product} title={productModal.mode === 'edit' ? 'تعديل صفحة المنتج' : productModal.mode === 'import' ? 'تعديل صف الملف المستورد' : 'صفحة منتج جديدة'} onClose={() => setProductModal(null)} onSaved={saveProduct} notify={notify} />}
    {previewModal && activeBrand && (
      <Modal
        title={'معاينة صفحة: ' + (previewModal.nameAr || previewModal.nameEn || 'صفحة الكتالوج')}
        subtitle={'الصفحة ' + (products.findIndex((p) => p.id === previewModal.id) + 2) + ' من ' + (products.length + 2) + ' في كتالوج ' + activeBrand.nameAr}
        onClose={() => setPreviewModal(null)}
        wide
      >
        <div className="sheet-preview-modal-body">
          <ProductSheet brand={activeBrand} product={previewModal} />
        </div>
      </Modal>
    )}
    {catalogPreviewModal && activeBrand && (
      <Modal
        title={'معاينة كتالوج: ' + activeBrand.nameAr}
        subtitle={'إجمالي ' + (products.length + 2) + ' صفحة (صفحة الترحيب + ' + products.length + ' صفحة منتج + صفحة الختام)'}
        onClose={() => setCatalogPreviewModal(false)}
        wide
      >
        <div className="catalog-preview-scroll">
          <div className="catalog-preview-page-wrap">
            <div className="catalog-preview-page-header">
              <strong>صفحة 1 (صفحة الترحيب)</strong>
              <span>{activeBrand.nameAr}</span>
            </div>
            <CatalogWelcomeSheet brand={activeBrand} />
          </div>

          {products.map((prod, idx) => (
            <div key={prod.id} className="catalog-preview-page-wrap">
              <div className="catalog-preview-page-header">
                <strong>صفحة {idx + 2}</strong>
                <span>{prod.nameAr || prod.nameEn}</span>
              </div>
              <ProductSheet brand={activeBrand} product={prod} />
            </div>
          ))}

          <div className="catalog-preview-page-wrap">
            <div className="catalog-preview-page-header">
              <strong>صفحة {products.length + 2} (صفحة الختام)</strong>
              <span>خدمتكم تسعدنا</span>
            </div>
            <CatalogClosingSheet brand={activeBrand} />
          </div>
        </div>
      </Modal>
    )}
    <nav className="mobile-bottom-bar" aria-label="شريط التنقل السريع">
      {nav.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          className={['bottom-bar-item', view === item.id && 'is-active'].filter(Boolean).join(' ')}
          onClick={() => {
            setMobileMenu(false);
            go(item.id);
          }}
          title={item.label}
        >
          <div className="bottom-bar-icon-wrap">
            <Icon name={item.icon} size={20} />
            {item.count !== undefined && item.count > 0 && <span className="bottom-bar-badge">{item.count}</span>}
          </div>
          <span className="bottom-bar-label">{item.label}</span>
        </button>
      ))}
    </nav>
    {toast && <div className={['toast', toast.tone].join(' ')} role="status"><Icon name={toast.tone === 'success' ? 'check' : 'settings'} size={18} />{toast.message}<button onClick={() => setToast(null)} aria-label="إغلاق"><Icon name="close" size={16} /></button></div>}
  </main>;
}

function Stat({ icon, label, value }) {
  return <article className="stat-card"><span><Icon name={icon} size={20} /></span><div><strong>{value}</strong><p>{label}</p></div></article>;
}

function BrandCard({ brand, selected, onOpen, onEdit, onDelete }) {
  return <article className={['brand-card', selected && 'selected'].filter(Boolean).join(' ')}><div className="brand-card-top"><BrandBadge brand={brand} large /><button className="icon-button" onClick={onEdit} aria-label="تعديل البراند"><Icon name="edit" size={17} /></button></div><h3>{brand.nameAr}</h3><p>{brand.nameEn || 'بدون اسم إنجليزي'}</p><div className="brand-card-meta"><span><Icon name="file" size={15} /> {brand.productCount} صفحة</span><span>مخزن على Neon</span></div><div className="brand-card-actions"><button className="button button-primary" onClick={onOpen}>فتح البراند <Icon name="arrow" size={16} /></button>{onDelete && <button className="mini-danger" onClick={onDelete} aria-label="حذف البراند"><Icon name="trash" size={17} /></button>}</div></article>;
}

function EmptyState({ onNew, onImport }) {
  return <div className="empty-state"><span><Icon name="folder" size={31} /></span><h3>لا توجد صفحات بعد</h3><p>أنشئ صفحة منتج يدويًا أو استورد ملف Excel مع معاينة وتعديل قبل الإدراج.</p><div><button className="button button-primary" onClick={onNew}><Icon name="plus" size={18} /> صفحة جديدة</button>{onImport && <button className="button button-ghost" onClick={onImport}><Icon name="upload" size={18} /> استيراد Excel</button>}</div></div>;
}

function NeedsBrand({ onCreate }) {
  return <div className="empty-state"><span><Icon name="tag" size={31} /></span><h3>أنشئ أو اختر براندًا أولًا</h3><p>كل منتج وكل صفحة في النظام مرتبطان ببراند مستقل وشعاره وإعداداته الخاصة.</p><button className="button button-primary" onClick={onCreate}><Icon name="plus" size={18} /> براند جديد</button></div>;
}
