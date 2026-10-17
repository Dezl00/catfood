import { Pool } from 'pg';

const DEFAULT_SETTINGS = {
  footerText: 'السعر غير شامل الضريبة',
  currency: 'ج.م',
  visible: { description: true, prices: true, cartonPrice: true, carton: true, barcode: true },
};

const globalForDatabase = globalThis;

function connectionPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Add it to .env.local or your deployment environment.');
  }
  if (!globalForDatabase.catalogPool) {
    const cleanUrl = process.env.DATABASE_URL.replace(/[?&]channel_binding=require/, '');
    globalForDatabase.catalogPool = new Pool({
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return globalForDatabase.catalogPool;
}

let schemaPromise;

export async function ensureSchema() {
  if (!schemaPromise) {
    const setup = [
      'CREATE TABLE IF NOT EXISTS catalog_brands (',
      'id TEXT PRIMARY KEY,',
      'name_ar TEXT NOT NULL,',
      'name_en TEXT NOT NULL DEFAULT \'\',',
      'logo_url TEXT NOT NULL DEFAULT \'\',',
      'settings JSONB NOT NULL DEFAULT \'{}\'::jsonb,',
      'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      ');',
      'CREATE TABLE IF NOT EXISTS catalog_products (',
      'id TEXT PRIMARY KEY,',
      'brand_id TEXT NOT NULL REFERENCES catalog_brands(id) ON DELETE CASCADE,',
      'name_ar TEXT NOT NULL DEFAULT \'\',',
      'name_en TEXT NOT NULL DEFAULT \'\',',
      'category_ar TEXT NOT NULL DEFAULT \'\',',
      'category_en TEXT NOT NULL DEFAULT \'\',',
      'description_ar TEXT NOT NULL DEFAULT \'\',',
      'description_en TEXT NOT NULL DEFAULT \'\',',
      'barcode TEXT NOT NULL DEFAULT \'\',',
      'image_url TEXT NOT NULL DEFAULT \'\',',
      'variants JSONB NOT NULL DEFAULT \'[]\'::jsonb,',
      'position INTEGER NOT NULL DEFAULT 0,',
      'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      ');',
      'CREATE INDEX IF NOT EXISTS catalog_products_brand_position_idx ON catalog_products (brand_id, position, created_at DESC);',
    ].join('\n');
    schemaPromise = connectionPool().query(setup).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeSettings(value) {
  const settings = value && typeof value === 'object' ? value : {};
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    visible: { ...DEFAULT_SETTINGS.visible, ...(settings.visible || {}) },
  };
}

function normalizeVariant(value, index) {
  return {
    id: stringValue(value?.id) || 'variant-' + (index + 1),
    weight: stringValue(value?.weight),
    unit: stringValue(value?.unit) || 'جم',
    sku: stringValue(value?.sku),
    qtyPerCarton: stringValue(value?.qtyPerCarton),
    pricePerPiece: stringValue(value?.pricePerPiece),
    pricePerCarton: stringValue(value?.pricePerCarton),
  };
}

export function normalizeProductInput(input = {}) {
  const variants = Array.isArray(input.variants) ? input.variants : [];
  return {
    id: stringValue(input.id),
    nameAr: stringValue(input.nameAr),
    nameEn: stringValue(input.nameEn),
    categoryAr: stringValue(input.categoryAr),
    categoryEn: stringValue(input.categoryEn),
    descriptionAr: stringValue(input.descriptionAr),
    descriptionEn: stringValue(input.descriptionEn),
    barcode: stringValue(input.barcode),
    imageUrl: stringValue(input.imageUrl),
    variants: variants.length ? variants.map(normalizeVariant) : [normalizeVariant({}, 0)],
  };
}

function asBrand(row, productCount) {
  return {
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    logoUrl: row.logo_url,
    settings: normalizeSettings(row.settings),
    productCount: productCount ?? Number(row.product_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function asProduct(row) {
  return {
    id: row.id,
    brandId: row.brand_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    categoryAr: row.category_ar,
    categoryEn: row.category_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    barcode: row.barcode,
    imageUrl: row.image_url,
    variants: Array.isArray(row.variants) && row.variants.length ? row.variants.map(normalizeVariant) : [normalizeVariant({}, 0)],
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBrands() {
  await ensureSchema();
  const query = [
    'SELECT b.*, COUNT(p.id)::int AS product_count',
    'FROM catalog_brands b',
    'LEFT JOIN catalog_products p ON p.brand_id = b.id',
    'GROUP BY b.id',
    'ORDER BY b.updated_at DESC',
  ].join('\n');
  const { rows } = await connectionPool().query(query);
  return rows.map(asBrand);
}

export async function getBrand(id, includeProducts = true) {
  await ensureSchema();
  const brandResult = await connectionPool().query('SELECT * FROM catalog_brands WHERE id = $1', [id]);
  if (!brandResult.rowCount) return null;
  const brand = asBrand(brandResult.rows[0], 0);
  if (!includeProducts) return brand;
  const productsResult = await connectionPool().query(
    'SELECT * FROM catalog_products WHERE brand_id = $1 ORDER BY position ASC, created_at ASC',
    [id],
  );
  brand.products = productsResult.rows.map(asProduct);
  brand.productCount = brand.products.length;
  return brand;
}

export async function reorderProducts(brandId, productIds) {
  await ensureSchema();
  if (!Array.isArray(productIds) || !productIds.length) return false;
  const client = await connectionPool().connect();
  try {
    await client.query('BEGIN');
    const updateResult = await client.query(
      `UPDATE catalog_products p SET position = t.ord - 1, updated_at = NOW()
       FROM unnest($1::text[]) WITH ORDINALITY AS t(id, ord)
       WHERE p.id = t.id AND p.brand_id = $2`,
      [productIds, brandId]
    );
    if (updateResult.rowCount < productIds.length) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('UPDATE catalog_brands SET updated_at = NOW() WHERE id = $1', [brandId]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createBrand(input) {
  await ensureSchema();
  const id = stringValue(input.id);
  const nameAr = stringValue(input.nameAr);
  if (!id || !nameAr) throw new Error('Brand ID and Arabic name are required.');
  const query = [
    'INSERT INTO catalog_brands (id, name_ar, name_en, logo_url, settings)',
    'VALUES ($1, $2, $3, $4, $5::jsonb)',
    'RETURNING *',
  ].join('\n');
  const { rows } = await connectionPool().query(query, [id, nameAr, stringValue(input.nameEn), stringValue(input.logoUrl), JSON.stringify(normalizeSettings(input.settings))]);
  return asBrand(rows[0], 0);
}

export async function updateBrand(id, input) {
  await ensureSchema();
  const nameAr = stringValue(input.nameAr);
  if (!nameAr) throw new Error('Brand name is required.');
  const query = [
    'UPDATE catalog_brands',
    'SET name_ar = $2, name_en = $3, logo_url = $4, settings = $5::jsonb, updated_at = NOW()',
    'WHERE id = $1',
    'RETURNING *',
  ].join('\n');
  const { rows } = await connectionPool().query(query, [id, nameAr, stringValue(input.nameEn), stringValue(input.logoUrl), JSON.stringify(normalizeSettings(input.settings))]);
  return rows[0] ? asBrand(rows[0], 0) : null;
}

export async function deleteBrand(id) {
  await ensureSchema();
  const result = await connectionPool().query('DELETE FROM catalog_brands WHERE id = $1', [id]);
  return result.rowCount > 0;
}

export async function createProducts(brandId, inputs) {
  await ensureSchema();
  const client = await connectionPool().connect();
  try {
    await client.query('BEGIN');
    const maxPosition = await client.query('SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM catalog_products WHERE brand_id = $1', [brandId]);
    let nextPosition = Number(maxPosition.rows[0].next_position);
    const created = [];
    const query = [
      'INSERT INTO catalog_products (id, brand_id, name_ar, name_en, category_ar, category_en, description_ar, description_en, barcode, image_url, variants, position)',
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)',
      'RETURNING *',
    ].join('\n');
    for (const rawInput of inputs) {
      const product = normalizeProductInput(rawInput);
      if (!product.nameAr && !product.nameEn) continue;
      const { rows } = await client.query(query, [
        crypto.randomUUID(), brandId, product.nameAr, product.nameEn, product.categoryAr,
        product.categoryEn, product.descriptionAr, product.descriptionEn, product.barcode, product.imageUrl,
        JSON.stringify(product.variants), nextPosition++,
      ]);
      created.push(asProduct(rows[0]));
    }
    await client.query('UPDATE catalog_brands SET updated_at = NOW() WHERE id = $1', [brandId]);
    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProduct(id, brandId, input) {
  await ensureSchema();
  const product = normalizeProductInput(input);
  if (!product.nameAr && !product.nameEn) throw new Error('A product name is required.');
  const query = [
    'UPDATE catalog_products',
    'SET name_ar = $3, name_en = $4, category_ar = $5, category_en = $6, description_ar = $7, description_en = $8, barcode = $9, image_url = $10, variants = $11::jsonb, updated_at = NOW()',
    'WHERE id = $1 AND brand_id = $2',
    'RETURNING *',
  ].join('\n');
  const { rows } = await connectionPool().query(query, [
    id, brandId, product.nameAr, product.nameEn, product.categoryAr, product.categoryEn,
    product.descriptionAr, product.descriptionEn, product.barcode, product.imageUrl, JSON.stringify(product.variants),
  ]);
  if (!rows[0]) return null;
  await connectionPool().query('UPDATE catalog_brands SET updated_at = NOW() WHERE id = $1', [brandId]);
  return asProduct(rows[0]);
}

export async function deleteProduct(id, brandId) {
  await ensureSchema();
  const result = await connectionPool().query('DELETE FROM catalog_products WHERE id = $1 AND brand_id = $2', [id, brandId]);
  if (result.rowCount) await connectionPool().query('UPDATE catalog_brands SET updated_at = NOW() WHERE id = $1', [brandId]);
  return result.rowCount > 0;
}
