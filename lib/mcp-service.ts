import crypto from 'node:crypto';
import {
  ensureSchema,
  listBrands,
  getBrand,
  createBrand,
  updateBrand,
  createProducts,
  updateProduct,
  listMedia,
  createMediaRecord,
  getMediaFoldersWithCounts,
} from './database.js';
import { uploadImageDetailed } from './cloudinary.js';
import { extractWeightAndUnit, normalizeUnit, extractUnitFromWeight } from './catalog-helpers.js';
import { sanitizeText, sanitizeBarcode, sanitizeUrl, sanitizeNumberString } from './sanitize.ts';

// Reuse database pool helper
// Note: We use raw connection pool from globalThis for custom transactions
function getPool() {
  const globalWithPool = globalThis as unknown as { catalogPool?: { connect: () => Promise<any>; query: (...args: any[]) => Promise<any> } };
  if (!globalWithPool.catalogPool) {
    throw new Error('Database pool is not initialized. Ensure DATABASE_URL is set.');
  }
  return globalWithPool.catalogPool;
}

export interface ProductVariantInput {
  id?: string;
  weight?: string;
  unit?: string;
  sku?: string;
  qtyPerCarton?: string;
  pricePerPiece?: string;
  pricePerCarton?: string;
}

export interface ImportProductItemInput {
  id?: string;
  nameAr?: string;
  nameEn?: string;
  categoryAr?: string;
  categoryEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  barcode?: string;
  imageUrl?: string;
  weight?: string;
  unit?: string;
  qtyPerCarton?: string;
  pricePerPiece?: string;
  pricePerCarton?: string;
  variants?: ProductVariantInput[];
}

export interface NormalizedImportProduct {
  id: string;
  brandId: string;
  nameAr: string;
  nameEn: string;
  categoryAr: string;
  categoryEn: string;
  descriptionAr: string;
  descriptionEn: string;
  barcode: string;
  imageUrl: string;
  variants: Array<{
    id: string;
    weight: string;
    unit: string;
    sku: string;
    qtyPerCarton: string;
    pricePerPiece: string;
    pricePerCarton: string;
  }>;
  idempotencyKey: string;
}

export interface ImportProductsOptions {
  dryRun?: boolean;
  idempotencyKeyField?: 'auto' | 'barcode' | 'name';
  onDuplicate?: 'update' | 'skip' | 'error';
}

export interface ImportProductsResult {
  success: boolean;
  dryRun: boolean;
  brandId: string;
  totalReceived: number;
  validCount: number;
  errorCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: Array<{ index: number; product: Partial<ImportProductItemInput>; error: string }>;
  preview?: NormalizedImportProduct[];
  createdProducts?: NormalizedImportProduct[];
  updatedProducts?: NormalizedImportProduct[];
}

/**
 * Normalizes an incoming product using the exact same business logic as the Excel import:
 * - Smart extraction of weight and unit from Arabic and English product names
 * - Automatic unit normalization (جم -> g, كيلو -> kg, etc.)
 * - Strict sanitization of texts, barcode, prices
 */
export function normalizeIncomingProduct(
  raw: ImportProductItemInput,
  brandId: string,
  idempotencyField: 'auto' | 'barcode' | 'name' = 'auto'
): { product: NormalizedImportProduct | null; error: string | null } {
  const nameAr = sanitizeText(raw.nameAr, 200);
  const nameEn = sanitizeText(raw.nameEn, 200);

  if (!nameAr && !nameEn) {
    return { product: null, error: 'Product must have at least an Arabic name (nameAr) or English name (nameEn).' };
  }

  // Smart extraction from product titles (just like Excel import in app/page.js)
  const extracted = extractWeightAndUnit(nameAr) || extractWeightAndUnit(nameEn);
  let rawWeight = sanitizeText(extracted?.weight || raw.weight, 50);
  let unit = sanitizeText(extracted?.unit || raw.unit, 20);

  if (!unit && rawWeight) {
    unit = extractUnitFromWeight(rawWeight) || 'g';
  } else if (unit) {
    unit = normalizeUnit(unit);
  } else {
    unit = 'g';
  }

  const barcode = sanitizeBarcode(raw.barcode);
  const imageUrl = sanitizeUrl(raw.imageUrl);
  const descriptionAr = sanitizeText(raw.descriptionAr, 2000);
  const descriptionEn = sanitizeText(raw.descriptionEn, 2000);
  const categoryAr = sanitizeText(raw.categoryAr, 100);
  const categoryEn = sanitizeText(raw.categoryEn, 100);

  // Normalizing variants: if variants array provided, use it; otherwise build default variant
  const variants: NormalizedImportProduct['variants'] = [];
  if (Array.isArray(raw.variants) && raw.variants.length > 0) {
    for (let i = 0; i < raw.variants.length; i++) {
      const v = raw.variants[i];
      const vWeight = sanitizeText(v?.weight || rawWeight, 50);
      const vUnit = normalizeUnit(sanitizeText(v?.unit || unit, 20)) || 'g';
      variants.push({
        id: sanitizeText(v?.id) || `variant-${i + 1}`,
        weight: vWeight,
        unit: vUnit,
        sku: sanitizeBarcode(v?.sku || barcode),
        qtyPerCarton: sanitizeNumberString(v?.qtyPerCarton || raw.qtyPerCarton),
        pricePerPiece: sanitizeNumberString(v?.pricePerPiece || raw.pricePerPiece),
        pricePerCarton: sanitizeNumberString(v?.pricePerCarton || raw.pricePerCarton),
      });
    }
  } else {
    variants.push({
      id: 'variant-1',
      weight: rawWeight,
      unit: unit,
      sku: barcode,
      qtyPerCarton: sanitizeNumberString(raw.qtyPerCarton),
      pricePerPiece: sanitizeNumberString(raw.pricePerPiece),
      pricePerCarton: sanitizeNumberString(raw.pricePerCarton),
    });
  }

  // Idempotency key determination:
  // - 'barcode': barcode only
  // - 'name': normalized name
  // - 'auto': barcode if available, fallback to name
  let idempotencyKey = '';
  if (idempotencyField === 'barcode') {
    idempotencyKey = barcode ? `barcode:${barcode.toLowerCase()}` : '';
  } else if (idempotencyField === 'name') {
    idempotencyKey = `name:${(nameAr || nameEn).toLowerCase()}`;
  } else {
    // auto
    if (barcode) {
      idempotencyKey = `barcode:${barcode.toLowerCase()}`;
    } else {
      idempotencyKey = `name:${(nameAr || nameEn).toLowerCase()}`;
    }
  }

  const normalized: NormalizedImportProduct = {
    id: sanitizeText(raw.id) || crypto.randomUUID(),
    brandId,
    nameAr,
    nameEn,
    categoryAr,
    categoryEn,
    descriptionAr,
    descriptionEn,
    barcode,
    imageUrl,
    variants,
    idempotencyKey,
  };

  return { product: normalized, error: null };
}

/**
 * Imports a batch of products into a brand with:
 * 1. dryRun mode support: returns validation and conflicts preview without modifying DB
 * 2. Idempotency deduplication by barcode/name
 * 3. Atomic database transaction: all succeed or all fail
 */
export async function importProductsBatch(
  brandId: string,
  rawItems: ImportProductItemInput[],
  options: ImportProductsOptions = {}
): Promise<ImportProductsResult> {
  await ensureSchema();

  const brand = await getBrand(brandId, false);
  if (!brand) {
    throw new Error(`البراند برقم «${brandId}» غير موجود.`);
  }

  const dryRun = Boolean(options.dryRun);
  const idempotencyField = options.idempotencyKeyField || 'auto';
  const onDuplicate = options.onDuplicate || 'update';

  const errors: ImportProductsResult['errors'] = [];
  const normalizedList: NormalizedImportProduct[] = [];
  const seenKeysInBatch = new Set<string>();

  for (let idx = 0; idx < rawItems.length; idx++) {
    const raw = rawItems[idx];
    const { product, error } = normalizeIncomingProduct(raw, brandId, idempotencyField);
    if (error || !product) {
      errors.push({ index: idx, product: raw, error: error || 'بيانات المنتج غير صالحة.' });
      continue;
    }

    if (product.idempotencyKey) {
      if (seenKeysInBatch.has(product.idempotencyKey)) {
        errors.push({
          index: idx,
          product: raw,
          error: `منتج مكرر داخل نفس الدفعة بالمفتاح «${product.idempotencyKey}».`,
        });
        continue;
      }
      seenKeysInBatch.add(product.idempotencyKey);
    }

    normalizedList.push(product);
  }

  // Fetch current products for brand to detect existing duplicates
  const pool = getPool();
  const existingRes = await pool.query(
    'SELECT id, name_ar, name_en, barcode, position FROM catalog_products WHERE brand_id = $1',
    [brandId]
  );
  const existingRows = existingRes.rows as Array<{
    id: string;
    name_ar: string;
    name_en: string;
    barcode: string;
    position: number;
  }>;

  // Build lookup maps for existing products
  const existingByBarcode = new Map<string, string>();
  const existingByName = new Map<string, string>();
  for (const row of existingRows) {
    if (row.barcode && row.barcode.trim()) {
      existingByBarcode.set(row.barcode.trim().toLowerCase(), row.id);
    }
    const nameKey = (row.name_ar || row.name_en || '').trim().toLowerCase();
    if (nameKey) {
      existingByName.set(nameKey, row.id);
    }
  }

  // Classify products into create vs update vs duplicate conflicts
  const toCreate: NormalizedImportProduct[] = [];
  const toUpdate: Array<{ existingId: string; product: NormalizedImportProduct }> = [];
  const toSkip: NormalizedImportProduct[] = [];

  for (const item of normalizedList) {
    let matchedId: string | undefined;

    if (idempotencyField === 'barcode') {
      if (item.barcode) matchedId = existingByBarcode.get(item.barcode.toLowerCase());
    } else if (idempotencyField === 'name') {
      const nameKey = (item.nameAr || item.nameEn).toLowerCase();
      matchedId = existingByName.get(nameKey);
    } else {
      // auto: check barcode first, then name
      if (item.barcode) matchedId = existingByBarcode.get(item.barcode.toLowerCase());
      if (!matchedId) {
        const nameKey = (item.nameAr || item.nameEn).toLowerCase();
        matchedId = existingByName.get(nameKey);
      }
    }

    if (matchedId) {
      if (onDuplicate === 'error') {
        errors.push({
          index: rawItems.indexOf(item as unknown as ImportProductItemInput),
          product: item,
          error: `المنتج موجود مسبقاً في قاعدة البيانات برقم «${matchedId}».`,
        });
      } else if (onDuplicate === 'skip') {
        toSkip.push(item);
      } else {
        toUpdate.push({ existingId: matchedId, product: item });
      }
    } else {
      toCreate.push(item);
    }
  }

  // If dryRun mode: return preview without modifying anything in DB
  if (dryRun) {
    return {
      success: errors.length === 0,
      dryRun: true,
      brandId,
      totalReceived: rawItems.length,
      validCount: normalizedList.length,
      errorCount: errors.length,
      createdCount: toCreate.length,
      updatedCount: toUpdate.length,
      skippedCount: toSkip.length,
      errors,
      preview: normalizedList.slice(0, 20),
    };
  }

  // If there are validation errors and we're not dryRun, fail completely to ensure atomicity
  if (errors.length > 0) {
    return {
      success: false,
      dryRun: false,
      brandId,
      totalReceived: rawItems.length,
      validCount: normalizedList.length,
      errorCount: errors.length,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors,
    };
  }

  // Execute within atomic transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get next position for newly created products
    const maxPosRes = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM catalog_products WHERE brand_id = $1',
      [brandId]
    );
    let nextPosition = Number(maxPosRes.rows[0].next_pos);

    const createdResults: NormalizedImportProduct[] = [];
    const updatedResults: NormalizedImportProduct[] = [];

    // 1. Process Updates
    const updateQuery = `
      UPDATE catalog_products
      SET name_ar = $3, name_en = $4, category_ar = $5, category_en = $6,
          description_ar = $7, description_en = $8, barcode = $9, image_url = $10,
          variants = $11::jsonb, updated_at = NOW()
      WHERE id = $1 AND brand_id = $2
      RETURNING *
    `;
    for (const { existingId, product } of toUpdate) {
      const { rows } = await client.query(updateQuery, [
        existingId,
        brandId,
        product.nameAr,
        product.nameEn,
        product.categoryAr,
        product.categoryEn,
        product.descriptionAr,
        product.descriptionEn,
        product.barcode,
        product.imageUrl,
        JSON.stringify(product.variants),
      ]);
      if (rows[0]) {
        updatedResults.push({ ...product, id: rows[0].id });
      }
    }

    // 2. Process Inserts
    const insertQuery = `
      INSERT INTO catalog_products (
        id, brand_id, name_ar, name_en, category_ar, category_en,
        description_ar, description_en, barcode, image_url, variants, position
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
      RETURNING *
    `;
    for (const product of toCreate) {
      const productId = product.id || crypto.randomUUID();
      const { rows } = await client.query(insertQuery, [
        productId,
        brandId,
        product.nameAr,
        product.nameEn,
        product.categoryAr,
        product.categoryEn,
        product.descriptionAr,
        product.descriptionEn,
        product.barcode,
        product.imageUrl,
        JSON.stringify(product.variants),
        nextPosition++,
      ]);
      if (rows[0]) {
        createdResults.push({ ...product, id: rows[0].id });
      }
    }

    // 3. Update Brand timestamp
    await client.query('UPDATE catalog_brands SET updated_at = NOW() WHERE id = $1', [brandId]);

    // Commit Transaction
    await client.query('COMMIT');

    return {
      success: true,
      dryRun: false,
      brandId,
      totalReceived: rawItems.length,
      validCount: normalizedList.length,
      errorCount: 0,
      createdCount: createdResults.length,
      updatedCount: updatedResults.length,
      skippedCount: toSkip.length,
      errors: [],
      createdProducts: createdResults,
      updatedProducts: updatedResults,
    };
  } catch (dbErr) {
    await client.query('ROLLBACK');
    throw dbErr;
  } finally {
    client.release();
  }
}

/**
 * Uploads an image to Cloudinary from either an external URL or base64 data URI,
 * and indexes it in catalog_media using existing database & cloudinary modules.
 */
export async function uploadImageFromSource(input: {
  source: string;
  folder?: string;
  brandId?: string | null;
  filename?: string;
}): Promise<{
  url: string;
  publicId: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
  folder: string;
}> {
  const source = input.source?.trim();
  if (!source) {
    throw new Error('Image source (URL or base64 data) is required.');
  }

  const folder = sanitizeText(input.folder || 'general', 80) || 'general';
  const brandId = input.brandId ? sanitizeText(input.brandId) : null;
  let filename = sanitizeText(input.filename || 'image', 100) || 'image';

  let buffer: Buffer;
  let mimeType = 'image/jpeg';

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source, { headers: { 'User-Agent': 'CatfoodCatalog/1.0' } });
    if (!res.ok) {
      throw new Error(`Failed to fetch image from URL: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType && !contentType.startsWith('image/')) {
      throw new Error(`URL did not return an image (Content-Type: ${contentType}).`);
    }
    if (contentType) mimeType = contentType;
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);

    // Try extracting filename from URL pathname if generic
    if (filename === 'image') {
      try {
        const pathname = new URL(source).pathname;
        const lastPart = pathname.split('/').pop();
        if (lastPart && lastPart.includes('.')) {
          filename = lastPart;
        }
      } catch {
        // ignore
      }
    }
  } else if (source.startsWith('data:')) {
    const match = source.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) {
      throw new Error('Invalid base64 data URI format.');
    }
    mimeType = match[1];
    buffer = Buffer.from(match[2], 'base64');
  } else {
    // Raw base64 string
    buffer = Buffer.from(source, 'base64');
  }

  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('Image size exceeds 10 MB limit.');
  }

  // Create a Web-standard File instance to call existing uploadImageDetailed
  const file = new File([new Uint8Array(buffer)], filename, { type: mimeType });
  const detail = await uploadImageDetailed(file, folder);

  // Index record into catalog_media
  try {
    await createMediaRecord({
      brandId: brandId || null,
      folder: folder || (brandId || 'general'),
      filename: detail.originalFilename || filename,
      url: detail.url,
      publicId: detail.publicId,
      bytes: detail.bytes,
      width: detail.width,
      height: detail.height,
      format: detail.format,
    });
  } catch (err) {
    console.warn('Failed to index media record to catalog_media:', err);
  }

  return {
    url: detail.url,
    publicId: detail.publicId,
    bytes: detail.bytes,
    width: detail.width,
    height: detail.height,
    format: detail.format,
    folder,
  };
}

/**
 * Returns overall statistics for catalog: brands, products, media storage.
 */
export async function getCatalogStats(): Promise<{
  totalBrands: number;
  totalProducts: number;
  totalImages: number;
  totalStorageBytes: number;
  brands: Array<{ id: string; nameAr: string; nameEn: string; productCount: number }>;
}> {
  await ensureSchema();
  const pool = getPool();

  const [brands, mediaFolders, productCountRes] = await Promise.all([
    listBrands(),
    getMediaFoldersWithCounts(),
    pool.query('SELECT COUNT(*)::int AS count FROM catalog_products'),
  ]);

  const totalProducts = Number(productCountRes.rows[0]?.count || 0);

  return {
    totalBrands: brands.length,
    totalProducts,
    totalImages: mediaFolders.totalCount,
    totalStorageBytes: mediaFolders.totalBytes,
    brands: brands.map((b: { id: string; nameAr: string; nameEn: string; productCount: number }) => ({
      id: b.id,
      nameAr: b.nameAr,
      nameEn: b.nameEn,
      productCount: b.productCount,
    })),
  };
}
