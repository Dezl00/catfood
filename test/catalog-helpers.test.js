import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoDetectMapping,
  extractUnitFromWeight,
  getTableColumns,
  computeProductLayout,
  getVariantsPerPage,
  paginateProductVariants,
  normalizeUnit,
  UNIT_MAP,
} from '../lib/catalog-helpers.js';

describe('normalizeUnit and UNIT_MAP', () => {
  it('normalizes common Arabic and English units', () => {
    assert.equal(normalizeUnit('جم'), 'g');
    assert.equal(normalizeUnit('جرام'), 'g');
    assert.equal(normalizeUnit('غرام'), 'g');
    assert.equal(normalizeUnit('كجم'), 'kg');
    assert.equal(normalizeUnit('كيلو'), 'kg');
    assert.equal(normalizeUnit('لتر'), 'L');
    assert.equal(normalizeUnit('مل'), 'ml');
    assert.equal(normalizeUnit('حبة'), 'pcs');
    assert.equal(normalizeUnit('قطعة'), 'pcs');
    assert.equal(normalizeUnit('باوند'), 'lb');
    assert.equal(normalizeUnit('أونصة'), 'oz');
  });

  it('handles empty or missing units gracefully', () => {
    assert.equal(normalizeUnit(''), '');
    assert.equal(normalizeUnit(null), '');
    assert.equal(normalizeUnit(undefined), '');
  });

  it('exports valid UNIT_MAP mapping dictionary', () => {
    assert.ok(typeof UNIT_MAP === 'object');
    assert.equal(UNIT_MAP['جم'], 'g');
    assert.equal(UNIT_MAP['كيلو'], 'kg');
  });
});

describe('extractUnitFromWeight', () => {
  it('detects lb correctly without confusing with L', () => {
    assert.equal(extractUnitFromWeight('1 lb'), 'lb');
    assert.equal(extractUnitFromWeight('5 lb'), 'lb');
    assert.equal(extractUnitFromWeight('10 باوند'), 'lb');
  });

  it('detects g correctly with Large/words containing l', () => {
    assert.equal(extractUnitFromWeight('400 g Large'), 'g');
    assert.equal(extractUnitFromWeight('400 جم'), 'g');
    assert.equal(extractUnitFromWeight('500 جرام'), 'g');
  });

  it('detects kg, ml, oz, pcs, L accurately', () => {
    assert.equal(extractUnitFromWeight('5 kg'), 'kg');
    assert.equal(extractUnitFromWeight('2 كيلو'), 'kg');
    assert.equal(extractUnitFromWeight('250 ml'), 'ml');
    assert.equal(extractUnitFromWeight('100 مل'), 'ml');
    assert.equal(extractUnitFromWeight('12 pcs'), 'pcs');
    assert.equal(extractUnitFromWeight('6 حبات'), 'pcs');
    assert.equal(extractUnitFromWeight('8 oz'), 'oz');
    assert.equal(extractUnitFromWeight('5 L'), 'L');
    assert.equal(extractUnitFromWeight('1 لتر'), 'L');
  });

  it('returns empty string for empty input', () => {
    assert.equal(extractUnitFromWeight(''), '');
    assert.equal(extractUnitFromWeight(null), '');
  });
});

describe('autoDetectMapping', () => {
  it('maps Arabic and English descriptions correctly without confusion', () => {
    const headers = ['الاسم بالعربي', 'الاسم بالإنجليزية', 'الوصف بالإنجليزية', 'الوصف بالعربي', 'السعر'];
    const mapping = autoDetectMapping(headers);

    assert.equal(mapping.nameAr, 'الاسم بالعربي');
    assert.equal(mapping.nameEn, 'الاسم بالإنجليزية');
    assert.equal(mapping.descriptionEn, 'الوصف بالإنجليزية');
    assert.equal(mapping.descriptionAr, 'الوصف بالعربي');
    assert.equal(mapping.pricePerPiece, 'السعر');
  });

  it('does not map English description as nameEn even if description appears first', () => {
    const headers = ['الوصف بالإنجليزية', 'الاسم بالإنجليزية', 'الاسم بالعربي', 'الوصف بالعربي'];
    const mapping = autoDetectMapping(headers);

    assert.equal(mapping.descriptionEn, 'الوصف بالإنجليزية');
    assert.equal(mapping.nameEn, 'الاسم بالإنجليزية');
    assert.equal(mapping.nameAr, 'الاسم بالعربي');
    assert.equal(mapping.descriptionAr, 'الوصف بالعربي');
  });
});

describe('getTableColumns', () => {
  it('computes proportional widths matching spec for 4 columns within 1pt', () => {
    const visible = { carton: true, prices: true, barcode: true, cartonPrice: false };
    const cols = getTableColumns(visible);

    assert.equal(cols.length, 4);

    const barcode = cols.find((c) => c.key === 'barcode');
    const price = cols.find((c) => c.key === 'price');
    const carton = cols.find((c) => c.key === 'carton');
    const weight = cols.find((c) => c.key === 'weight');

    assert.ok(Math.abs(barcode.width - 170.2) < 1.0, `barcode width ${barcode.width} should be within 1pt of 170.2`);
    assert.ok(Math.abs(price.width - 110.7) < 1.0, `price width ${price.width} should be within 1pt of 110.7`);
    assert.ok(Math.abs(carton.width - 110.7) < 1.0, `carton width ${carton.width} should be within 1pt of 110.7`);
    assert.ok(Math.abs(weight.width - 110.6) < 1.0, `weight width ${weight.width} should be within 1pt of 110.6`);
  });

  it('centers single visible column with max width 200', () => {
    const visible = { carton: false, prices: false, barcode: false, cartonPrice: false };
    const cols = getTableColumns(visible);

    assert.equal(cols.length, 1);
    assert.equal(cols[0].key, 'weight');
    assert.equal(cols[0].width, 200);
    assert.equal(cols[0].left, 190.75);
  });
});

describe('computeProductLayout', () => {
  it('calculates full-state layout within 1pt of target measurements', () => {
    const product = {
      descriptionAr: 'وصف عربي',
      descriptionEn: 'English description',
    };
    const settings = {
      visible: { description: true, prices: true, carton: true, barcode: true },
    };
    const variants = [{ id: '1' }, { id: '2' }, { id: '3' }];

    const layout = computeProductLayout(product, settings, variants);

    // Card height should be 328.3 for 3 rows
    assert.ok(Math.abs(layout.cardHeight - 328.3) < 1.0, `cardHeight ${layout.cardHeight} should be ~328.3`);
    assert.equal(layout.descHeight, 114.2);
    assert.equal(layout.hasDescriptions, true);
    // nameArTop should be pillTop - 25.94
    assert.ok(Math.abs(layout.pillTop - layout.nameArTop - 25.94) < 0.01);
  });
});

describe('paginateProductVariants', () => {
  it('splits 16 variants into 2 pages of 8 variants each when descriptions are present', () => {
    const product = {
      descriptionAr: 'وصف',
      variants: Array.from({ length: 16 }, (_, i) => ({ id: `v-${i + 1}` })),
    };
    const settings = { visible: { description: true } };

    const perPage = getVariantsPerPage(product, settings);
    assert.equal(perPage, 8);

    const pages = paginateProductVariants(product, settings);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].length, 8);
    assert.equal(pages[1].length, 8);
  });
});
