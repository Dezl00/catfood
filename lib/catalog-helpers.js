export const UNIT_MAP = {
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
  'oz': 'oz',
  'أونصة': 'oz',
  'lb': 'lb',
  'باوند': 'lb',
};

export function normalizeUnit(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (['g', 'جم', 'جرام', 'غرام', 'gram', 'grams'].includes(lower)) return 'g';
  if (['kg', 'كجم', 'كيلو', 'كيلوغرام', 'كيلو غرام'].includes(lower)) return 'kg';
  if (['l', 'لتر', 'ليتر', 'liter', 'liters'].includes(lower)) return 'L';
  if (['ml', 'مل', 'ملل', 'مليلتر'].includes(lower)) return 'ml';
  if (['pcs', 'حبة', 'حبه', 'قطع', 'قطعة'].includes(lower)) return 'pcs';
  if (['oz', 'أونصة'].includes(lower)) return 'oz';
  if (['lb', 'باوند'].includes(lower)) return 'lb';
  return UNIT_MAP[raw] || UNIT_MAP[lower] || raw;
}

export function extractUnitFromWeight(str) {
  if (!str) return '';
  const s = String(str).toLowerCase();
  if (/(?<![a-z])kg(?![a-z])|كيلو|كغ/.test(s)) return 'kg';
  if (/(?<![a-z])ml(?![a-z])|مل/.test(s)) return 'ml';
  if (/(?<![a-z])lb(?![a-z])|باوند/.test(s)) return 'lb';
  if (/(?<![a-z])oz(?![a-z])|أونصة/.test(s)) return 'oz';
  if (/(?<![a-z])pcs(?![a-z])|حبة|حبات|قطع|قطعة/.test(s)) return 'pcs';
  if (/(?<![a-z])l(?![a-z])|لتر/.test(s)) return 'L';
  if (/(?<![a-z])g(?![a-z])|جرام|جم/.test(s)) return 'g';
  return '';
}

export function extractWeightAndUnit(text) {
  if (!text) return null;
  const s = String(text).trim();
  // Match number (including decimals like 1.5, 0.5) followed by unit
  const match = s.match(/(\d+(?:\.\d+)?)\s*(كجم|كيلو\s*غرام|كيلوغرام|كيلو|كغ|جرام|غرام|جم|مليلتر|ملل|مل|ليتر|لتر|باوند|أونصة|حبة|حبات|قطع|قطعة|kg|gms?|gm|g|ml|ltr|liters?|l|lbs?|oz|pcs)(?!\w)/i);
  if (match) {
    return {
      weight: match[1],
      unit: normalizeUnit(match[2]),
    };
  }
  return null;
}

export const MAPPABLE_FIELDS = [
  { key: 'nameAr', label: 'الاسم بالعربي', required: true, hint: 'الاسم العربي الأساسي لصفحة المنتج' },
  { key: 'nameEn', label: 'الاسم بالإنجليزي', required: false, hint: 'الاسم الإنجليزي في الشارة المستطيلة' },
  { key: 'pricePerPiece', label: 'سعر الحبة', required: false, hint: 'سعر القطعة الفردية في الجدول' },
  { key: 'pricePerCarton', label: 'سعر الكرتون', required: false, hint: 'سعر كرتون المنتج في الجدول' },
  { key: 'qtyPerCarton', label: 'العدد في الكرتون', required: false, hint: 'عدد الحبات المعبأة بالكرتون' },
  { key: 'barcode', label: 'الباركود (Barcode)', required: false, hint: 'رقم الباركود أو رمز الصنف' },
  { key: 'descriptionAr', label: 'الوصف بالعربي', required: false, hint: 'النص في الصندوق الأيمن' },
  { key: 'descriptionEn', label: 'الوصف بالإنجليزي', required: false, hint: 'النص في الصندوق الأيسر' },
  { key: 'imageUrl', label: 'رابط الصورة', required: false, hint: 'رابط مباشر لصورة المنتج (اختياري)' },
];


export function autoDetectMapping(headers) {
  const mapping = {};
  for (const f of MAPPABLE_FIELDS) mapping[f.key] = '';

  for (const rawHeader of headers) {
    const raw = String(rawHeader || '').trim();
    if (!raw) continue;
    const clean = raw.toLowerCase().replace(/[\s_\-]+/g, '');

    // Handle description headers first to avoid false positives
    const isDesc = clean.includes('وصف') || clean.includes('desc');
    if (isDesc) {
      const en = /انجليز|إنجليز|english|(^|[^a-z])en($|[^a-z])/.test(clean);
      if (en && !mapping.descriptionEn) mapping.descriptionEn = raw;
      else if (!en && !mapping.descriptionAr) mapping.descriptionAr = raw;
      continue;
    }

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

export function getTableColumns(visible, variants = []) {
  const showWeight = true; // Always visible
  const showCarton = visible?.carton !== false;
  const showPrice = visible?.prices !== false;
  const showBarcode = visible?.barcode !== false;
  const showCartonPrice = visible?.cartonPrice !== false && variants.some((v) => Boolean(String(v.pricePerCarton || '').trim()));

  const activeCols = [];
  if (showBarcode) activeCols.push({ key: 'barcode', title: 'باركود', weight: 1.54, align: 'ltr' });
  if (showCartonPrice) activeCols.push({ key: 'cartonPrice', title: 'سعر الكرتون', weight: 1.0, align: 'ltr' });
  if (showPrice) activeCols.push({ key: 'price', title: showCartonPrice ? 'سعر الحبة' : 'السعر', weight: 1.0, align: 'ltr' });
  if (showCarton) activeCols.push({ key: 'carton', title: 'العدد بالكرتون', weight: 1.30, align: 'ltr' });
  if (showWeight) activeCols.push({ key: 'weight', title: 'الوزن', weight: 0.70, align: 'ltr' });

  if (activeCols.length === 0) return [];

  const totalWidth = 516.50;
  if (activeCols.length === 1) {
    const width = Math.min(200, totalWidth);
    const left = Number((32.50 + (totalWidth - width) / 2).toFixed(2));
    return [{ ...activeCols[0], left, width }];
  }

  const gap = 4.7;
  const totalGaps = (activeCols.length - 1) * gap;
  const availableWidth = totalWidth - totalGaps;
  const totalWeight = activeCols.reduce((sum, c) => sum + c.weight, 0);

  let currentLeft = 32.50;
  return activeCols.map((col) => {
    const width = Number(((col.weight / totalWeight) * availableWidth).toFixed(1));
    const left = Number(currentLeft.toFixed(2));
    currentLeft += width + gap;
    return { ...col, left, width };
  });
}

export function estimateDescHeight(product) {
  const ar = (product?.descriptionAr || '').trim();
  const en = (product?.descriptionEn || '').trim();
  if (!ar && !en) return 0;
  const arLines = ar ? ar.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 42)), 0) : 0;
  const arNeeded = arLines > 0 ? (arLines * 16.5 + 8.0) : 0;
  const enLines = en ? en.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 38)), 0) : 0;
  const enNeeded = enLines > 0 ? (enLines * 14.5 + 8.0) : 0;
  return Number(Math.max(52.0, arNeeded, enNeeded).toFixed(1));
}

export function computeProductLayout(product, settings, variants = []) {
  const hasDescAr = settings?.visible?.description !== false && Boolean(product.descriptionAr?.trim());
  const hasDescEn = settings?.visible?.description !== false && Boolean(product.descriptionEn?.trim());
  const hasDescriptions = hasDescAr || hasDescEn;

  const rowCount = Math.max(1, variants.length);
  const tableHeight = 22.5 + rowCount * 28;

  const descHeight = hasDescriptions ? estimateDescHeight(product) : 0;
  const enDescHeight = descHeight; // Strict 1:1 linked height with Arabic box

  // Fixed safe gap above table so description never collides or touches table
  const descToTableGap = hasDescriptions ? 22.0 : 0;
  const cardToDescGap = hasDescriptions ? 28.0 : 36.0;

  // Table top positioned safely above footer
  const tableTop = Math.min(715.0, 765.0 - tableHeight);

  // Description bottom is anchored above table:
  const descBottom = hasDescriptions ? tableTop - descToTableGap : tableTop;

  // Description top expands UPWARDS as descHeight increases:
  const descTop = hasDescriptions ? descBottom - descHeight : 0;

  // Card bottom sits above description top:
  const cardBottom = hasDescriptions ? descTop - cardToDescGap : tableTop - cardToDescGap;

  // Image card height absorbs the difference, shrinking upwards as description grows
  const cardHeight = Math.max(140.0, cardBottom - 145.8);

  // Name pill centered on card bottom border (y = cardBottom)
  const pillHeight = 17.93;
  const pillTop = cardBottom - pillHeight / 2;
  const nameArTop = pillTop - 25.94;

  return {
    cardHeight,
    cardBottom,
    pillTop,
    nameArTop,
    hasDescAr,
    hasDescEn,
    hasDescriptions,
    descHeight,
    enDescHeight,
    descTop,
    descBottom,
    tableTop,
  };
}

export function getVariantsPerPage(product, settings) {
  const hasDescAr = settings?.visible?.description !== false && Boolean(product.descriptionAr?.trim());
  const hasDescEn = settings?.visible?.description !== false && Boolean(product.descriptionEn?.trim());
  const hasDescriptions = hasDescAr || hasDescEn;
  const descHeight = hasDescriptions ? estimateDescHeight(product) : 0;
  const descToTableGap = hasDescriptions ? 22.0 : 0;
  const cardToDescGap = hasDescriptions ? 28.0 : 36.0;
  // Maximum height available for table given min card height of 150
  const maxTableHeight = 765.0 - (145.8 + 150.0 + cardToDescGap + descHeight + descToTableGap);
  return Math.max(1, Math.floor((maxTableHeight - 22.5) / 28.0));
}

export function paginateProductVariants(product, settings) {
  const allVariants = product.variants?.length ? product.variants : [{ id: 'empty' }];
  const perPage = getVariantsPerPage(product, settings);
  if (allVariants.length <= perPage) {
    return [allVariants];
  }
  const pages = [];
  for (let i = 0; i < allVariants.length; i += perPage) {
    pages.push(allVariants.slice(i, i + perPage));
  }
  return pages;
}
