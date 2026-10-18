'use client';

import { useState, useEffect } from 'react';

export default function AiVisualMatchModal({
  isOpen,
  onClose,
  brand,
  brands = [],
  selectedFolder = null,
  onApplied,
  notify,
}) {
  const [phase, setPhase] = useState('setup'); // 'setup' | 'scanning' | 'results'
  const [activeBrandId, setActiveBrandId] = useState(brand?.id || '');
  const [targetFolder, setTargetFolder] = useState(selectedFolder || brand?.id || 'all');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [keyStats, setKeyStats] = useState({ totalKeys: 4, activeKey: 1 });
  const [progressText, setProgressText] = useState('');
  const [results, setResults] = useState({ matched: [], unmatched: [], allProducts: [] });
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [customAssignments, setCustomAssignments] = useState({});
  const [activeTab, setActiveTab] = useState('matched');
  const [saving, setSaving] = useState(false);

  const currentBrand = brands.find((b) => b.id === activeBrandId) || brand;
  const products = currentBrand?.products || [];
  const productsWithoutImages = products.filter((p) => !p.imageUrl || !p.imageUrl.trim());

  useEffect(() => {
    if (!isOpen) return;
    setPhase('setup');
    setCustomAssignments({});
    // Fetch key status
    fetch('/api/ai-match')
      .then((res) => res.json())
      .then((data) => {
        if (data.totalKeys) {
          setKeyStats({ totalKeys: data.totalKeys, activeKey: data.activeKey || 1 });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartScan = async () => {
    if (!activeBrandId) {
      notify('يرجى اختيار براند أولاً.', 'warning');
      return;
    }

    setPhase('scanning');
    setProgressText('جاري فحص الصور بالذكاء الاصطناعي (Gemini Vision) وتحليل العبوات والتصميمات...');

    try {
      const res = await fetch('/api/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan',
          brandId: activeBrandId,
          folder: targetFolder === 'all' ? undefined : targetFolder,
          overwriteExisting,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشلت عملية الفحص والمطابقة.');
      }

      setResults({
        matched: data.matched || [],
        unmatched: data.unmatched || [],
        allProducts: data.allProducts || products,
      });

      // Select all matched by default
      const allSelected = new Set((data.matched || []).map((_, idx) => idx));
      setSelectedIndices(allSelected);
      setActiveTab((data.matched || []).length > 0 ? 'matched' : 'unmatched');
      setPhase('results');
    } catch (err) {
      notify(err.message, 'warning');
      setPhase('setup');
    }
  };

  const toggleSelectMatch = (idx) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleProductChange = (mediaId, productId) => {
    setCustomAssignments((prev) => ({
      ...prev,
      [mediaId]: productId,
    }));
  };

  const handleApply = async () => {
    const toApply = [];

    // Add selected matches
    results.matched.forEach((m, idx) => {
      if (selectedIndices.has(idx)) {
        const assignedProductId = customAssignments[m.mediaId] !== undefined
          ? customAssignments[m.mediaId]
          : m.product?.id;
        if (assignedProductId) {
          toApply.push({
            productId: assignedProductId,
            imageUrl: m.imageUrl,
          });
        }
      }
    });

    // Add any manually assigned from unmatched
    results.unmatched.forEach((u) => {
      const assignedProductId = customAssignments[u.mediaId];
      if (assignedProductId) {
        toApply.push({
          productId: assignedProductId,
          imageUrl: u.imageUrl,
        });
      }
    });

    if (!toApply.length) {
      notify('يرجى تحديد صورة واحدة على الأقل للاعتماد.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          brandId: activeBrandId,
          matches: toApply,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حفظ وتحديث الصور.');
      }

      notify(data.message || `تم بنجاح ربط ${data.updatedCount} منتج بالصور.`);
      if (onApplied) onApplied(data.products);
      onClose();
    } catch (err) {
      notify(err.message, 'warning');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--wide ai-match-modal" role="dialog" aria-modal="true" style={{ maxWidth: 840 }}>
        {/* Header */}
        <header className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3Z" />
                <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                الربط البصري الذكي للصور (Vision AI)
              </h2>
              <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                مطابقة تصميم ونكهات وعبوة كل صورة تلقائياً مع اسم ووصف المنتج في الكتالوج
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="إغلاق"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {/* Content Body */}
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <div className="ai-match-container">
            {/* 1. SETUP PHASE */}
            {phase === 'setup' && (
              <>
                <div className="ai-match-info-card">
                  <div className="ai-match-info-header">
                    <strong style={{ fontSize: 13.5, color: '#4c1d95' }}>
                      ⚡ نظام المطابقة التلقائية متعدد المفاتيح (Multi-Key Rotation)
                    </strong>
                    <span className="ai-match-keys-badge">
                      <span>✓ {keyStats.totalKeys} مفاتيح Gemini جاهزة</span>
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b21a8', lineHeight: 1.5 }}>
                    يقوم النظام بقراءة النصوص والنكهات والتصميم والأوزان المطبوعة على عبوة المنتج داخل الصورة ومقارنتها فوراً ببيانات جدولك. إذا وصل أي مفتاح للحد الأقصى، يتم التبديل تلقائياً للمفتاح التالي فوراً.
                  </p>
                </div>

                <div className="ai-match-stats-row">
                  <div className="ai-stat-box">
                    <span>البراند النشط</span>
                    <strong>{currentBrand?.nameAr || 'غير محدد'}</strong>
                  </div>
                  <div className="ai-stat-box">
                    <span>إجمالي منتجات البراند</span>
                    <strong>{products.length} منتج</strong>
                  </div>
                  <div className="ai-stat-box">
                    <span>منتجات بدون صور</span>
                    <strong style={{ color: productsWithoutImages.length ? '#e11d48' : '#15803d' }}>
                      {productsWithoutImages.length} منتج
                    </strong>
                  </div>
                </div>

                <div className="ai-match-options">
                  <strong style={{ fontSize: 13, color: '#334155' }}>خيارات الفحص:</strong>
                  <label className="ai-option-item">
                    <input
                      type="checkbox"
                      checked={!overwriteExisting}
                      onChange={(e) => setOverwriteExisting(!e.target.checked)}
                    />
                    <span>
                      <strong>فقط المنتجات التي ليس لها صورة حالياً</strong> (موصى به لحماية أي صور رفعتها يدوياً)
                    </span>
                  </label>
                  <label className="ai-option-item">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                    />
                    <span>
                      <strong>السماح بإعادة مطابقة واستبدال الصور لجميع المنتجات</strong> (حتى التي تحتوي على صورة مسبقاً)
                    </span>
                  </label>
                </div>

                {brands.length > 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>
                      البراند المستهدف:
                    </label>
                    <select
                      value={activeBrandId}
                      onChange={(e) => setActiveBrandId(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 13,
                      }}
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nameAr} ({b.products?.length || 0} منتج)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* 2. SCANNING PHASE */}
            {phase === 'scanning' && (
              <div className="ai-scanning-box">
                <div className="ai-spinner" />
                <h3 style={{ margin: 0, fontSize: 16, color: '#1e293b' }}>
                  جاري التحليل البصري ومطابقة المنتجات...
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 440 }}>
                  {progressText}
                </p>
                <div style={{ fontSize: 12, color: '#9333ea', background: '#faf5ff', padding: '6px 14px', borderRadius: 9999 }}>
                  المفتاح النشط حالياً: #{keyStats.activeKey} (التبديل التلقائي مفعّل عند الحاجة)
                </div>
              </div>
            )}

            {/* 3. RESULTS PHASE */}
            {phase === 'results' && (
              <>
                <div className="ai-tabs-bar">
                  <button
                    type="button"
                    className={['ai-tab-btn', activeTab === 'matched' && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => setActiveTab('matched')}
                  >
                    <span>✅ تمت المطابقة بنجاح</span>
                    <strong style={{ background: '#dcfce7', color: '#15803d', padding: '1px 7px', borderRadius: 9999, fontSize: 11 }}>
                      {results.matched.length}
                    </strong>
                  </button>
                  <button
                    type="button"
                    className={['ai-tab-btn', activeTab === 'unmatched' && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => setActiveTab('unmatched')}
                  >
                    <span>❓ صور غير مؤكدة / متبقية</span>
                    <strong style={{ background: '#fef3c7', color: '#b45309', padding: '1px 7px', borderRadius: 9999, fontSize: 11 }}>
                      {results.unmatched.length}
                    </strong>
                  </button>
                </div>

                {activeTab === 'matched' && (
                  <div className="ai-results-list">
                    {results.matched.length === 0 ? (
                      <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                        لم يتم العثور على مطابقات مؤكدة. راجع تبويب الصور غير المؤكدة أو جرب خيار استبدال الصور الحالية.
                      </div>
                    ) : (
                      results.matched.map((m, idx) => {
                        const isSelected = selectedIndices.has(idx);
                        const assignedId = customAssignments[m.mediaId] !== undefined
                          ? customAssignments[m.mediaId]
                          : m.product?.id;
                        return (
                          <div
                            key={m.mediaId || idx}
                            className={['ai-match-card', isSelected && 'is-selected'].filter(Boolean).join(' ')}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectMatch(idx)}
                              style={{ marginTop: 26, width: 18, height: 18, accentColor: '#9333ea', cursor: 'pointer' }}
                              title="تضمين في الحفظ"
                            />
                            <img src={m.imageUrl} alt={m.filename} className="ai-match-thumb" />
                            <div className="ai-match-content">
                              <div className="ai-match-top-row">
                                <strong style={{ fontSize: 13.5, color: '#0f172a' }}>
                                  {m.product?.nameAr || 'منتج غير مسمى'}
                                </strong>
                                <span className="ai-confidence-pill">
                                  {Math.round((m.confidence || 0.95) * 100)}% تطابق مؤكد
                                </span>
                              </div>

                              {m.detectedDetails && (
                                <div className="ai-detected-chips">
                                  {m.detectedDetails.flavor && (
                                    <span className="ai-detected-chip">
                                      نكهة: {m.detectedDetails.flavor}
                                    </span>
                                  )}
                                  {m.detectedDetails.targetAnimal && (
                                    <span className="ai-detected-chip">
                                      الفئة: {m.detectedDetails.targetAnimal}
                                    </span>
                                  )}
                                  {m.detectedDetails.lifeStage && (
                                    <span className="ai-detected-chip">
                                      العمر: {m.detectedDetails.lifeStage}
                                    </span>
                                  )}
                                  {m.detectedDetails.productType && (
                                    <span className="ai-detected-chip">
                                      القوام: {m.detectedDetails.productType}
                                    </span>
                                  )}
                                  {m.detectedDetails.weight && (
                                    <span className="ai-detected-chip">
                                      الوزن: {m.detectedDetails.weight}
                                    </span>
                                  )}
                                </div>
                              )}

                              <p className="ai-match-reason" style={{ margin: 0 }}>
                                💡 {m.reason}
                              </p>

                              {/* Manual Override Dropdown */}
                              <div className="ai-target-product-row">
                                <span style={{ fontSize: 11.5, color: '#475569', whiteSpace: 'nowrap' }}>
                                  ربط بالمنتج:
                                </span>
                                <select
                                  className="ai-product-select"
                                  value={assignedId || ''}
                                  onChange={(e) => handleProductChange(m.mediaId, e.target.value)}
                                >
                                  {results.allProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nameAr || p.nameEn || p.id}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {activeTab === 'unmatched' && (
                  <div className="ai-results-list">
                    {results.unmatched.length === 0 ? (
                      <div style={{ padding: 30, textAlign: 'center', color: '#15803d', fontSize: 13 }}>
                        رائع! تم التعرف على جميع الصور بنجاح ولا توجد صور متبقية.
                      </div>
                    ) : (
                      results.unmatched.map((u, idx) => {
                        const assignedId = customAssignments[u.mediaId] || '';
                        return (
                          <div key={u.mediaId || idx} className="ai-match-card">
                            <img src={u.imageUrl} alt={u.filename} className="ai-match-thumb" />
                            <div className="ai-match-content">
                              <div className="ai-match-top-row">
                                <strong style={{ fontSize: 13, color: '#64748b' }}>
                                  {u.filename}
                                </strong>
                                <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 9999 }}>
                                  لم يتم العثور على مطابقة تلقائية
                                </span>
                              </div>
                              <p className="ai-match-reason" style={{ margin: 0, color: '#94a3b8' }}>
                                {u.reason || 'لم يتطابق تصميم هذه العبوة بنسبة كافية مع أي منتج في هذا البراند.'}
                              </p>
                              <div className="ai-target-product-row">
                                <span style={{ fontSize: 11.5, color: '#475569', whiteSpace: 'nowrap' }}>
                                  تعيين يدوي لهذا المنتج:
                                </span>
                                <select
                                  className="ai-product-select"
                                  value={assignedId}
                                  onChange={(e) => handleProductChange(u.mediaId, e.target.value)}
                                >
                                  <option value="">-- اختر منتجاً لربطه بهذه الصورة يدوياً --</option>
                                  {results.allProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nameAr || p.nameEn}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid #e4e4e7', background: '#fafafa' }}>
          {phase === 'setup' && (
            <>
              <button type="button" className="button button-ghost" onClick={onClose}>
                إلغاء
              </button>
              <button
                type="button"
                className="button button-ai-match"
                onClick={handleStartScan}
                disabled={!products.length}
              >
                <span>⚡ بدء الفحص والمطابقة البصرية</span>
              </button>
            </>
          )}

          {phase === 'scanning' && (
            <button type="button" className="button button-ghost" onClick={() => setPhase('setup')}>
              إلغاء الفحص
            </button>
          )}

          {phase === 'results' && (
            <>
              <button type="button" className="button button-ghost" onClick={() => setPhase('setup')}>
                إعادة الفحص
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleApply}
                disabled={saving || (selectedIndices.size === 0 && Object.keys(customAssignments).length === 0)}
              >
                {saving
                  ? 'جاري حفظ التحديثات…'
                  : `اعتماد وحفظ (${selectedIndices.size + Object.keys(customAssignments).filter(k => customAssignments[k]).length}) صورة بالكتالوج`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
