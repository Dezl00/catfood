'use client';

import { useState, useRef, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePageCard({ id, product, index, onDelete, onEdit, onImageDrop }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onImageDrop(e.dataTransfer.files[0], id);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      className="page-card"
      style={{ ...style, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'grab' }}
      {...attributes} 
      {...listeners}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
        <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit(index); }} onPointerDown={e => e.stopPropagation()} style={{ background: 'var(--bg-section)', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: 'var(--primary)' }} title="تعديل">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(index); }} onPointerDown={e => e.stopPropagation()} style={{ background: '#fee2e2', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#dc2626' }} title="حذف">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
      <div style={{ alignSelf: 'center', margin: '8px 0', pointerEvents: 'none' }}>
        {product.imagePreview ? (
          <img src={product.imagePreview} alt="Preview" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '4px' }} />
        ) : (
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--border-color)" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        )}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{product.nameAr || 'بدون اسم'}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>صفحة {index + 1}</div>
    </div>
  );
}

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
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [editingPageIndex, setEditingPageIndex] = useState(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState(1);
  const [bulkEditMode, setBulkEditMode] = useState(false);

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

      const parsedProducts = rows.map((row) => ({
        _id: Math.random().toString(36).substr(2, 9),
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
      setBulkStep(1);
      setBulkEditMode(false);
      setBulkModalOpen(true);

    } catch (err) {
      console.error('Bulk generation error:', err);
      alert('حدث خطأ أثناء قراءة الملف الجماعي');
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setBulkProducts((items) => {
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleGridImageDrop = useCallback((file, id) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setBulkProducts(prev => {
          const index = prev.findIndex(p => p._id === id);
          if (index === -1) return prev;
          const newProducts = [...prev];
          newProducts[index].imagePreview = ev.target.result;
          newProducts[index].image = file;
          return newProducts;
        });
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleGridDelete = useCallback((index) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الصفحة؟')) {
      setBulkProducts(prev => prev.filter((_, i) => i !== index));
    }
  }, []);

  const handleGridEdit = useCallback((index) => {
    setEditingPageIndex(index);
  }, []);

  const handleSavePageEdit = (e) => {
    e.preventDefault();
    setEditingPageIndex(null);
  };

  return (
    <div className="app-wrapper">
      {/* Sidebar - Form Controls */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </span>
            أداة كتالوج المنتجات
          </h2>
        </div>

        <div className="sidebar-content">

          {/* Product Image */}
          {visibility.image && (
            <div className="form-section">
              <div className="form-section-title">صورة المنتج</div>
              <div
                className={`image-upload-zone ${imagePreview ? 'has-image' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    fileInputRef.current.files = e.dataTransfer.files;
                    handleImageUpload({ target: { files: e.dataTransfer.files } });
                  }
                }}
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
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
              <div className="form-grid">
                {visibility.nameAr && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
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
                  <div className="form-group" style={{ marginBottom: 0 }}>
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
              <div className="form-grid">
                {visibility.weight && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
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
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>الوحدة</label>
                    <input
                      type="text"
                      placeholder="مثال: ml"
                      value={product.unit}
                      onChange={(e) => handleChange('unit', e.target.value)}
                    />
                  </div>
                )}
                {visibility.qtyPerCarton && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
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
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>سعر الحبة</label>
                    <input
                      type="text"
                      placeholder="مثال: 12"
                      value={product.pricePerPiece}
                      onChange={(e) => handleChange('pricePerPiece', e.target.value)}
                    />
                  </div>
                )}
                {visibility.pricePerCarton && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
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

          {/* Advanced Settings */}
          <div className="advanced-settings-section">
            <button 
              className={`advanced-settings-toggle ${showAdvancedSettings ? 'open' : ''}`}
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            >
              <span className="toggle-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                إعدادات متقدمة
              </span>
              <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div className={`advanced-settings-content ${showAdvancedSettings ? 'show' : ''}`}>
              <div className="form-section">
                <div className="form-section-title">نص التذييل</div>
                <div className="form-group">
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="مثال: السعر غير شامل الضريبة"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>

              {/* Visibility Toggles */}
              <div className="visibility-section">
                <div className="form-section-title" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>إظهار / إخفاء الحقول</div>
                <div className="toggle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
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
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sidebar-actions" style={{ display: 'flex', gap: '10px', marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
          {/* Export PDF */}
          <button 
            className="btn btn-primary" 
            onClick={handleDownloadPDF} 
            disabled={isGenerating || bulkProducts.length > 0}
            title="تصدير PDF (الصفحة الحالية)"
            style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            {isGenerating ? (
              <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </button>
          
          {/* Upload Bulk */}
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
            title="رفع إكسل جماعي"
            style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#2e7d32', borderColor: '#2e7d32' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </button>

          {/* Download Template */}
          <button 
            className="btn btn-secondary" 
            onClick={handleDownloadTemplate} 
            title="تنزيل قالب إكسل"
            style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </button>

          {/* Reset */}
          <button 
            className="btn btn-secondary" 
            onClick={handleReset} 
            title="إعادة تعيين"
            style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#d32f2f' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
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
                            ? (
                                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px', justifyContent: 'center', direction: 'rtl' }}>
                                  {visibility.unit && prod.unit && <span>{prod.unit}</span>}
                                  <span dir="ltr">{prod.weight}</span>
                                </div>
                              )
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

      {/* Bulk Upload Wizard Modal */}
      {bulkModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ background: 'var(--bg-card)', width: '90vw', height: '90vh', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--primary)' }}>
                {bulkStep === 1 ? 'مراجعة وتعديل البيانات' : 'ترتيب وتصدير الصفحات'}
              </h2>
              <button onClick={() => setBulkModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--bg-page)' }}>
              {bulkStep === 1 ? (
                <div className="bulk-table-container" style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead style={{ background: 'var(--primary)', color: '#fff' }}>
                      <tr>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border-light)' }}>الاسم (ع)</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border-light)' }}>الاسم (E)</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border-light)' }}>الباركود</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border-light)' }}>السعر</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border-light)' }}>إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkProducts.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '12px' }}>
                            {bulkEditMode ? <input type="text" value={p.nameAr} onChange={e => {
                                const newP = [...bulkProducts];
                                newP[i].nameAr = e.target.value;
                                setBulkProducts(newP);
                            }} style={{ width: '100%', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px' }} /> : p.nameAr}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {bulkEditMode ? <input type="text" value={p.nameEn} onChange={e => {
                                const newP = [...bulkProducts];
                                newP[i].nameEn = e.target.value;
                                setBulkProducts(newP);
                            }} style={{ width: '100%', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px' }} /> : p.nameEn}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {bulkEditMode ? <input type="text" value={p.barcode} onChange={e => {
                                const newP = [...bulkProducts];
                                newP[i].barcode = e.target.value;
                                setBulkProducts(newP);
                            }} style={{ width: '100%', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px' }} /> : p.barcode}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {bulkEditMode ? <input type="text" value={p.pricePerPiece} onChange={e => {
                                const newP = [...bulkProducts];
                                newP[i].pricePerPiece = e.target.value;
                                setBulkProducts(newP);
                            }} style={{ width: '100%', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px' }} /> : p.pricePerPiece}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <button onClick={() => {
                                const newP = bulkProducts.filter((_, idx) => idx !== i);
                                setBulkProducts(newP);
                            }} style={{ background: 'transparent', color: '#dc2626', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }} title="حذف">
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bulk-pages-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '20px' }}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={bulkProducts.map(p => p._id)} strategy={rectSortingStrategy}>
                      {bulkProducts.map((p, i) => (
                        <SortablePageCard 
                          key={p._id} 
                          id={p._id} 
                          product={p} 
                          index={i} 
                          onDelete={handleGridDelete} 
                          onEdit={handleGridEdit} 
                          onImageDrop={handleGridImageDrop} 
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ padding: '20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
              {bulkStep === 1 ? (
                <>
                  <button className="btn btn-secondary" onClick={() => setBulkEditMode(!bulkEditMode)}>
                    {bulkEditMode ? 'إغلاق التعديل المباشر' : 'تعديل جماعي'}
                  </button>
                  <button className="btn btn-primary" onClick={() => setBulkStep(2)} disabled={bulkProducts.length === 0}>
                    تأكيد ومتابعة للصفحات
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setBulkStep(1)}>
                    رجوع للبيانات
                  </button>
                  <button className="btn btn-primary" onClick={() => { setBulkModalOpen(false); handleDownloadPDF(); }} disabled={isGenerating}>
                    {isGenerating ? 'جاري التصدير...' : 'تصدير PDF النهائي'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Single Page Modal */}
      {editingPageIndex !== null && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ background: 'var(--bg-card)', width: '600px', maxWidth: '90vw', maxHeight: '90vh', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--primary)' }}>تعديل صفحة المنتج</h2>
              <button onClick={() => setEditingPageIndex(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <form onSubmit={handleSavePageEdit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>الاسم بالعربي</label>
                    <input type="text" value={bulkProducts[editingPageIndex].nameAr} onChange={e => {
                      const newP = [...bulkProducts];
                      newP[editingPageIndex].nameAr = e.target.value;
                      setBulkProducts(newP);
                    }} />
                  </div>
                  <div className="form-group">
                    <label>الاسم بالانجليزي</label>
                    <input type="text" value={bulkProducts[editingPageIndex].nameEn} onChange={e => {
                      const newP = [...bulkProducts];
                      newP[editingPageIndex].nameEn = e.target.value;
                      setBulkProducts(newP);
                    }} />
                  </div>
                  <div className="form-group">
                    <label>السعر</label>
                    <input type="text" value={bulkProducts[editingPageIndex].pricePerPiece} onChange={e => {
                      const newP = [...bulkProducts];
                      newP[editingPageIndex].pricePerPiece = e.target.value;
                      setBulkProducts(newP);
                    }} />
                  </div>
                  <div className="form-group">
                    <label>الباركود</label>
                    <input type="text" value={bulkProducts[editingPageIndex].barcode} onChange={e => {
                      const newP = [...bulkProducts];
                      newP[editingPageIndex].barcode = e.target.value;
                      setBulkProducts(newP);
                    }} />
                  </div>
                </div>
                <div style={{ marginTop: '20px', textAlign: 'left' }}>
                  <button type="submit" className="btn btn-primary">حفظ وإغلاق</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
