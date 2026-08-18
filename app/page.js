'use client';

import { useState, useRef, useCallback } from 'react';

const FIELD_CONFIG = [
  { key: 'image', labelAr: 'الصورة', labelEn: 'Image' },
  { key: 'nameAr', labelAr: 'الاسم بالعربي', labelEn: 'Arabic Name' },
  { key: 'nameEn', labelAr: 'الاسم بالانجليزي', labelEn: 'English Name' },
  { key: 'descAr', labelAr: 'الوصف بالعربي', labelEn: 'Arabic Desc' },
  { key: 'descEn', labelAr: 'الوصف بالانجليزي', labelEn: 'English Desc' },
  { key: 'weight', labelAr: 'الوزن', labelEn: 'Weight' },
  { key: 'unit', labelAr: 'الوحدة', labelEn: 'Unit' },
  { key: 'qtyPerCarton', labelAr: 'العدد بالكرتون', labelEn: 'Qty/Carton' },
  { key: 'pricePerPiece', labelAr: 'سعر الحبة', labelEn: 'Piece Price' },
  { key: 'pricePerCarton', labelAr: 'سعر الكرتون', labelEn: 'Carton Price' },
  { key: 'barcode', labelAr: 'الباركود', labelEn: 'Barcode' },
];

const DEFAULT_VISIBILITY = {};
FIELD_CONFIG.forEach(f => { DEFAULT_VISIBILITY[f.key] = true; });

export default function Home() {
  const [product, setProduct] = useState({
    nameAr: '',
    nameEn: '',
    descAr: '',
    descEn: '',
    weight: '',
    unit: '',
    qtyPerCarton: '',
    pricePerPiece: '',
    pricePerCarton: '',
    barcode: '',
    image: null,
  });

  const [categoryAr, setCategoryAr] = useState('');
  const [categoryEn, setCategoryEn] = useState('');
  const [footerText, setFooterText] = useState('السعر غير شامل الضريبة');
  const [visibility, setVisibility] = useState({ ...DEFAULT_VISIBILITY });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [imagePreview, setImagePreview] = useState(null);
  const [bulkProducts, setBulkProducts] = useState([]);

  const catalogRef = useRef(null);
  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);

  const handleChange = useCallback((field, value) => {
    setProduct(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target.result);
        setProduct(prev => ({ ...prev, image: file }));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const removeImage = useCallback(() => {
    setImagePreview(null);
    setProduct(prev => ({ ...prev, image: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const toggleVisibility = useCallback((key) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    if (!catalogRef.current) return;
    setIsGenerating(true);

    try {
      // Grab the exact HTML as rendered in preview
      const html = catalogRef.current.innerHTML;
      
      // Fetch the CSS from the page stylesheets
      let css = '';
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            css += rule.cssText + '\n';
          }
        } catch (e) {
          // Skip cross-origin stylesheets
        }
      }

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, css }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error');
      }

      const blob = await response.blob();
      const { saveAs } = await import('file-saver');
      
      const fileName = bulkProducts.length > 0 
        ? 'catalog-bulk.pdf' 
        : (product.nameEn ? `catalog-${product.nameEn.replace(/\s+/g, '-').toLowerCase()}.pdf` : 'product-catalog.pdf');
        
      saveAs(blob, fileName);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('حدث خطأ أثناء إنشاء ملف PDF: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  }, [product.nameEn, bulkProducts]);

  const handleDownloadTemplate = useCallback(() => {
    Promise.all([import('xlsx'), import('file-saver')]).then(([XLSX, FileSaver]) => {
      const headers = [
        'categoryAr', 'categoryEn', 'nameAr', 'nameEn',
        'descAr', 'descEn', 'weight', 'unit', 'qtyPerCarton',
        'pricePerPiece', 'pricePerCarton', 'barcode', 'imageUrl'
      ];
      
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ['طعام قطط', 'Cat Food', 'معجون بيفيس', 'Beavis Paste', 'وصف قصير بالعربي...', 'Short English desc...', '75', 'ml', '12', '10', '120', '123456789', '']
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      FileSaver.saveAs(blob, 'product-catalog-template.xlsx');
    });
  }, []);

  const handleBulkUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      
      if (rows.length === 0) {
        alert('الملف فارغ');
        return;
      }

      setIsBulkGenerating(true);
      setBulkProgress({ current: 0, total: rows.length });

      const parsedProducts = rows.map((row) => ({
        nameAr: row.nameAr || '',
        nameEn: row.nameEn || '',
        descAr: row.descAr || '',
        descEn: row.descEn || '',
        weight: row.weight || '',
        unit: row.unit || '',
        qtyPerCarton: row.qtyPerCarton || '',
        pricePerPiece: row.pricePerPiece || '',
        pricePerCarton: row.pricePerCarton || '',
        barcode: row.barcode || '',
        imagePreview: row.imageUrl || null,
        categoryAr: row.categoryAr || categoryAr,
        categoryEn: row.categoryEn || categoryEn,
      }));

      setBulkProducts(parsedProducts);

      // Wait for DOM to render the bulk products and images to hopefully load
      setTimeout(() => {
        setIsBulkGenerating(false);
        setBulkProgress({ current: 0, total: 0 });
        // Removed auto window.print() so the user can review and click Download Bulk PDF.
      }, 1000);

    } catch (err) {
      console.error('Bulk generation error:', err);
      alert('حدث خطأ أثناء الإنشاء الجماعي');
      setIsBulkGenerating(false);
      setBulkProgress({ current: 0, total: 0 });
    } finally {
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    }
  }, [categoryAr, categoryEn]);

  const handleReset = useCallback(() => {
    setProduct({
      nameAr: '', nameEn: '', descAr: '', descEn: '',
      weight: '', unit: '', qtyPerCarton: '',
      pricePerPiece: '', pricePerCarton: '', barcode: '', image: null,
    });
    setImagePreview(null);
    setCategoryAr('');
    setCategoryEn('');
    setBulkProducts([]);
    setFooterText('السعر غير شامل الضريبة');
    setVisibility({ ...DEFAULT_VISIBILITY });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Determine which table columns are visible
  const tableFields = [
    { key: 'weight', label: 'الوزن' },
    { key: 'qtyPerCarton', label: 'العدد بالكرتون' },
    { key: 'pricePerPiece', label: 'سعر الحبة' },
    { key: 'pricePerCarton', label: 'سعر الكرتون' },
  ];
  const visibleTableFields = tableFields.filter(f => visibility[f.key]);
  const hasDescription = visibility.descAr || visibility.descEn;

  const currentProductData = {
    ...product,
    categoryAr,
    categoryEn,
    imagePreview
  };

  const productsToRender = bulkProducts.length > 0 ? bulkProducts : [currentProductData];

  return (
    <div className="app-wrapper">
      {/* Sidebar - Form Controls */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>
            <span className="icon">📦</span>
            أداة كتالوج المنتجات
          </h2>
        </div>

        <div className="sidebar-content">
          {/* Visibility Toggles */}
          <div className="visibility-section">
            <div className="form-section-title">إظهار / إخفاء الحقول</div>
            <div className="toggle-grid">
              {FIELD_CONFIG.map(field => (
                <div
                  key={field.key}
                  className={`toggle-item ${visibility[field.key] ? 'active' : ''}`}
                  onClick={() => toggleVisibility(field.key)}
                >
                  <div className="toggle-switch" />
                  <span className="toggle-label">{field.labelAr}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Product Image */}
          {visibility.image && (
            <div className="form-section">
              <div className="form-section-title">صورة المنتج</div>
              <div
                className={`image-upload-zone ${imagePreview ? 'has-image' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" />
                    <button
                      className="remove-image-btn"
                      onClick={(e) => { e.stopPropagation(); removeImage(); }}
                      title="حذف الصورة"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="upload-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>اضغط لرفع صورة المنتج</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product Names */}
          {(visibility.nameAr || visibility.nameEn) && (
            <div className="form-section">
              <div className="form-section-title">اسم المنتج</div>
              {visibility.nameAr && (
                <div className="form-group">
                  <label>الاسم بالعربي</label>
                  <input
                    type="text"
                    placeholder="مثال: بيفيس معجون للقطط المعقمة"
                    value={product.nameAr}
                    onChange={(e) => handleChange('nameAr', e.target.value)}
                  />
                </div>
              )}
              {visibility.nameEn && (
                <div className="form-group">
                  <label>الاسم بالانجليزي</label>
                  <input
                    type="text"
                    placeholder="e.g. Beavis Cat Sterilized Hairball Control Paste"
                    value={product.nameEn}
                    onChange={(e) => handleChange('nameEn', e.target.value)}
                    style={{ fontFamily: 'var(--font-en)', direction: 'ltr', textAlign: 'left' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Descriptions */}
          {(visibility.descAr || visibility.descEn) && (
            <div className="form-section">
              <div className="form-section-title">الوصف</div>
              {visibility.descAr && (
                <div className="form-group">
                  <label>الوصف بالعربي</label>
                  <textarea
                    placeholder="وصف المنتج بالعربي..."
                    value={product.descAr}
                    onChange={(e) => handleChange('descAr', e.target.value)}
                    rows={3}
                  />
                </div>
              )}
              {visibility.descEn && (
                <div className="form-group">
                  <label>الوصف بالانجليزي</label>
                  <textarea
                    placeholder="Product description in English..."
                    value={product.descEn}
                    onChange={(e) => handleChange('descEn', e.target.value)}
                    rows={3}
                    style={{ fontFamily: 'var(--font-en)', direction: 'ltr', textAlign: 'left' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Product Details */}
          {(visibility.weight || visibility.unit || visibility.qtyPerCarton ||
            visibility.pricePerPiece || visibility.pricePerCarton) && (
            <div className="form-section">
              <div className="form-section-title">تفاصيل المنتج</div>
              <div className="form-row">
                {visibility.weight && (
                  <div className="form-group">
                    <label>الوزن</label>
                    <input
                      type="text"
                      placeholder="مثال: 75"
                      value={product.weight}
                      onChange={(e) => handleChange('weight', e.target.value)}
                    />
                  </div>
                )}
                {visibility.unit && (
                  <div className="form-group">
                    <label>الوحدة</label>
                    <input
                      type="text"
                      placeholder="مثال: ml"
                      value={product.unit}
                      onChange={(e) => handleChange('unit', e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="form-row">
                {visibility.qtyPerCarton && (
                  <div className="form-group">
                    <label>العدد بالكرتون</label>
                    <input
                      type="text"
                      placeholder="مثال: 12"
                      value={product.qtyPerCarton}
                      onChange={(e) => handleChange('qtyPerCarton', e.target.value)}
                    />
                  </div>
                )}
                {visibility.pricePerPiece && (
                  <div className="form-group">
                    <label>سعر الحبة</label>
                    <input
                      type="text"
                      placeholder="مثال: 12"
                      value={product.pricePerPiece}
                      onChange={(e) => handleChange('pricePerPiece', e.target.value)}
                    />
                  </div>
                )}
              </div>
              {visibility.pricePerCarton && (
                <div className="form-group">
                  <label>سعر الكرتون</label>
                  <input
                    type="text"
                    placeholder="مثال: 144"
                    value={product.pricePerCarton}
                    onChange={(e) => handleChange('pricePerCarton', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Barcode */}
          {visibility.barcode && (
            <div className="form-section">
              <div className="form-section-title">الباركود</div>
              <div className="form-group">
                <label>رقم الباركود</label>
                <input
                  type="text"
                  placeholder="مثال: 8682631211974"
                  value={product.barcode}
                  onChange={(e) => handleChange('barcode', e.target.value)}
                  style={{ fontFamily: 'var(--font-en)', direction: 'ltr', textAlign: 'left', letterSpacing: '1.5px' }}
                />
              </div>
            </div>
          )}

          {/* Footer Text */}
          <div className="footer-input-group">
            <label>نص التذييل</label>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="مثال: السعر غير شامل الضريبة"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="sidebar-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleDownloadPDF} 
            disabled={isGenerating}
            style={bulkProducts.length > 0 ? { background: '#2e7d32' } : {}}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isGenerating ? 'جاري التصدير...' : (bulkProducts.length > 0 ? 'تصدير PDF مجمع' : 'تصدير PDF')}
          </button>
          <button className="btn btn-secondary" onClick={handleReset} disabled={isGenerating}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            إعادة تعيين
          </button>

          <div className="bulk-actions" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
            <div className="form-section-title">إنشاء جماعي (Excel)</div>
            <button className="btn btn-secondary" onClick={handleDownloadTemplate} style={{ marginBottom: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              تنزيل قالب إكسل
            </button>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              ref={bulkInputRef} 
              style={{ display: 'none' }} 
              onChange={handleBulkUpload} 
            />
            <button 
              className="btn btn-primary" 
              onClick={() => bulkInputRef.current?.click()} 
              disabled={isGenerating || isBulkGenerating}
              style={{ background: '#2e7d32' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              رفع وإنشاء ملفات متعددة للطباعة
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content - Catalog Preview */}
      <main className="main-content">
        <div ref={catalogRef} style={{ width: '595px', display: 'flex', flexDirection: 'column' }}>
          {productsToRender.map((prod, index) => (
            <div 
              key={index} 
              className="catalog-page" 
              style={{ 
                pageBreakAfter: index < productsToRender.length - 1 ? 'always' : 'auto',
                marginBottom: index < productsToRender.length - 1 ? '20px' : '0' 
              }}
            >
              {/* Header */}
              <div className="catalog-header">
              <div className="cat-name-ar">
                كات فود
              </div>
              <div className="cat-name-en">
                CAT FOOD
              </div>
            </div>

            {/* Product Card */}
            <div className="product-card">
              {/* Image and Titles Wrapper */}
              <div className="image-and-title-wrapper" style={{ position: 'relative', marginBottom: '56px', marginTop: '0px' }}>
                
                {/* Image */}
                {visibility.image && (
                  <div className="product-image-section">
                    {prod.imagePreview ? (
                      <img src={prod.imagePreview} alt={prod.nameAr || 'Product'} />
                    ) : (
                      <div className="product-image-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        <span>صورة المنتج</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Titles (Bottom Edge) */}
                <div className="product-titles-wrapper" style={{
                  position: 'absolute',
                  bottom: '-14px',
                  left: '0',
                  right: '0',
                  textAlign: 'center',
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px'
                }}>
                  {/* Product Name AR (Inside the frame, above English name) */}
                  {visibility.nameAr && (
                    <div className="product-title-ar">
                      {prod.nameAr || <span className="empty-field">اسم المنتج بالعربي</span>}
                    </div>
                  )}

                  {/* Product Name EN (Exactly on bottom edge) */}
                  {visibility.nameEn && (
                    <div className="product-title-en">
                      {prod.nameEn || <span className="empty-field">Product Name in English</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {hasDescription && (
                <div className="product-description" style={{
                  justifyContent: 'center',
                  flexDirection: (!visibility.descEn && visibility.descAr) || (visibility.descEn && !visibility.descAr) ? 'column' : 'row',
                }}>
                  {visibility.descAr && (
                    <div className="desc-ar" style={{
                      maxWidth: !visibility.descEn ? '100%' : undefined,
                    }}>
                      {prod.descAr || <span className="empty-field">وصف المنتج بالعربي</span>}
                    </div>
                  )}
                  {visibility.descEn && (
                    <div className="desc-en" style={{
                      maxWidth: !visibility.descAr ? '100%' : undefined,
                    }}>
                      {prod.descEn || <span className="empty-field">Product description in English</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Info and Barcode Grid */}
              {(visibleTableFields.length > 0 || visibility.barcode) && (
                <div className="details-grid">
                  {visibleTableFields.map(f => (
                    <div key={f.key} className="detail-item">
                      <div className="detail-label">{f.label}</div>
                      <div className="detail-value">
                        {f.key === 'weight'
                          ? (prod.weight
                            ? `${prod.weight}${visibility.unit && prod.unit ? ' ' + prod.unit : ''}`
                            : <span className="empty-field">-</span>)
                          : (prod[f.key] || <span className="empty-field">-</span>)
                        }
                      </div>
                    </div>
                  ))}

                  {visibility.barcode && (
                    <div className="detail-item barcode-item">
                      <div className="detail-label">باركود</div>
                      <div className="detail-value barcode-value">
                        {prod.barcode || <span className="empty-field">0000000000000</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

              {/* Footer */}
              {footerText && (
                <div className="catalog-footer">
                  <div className="footer-note">{footerText}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Loading Overlay */}
      {(isGenerating || isBulkGenerating) && (
        <div className="loading-overlay">
          <div className="loading-box">
            <div className="loading-spinner" />
            <p>
              {isBulkGenerating 
                ? 'جاري تجهيز المنتجات للطباعة الجماعية...' 
                : 'جاري تجهيز المنتج للطباعة...'}
            </p>
            <div className="loading-sub">الرجاء الانتظار قليلاً</div>
          </div>
        </div>
      )}
    </div>
  );
}
