'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  UNIT_MAP,
  normalizeUnit,
  extractUnitFromWeight,
  MAPPABLE_FIELDS,
  autoDetectMapping,
  getTableColumns,
  computeProductLayout,
  getVariantsPerPage,
  paginateProductVariants,
} from '../lib/catalog-helpers';

const DEFAULT_SETTINGS = {
  footerText: 'السعر غير شامل الضريبة',
  currency: 'ج.م',
  visible: { description: true, prices: true, cartonPrice: true, carton: true, barcode: true },
};

const newId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
const emptyVariant = () => ({ id: newId(), weight: '', unit: 'g', sku: '', qtyPerCarton: '', pricePerPiece: '', pricePerCarton: '' });
const emptyProduct = () => ({ id: newId(), nameAr: '', nameEn: '', categoryAr: '', categoryEn: '', descriptionAr: '', descriptionEn: '', barcode: '', imageUrl: '', variants: [emptyVariant()] });
const mergeSettings = (settings) => ({ ...DEFAULT_SETTINGS, ...(settings || {}), visible: { ...DEFAULT_SETTINGS.visible, ...((settings || {}).visible || {}) } });
const price = (value, currency) => value === '' || value === undefined ? '—' : String(value) + ' ' + currency;
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

function Icon({ name, size = 20 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const shapes = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    tag: <><path d="M20 13 11 22 2 13V4h9Z" /><circle cx="7" cy="9" r="1" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    upload: <><path d="M12 16V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
    download: <><path d="M12 3v13" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></>,
    folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    folderOpen: <><path d="m6 14 1.5-6h13l-2.5 10H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v3" /></>,
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
    columns1: <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" stroke="none" />,
    columns2: <><rect x="3.5" y="4" width="7.5" height="16" rx="2" fill="currentColor" stroke="none" /><rect x="13" y="4" width="7.5" height="16" rx="2" fill="currentColor" stroke="none" /></>,
    square: <rect x="3" y="3" width="18" height="18" rx="4" />,
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

async function optimizeImageForUpload(file) {
  if (!file || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const optimized = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
            resolve(optimized);
          } else {
            resolve(file);
          }
        },
        'image/webp',
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function UploadZone({ preview, onFile, label, note, compact = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    onFile(file);
  };
  return <div className={['upload-zone', compact && 'upload-zone--compact', dragging && 'is-dragging', preview && 'has-preview'].filter(Boolean).join(' ')} role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files?.[0]); }}>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => handleFile(event.target.files?.[0])} />
    {preview ? <img src={preview} alt="معاينة" /> : <><Icon name="upload" size={compact ? 22 : 28} /><strong>{label}</strong><span>{note}</span></>}
  </div>;
}

function expandDescriptionBoxes(container) {
  if (!container) return;
  const boxes = Array.from(container.querySelectorAll('.cf-desc-box'));
  if (!boxes.length) return;

  let maxNeeded = 0;
  boxes.forEach((box) => {
    const textAr = box.querySelector('.cf-desc-ar-text');
    const textEn = box.querySelector('.cf-desc-en-text');
    const textEl = textAr || textEn;
    if (!textEl) return;

    const isArabic = Boolean(textAr);
    textEl.style.fontSize = isArabic ? '11pt' : '13pt';
    textEl.style.lineHeight = isArabic ? '16.5pt' : '15pt';

    const needed = Number((textEl.scrollHeight + 5).toFixed(1));
    if (needed > maxNeeded) {
      maxNeeded = needed;
    }
  });

  if (maxNeeded > 0) {
    const firstBox = boxes[0];
    const currentHeight = parseFloat(firstBox.style.height) || 0;
    const delta = maxNeeded - currentHeight;

    if (delta > 0.5) {
      boxes.forEach((box) => {
        const currentTop = parseFloat(box.style.top) || 0;
        box.style.height = `${maxNeeded}pt`;
        // Grow UPWARDS: shift top upwards by delta to anchor bottom and prevent table overlap
        box.style.top = `${currentTop - delta}pt`;
      });

      // Reduce image card height above description to maintain balance
      const card = container.querySelector('.cf-image-card');
      if (card) {
        const currentCardHeight = parseFloat(card.style.height) || 0;
        const newCardHeight = Math.max(120.0, currentCardHeight - delta);
        card.style.height = `${newCardHeight}pt`;
        const img = card.querySelector('.cf-product-image-img');
        if (img) {
          img.style.maxHeight = `${newCardHeight - 48}pt`;
        }
      }

      // Shift name labels upwards with the card bottom
      const nameAr = container.querySelector('.cf-name-ar');
      if (nameAr) {
        const currentNameArTop = parseFloat(nameAr.style.top) || 0;
        nameAr.style.top = `${currentNameArTop - delta}pt`;
      }
      const pill = container.querySelector('.cf-name-pill');
      if (pill) {
        const currentPillTop = parseFloat(pill.style.top) || 0;
        pill.style.top = `${currentPillTop - delta}pt`;
      }
    }
  }
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
      <div className="cf-header-ar">كات فوود</div>
      <div className="cf-header-en">CAT FOOD</div>

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

function ProductSheet({ brand, product, variants: customVariants }) {
  const brandAr = brand?.nameAr || 'كـات فـود';
  const brandEn = brand?.nameEn || 'CAT FOOD';
  const settings = mergeSettings(brand?.settings);
  const variants = customVariants || (product.variants?.length ? product.variants : [emptyVariant()]);

  const layout = computeProductLayout(product, settings, variants);
  const columns = getTableColumns(settings.visible, variants);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (sheetRef.current) {
      expandDescriptionBoxes(sheetRef.current);
    }
  }, [product.descriptionAr, product.descriptionEn, layout.descHeight]);

  return (
    <article ref={sheetRef} className="catfood-page" data-page="product" aria-label={product.nameAr || product.nameEn || 'صفحة المنتج'}>
      {/* Header Band */}
      <div className="cf-header-band" />
      <div className="cf-header-ar">كات فوود</div>
      <div className="cf-header-en">CAT FOOD</div>

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
          <span>{product.nameAr.trim()}</span>
        </div>
      )}
      {product.nameEn && (
        <div className="cf-name-pill" style={{ top: `${layout.pillTop}pt` }}>
          <span>{product.nameEn.trim()}</span>
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
                  borderRadius: '36.9pt',
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
                  borderRadius: '36.9pt',
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
                borderRadius: '36.9pt',
              }}
            >
              <div className="cf-desc-ar-text">
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
                borderRadius: '36.9pt',
              }}
            >
              <div className="cf-desc-en-text">
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

function SortableProductCard({
  brand,
  product,
  index,
  total,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onMoveUp,
  onMoveDown,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={['sortable-item-wrap', isDragging && 'is-sortable-dragging'].filter(Boolean).join(' ')}
    >
      <ProductCard
        brand={brand}
        product={product}
        index={index}
        total={total}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onPreview={onPreview}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ProductCard({
  brand,
  product,
  index,
  total,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
  isOverlay = false,
}) {
  return (
    <article className={['product-card', isOverlay && 'is-drag-overlay', isSelected && 'is-card-selected'].filter(Boolean).join(' ')} data-id={product.id}>
      <div className="product-card-topbar">
        {!isOverlay && onToggleSelect && (
          <button
            type="button"
            className={['card-select-btn', isSelected && 'is-selected'].filter(Boolean).join(' ')}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(product.id);
            }}
            title={isSelected ? 'إلغاء تحديد الصفحة' : 'تحديد الصفحة'}
            aria-label="تحديد الصفحة"
          >
            <Icon name={isSelected ? 'check' : 'square'} size={13} />
          </button>
        )}
        <div className="drag-handle" title="اسحب لإعادة ترتيب موضع الصفحة في الكتالوج" {...dragHandleProps}>
          <Icon name="grip" size={14} />
          <span className="page-order-badge">صفحة {index + 1}</span>
        </div>
        {!isOverlay && (
          <div className="card-top-actions">
            <button
              type="button"
              className="card-top-btn"
              onClick={onPreview}
              title="معاينة شكل الصفحة A4"
              aria-label="معاينة الصفحة"
            >
              <Icon name="eye" size={14} />
            </button>
            <button
              type="button"
              className="card-top-btn"
              onClick={onDuplicate}
              title="تكرار الصفحة"
              aria-label="تكرار الصفحة"
            >
              <Icon name="copy" size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="product-card-hero" onClick={onPreview} title="معاينة شكل الصفحة A4" style={{ cursor: 'pointer' }}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.nameAr || ''} loading="lazy" />
        ) : (
          <div className="product-card-placeholder">
            <Icon name="image" size={38} />
            <span>معاينة الصفحة</span>
          </div>
        )}
      </div>

      <div className="product-card-content">
        <h3 className="product-card-title" title={product.nameAr}>
          {product.nameAr || 'صفحة بدون اسم'}
        </h3>
        <p className="product-card-sub" title={product.nameEn}>
          {product.nameEn || '—'}
        </p>
        {product.barcode && (
          <div className="product-card-barcode-wrap">
            <span className="product-card-barcode" dir="ltr">#{product.barcode}</span>
          </div>
        )}
      </div>

      <div className="product-card-footer">
        <button
          type="button"
          className="btn-card-action btn-card-edit"
          onClick={onEdit}
          title="تعديل صفحة المنتج"
          aria-label="تعديل"
        >
          <span className="btn-card-text">تعديل</span>
        </button>
        <button
          type="button"
          className="btn-card-action btn-card-danger"
          onClick={onDelete}
          title="حذف الصفحة"
          aria-label="حذف"
        >
          <Icon name="trash" size={13} />
          <span className="btn-card-text">حذف</span>
        </button>
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
        <div className="modal-sheet-handle" aria-hidden="true" />
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

function ScaledPageWrapper({ children, scale }) {
  const widthPt = 595.28;
  const heightPt = 841.89;

  return (
    <div
      className="scaled-page-wrapper"
      style={{
        width: `${widthPt * scale}pt`,
        height: `${heightPt * scale}pt`,
        maxWidth: '100%',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="scaled-page-inner"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${widthPt}pt`,
          height: `${heightPt}pt`,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PreviewToolbar({ zoom, setZoom, autoScale }) {
  const currentScale = typeof zoom === 'number' ? zoom : autoScale;
  return (
    <div className="catalog-preview-toolbar">
      <div className="zoom-toggle-group">
        <button
          type="button"
          className={['zoom-pill-btn', zoom === 'fit' && 'is-active'].filter(Boolean).join(' ')}
          onClick={() => setZoom('fit')}
        >
          ملاءمة الشاشة (عرض كامل)
        </button>
        <button
          type="button"
          className={['zoom-pill-btn', zoom === 1 && 'is-active'].filter(Boolean).join(' ')}
          onClick={() => setZoom(1)}
        >
          الحجم الفعلي (100%)
        </button>
      </div>
      <div className="zoom-controls">
        <button
          type="button"
          className="zoom-step-btn"
          onClick={() => setZoom(Math.max(0.15, Number((currentScale - 0.10).toFixed(2))))}
          title="تصغير"
        >
          -
        </button>
        <span className="zoom-display-text">{Math.round(currentScale * 100)}%</span>
        <button
          type="button"
          className="zoom-step-btn"
          onClick={() => setZoom(Math.min(2.0, Number((currentScale + 0.10).toFixed(2))))}
          title="تكبير"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({ config, onClose }) {
  if (!config) return null;
  const { title, message, confirmText = 'تأكيد الحذف', cancelText = 'إلغاء', tone = 'danger', onConfirm } = config;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="confirm-modal-box" role="dialog" aria-modal="true" aria-label={title}>
        <div className={['confirm-icon-circle', tone === 'danger' ? 'is-danger' : 'is-primary'].filter(Boolean).join(' ')}>
          <Icon name={tone === 'danger' ? 'trash' : 'check'} size={24} />
        </div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={['button', tone === 'danger' ? 'button-danger' : 'button-primary'].join(' ')}
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
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

function BrandEditor({ brand, brands = [], onClose, onSaved, notify }) {
  const [nameAr, setNameAr] = useState(brand?.nameAr || '');
  const [nameEn, setNameEn] = useState(brand?.nameEn || '');
  const [logo, setLogo] = useState(null);
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl || '');
  const [preview, setPreview] = useState(brand?.logoUrl || '');
  const [busy, setBusy] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const logoInputRef = useRef(null);

  const handleDeviceUpload = async (file) => {
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploadingLogo(true);
    try {
      const optimized = await optimizeImageForUpload(file);
      const formData = new FormData();
      formData.set('file', optimized);
      formData.set('folder', (brand?.id || 'general') + '/logos');
      if (brand?.id) formData.set('brandId', brand.id);
      const result = await request('/api/upload', { method: 'POST', body: formData });
      setLogoUrl(result.url);
      setPreview(result.url);
      setLogo(null);
      notify('تم رفع الشعار وإضافته إلى المعرض بنجاح.');
    } catch (err) {
      setLogo(file);
      notify('سيتم رفع الشعار عند حفظ البراند.', 'info');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSelectFromGallery = (url) => {
    setLogoUrl(url);
    setPreview(url);
    setLogo(null);
    setShowMediaPicker(false);
    notify('تم اختيار الشعار من المعرض بنجاح.');
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    setPreview('');
    setLogo(null);
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
      formData.set('logoUrl', logoUrl);
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

  return (
    <>
      <Modal title={brand ? 'تعديل البراند' : 'براند جديد'} subtitle="الاسم والشعار يظهران في كل صفحة من صفحات الكتالوج." onClose={onClose}>
        <form className="modal-form" onSubmit={submit}>
          <div className="product-image-section">
            <label className="field-label">شعار البراند</label>
            {preview ? (
              <div className="product-image-active-box" style={{ background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: '10px', padding: '14px' }}>
                <div className="product-image-preview-wrap" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '90px' }}>
                  <img src={preview} alt="شعار البراند" style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
                  {uploadingLogo && <div className="product-image-uploading-overlay">جارٍ الرفع…</div>}
                </div>
                <div className="product-image-active-actions" style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setShowMediaPicker(true)}
                  >
                    <Icon name="image" size={15} /> اختيار من المعرض
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Icon name="upload" size={15} /> رفع من الجهاز
                  </button>
                  <button
                    type="button"
                    className="button button-ghost text-danger"
                    onClick={handleRemoveLogo}
                  >
                    <Icon name="trash" size={15} /> إزالة الشعار
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="product-image-empty-dropzone"
                style={{ padding: '16px', textAlign: 'center', border: '1.5px dashed #d4d4d8', borderRadius: '10px', background: '#fafafa' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleDeviceUpload(e.dataTransfer.files[0]);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: '#71717a' }}>
                  <Icon name="image" size={28} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#09090b' }}>اختر شعار البراند</strong>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>اختر من صور المعرض أو ارفع شعاراً من جهازك مباشرة</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setShowMediaPicker(true)}
                  >
                    <Icon name="image" size={15} /> اختيار من المعرض
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Icon name="upload" size={15} /> رفع من الجهاز
                  </button>
                </div>
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) handleDeviceUpload(e.target.files[0]);
              }}
            />
          </div>

          <div className="form-grid two">
            <Field label="اسم البراند بالعربي *">
              <input value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder="مثال: كات فود" autoFocus />
            </Field>
            <Field label="اسم البراند بالإنجليزية">
              <input value={nameEn} dir="ltr" onChange={(event) => setNameEn(event.target.value)} placeholder="CAT FOOD" />
            </Field>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>إلغاء</button>
            <button className="button button-primary" disabled={busy || uploadingLogo}>{busy ? 'جاري الحفظ…' : brand ? 'حفظ التعديل' : 'إنشاء البراند'}</button>
          </div>
        </form>
      </Modal>

      {showMediaPicker && (
        <MediaPickerModal
          brands={brands}
          activeBrandId={brand?.id}
          onClose={() => setShowMediaPicker(false)}
          onSelect={handleSelectFromGallery}
          notify={notify}
        />
      )}
    </>
  );
}

function AutoTextarea({ value, onChange, placeholder, dir, ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${Math.max(76, ref.current.scrollHeight)}px`;
    }
  }, [value]);

  const handleInput = (e) => {
    if (onChange) onChange(e);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.max(76, e.target.scrollHeight)}px`;
  };

  return (
    <textarea
      ref={ref}
      value={value || ''}
      dir={dir}
      placeholder={placeholder}
      onChange={handleInput}
      rows={3}
      className="auto-expand-textarea"
      {...props}
    />
  );
}

function MediaPickerModal({ brands = [], activeBrandId, onClose, onSelect, notify }) {
  const [mediaList, setMediaList] = useState([]);
  const [foldersData, setFoldersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState(activeBrandId || 'all');
  const [search, setSearch] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFolder !== 'all') {
        if (selectedFolder === 'general') {
          params.set('folder', 'general');
        } else {
          params.set('folder', selectedFolder);
          params.set('brandId', selectedFolder);
        }
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }
      const data = await request(`/api/media?${params.toString()}`);
      setMediaList(data.media || []);
      setFoldersData(data.folders || null);
    } catch (err) {
      notify(err.message, 'warning');
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, search, notify]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUploadFromPicker = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setUploading(true);
    try {
      const targetFolder = selectedFolder === 'all' ? (activeBrandId || 'general') : selectedFolder;
      const formData = new FormData();
      for (const file of files) {
        const optimized = await optimizeImageForUpload(file);
        formData.append('files', optimized);
      }
      formData.append('folder', targetFolder);
      if (targetFolder !== 'general') formData.append('brandId', targetFolder);
      const res = await request('/api/media', { method: 'POST', body: formData });
      notify(`تم رفع ${res.count || files.length} صورة إلى المعرض.`);
      await fetchMedia();
      if (res.uploaded && res.uploaded[0]) {
        setSelectedMedia(res.uploaded[0]);
      }
    } catch (err) {
      notify(err.message, 'warning');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--wide media-picker-modal" role="dialog" aria-modal="true" aria-label="اختيار صورة من المعرض">
        <header className="media-picker-header">
          <div>
            <h2>اختيار صورة من المعرض</h2>
            <p>تصفح مجلدات البراندات أو ارفع صورة جديدة مباشرة</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق"><Icon name="close" /></button>
        </header>

        <div className="media-picker-controls">
          <div className="media-picker-folders-bar">
            <button
              type="button"
              className={['media-folder-tab', selectedFolder === 'all' && 'is-active'].filter(Boolean).join(' ')}
              onClick={() => setSelectedFolder('all')}
            >
              <Icon name="grid" size={15} />
              <span>كل الصور</span>
              {foldersData?.totalCount !== undefined && <b className="folder-tab-badge">{foldersData.totalCount}</b>}
            </button>
            <button
              type="button"
              className={['media-folder-tab', selectedFolder === 'general' && 'is-active'].filter(Boolean).join(' ')}
              onClick={() => setSelectedFolder('general')}
            >
              <Icon name="folder" size={15} />
              <span>عام</span>
              {foldersData?.generalCount !== undefined && <b className="folder-tab-badge">{foldersData.generalCount}</b>}
            </button>
            {brands.map((b) => {
              const count = foldersData?.brandFolders?.find((bf) => bf.id === b.id)?.count || 0;
              return (
                <button
                  key={b.id}
                  type="button"
                  className={['media-folder-tab', selectedFolder === b.id && 'is-active'].filter(Boolean).join(' ')}
                  onClick={() => setSelectedFolder(b.id)}
                >
                  <Icon name="tag" size={15} />
                  <span>{b.nameAr}</span>
                  <b className="folder-tab-badge">{count}</b>
                </button>
              );
            })}
          </div>

          <div className="media-picker-search-bar">
            <label className="search-box">
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم الصورة…"
              />
            </label>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Icon name="upload" size={16} />
              <span>{uploading ? 'جاري الرفع…' : 'رفع صور لهذا المجلد'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUploadFromPicker}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="media-picker-body">
          {loading ? (
            <div className="media-picker-loading">
              <span className="spinner-dot" /> جاري تحميل الصور…
            </div>
          ) : mediaList.length === 0 ? (
            <div className="media-picker-empty">
              <Icon name="image" size={36} />
              <p>لا توجد صور في هذا المجلد بعد</p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={16} /> رفع أول صورة الآن
              </button>
            </div>
          ) : (
            <div className="media-picker-grid">
              {mediaList.map((item) => {
                const isSelected = selectedMedia?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={['media-picker-thumb', isSelected && 'is-selected'].filter(Boolean).join(' ')}
                    onClick={() => setSelectedMedia(item)}
                    onDoubleClick={() => {
                      onSelect(item.url);
                      onClose();
                    }}
                    role="button"
                    tabIndex={0}
                    title={item.filename}
                  >
                    <div className="media-thumb-img-wrap">
                      <img src={item.url} alt={item.filename} loading="lazy" />
                      {isSelected && (
                        <div className="media-thumb-selected-check">
                          <Icon name="check" size={14} />
                        </div>
                      )}
                    </div>
                    <div className="media-thumb-caption">
                      <span className="media-thumb-name">{item.filename}</span>
                      <small className="media-thumb-meta">{formatBytes(item.bytes)}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="media-picker-footer">
          <div className="media-picker-selected-info">
            {selectedMedia ? (
              <>
                <img src={selectedMedia.url} alt="" className="media-selected-mini" />
                <div>
                  <strong>{selectedMedia.filename}</strong>
                  <span>{formatBytes(selectedMedia.bytes)} {selectedMedia.width ? `· ${selectedMedia.width}×${selectedMedia.height}` : ''}</span>
                </div>
              </>
            ) : (
              <span>اختر صورة بالضغط عليها</span>
            )}
          </div>
          <div className="modal-actions-inline">
            <button type="button" className="button button-ghost" onClick={onClose}>إلغاء</button>
            <button
              type="button"
              className="button button-primary"
              disabled={!selectedMedia}
              onClick={() => {
                if (selectedMedia) {
                  onSelect(selectedMedia.url);
                  onClose();
                }
              }}
            >
              استخدام هذه الصورة
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ProductEditor({ brand, brands = [], product, title, onClose, onSaved, notify }) {
  const [draft, setDraft] = useState(() => ({ ...emptyProduct(), ...product, variants: product.variants?.length ? product.variants : [emptyVariant()] }));
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const fileInputRef = useRef(null);

  const edit = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const editVariant = (id, key, value) => setDraft((current) => ({ ...current, variants: current.variants.map((variant) => variant.id === id ? { ...variant, [key]: value } : variant) }));

  const handleDeviceUpload = async (file) => {
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    edit('imageUrl', localUrl);
    setUploading(true);
    try {
      const optimized = await optimizeImageForUpload(file);
      const formData = new FormData();
      formData.set('file', optimized);
      formData.set('folder', brand.id + '/products');
      formData.set('brandId', brand.id);
      const result = await request('/api/upload', { method: 'POST', body: formData });
      edit('imageUrl', result.url);
      notify('تم رفع الصورة وإضافتها إلى معرض البراند بنجاح.');
    } catch (error) {
      notify(error.message, 'warning');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectFromGallery = (url) => {
    edit('imageUrl', url);
    setShowMediaPicker(false);
    notify('تم اختيار الصورة من المعرض بنجاح.');
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

  return (
    <>
      <Modal title={title} subtitle="يمكنك إضافة أكثر من وزن أو مقاس لنفس صفحة المنتج." onClose={onClose} wide>
        <form className="product-editor" onSubmit={save}>
          <div className="product-editor-main">
            <div className="product-image-section">
              <label className="field-label">صورة المنتج</label>
              {draft.imageUrl ? (
                <div className="product-image-active-box">
                  <div className="product-image-preview-wrap">
                    <img src={draft.imageUrl} alt="صورة المنتج" className="product-image-preview-img" />
                    {uploading && <div className="product-image-uploading-overlay">جارٍ الرفع…</div>}
                  </div>
                  <div className="product-image-active-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => setShowMediaPicker(true)}
                    >
                      <Icon name="image" size={15} /> اختيار من المعرض
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Icon name="upload" size={15} /> رفع بديل من الجهاز
                    </button>
                    <button
                      type="button"
                      className="button button-ghost text-danger"
                      onClick={() => edit('imageUrl', '')}
                    >
                      <Icon name="trash" size={15} /> إزالة الصورة
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="product-image-empty-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleDeviceUpload(e.dataTransfer.files[0]);
                  }}
                >
                  <div className="product-image-dropzone-icon">
                    <Icon name="image" size={28} />
                  </div>
                  <div className="product-image-dropzone-text">
                    <strong>اختر صورة لصفحة المنتج</strong>
                    <span>اختر من مجلدات المعرض أو ارفع صورة جديدة مباشرة من جهازك</span>
                  </div>
                  <div className="product-image-dropzone-buttons">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => setShowMediaPicker(true)}
                    >
                      <Icon name="image" size={16} /> اختيار من المعرض
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Icon name="upload" size={16} /> رفع من الجهاز
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => e.target.files?.[0] && handleDeviceUpload(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </div>

            <div className="form-grid two">
              <Field label="اسم المنتج بالعربي *"><input value={draft.nameAr} onChange={(event) => edit('nameAr', event.target.value)} /></Field>
              <Field label="اسم المنتج بالإنجليزية (Product Name - English)"><input value={draft.nameEn} dir="ltr" onChange={(event) => edit('nameEn', event.target.value)} placeholder="e.g. Quik Cat Litter Lavender" /></Field>
            </div>
            <div className="form-grid two">
              <Field label="الوصف بالعربي"><AutoTextarea value={draft.descriptionAr} onChange={(event) => edit('descriptionAr', event.target.value)} placeholder="اكتب الوصف العربي للمنتج…" /></Field>
              <Field label="الوصف بالإنجليزية"><AutoTextarea value={draft.descriptionEn} dir="ltr" onChange={(event) => edit('descriptionEn', event.target.value)} placeholder="Product English description…" /></Field>
            </div>
            <Field label="الباركود"><input value={draft.barcode} dir="ltr" onChange={(event) => edit('barcode', event.target.value.replace(/\s/g, ''))} /></Field>
          </div>

          <section className="variants-editor">
            <div className="variants-title">
              <div>
                <h3>الأحجام والأوزان</h3>
                <p>كل صف يمثل مقاسًا أو وزنًا ضمن جدول أسعار صفحة المنتج.</p>
              </div>
              <button type="button" className="button button-ghost" onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, emptyVariant()] }))}>
                <Icon name="plus" size={17} /> إضافة مقاس
              </button>
            </div>
            <div className="variant-edit-list">
              {draft.variants.map((variant, index) => (
                <div className="variant-edit-card" key={variant.id}>
                  <div className="variant-edit-top">
                    <b>مقاس {index + 1}</b>
                    {draft.variants.length > 1 && (
                      <button type="button" className="text-danger" onClick={() => setDraft((current) => ({ ...current, variants: current.variants.filter((item) => item.id !== variant.id) }))}>
                        حذف
                      </button>
                    )}
                  </div>
                  <div className="form-grid variant-grid">
                    <Field label="الوزن / الحجم"><input value={variant.weight} onChange={(event) => editVariant(variant.id, 'weight', event.target.value)} placeholder="5 L أو 400" /></Field>
                    <Field label="الوحدة (Unit)"><select value={normalizeUnit(variant.unit)} onChange={(event) => editVariant(variant.id, 'unit', event.target.value)}><option value="">بدون وحدة</option><option value="g">g (جرام)</option><option value="kg">kg (كيلوجرام)</option><option value="L">L (لتر)</option><option value="ml">ml (مل)</option><option value="pcs">pcs (حبة)</option><option value="oz">oz (أونصة)</option><option value="lb">lb (باوند)</option></select></Field>
                    <Field label="الباركود (Barcode)"><input value={variant.sku} dir="ltr" onChange={(event) => editVariant(variant.id, 'sku', event.target.value)} placeholder="8681299606443" /></Field>
                    <Field label="العدد بالكرتون"><input value={variant.qtyPerCarton} inputMode="numeric" onChange={(event) => editVariant(variant.id, 'qtyPerCarton', event.target.value)} placeholder="1" /></Field>
                    <Field label={'سعر الحبة (' + mergeSettings(brand.settings).currency + ')'}><input value={variant.pricePerPiece} inputMode="decimal" onChange={(event) => editVariant(variant.id, 'pricePerPiece', event.target.value)} placeholder="7.83" /></Field>
                    <Field label={'سعر الكرتون (' + mergeSettings(brand.settings).currency + ')'}><input value={variant.pricePerCarton} inputMode="decimal" onChange={(event) => editVariant(variant.id, 'pricePerCarton', event.target.value)} placeholder="120.00" /></Field>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>إلغاء</button>
            <button className="button button-primary" disabled={busy || uploading}>{busy ? 'جاري الحفظ…' : 'حفظ الصفحة'}</button>
          </div>
        </form>
      </Modal>

      {showMediaPicker && (
        <MediaPickerModal
          brands={brands}
          activeBrandId={brand?.id}
          onClose={() => setShowMediaPicker(false)}
          onSelect={handleSelectFromGallery}
          notify={notify}
        />
      )}
    </>
  );
}

function GalleryView({ brands = [], activeBrand, notify, setConfirmModal }) {
  const [selectedFolder, setSelectedFolder] = useState('folders'); // 'folders' | 'all' | 'general' | brandId
  const [mediaList, setMediaList] = useState([]);
  const [foldersData, setFoldersData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [previewMedia, setPreviewMedia] = useState(null);
  const fileInputRef = useRef(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFolder !== 'folders' && selectedFolder !== 'all') {
        if (selectedFolder === 'general') {
          params.set('folder', 'general');
        } else {
          params.set('folder', selectedFolder);
          params.set('brandId', selectedFolder);
        }
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }
      const res = await request(`/api/media?${params.toString()}`);
      setMediaList(res.media || []);
      setFoldersData(res.folders || null);
    } catch (err) {
      notify(err.message, 'warning');
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, search, notify]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleUploadFiles = async (filesList) => {
    const files = Array.from(filesList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) {
      notify('يرجى اختيار ملفات صور صالحة (PNG, JPG, WEBP, GIF).', 'warning');
      return;
    }

    const targetFolder = (selectedFolder === 'folders' || selectedFolder === 'all')
      ? (activeBrand?.id || 'general')
      : selectedFolder;

    setUploading(true);
    setUploadProgress(0);
    const total = files.length;
    let completed = 0;

    try {
      for (let i = 0; i < total; i++) {
        const file = files[i];
        setUploadStatusText(`جاري رفع ${file.name} (${i + 1} من ${total})`);
        const optimized = await optimizeImageForUpload(file);
        const formData = new FormData();
        formData.append('files', optimized);
        formData.append('folder', targetFolder);
        if (targetFolder !== 'general') formData.append('brandId', targetFolder);
        await request('/api/media', { method: 'POST', body: formData });
        completed++;
        setUploadProgress(Math.round((completed / total) * 100));
      }
      notify(`تم رفع ${completed} صورة بنجاح إلى المعرض.`);
      await loadMedia();
    } catch (err) {
      notify(err.message || 'حدث خطأ أثناء رفع الصور.', 'warning');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setUploadStatusText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteMedia = (media) => {
    setConfirmModal({
      title: 'حذف الصورة نهائياً',
      message: `هل أنت متأكد من حذف «${media.filename}» نهائياً؟ سيتم حذفها فوراً من Cloudinary وقاعدة البيانات ولا يمكن استرجاعها.`,
      confirmText: 'حذف نهائي',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await request(`/api/media/${media.id}`, { method: 'DELETE' });
          notify('تم حذف الصورة نهائياً من Cloudinary وقاعدة البيانات.');
          setMediaList((prev) => prev.filter((m) => m.id !== media.id));
          await loadMedia();
        } catch (err) {
          notify(err.message, 'warning');
        }
      },
    });
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      notify('تم نسخ رابط الصورة إلى الحافظة.');
    } catch {
      notify('تعذر نسخ الرابط.', 'warning');
    }
  };

  const isFoldersView = selectedFolder === 'folders';
  const activeBrandObj = brands.find((b) => b.id === selectedFolder);
  const currentFolderName = isFoldersView
    ? 'كل المجلدات'
    : selectedFolder === 'all'
    ? 'جميع الصور'
    : selectedFolder === 'general'
    ? 'مجلد عام'
    : activeBrandObj?.nameAr || 'المجلد';

  return (
    <section className="page-shell gallery-page">
      <div className="gallery-header-bar">
        <div className="gallery-breadcrumb">
          <button
            type="button"
            className={['gallery-crumb-btn', isFoldersView && 'is-current'].filter(Boolean).join(' ')}
            onClick={() => setSelectedFolder('folders')}
          >
            <Icon name="folder" size={17} />
            <span>المعرض</span>
          </button>
          {!isFoldersView && (
            <>
              <span className="crumb-separator">/</span>
              <span className="crumb-current">{currentFolderName}</span>
            </>
          )}
        </div>

        <div className="gallery-header-actions">
          {!isFoldersView && (
            <label className="search-box">
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم في هذا المجلد…"
              />
            </label>
          )}
          <button
            type="button"
            className="button button-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Icon name="upload" size={17} />
            <span>رفع صور جديدة</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleUploadFiles(e.target.files)}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {uploading && (
        <div className="upload-progress-card">
          <div className="upload-progress-header">
            <strong>{uploadStatusText || 'جاري رفع الصور إلى المعرض…'}</strong>
            <span>{uploadProgress || 0}%</span>
          </div>
          <div className="upload-progress-track">
            <div className="upload-progress-fill" style={{ width: `${uploadProgress || 0}%` }} />
          </div>
        </div>
      )}

      {isFoldersView && (
        <div className="gallery-folders-section">
          <div className="gallery-section-title">
            <div>
              <h2>مجلدات البراندات</h2>
              <p>يتم إنشاء مجلد تلقائياً لكل براند في النظام. انقر على أي مجلد لفتحه واستعراض صوره أو رفع صور جديدة داخله.</p>
            </div>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setSelectedFolder('all')}
            >
              <Icon name="grid" size={16} /> عرض جميع الصور ({foldersData?.totalCount || 0})
            </button>
          </div>

          <div className="gallery-folders-grid">
            <article
              className="folder-card"
              onClick={() => setSelectedFolder('general')}
              role="button"
              tabIndex={0}
            >
              <div className="folder-card-icon-wrap">
                <Icon name="folder" size={32} />
              </div>
              <div className="folder-card-body">
                <h3>مجلد عام</h3>
                <p>صور عامة ومرفقات غير مرتبطة ببراند محدد</p>
              </div>
              <div className="folder-card-meta">
                <span className="folder-count-pill">
                  {foldersData?.generalCount || 0} صورة
                </span>
                <span className="folder-arrow-link">
                  فتح المجلد <Icon name="arrow" size={14} />
                </span>
              </div>
            </article>

            {brands.map((b) => {
              const brandStat = foldersData?.brandFolders?.find((bf) => bf.id === b.id);
              const count = brandStat?.count || 0;
              const totalBytes = brandStat?.totalBytes || 0;

              return (
                <article
                  key={b.id}
                  className="folder-card"
                  onClick={() => setSelectedFolder(b.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="folder-card-logo-wrap">
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.nameAr} className="folder-card-logo-img" />
                    ) : (
                      <div className="folder-card-logo-fallback">
                        <b>{(b.nameAr || b.nameEn || 'B').slice(0, 1)}</b>
                      </div>
                    )}
                  </div>
                  <div className="folder-card-body">
                    <h3>{b.nameAr}</h3>
                    <p>{b.nameEn || 'براند كتالوج'}</p>
                  </div>
                  <div className="folder-card-meta">
                    <span className="folder-count-pill">{count} صورة</span>
                    {totalBytes > 0 && <small className="folder-size-text">{formatBytes(totalBytes)}</small>}
                    <span className="folder-arrow-link">
                      فتح المجلد <Icon name="arrow" size={14} />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!isFoldersView && (
        <div className="gallery-contents-section">
          <div className="gallery-folder-pills">
            <button
              type="button"
              className={['gallery-pill', selectedFolder === 'all' && 'is-active'].filter(Boolean).join(' ')}
              onClick={() => setSelectedFolder('all')}
            >
              الكل ({foldersData?.totalCount || 0})
            </button>
            <button
              type="button"
              className={['gallery-pill', selectedFolder === 'general' && 'is-active'].filter(Boolean).join(' ')}
              onClick={() => setSelectedFolder('general')}
            >
              عام ({foldersData?.generalCount || 0})
            </button>
            {brands.map((b) => {
              const count = foldersData?.brandFolders?.find((bf) => bf.id === b.id)?.count || 0;
              return (
                <button
                  key={b.id}
                  type="button"
                  className={['gallery-pill', selectedFolder === b.id && 'is-active'].filter(Boolean).join(' ')}
                  onClick={() => setSelectedFolder(b.id)}
                >
                  {b.nameAr} ({count})
                </button>
              );
            })}
          </div>

          <div
            className="gallery-dropzone-banner"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleUploadFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="upload" size={24} />
            <div>
              <strong>اسحب الصور وأفلتها هنا للرفع الفوري، أو اضغط لاختيار ملفات متعددة</strong>
              <span>يتم تحسين الصور ورفعها وحفظها في مجلد «{currentFolderName}»</span>
            </div>
          </div>

          {loading ? (
            <div className="gallery-loading-state">
              <span className="spinner-dot" /> جاري تحميل الصور…
            </div>
          ) : mediaList.length === 0 ? (
            <div className="gallery-empty-state">
              <Icon name="image" size={40} />
              <h3>لا توجد صور في مجلد {currentFolderName}</h3>
              <p>ابدأ برفع صور لمنتجات البراند أو اسحب الملفات هنا مباشرة.</p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={16} /> رفع صور لهذا المجلد
              </button>
            </div>
          ) : (
            <div className="gallery-media-grid">
              {mediaList.map((item) => (
                <article key={item.id} className="media-item-card">
                  <div
                    className="media-item-preview"
                    onClick={() => setPreviewMedia(item)}
                    title="تكبير ومعاينة الصورة"
                  >
                    <img src={item.url} alt={item.filename} loading="lazy" />
                    <div className="media-item-hover-overlay">
                      <Icon name="eye" size={20} />
                      <span>معاينة مكبرة</span>
                    </div>
                  </div>

                  <div className="media-item-details">
                    <div className="media-item-title-row">
                      <strong className="media-filename" title={item.filename}>{item.filename}</strong>
                    </div>
                    <div className="media-item-meta-row">
                      <span className="media-size-pill">{formatBytes(item.bytes)}</span>
                      {item.width && item.height && (
                        <span className="media-dim-pill">{item.width} × {item.height}</span>
                      )}
                    </div>
                  </div>

                  <div className="media-item-actions">
                    <button
                      type="button"
                      className="btn-media-action"
                      onClick={() => copyUrl(item.url)}
                      title="نسخ رابط الصورة"
                    >
                      <Icon name="copy" size={14} /> نسخ الرابط
                    </button>
                    <button
                      type="button"
                      className="btn-media-action btn-media-delete"
                      onClick={() => handleDeleteMedia(item)}
                      title="حذف نهائي من السحابة وقاعدة البيانات"
                    >
                      <Icon name="trash" size={14} /> حذف نهائي
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {previewMedia && (
        <Modal
          title={`معاينة: ${previewMedia.filename}`}
          subtitle={`${formatBytes(previewMedia.bytes)} ${previewMedia.width ? `· ${previewMedia.width}×${previewMedia.height}px` : ''}`}
          onClose={() => setPreviewMedia(null)}
          wide
        >
          <div className="gallery-full-preview-body">
            <img src={previewMedia.url} alt={previewMedia.filename} className="gallery-full-preview-img" />
            <div className="gallery-full-preview-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => copyUrl(previewMedia.url)}
              >
                <Icon name="copy" size={16} /> نسخ رابط الصورة
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => {
                  const toDelete = previewMedia;
                  setPreviewMedia(null);
                  handleDeleteMedia(toDelete);
                }}
              >
                <Icon name="trash" size={16} /> حذف نهائي
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
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
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const toggleSelectProduct = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectAllFiltered = useCallback(() => {
    if (!activeBrand?.products) return;
    const q = query.trim().toLowerCase();
    const filtered = (q
      ? activeBrand.products.filter(
          (p) =>
            (p.nameAr || '').toLowerCase().includes(q) ||
            (p.nameEn || '').toLowerCase().includes(q) ||
            (p.barcode || '').toLowerCase().includes(q)
        )
      : activeBrand.products
    ).map((p) => p.id);
    setSelectedIds(new Set(filtered));
  }, [activeBrand?.products, query]);
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);
  const [savingOrder, setSavingOrder] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [previewZoom, setPreviewZoom] = useState('fit');
  const [catalogZoom, setCatalogZoom] = useState('fit');
  const [catalogCols, setCatalogCols] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('catfood_catalog_cols') || '2';
      } catch {
        return '2';
      }
    }
    return '2';
  });

  const handleSetCatalogCols = (cols) => {
    setCatalogCols(cols);
    try {
      localStorage.setItem('catfood_catalog_cols', cols);
    } catch {}
  };
  const [windowDimensions, setWindowDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const handleResize = () => setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowDimensions.width < 820;
  const modalAvailableWidth = isMobile
    ? Math.max(280, windowDimensions.width - 24)
    : Math.max(320, Math.min(940, windowDimensions.width - 48) - 36);

  const responsiveScale = Math.min(1.0, Math.max(0.20, Number((modalAvailableWidth / 793.7).toFixed(3))));
  const effectivePreviewScale = responsiveScale;
  const effectiveCatalogScale = responsiveScale;

  const isAnyModalActive = Boolean(
    brandModal ||
    productModal ||
    previewModal ||
    catalogPreviewModal ||
    confirmModal ||
    mobileMenu
  );

  useEffect(() => {
    if (isAnyModalActive) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.paddingRight = '';
    };
  }, [isAnyModalActive]);


  const activeDragItem = useMemo(() => activeBrand?.products?.find((p) => p.id === activeDragId), [activeBrand?.products, activeDragId]);

  const gridRef = useRef(null);
  const importInput = useRef(null);
  const pdfRef = useRef(null);
  const activeIdRef = useRef(null);
  activeIdRef.current = activeBrand?.id;
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
    setSelectedIds(new Set());
    try {
      localStorage.setItem(CACHE_ACTIVE_KEY, JSON.stringify(result.brand));
    } catch {}
    return result.brand;
  }, []);
  const refresh = useCallback(async (brandId) => {
    const list = await loadBrands();
    const targetId = brandId || activeIdRef.current || list[0]?.id;
    if (targetId) await loadBrand(targetId);
    else setActiveBrand(null);
  }, [loadBrands, loadBrand]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const go = (next) => { setView(next); setMobileMenu(false); };
  const chooseBrand = async (brand) => {
    try {
      setSelectedIds(new Set());
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
  const removeProduct = (product) => {
    if (!activeBrand) return;
    setConfirmModal({
      title: 'حذف صفحة المنتج',
      message: 'هل أنت متأكد من حذف صفحة «' + (product.nameAr || product.nameEn || 'المنتج') + '»؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'حذف الصفحة',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await request('/api/products/' + product.id + '?brandId=' + activeBrand.id, { method: 'DELETE' });
          notify('تم حذف الصفحة.');
          await refresh(activeBrand.id);
        } catch (error) { notify(error.message, 'warning'); }
      },
    });
  };
  const handleBulkDelete = () => {
    if (!selectedIds.size || !activeBrand) return;
    const count = selectedIds.size;
    const idsToDelete = Array.from(selectedIds);
    setConfirmModal({
      title: `حذف ${count} صفحة محددة`,
      message: `هل أنت متأكد من حذف ${count} صفحة من الكتالوج نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmText: `حذف ${count} صفحة`,
      tone: 'danger',
      onConfirm: async () => {
        try {
          await request('/api/brands/' + activeBrand.id + '/products', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: idsToDelete }),
          });
          notify(`تم حذف ${count} صفحة بنجاح.`);
          setSelectedIds(new Set());
          await refresh(activeBrand.id);
        } catch (error) {
          notify(error.message, 'warning');
        }
      },
    });
  };
  const reorderProductsByIds = async (orderedIds) => {
    if (!activeBrand?.products) return;
    const currentList = [...activeBrand.products];
    const map = new Map(currentList.map((p) => [p.id, p]));
    const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean);
    const seen = new Set(orderedIds);
    currentList.forEach((p) => {
      if (!seen.has(p.id)) reordered.push(p);
    });

    setActiveBrand((curr) => ({ ...curr, products: reordered }));
    try {
      setSavingOrder(true);
      await request('/api/brands/' + activeBrand.id + '/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: reordered.map((p) => p.id) }),
      });
      notify('تم تحديث ترتيب الصفحات في الكتالوج.');
    } catch (err) {
      notify(err.message || 'تعذر حفظ الترتيب', 'warning');
      await refresh(activeBrand.id);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeBrand?.products) return;

    if (selectedIds.has(active.id) && selectedIds.size > 1) {
      if (selectedIds.has(over.id)) return;
      const currentProducts = activeBrand.products;
      const selectedList = currentProducts.filter((p) => selectedIds.has(p.id));
      const unselectedList = currentProducts.filter((p) => !selectedIds.has(p.id));
      const targetUnselectedIdx = unselectedList.findIndex((p) => p.id === over.id);
      if (targetUnselectedIdx === -1) return;

      const currentActiveIdx = currentProducts.findIndex((p) => p.id === active.id);
      const currentOverIdx = currentProducts.findIndex((p) => p.id === over.id);

      let insertIdx = targetUnselectedIdx;
      if (currentOverIdx > currentActiveIdx) {
        insertIdx = targetUnselectedIdx + 1;
      }

      const newProducts = [
        ...unselectedList.slice(0, insertIdx),
        ...selectedList,
        ...unselectedList.slice(insertIdx),
      ];

      const hasChanged = newProducts.some((p, i) => p.id !== currentProducts[i]?.id);
      if (hasChanged) {
        setActiveBrand((curr) => ({
          ...curr,
          products: newProducts,
        }));
      }
      return;
    }

    const oldIndex = activeBrand.products.findIndex((p) => p.id === active.id);
    const newIndex = activeBrand.products.findIndex((p) => p.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setActiveBrand((curr) => ({
        ...curr,
        products: arrayMove(curr.products, oldIndex, newIndex),
      }));
    }
  };


  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!activeBrand?.products) return;
    const productIds = activeBrand.products.map((p) => p.id);

    try {
      setSavingOrder(true);
      await request('/api/brands/' + activeBrand.id + '/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
      });
      notify('تم تحديث ترتيب الصفحات في الكتالوج بنجاح.');
    } catch (err) {
      notify(err.message || 'تعذر حفظ الترتيب', 'warning');
      await refresh(activeBrand.id);
    } finally {
      setSavingOrder(false);
    }
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
  const removeBrand = (brand) => {
    setConfirmModal({
      title: 'حذف البراند',
      message: 'هل أنت متأكد من حذف براند «' + brand.nameAr + '» وكافة صفحاته (' + (brand.productCount || 0) + ' صفحة)؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'حذف البراند نهائياً',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await request('/api/brands/' + brand.id, { method: 'DELETE' });
          const list = await loadBrands();
          if (activeBrand?.id === brand.id) {
            try { localStorage.removeItem(CACHE_ACTIVE_KEY); } catch {}
            if (list[0]) await loadBrand(list[0].id); else setActiveBrand(null);
          }
          notify('تم حذف البراند.');
        } catch (error) { notify(error.message, 'warning'); }
      },
    });
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
    if (!activeBrand?.products?.length) return notify('اختر براندًا يحتوي على صفحة واحدة على الأقل أولًا.', 'warning');
    setBusy(true);
    setExporting(true);
    setExportProgress(1);

    let currentPct = 1;
    const progressTimer = setInterval(() => {
      currentPct = Math.min(96, currentPct + (currentPct < 35 ? 6 : currentPct < 75 ? 3 : currentPct < 90 ? 2 : 1));
      setExportProgress(currentPct);
    }, 120);

    try {
      await new Promise((resolve) => setTimeout(resolve, 60));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (pdfRef.current) {
        expandDescriptionBoxes(pdfRef.current);
      }
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
      clearInterval(progressTimer);
      setExportProgress(100);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (activeBrand.nameEn || activeBrand.nameAr || 'catalog').replace(/\s+/g, '-') + '-catalog.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('تم تصدير وتحميل كتالوج ' + activeBrand.nameAr + ' بصيغة PDF بنجاح!');
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (error) {
      clearInterval(progressTimer);
      notify(error.message, 'warning');
    } finally {
      clearInterval(progressTimer);
      setExportProgress(null);
      setBusy(false);
      setExporting(false);
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
  const nav = [
    { id: 'dashboard', label: 'الرئيسية', fullLabel: 'لوحة التحكم', icon: 'grid' },
    { id: 'brands', label: 'البراندات', fullLabel: 'البراندات', icon: 'tag', count: brands.length },
    { id: 'catalog', label: 'الصفحات', fullLabel: 'صفحات البراند', icon: 'folder', disabled: !activeBrand, count: products.length },
    { id: 'gallery', label: 'المعرض', fullLabel: 'معرض الصور', icon: 'image' },
    { id: 'import', label: 'استيراد', fullLabel: 'استيراد Excel', icon: 'upload', disabled: !activeBrand },
    { id: 'settings', label: 'الإعدادات', fullLabel: 'إعدادات البراند', icon: 'settings', disabled: !activeBrand }
  ];

  return <main className="studio-shell" suppressHydrationWarning>
    <aside className={['app-sidebar', mobileMenu && 'is-open'].filter(Boolean).join(' ')}>
      <div className="sidebar-brand">
        <span className="brand-mark">C</span>
        <div>
          <strong>Catalog Studio</strong>
          <small>لوحة إدارة الكتالوجات</small>
        </div>
      </div>
      <nav className="sidebar-nav">
        {nav.map((item) => (
          <button
            key={item.id}
            disabled={item.disabled}
            className={view === item.id ? 'active' : ''}
            onClick={() => go(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.fullLabel || item.label}</span>
            {item.count !== undefined && <b>{item.count}</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-active-brand">
        {activeBrand ? (
          <>
            <BrandBadge brand={activeBrand} />
            <div>
              <small>البراند النشط</small>
              <strong>{activeBrand.nameAr}</strong>
            </div>
          </>
        ) : (
          <span>أنشئ براندًا للبدء</span>
        )}
      </div>
    </aside>
    {mobileMenu && <button className="sidebar-backdrop" onClick={() => setMobileMenu(false)} aria-label="إغلاق القائمة" />}
    <section className="workspace">
      <header className="topbar">
        <button
          type="button"
          className="mobile-menu"
          onClick={() => setMobileMenu(true)}
          aria-label="القائمة الجانبية"
          title="القائمة"
        >
          <Icon name="menu" size={20} />
        </button>
        <div className="topbar-title-wrap">
          <h1>
            {view === 'dashboard'
              ? 'لوحة التحكم'
              : view === 'brands'
              ? 'البراندات'
              : view === 'catalog'
              ? (activeBrand?.nameAr ? `صفحات ${activeBrand.nameAr}` : 'صفحات الكتالوج')
              : view === 'gallery'
              ? 'معرض الصور'
              : view === 'import'
              ? 'استيراد ومراجعة الملف'
              : 'إعدادات التصميم'}
          </h1>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="button button-ghost topbar-btn-brand"
            onClick={() => setBrandModal({})}
            title="إضافة براند جديد"
            aria-label="براند جديد"
          >
            <Icon name="plus" size={17} />
            <span className="topbar-btn-text">براند جديد</span>
          </button>
          {activeBrand && (
            <button
              type="button"
              className={['button', 'button-primary', 'btn-direct-export', 'topbar-btn-export', exportProgress !== null && 'is-exporting'].filter(Boolean).join(' ')}
              disabled={busy || !products.length}
              onClick={exportDirectPdf}
              title="تصدير وتحميل ملف PDF المباشر فائق السرعة"
              aria-label="تصدير PDF"
            >
              {exportProgress !== null && <span className="export-progress-fill" style={{ width: `${exportProgress}%` }} />}
              <Icon name="download" size={17} />
              <span className="topbar-btn-text">
                {exportProgress !== null
                  ? (exportProgress >= 100 ? '100%' : `${exportProgress}%`)
                  : 'تصدير PDF'}
              </span>
            </button>
          )}
        </div>
      </header>
      {view === 'dashboard' && <section className="page-shell dashboard"><div className="dashboard-hero"><div><h2>كل براند ومنتجاته في مكان واحد.</h2><p>أنشئ براند، ارفع الشعار، راجع Excel قبل الإدراج، ثم عدّل أي صفحة يدويًا وصدّر كتالوج PDF.</p><div className="hero-actions"><button className="button button-primary" onClick={() => setBrandModal({})}><Icon name="plus" size={18} /> براند جديد</button>{activeBrand && <button className="button button-ghost" onClick={() => go('catalog')}><Icon name="folder" size={18} /> فتح الصفحات</button>}</div></div><div className="dashboard-brand-card">{activeBrand ? <><BrandBadge brand={activeBrand} large /><div><span>البراند النشط</span><strong>{activeBrand.nameAr}</strong><small>{products.length} صفحة منتج</small></div></> : <><span className="hero-icon"><Icon name="tag" size={27} /></span><p>لا يوجد براند نشط</p></>}</div></div><div className="stats-grid"><Stat icon="tag" label="إجمالي البراندات" value={brands.length} /><Stat icon="file" label="صفحات البراند النشط" value={products.length} /><Stat icon="image" label="صور محفوظة" value={products.filter((item) => item.imageUrl).length} /><Stat icon="grid" label="مقاسات مسجلة" value={products.reduce((total, item) => total + (item.variants?.length || 0), 0)} /></div><section className="dashboard-section"><div className="section-bar"><div><h2>آخر البراندات</h2><p>اختر براندًا لتعديل صفحاته أو إعداداته.</p></div><button className="button button-ghost" onClick={() => go('brands')}>كل البراندات <Icon name="arrow" size={16} /></button></div>{brands.length ? <div className="brand-grid">{brands.slice(0, 4).map((brand) => <BrandCard key={brand.id} brand={brand} selected={activeBrand?.id === brand.id} onOpen={() => chooseBrand(brand)} onEdit={() => setBrandModal(brand)} />)}</div> : <EmptyState onNew={() => setBrandModal({})} />}</section></section>}
      {view === 'brands' && <section className="page-shell"><div className="section-bar"><div><h2>إدارة البراندات</h2><p>أضف براندات متعددة وغيّر الشعار والهوية في أي وقت.</p></div><button className="button button-primary" onClick={() => setBrandModal({})}><Icon name="plus" size={18} /> براند جديد</button></div>{brands.length ? <div className="brand-grid brand-grid--full">{brands.map((brand) => <BrandCard key={brand.id} brand={brand} selected={activeBrand?.id === brand.id} onOpen={() => chooseBrand(brand)} onEdit={() => setBrandModal(brand)} onDelete={() => removeBrand(brand)} />)}</div> : <EmptyState onNew={() => setBrandModal({})} />}</section>}
      {view === 'catalog' && (
        <section className="page-shell">
          {activeBrand ? (
            <>
              <div className="catalog-toolbar">
                <div className="brand-page-heading">
                  <BrandBadge brand={activeBrand} large />
                  <div className="brand-heading-meta">
                    <div className="brand-heading-title-row">
                      <h2>{activeBrand.nameAr}</h2>
                      {brands.length > 1 && (
                        <select
                          className="brand-select-dropdown"
                          value={activeBrand.id}
                          onChange={(e) => {
                            const found = brands.find((b) => b.id === e.target.value);
                            if (found) chooseBrand(found);
                          }}
                          title="التبديل بين كتالوجات البراندات"
                        >
                          {brands.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.nameAr} {b.nameEn ? '(' + b.nameEn + ')' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <p>{activeBrand.nameEn || 'Product catalog'} · كتالوج كامل بـ {products.length} صفحة</p>
                  </div>
                </div>

                <div className="catalog-toolbar-actions">
                  <div className="catalog-search-row">
                    <label className="search-box">
                      <Icon name="search" size={17} />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="بحث بالاسم أو الباركود…"
                      />
                      {query && (
                        <button
                          type="button"
                          className="search-clear-btn"
                          onClick={() => setQuery('')}
                          title="مسح البحث"
                          aria-label="مسح البحث"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      )}
                    </label>

                    {/* Column Layout Controller Icon */}
                    <div className="catalog-grid-toggle" role="group" aria-label="التحكم في عدد الصفحات في الصف">
                      <button
                        type="button"
                        className={['grid-toggle-btn', catalogCols === '1' && 'is-active'].filter(Boolean).join(' ')}
                        onClick={() => handleSetCatalogCols('1')}
                        title="عرض عامود واحد (صفحة واحدة في الصف)"
                        aria-label="عامود واحد"
                      >
                        <Icon name="columns1" size={17} />
                      </button>
                      <button
                        type="button"
                        className={['grid-toggle-btn', catalogCols === '2' && 'is-active'].filter(Boolean).join(' ')}
                        onClick={() => handleSetCatalogCols('2')}
                        title="عرض عامودين (صفحتين في الصف)"
                        aria-label="عامودين"
                      >
                        <Icon name="columns2" size={17} />
                      </button>
                    </div>
                  </div>

                  <div className="catalog-action-chips">
                    {products.length > 0 && (
                      <button
                        type="button"
                        className={['button', 'button-ghost', 'action-chip', selectedIds.size > 0 && 'is-active'].filter(Boolean).join(' ')}
                        onClick={selectedIds.size === filteredProducts.length ? clearSelection : selectAllFiltered}
                        title={selectedIds.size === filteredProducts.length ? 'إلغاء تحديد كل الصفحات' : 'تحديد كل الصفحات'}
                      >
                        <Icon name={selectedIds.size === filteredProducts.length ? 'close' : 'check'} size={15} />
                        <span>{selectedIds.size === filteredProducts.length ? 'إلغاء التحديد' : 'تحديد الكل'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-primary action-chip"
                      onClick={() => setProductModal({ mode: 'new', product: emptyProduct() })}
                    >
                      <Icon name="plus" size={16} /> <span>صفحة جديدة</span>
                    </button>
                    <button
                      type="button"
                      className="button button-ghost action-chip"
                      onClick={() => setCatalogPreviewModal(true)}
                      disabled={!products.length}
                      title="معاينة صفحات الكتالوج بالكامل"
                    >
                      <Icon name="eye" size={16} /> <span>معاينة</span>
                    </button>
                    <button
                      type="button"
                      className="button button-ghost action-chip"
                      onClick={() => go('import')}
                    >
                      <Icon name="upload" size={16} /> <span>استيراد</span>
                    </button>
                    <button
                      type="button"
                      className={['button', 'button-ghost', 'btn-direct-export', 'action-chip', exportProgress !== null && 'is-exporting'].filter(Boolean).join(' ')}
                      disabled={busy || !products.length}
                      onClick={exportDirectPdf}
                      title="تصدير وتحميل ملف PDF المباشر فائق السرعة"
                    >
                      {exportProgress !== null && <span className="export-progress-fill" style={{ width: `${exportProgress}%` }} />}
                      <Icon name="download" size={16} />
                      <span>{exportProgress !== null ? (exportProgress >= 100 ? '100%' : `${exportProgress}%`) : 'تصدير'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {products.length > 1 && !query && (
                <div className="catalog-reorder-banner">
                  <span>
                    <Icon name="grip" size={15} />
                    اسحب وأفلت لإعادة ترتيب الصفحات، أو استخدم الأسهم. الترتيب ينعكس تلقائياً في PDF.
                  </span>
                  {savingOrder && <small>جاري الحفظ…</small>}
                </div>
              )}

              {products.length ? (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={filteredProducts.map((p) => p.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className={['product-grid', `product-grid--cols-${catalogCols}`].join(' ')}>
                        {filteredProducts.map((product, idx) => {
                          const actualIndex = products.findIndex((p) => p.id === product.id);
                          return (
                            <SortableProductCard
                              key={product.id}
                              brand={activeBrand}
                              product={product}
                              index={actualIndex >= 0 ? actualIndex : idx}
                              total={products.length}
                              isSelected={selectedIds.has(product.id)}
                              onToggleSelect={toggleSelectProduct}
                              onMoveUp={() => moveProduct(actualIndex, actualIndex - 1)}
                              onMoveDown={() => moveProduct(actualIndex, actualIndex + 1)}
                              onPreview={() => setPreviewModal(product)}
                              onEdit={() => setProductModal({ mode: 'edit', product })}
                              onDuplicate={() => duplicateProduct(product)}
                              onDelete={() => removeProduct(product)}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay adjustScale={false}>
                      {activeDragItem ? (
                        <div className="is-drag-overlay" style={{ width: '100%', position: 'relative' }}>
                          {selectedIds.has(activeDragItem.id) && selectedIds.size > 1 && (
                            <div style={{
                              position: 'absolute',
                              top: -10,
                              right: -10,
                              zIndex: 99,
                              background: '#00497A',
                              color: '#fff',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                            }}>
                              نقل {selectedIds.size} صفحات محددة معاً
                            </div>
                          )}
                          <ProductCard
                            brand={activeBrand}
                            product={activeDragItem}
                            index={products.findIndex((p) => p.id === activeDragItem.id)}
                            total={products.length}
                            isSelected={selectedIds.has(activeDragItem.id)}
                            isOverlay
                          />
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                  {selectedIds.size > 0 && (
                    <aside className="bulk-actions-bar" aria-label="إجراءات التحديد الجماعي">
                      <div className="bulk-actions-info">
                        <span className="bulk-badge">{selectedIds.size}</span>
                        <span>صفحة محددة</span>
                      </div>
                      <div className="bulk-actions-buttons">
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          onClick={handleBulkDelete}
                          title="حذف جميع الصفحات المحددة"
                        >
                          <Icon name="trash" size={14} />
                          <span>حذف المحدد ({selectedIds.size})</span>
                        </button>
                        <button
                          type="button"
                          className="button button-ghost button-sm"
                          onClick={clearSelection}
                          title="إلغاء التحديد"
                        >
                          <span>إلغاء</span>
                        </button>
                      </div>
                    </aside>
                  )}

                  {!filteredProducts.length && (
                    <div className="search-empty">لا توجد صفحات تطابق البحث.</div>
                  )}
                </>
              ) : (
                <EmptyState
                  onNew={() => setProductModal({ mode: 'new', product: emptyProduct() })}
                  onImport={() => go('import')}
                />
              )}
            </>
          ) : (
            <NeedsBrand onCreate={() => setBrandModal({})} />
          )}
        </section>
      )}
      {view === 'gallery' && <GalleryView brands={brands} activeBrand={activeBrand} notify={notify} setConfirmModal={setConfirmModal} />}
      {view === 'import' && <section className="page-shell import-page">{activeBrand ? <><div className="import-hero"><span className="hero-icon"><Icon name="upload" size={27} /></span><p className="eyebrow">EXCEL COLUMN MAPPING & PREVIEW</p><h2>استيراد صفحات {activeBrand.nameAr}</h2><p>ارفع ملف Excel، حدد مطابقة كل عامود مع العنصر المناسب له، عاين البيانات، ثم أدرج الصفحات في الكتالوج.</p></div>{!rawFileState && !importRows.length && <div className="import-actions"><button className="import-card" onClick={downloadTemplate}><span><Icon name="download" size={23} /></span><div><strong>1. تنزيل قالب Excel</strong><p>يشمل الأعمدة الافتراضية وحقل variants للمقاسات المتعددة.</p></div><Icon name="arrow" size={19} /></button><button className="import-card" onClick={() => importInput.current?.click()}><span><Icon name="upload" size={23} /></span><div><strong>2. اختيار ملف Excel</strong><p>يدعم أي ملف XLSX أو XLS بأي ترتيب للأعمدة ويفتح واجهة المطابقة.</p></div><Icon name="arrow" size={19} /></button><input ref={importInput} type="file" accept=".xlsx,.xls" onChange={readExcel} /></div>}{rawFileState && !importRows.length && <section className="import-mapping"><div className="mapping-header"><div><h3><Icon name="tag" size={18} /> تحديد ومطابقة أعمدة الملف</h3><p>اختر لكل عنصر في الكتالوج العامود المقابل له في ملف Excel المرفوع:</p></div><div className="mapping-file-info"><span className="mapping-badge">الملف: {rawFileState.filename} ({rawFileState.rows.length} صف)</span><button className="button button-ghost" onClick={resetImport}>إلغاء الملف</button></div></div><div className="mapping-grid">{MAPPABLE_FIELDS.map((field) => <div key={field.key} className={['mapping-field-card', field.required && 'is-required'].filter(Boolean).join(' ')}><div className="mapping-field-label"><span>{field.label}</span>{field.required ? <span className="req">مطلوب</span> : <small className="mapping-field-hint">{field.hint}</small>}</div><select className="mapping-select" value={rawFileState.mapping[field.key] || ''} onChange={(e) => updateColumnMapping(field.key, e.target.value)}><option value="">-- تجاهل هذا الحقل --</option>{rawFileState.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>)}</div><div className="mapping-preview-section"><h4>معاينة حية للمطابقة (أول {Math.min(3, rawFileState.rows.length)} صفوف):</h4><div className="table-wrap"><table><thead><tr><th>الاسم بالعربي</th><th>الاسم بالإنجليزي</th><th>سعر الحبة</th><th>سعر الكرتون</th><th>عدد الكرتون</th><th>الوزن / الحجم</th><th>الباركود</th></tr></thead><tbody>{rawFileState.rows.slice(0, 3).map((r, i) => { const p = rowToProductWithMapping(r, rawFileState.mapping); const v = p.variants[0] || {}; return <tr key={i}><td><strong>{p.nameAr || '—'}</strong></td><td>{p.nameEn || '—'}</td><td>{v.pricePerPiece || '—'}</td><td>{v.pricePerCarton || '—'}</td><td>{v.qtyPerCarton || '—'}</td><td>{v.weight ? (v.weight + ' ' + (v.unit || '')) : '—'}</td><td dir="ltr">{p.barcode || '—'}</td></tr>; })}</tbody></table></div></div><div className="mapping-actions-bar"><button className="button button-ghost" onClick={resetImport}>إلغاء واختيار ملف آخر</button><button className="button button-primary" onClick={applyColumnMapping}><Icon name="check" size={17} /> تطبيق المطابقة ومعاينة البيانات ({rawFileState.rows.length} صف)</button></div></section>}{importRows.length > 0 && <section className="import-review"><div className="review-header"><div><h3>معاينة البيانات قبل الإدراج</h3><p>{importRows.length} صف جاهز للمراجعة. يمكنك تعديل أي صف أو حذفه، ثم الضغط على إدراج الصفحات في الكتالوج.</p></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{rawFileState && <button className="button button-ghost" onClick={() => setImportRows([])} title="العودة لشاشة مطابقة وتحديد الأعمدة"><Icon name="settings" size={15} /> تعديل مطابقة الأعمدة</button>}<button className="button button-ghost" onClick={resetImport}>إلغاء الملف</button><button className="button button-primary" disabled={busy} onClick={insertImportRows}><Icon name="check" size={17} /> {busy ? 'جاري الإدراج…' : 'إدراج ' + importRows.length + ' صفحة'}</button></div></div><div className="table-wrap"><table><thead><tr><th>المنتج</th><th>المقاسات</th><th>الباركود</th><th>إجراء</th></tr></thead><tbody>{importRows.map((row, index) => <tr key={row.id}><td><strong>{row.nameAr || 'بدون اسم عربي'}</strong><small>{row.nameEn}</small></td><td>{row.variants.map((variant) => variant.weight ? variant.weight + ' ' + normalizeUnit(variant.unit) : '—').join('، ')}</td><td dir="ltr">{row.barcode || '—'}</td><td><button className="table-action" onClick={() => setProductModal({ mode: 'import', index, product: row })}><Icon name="edit" size={15} /> تعديل</button><button className="table-action danger" onClick={() => setImportRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="trash" size={15} /> حذف</button></td></tr>)}</tbody></table></div></section>}</> : <NeedsBrand onCreate={() => setBrandModal({})} />}</section>}
      {view === 'settings' && <section className="page-shell settings-page">{activeBrand ? <form className="settings-card" onSubmit={updateBrandSettings}><div className="settings-intro"><h2>إعدادات {activeBrand.nameAr}</h2><p>تُطبّق على المعاينة وجميع صفحات PDF للبراند الحالي.</p></div><div className="settings-section"><h3>التذييل والعملة</h3><div className="form-grid two"><Field label="نص التذييل"><input value={mergeSettings(activeBrand.settings).footerText} onChange={(event) => updateSettings('footerText', event.target.value)} /></Field><Field label="رمز العملة"><input value={mergeSettings(activeBrand.settings).currency} onChange={(event) => updateSettings('currency', event.target.value)} /></Field></div></div><div className="settings-section"><h3>الحقول الظاهرة في صفحة المنتج</h3><div className="visibility-options">{[{ key: 'description', label: 'الوصف' }, { key: 'prices', label: 'سعر الحبة' }, { key: 'cartonPrice', label: 'سعر الكرتون' }, { key: 'carton', label: 'عدد الكرتون' }, { key: 'barcode', label: 'الباركود' }].map((option) => <label key={option.key} className="switch-row"><span>{option.label}</span><input type="checkbox" checked={mergeSettings(activeBrand.settings).visible[option.key] !== false} onChange={() => toggleVisible(option.key)} /><i /></label>)}</div></div><div className="settings-save"><button className="button button-primary" disabled={busy}><Icon name="check" size={18} />{busy ? 'جاري الحفظ…' : 'حفظ الإعدادات'}</button></div></form> : <NeedsBrand onCreate={() => setBrandModal({})} />}</section>}
    </section>
    {exporting && activeBrand && (
      <div className="pdf-stage" ref={pdfRef} aria-hidden="true">
        <CatalogWelcomeSheet brand={activeBrand} />
        {activeBrand?.products?.map((product) => {
          const pages = paginateProductVariants(product, mergeSettings(activeBrand.settings));
          return pages.map((pageVariants, pIdx) => (
            <ProductSheet
              key={`${product.id}-p${pIdx}`}
              brand={activeBrand}
              product={product}
              variants={pageVariants}
            />
          ));
        })}
        <CatalogClosingSheet brand={activeBrand} />
      </div>
    )}
    {brandModal && <BrandEditor brand={brandModal.id ? brandModal : null} brands={brands} onClose={() => setBrandModal(null)} onSaved={onBrandSaved} notify={notify} />}
    {productModal && activeBrand && <ProductEditor brand={activeBrand} brands={brands} product={productModal.product} title={productModal.mode === 'edit' ? 'تعديل صفحة المنتج' : productModal.mode === 'import' ? 'تعديل صف الملف المستورد' : 'صفحة منتج جديدة'} onClose={() => setProductModal(null)} onSaved={saveProduct} notify={notify} />}
    {previewModal && activeBrand && (
      <Modal
        title={'معاينة صفحة: ' + (previewModal.nameAr || previewModal.nameEn || 'صفحة الكتالوج')}
        subtitle={'الصفحة ' + (products.findIndex((p) => p.id === previewModal.id) + 2) + ' من ' + (products.length + 2) + ' في كتالوج ' + activeBrand.nameAr}
        onClose={() => setPreviewModal(null)}
        wide
      >
        <div className="catalog-preview-scroll">
          {paginateProductVariants(previewModal, mergeSettings(activeBrand.settings)).map((pageVariants, pIdx, allPages) => {
            const pageNum = products.findIndex((p) => p.id === previewModal.id) + 2;
            return (
              <div key={`${previewModal.id}-p${pIdx}`} className="catalog-preview-page-wrap">
                <div className="catalog-preview-page-header">
                  <strong>صفحة {pageNum}</strong>
                  <span>{previewModal.nameAr || previewModal.nameEn}{allPages.length > 1 ? ` (صفحة ${pIdx + 1} من ${allPages.length})` : ''}</span>
                </div>
                <ScaledPageWrapper scale={effectivePreviewScale}>
                  <ProductSheet
                    brand={activeBrand}
                    product={previewModal}
                    variants={pageVariants}
                  />
                </ScaledPageWrapper>
              </div>
            );
          })}
        </div>
      </Modal>
    )}
    {catalogPreviewModal && activeBrand && (() => {
      let pageNum = 2;
      return (
        <Modal
          title={'معاينة كتالوج: ' + activeBrand.nameAr}
          subtitle={'إجمالي صفحات الكتالوج مع الترحيب والختام'}
          onClose={() => setCatalogPreviewModal(false)}
          wide
        >
          <div className="catalog-preview-scroll">
            <div className="catalog-preview-page-wrap">
              <div className="catalog-preview-page-header">
                <strong>صفحة 1 (صفحة الترحيب)</strong>
                <span>{activeBrand.nameAr}</span>
              </div>
              <ScaledPageWrapper scale={effectiveCatalogScale}>
                <CatalogWelcomeSheet brand={activeBrand} />
              </ScaledPageWrapper>
            </div>

            {products.map((prod) => {
              const pages = paginateProductVariants(prod, mergeSettings(activeBrand.settings));
              return pages.map((pageVariants, pIdx) => {
                const currentPage = pageNum++;
                return (
                  <div key={`${prod.id}-p${pIdx}`} className="catalog-preview-page-wrap">
                    <div className="catalog-preview-page-header">
                      <strong>صفحة {currentPage}</strong>
                      <span>{prod.nameAr || prod.nameEn}{pages.length > 1 ? ` (صفحة ${pIdx + 1} من ${pages.length})` : ''}</span>
                    </div>
                    <ScaledPageWrapper scale={effectiveCatalogScale}>
                      <ProductSheet brand={activeBrand} product={prod} variants={pageVariants} />
                    </ScaledPageWrapper>
                  </div>
                );
              });
            })}

            <div className="catalog-preview-page-wrap">
              <div className="catalog-preview-page-header">
                <strong>صفحة {pageNum} (صفحة الختام)</strong>
                <span>خدمتكم تسعدنا</span>
              </div>
              <ScaledPageWrapper scale={effectiveCatalogScale}>
                <CatalogClosingSheet brand={activeBrand} />
              </ScaledPageWrapper>
            </div>
          </div>
        </Modal>
      );
    })()}
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
    {confirmModal && <ConfirmModal config={confirmModal} onClose={() => setConfirmModal(null)} />}
    {toast && (
      <div className="toast" role="status" aria-live="polite">
        <span className="toast-icon">
          <Icon name="check" size={15} />
        </span>
        <span className="toast-message">{toast.message}</span>
        <button type="button" onClick={() => setToast(null)} aria-label="إغلاق">
          <Icon name="close" size={14} />
        </button>
      </div>
    )}
  </main>;
}

function Stat({ icon, label, value }) {
  return <article className="stat-card"><span><Icon name={icon} size={20} /></span><div><strong>{value}</strong><p>{label}</p></div></article>;
}

function BrandCard({ brand, selected, onOpen, onEdit, onDelete }) {
  return (
    <article className={['brand-card', selected && 'selected'].filter(Boolean).join(' ')}>
      <div className="brand-card-hero" onClick={onOpen} style={{ cursor: 'pointer' }} title="فتح كتالوج البراند">
        {brand?.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.nameAr} className="brand-card-logo-img" />
        ) : (
          <div className="brand-card-logo-fallback">
            <b>{(brand?.nameAr || brand?.nameEn || 'B').slice(0, 1)}</b>
          </div>
        )}
        {selected && <span className="brand-active-tag">البراند النشط</span>}
      </div>

      <div className="brand-card-info">
        <div className="brand-card-titles">
          <h3>{brand.nameAr}</h3>
          <p>{brand.nameEn || 'بدون اسم إنجليزي'}</p>
        </div>
        <div className="brand-card-badge">
          <Icon name="file" size={13} />
          <span>{brand.productCount || 0} صفحة</span>
        </div>
      </div>

      <div className="brand-card-actions">
        <button className="button button-primary" onClick={onOpen}>
          فتح البراند <Icon name="arrow" size={15} />
        </button>
        <button className="button button-ghost" onClick={onEdit} aria-label="تعديل البراند" title="تعديل البراند">
          تعديل
        </button>
        {onDelete && (
          <button className="mini-danger" onClick={onDelete} aria-label="حذف البراند" title="حذف البراند">
            <Icon name="trash" size={15} />
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyState({ onNew, onImport }) {
  return <div className="empty-state"><span><Icon name="folder" size={31} /></span><h3>لا توجد صفحات بعد</h3><p>أنشئ صفحة منتج يدويًا أو استورد ملف Excel مع معاينة وتعديل قبل الإدراج.</p><div><button className="button button-primary" onClick={onNew}><Icon name="plus" size={18} /> صفحة جديدة</button>{onImport && <button className="button button-ghost" onClick={onImport}><Icon name="upload" size={18} /> استيراد</button>}</div></div>;
}

function NeedsBrand({ onCreate }) {
  return <div className="empty-state"><span><Icon name="tag" size={31} /></span><h3>أنشئ أو اختر براندًا أولًا</h3><p>كل منتج وكل صفحة في النظام مرتبطان ببراند مستقل وشعاره وإعداداته الخاصة.</p><button className="button button-primary" onClick={onCreate}><Icon name="plus" size={18} /> براند جديد</button></div>;
}
