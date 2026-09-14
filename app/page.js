'use client';

import { useState, useRef, useCallback } from 'react';
import { Icons } from '../components/icons';

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
  { key: 'footer', labelAr: 'نص التذييل', labelEn: 'Footer Text' }
];

const DEFAULT_VISIBILITY = {};
FIELD_CONFIG.forEach(f => { DEFAULT_VISIBILITY[f.key] = true; });

export default function Home() {
  const [currentView, setCurrentView] = useState('create');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editorStep, setEditorStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [product, setProduct] = useState({
    nameAr: '', nameEn: '', descAr: '', descEn: '',
    weight: '', unit: '', qtyPerCarton: '', pricePerPiece: '',
    pricePerCarton: '', barcode: '', image: null, footerText: 'السعر غير شامل الضريبة'
  });
  const [visibility, setVisibility] = useState({ ...DEFAULT_VISIBILITY });
  const [imagePreview, setImagePreview] = useState(null);
  
  const [bulkProducts, setBulkProducts] = useState([]);
  const [importSummary, setImportSummary] = useState(null);

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
      const html = catalogRef.current.innerHTML;
      let css = '';
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            css += rule.cssText + '\n';
          }
        } catch (e) {}
      }
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, css }),
      });
      if (!response.ok) throw new Error('Server error');
      const blob = await response.blob();
      const { saveAs } = await import('file-saver');
      const fileName = product.nameEn ? `catalog-${product.nameEn.replace(/\s+/g, '-').toLowerCase()}.pdf` : 'product-catalog.pdf';
      saveAs(blob, fileName);
    } catch (err) {
      alert('حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      setIsGenerating(false);
    }
  }, [product.nameEn]);

  const handleBulkUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      if (rows.length === 0) return alert('الملف فارغ');
      
      const parsed = rows.map((row) => ({
        _id: Math.random().toString(36).substr(2, 9),
        nameAr: row.nameAr || '', nameEn: row.nameEn || '',
        weight: row.weight || '', pricePerCarton: row.pricePerCarton || '',
        pricePerPiece: row.pricePerPiece || '', status: 'صالح'
      }));
      setImportSummary({ total: parsed.length, valid: parsed.length, error: 0 });
      setBulkProducts(parsed);
    } catch (err) {
      alert('حدث خطأ أثناء قراءة الملف');
    } finally {
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    }
  }, []);

  const confirmImport = () => {
    alert(`تم استيراد ${bulkProducts.length} منتج بنجاح!`);
    setImportSummary(null);
    setCurrentView('products');
  };

  const navItems = [
    { id: 'create', icon: <Icons.Plus />, label: 'إنشاء منتج' },
    { id: 'import', icon: <Icons.Upload />, label: 'استيراد المنتجات' },
    { id: 'products', icon: <Icons.List />, label: 'منتجاتي' },
    { id: 'templates', icon: <Icons.Layout />, label: 'القوالب' }
  ];

  const getPageTitle = () => navItems.find(n => n.id === currentView)?.label || '';

  // --- Render Views ---
  const renderCreateView = () => (
    <div className="editor-layout">
      {/* Form Area */}
      <div className="editor-form">
        <div className="step-indicator">
          <div className={`step-item ${editorStep === 1 ? 'active' : ''}`} onClick={() => setEditorStep(1)} style={{cursor: 'pointer'}}>
            <span>1</span> معلومات المنتج
          </div>
          <div className="step-divider"></div>
          <div className={`step-item ${editorStep === 2 ? 'active' : ''}`} onClick={() => setEditorStep(2)} style={{cursor: 'pointer'}}>
            <span>2</span> التفاصيل
          </div>
          <div className="step-divider"></div>
          <div className={`step-item ${editorStep === 3 ? 'active' : ''}`} onClick={() => setEditorStep(3)} style={{cursor: 'pointer'}}>
            <span>3</span> العرض
          </div>
        </div>

        {editorStep === 1 && (
          <div className="section-panel">
            <h3 className="section-title">معلومات المنتج الأساسية</h3>
            <p className="section-subtitle">أدخل البيانات الأساسية التي ستظهر في تصميم المنتج.</p>
            
            <div className="form-group">
              <label className="form-label">صورة المنتج</label>
              {!imagePreview ? (
                <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                  <div className="flex justify-center"><Icons.Image /></div>
                  <div className="mt-4" style={{fontSize: '14px', fontWeight: 600}}>ارفع صورة المنتج</div>
                  <div className="text-muted" style={{fontSize: '12px'}}>PNG أو JPG — بحد أقصى 5 ميجابايت</div>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{display: 'none'}} />
                </div>
              ) : (
                <div style={{position: 'relative', display: 'inline-block', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '4px'}}>
                  <img src={imagePreview} alt="Preview" style={{height: '100px', borderRadius: '4px'}} />
                  <button onClick={removeImage} className="btn btn-danger btn-icon" style={{position: 'absolute', top: '8px', right: '8px', borderRadius: '50%', padding: '4px'}}>
                    <Icons.X />
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">اسم المنتج بالعربي *</label>
              <input className="form-control" value={product.nameAr} onChange={e => handleChange('nameAr', e.target.value)} placeholder="مثال: ويسكاس طعام قطط بالدجاج" />
            </div>

            <div className="form-group">
              <label className="form-label">اسم المنتج بالإنجليزي *</label>
              <input className="form-control" value={product.nameEn} onChange={e => handleChange('nameEn', e.target.value)} placeholder="e.g. Whiskas Chicken in Jelly" dir="ltr" />
            </div>

            <div className="form-group">
              <label className="form-label">وصف مختصر</label>
              <textarea className="form-control" value={product.descAr} onChange={e => handleChange('descAr', e.target.value)} placeholder="طعام متكامل للقطط البالغة..."></textarea>
            </div>
            
            <button className="btn btn-primary" style={{width: '100%'}} onClick={() => setEditorStep(2)}>التالي</button>
          </div>
        )}

        {editorStep === 2 && (
          <div className="section-panel">
            <h3 className="section-title">تفاصيل المنتج</h3>
            <p className="section-subtitle">أدخل تفاصيل التعبئة والأسعار.</p>
            
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">الوزن</label>
                <input className="form-control" value={product.weight} onChange={e => handleChange('weight', e.target.value)} placeholder="400" />
              </div>
              <div className="form-group">
                <label className="form-label">الوحدة</label>
                <select className="form-control" value={product.unit} onChange={e => handleChange('unit', e.target.value)}>
                  <option value="">اختر...</option>
                  <option value="جم">جم</option>
                  <option value="كجم">كجم</option>
                  <option value="مل">مل</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">سعر الحبة</label>
                <input className="form-control" value={product.pricePerPiece} onChange={e => handleChange('pricePerPiece', e.target.value)} placeholder="35" />
              </div>
              <div className="form-group">
                <label className="form-label">سعر الكرتونة</label>
                <input className="form-control" value={product.pricePerCarton} onChange={e => handleChange('pricePerCarton', e.target.value)} placeholder="420" />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">العدد بالكرتون</label>
                <input className="form-control" value={product.qtyPerCarton} onChange={e => handleChange('qtyPerCarton', e.target.value)} placeholder="12" />
              </div>
              <div className="form-group">
                <label className="form-label">الباركود</label>
                <input className="form-control" value={product.barcode} onChange={e => handleChange('barcode', e.target.value)} placeholder="622..." dir="ltr" />
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditorStep(1)}>السابق</button>
              <button className="btn btn-primary" style={{flex: 1}} onClick={() => setEditorStep(3)}>التالي</button>
            </div>
          </div>
        )}

        {editorStep === 3 && (
          <div className="section-panel">
            <h3 className="section-title">إعدادات العرض</h3>
            <p className="section-subtitle">حدد العناصر التي ترغب بإظهارها في التصميم.</p>
            
            <ul style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              {FIELD_CONFIG.map(field => (
                <li key={field.key} className="flex items-center justify-between" style={{paddingBottom: '12px', borderBottom: '1px solid var(--border)'}}>
                  <span style={{fontSize: '14px', fontWeight: 500}}>{field.labelAr}</span>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={visibility[field.key]} onChange={() => toggleVisibility(field.key)} />
                    <span className="toggle-slider"></span>
                  </label>
                </li>
              ))}
            </ul>
            
            <div className="flex gap-4 mt-4">
              <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditorStep(2)}>السابق</button>
            </div>
          </div>
        )}
      </div>

      {/* Live Preview Area */}
      <div className="editor-preview">
        <div className="flex items-center justify-between" style={{padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)'}}>
          <div>
            <div style={{fontWeight: 700, fontSize: '14px'}}>المعاينة المباشرة</div>
            <div className="text-muted" style={{fontSize: '12px'}}>شاهد التغييرات فوراً أثناء التعديل</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-icon"><Icons.Eye /></button>
          </div>
        </div>
        <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'hidden', background: '#F1F3F5'}}>
          
          {/* Card Preview Container */}
          <div ref={catalogRef} style={{width: '320px', height: '420px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)', position: 'relative', display: 'flex', flexDirection: 'column'}}>
            {/* Simple Mockup of the exported card */}
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
              {visibility.image && (imagePreview ? <img src={imagePreview} style={{height: '140px', objectFit: 'contain', marginBottom: '16px'}} /> : <div style={{height: '140px', width: '100%', background: '#f5f5f5', borderRadius: '8px', marginBottom: '16px'}}></div>)}
              {visibility.nameAr && <div style={{fontSize: '20px', fontWeight: 800, color: '#1a2332'}}>{product.nameAr || 'اسم المنتج'}</div>}
              {visibility.nameEn && <div style={{fontSize: '12px', color: '#666', marginTop: '4px'}}>{product.nameEn || 'Product Name'}</div>}
              {visibility.descAr && <div style={{fontSize: '12px', marginTop: '8px', color: '#555'}}>{product.descAr}</div>}
              
              <div style={{display: 'flex', justifyContent: 'center', gap: '16px', marginTop: 'auto', width: '100%'}}>
                {visibility.weight && <div style={{textAlign: 'center'}}><div style={{fontSize: '10px', color: '#888'}}>الوزن</div><div style={{fontWeight: 700, fontSize: '14px'}}>{product.weight || '-'} {product.unit}</div></div>}
                {visibility.pricePerPiece && <div style={{textAlign: 'center'}}><div style={{fontSize: '10px', color: '#888'}}>سعر الحبة</div><div style={{fontWeight: 700, fontSize: '14px'}}>{product.pricePerPiece || '-'} ج</div></div>}
              </div>
            </div>
          </div>
          {/* End Card Preview */}
          
        </div>
      </div>
    </div>
  );

  const renderImportView = () => (
    <div style={{maxWidth: '800px', margin: '0 auto'}}>
      {!importSummary ? (
        <>
          <div className="section-panel text-center">
            <h3 className="section-title">استيراد المنتجات</h3>
            <p className="section-subtitle">أضف مجموعة كبيرة من المنتجات باستخدام ملف Excel أو CSV.</p>
            
            <div className="upload-area" onClick={() => bulkInputRef.current?.click()} style={{padding: '48px 24px', margin: '32px 0'}}>
              <div className="flex justify-center" style={{marginBottom: '16px', color: 'var(--accent)'}}>
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
              <div style={{fontSize: '18px', fontWeight: 600}}>اسحب ملف Excel أو CSV هنا</div>
              <div className="text-muted mt-4">أو اضغط لاختيار ملف من جهازك</div>
              <input type="file" ref={bulkInputRef} onChange={handleBulkUpload} accept=".xlsx, .xls, .csv" style={{display: 'none'}} />
            </div>
            
            <button className="btn btn-ghost">تحميل نموذج جاهز</button>
          </div>
          
          <div className="section-panel">
            <h3 className="section-title">خيارات الاستيراد</h3>
            <ul style={{display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px'}}>
              <li className="flex items-center justify-between">
                <span style={{fontSize: '14px'}}>تجاهل المنتجات المكررة</span>
                <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider"></span></label>
              </li>
              <li className="flex items-center justify-between">
                <span style={{fontSize: '14px'}}>تحديث المنتجات الموجودة</span>
                <label className="toggle-switch"><input type="checkbox" /><span className="toggle-slider"></span></label>
              </li>
            </ul>
          </div>
        </>
      ) : (
        <div className="section-panel">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">مراجعة البيانات قبل الاستيراد</h3>
              <p className="section-subtitle">راجع البيانات وتأكد من عدم وجود أخطاء.</p>
            </div>
            <div className="flex gap-4">
              <div style={{textAlign: 'center'}}><div style={{fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)'}}>{importSummary.total}</div><div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>الإجمالي</div></div>
              <div style={{textAlign: 'center'}}><div style={{fontSize: '24px', fontWeight: 800, color: 'var(--success)'}}>{importSummary.valid}</div><div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>صالح</div></div>
            </div>
          </div>
          
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم بالعربي</th>
                  <th>الاسم بالإنجليزي</th>
                  <th>الوزن</th>
                  <th>السعر</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {bulkProducts.map((p, i) => (
                  <tr key={i}>
                    <td>{p.nameAr || '-'}</td>
                    <td dir="ltr" style={{textAlign: 'right'}}>{p.nameEn || '-'}</td>
                    <td>{p.weight || '-'}</td>
                    <td>{p.pricePerCarton || '-'}</td>
                    <td><span className="badge badge-success">صالح</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex gap-4 mt-4 pt-4" style={{borderTop: '1px solid var(--border)'}}>
            <button className="btn btn-primary" onClick={confirmImport}>استيراد {importSummary.total} منتجاً</button>
            <button className="btn btn-secondary" onClick={() => setImportSummary(null)}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );

  const renderProductsView = () => (
    <div className="section-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title">منتجاتي</h3>
          <p className="section-subtitle">إدارة المنتجات التي أضفتها أو استوردتها.</p>
        </div>
        <div className="flex gap-2">
          <div style={{position: 'relative'}}>
            <input className="form-control" placeholder="بحث عن منتج..." style={{paddingRight: '36px', width: '250px'}} />
            <div style={{position: 'absolute', right: '10px', top: '10px', color: 'var(--text-secondary)'}}><Icons.Search /></div>
          </div>
          <button className="btn btn-primary" onClick={() => setCurrentView('create')}><Icons.Plus /> منتج جديد</button>
        </div>
      </div>
      
      {bulkProducts.length > 0 ? (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم المنتج بالعربي</th>
                <th>اسم المنتج بالإنجليزي</th>
                <th>السعر</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {bulkProducts.map((p, i) => (
                <tr key={i}>
                  <td style={{fontWeight: 600}}>{p.nameAr || 'بدون اسم'}</td>
                  <td dir="ltr" style={{textAlign: 'right'}}>{p.nameEn || '-'}</td>
                  <td>{p.pricePerCarton || '-'} ج</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-icon"><Icons.Edit /></button>
                      <button className="btn btn-ghost btn-icon"><Icons.Copy /></button>
                      <button className="btn btn-ghost btn-icon" style={{color: 'var(--danger)'}}><Icons.Trash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center" style={{padding: '64px 24px'}}>
          <div className="flex justify-center mb-4 text-muted"><Icons.Layout /></div>
          <h4 style={{fontSize: '16px', fontWeight: 700}}>لا توجد منتجات بعد</h4>
          <p className="text-muted mt-4">ابدأ بإنشاء منتج جديد أو استيراد مجموعة من المنتجات.</p>
          <div className="flex justify-center gap-4 mt-4">
            <button className="btn btn-primary" onClick={() => setCurrentView('create')}>إنشاء منتج</button>
            <button className="btn btn-secondary" onClick={() => setCurrentView('import')}>استيراد المنتجات</button>
          </div>
        </div>
      )}
    </div>
  );

  const renderTemplatesView = () => (
    <div className="section-panel">
      <h3 className="section-title mb-4">القوالب</h3>
      <p className="section-subtitle mb-4">اختر القالب المناسب لتصميم منتجاتك.</p>
      
      <div className="grid-3">
        {[1, 2, 3].map(i => (
          <div key={i} style={{border: i === 1 ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', cursor: 'pointer', background: 'var(--surface)'}}>
            <div style={{background: 'var(--surface-secondary)', height: '160px', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Icons.Layout />
            </div>
            <div style={{fontWeight: 700, fontSize: '14px'}}>قالب حديث 0{i}</div>
            <div className="text-muted" style={{fontSize: '12px', marginTop: '4px'}}>تصميم نظيف ومناسب للعرض الرقمي</div>
            {i === 1 && <div className="mt-4"><span className="badge badge-success">نشط حالياً</span></div>}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app-shell" dir="rtl">
      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90}} onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Right Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <div style={{color: 'var(--accent)'}}><Icons.Layout /></div>
            أداة كتالوج المنتجات
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => { setCurrentView(item.id); setIsMobileMenuOpen(false); }}
            >
              {item.icon} {item.label}
            </button>
          ))}
          <div style={{margin: '16px 0', borderBottom: '1px solid var(--border)'}}></div>
          <button className="nav-item">
            <Icons.Settings /> إعدادات النظام
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="flex items-center gap-3">
            <div style={{width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700}}>م</div>
            <div>
              <div style={{fontSize: '13px', fontWeight: 700}}>مستخدم النظام</div>
              <div style={{fontSize: '11px', color: 'var(--text-secondary)'}}>admin@example.com</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-wrapper">
        <header className="top-header">
          <div className="flex items-center gap-4">
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <Icons.Menu />
            </button>
            <h1 className="header-title">{getPageTitle()}</h1>
          </div>
          
          <div className="header-actions">
            {currentView === 'create' && (
              <>
                <button className="btn btn-ghost" style={{display: 'none' /* hide on small */}}>حفظ كمسودة</button>
                <button className="btn btn-primary" onClick={handleDownloadPDF} disabled={isGenerating}>
                  {isGenerating ? 'جاري التصدير...' : <><Icons.Download /> تصدير التصميم</>}
                </button>
              </>
            )}
          </div>
        </header>
        
        <div className="content-area">
          {currentView === 'create' && renderCreateView()}
          {currentView === 'import' && renderImportView()}
          {currentView === 'products' && renderProductsView()}
          {currentView === 'templates' && renderTemplatesView()}
        </div>
      </main>
    </div>
  );
}
