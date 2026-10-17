import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

describe('Media Gallery Helpers', () => {
  it('formats byte sizes cleanly into B, KB, MB, GB', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(null), '0 B');
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(1048576), '1 MB');
    assert.equal(formatBytes(5242880), '5 MB');
    assert.equal(formatBytes(1073741824), '1 GB');
  });

  it('verifies brand folder mapping structure', () => {
    const brands = [
      { id: 'b1', nameAr: 'براند القطط', nameEn: 'Cat Brand' },
      { id: 'b2', nameAr: 'براند الكلاب', nameEn: 'Dog Brand' },
    ];
    const mediaItems = [
      { id: 'm1', brand_id: 'b1', folder: 'b1', bytes: 1000 },
      { id: 'm2', brand_id: 'b1', folder: 'b1', bytes: 2000 },
      { id: 'm3', brand_id: null, folder: 'general', bytes: 500 },
    ];

    const brandFolders = brands.map((brand) => {
      const items = mediaItems.filter((m) => m.brand_id === brand.id || m.folder === brand.id);
      return {
        id: brand.id,
        nameAr: brand.nameAr,
        nameEn: brand.nameEn,
        count: items.length,
        totalBytes: items.reduce((sum, item) => sum + (item.bytes || 0), 0),
      };
    });

    const generalItems = mediaItems.filter((m) => m.folder === 'general');

    assert.equal(brandFolders.length, 2);
    assert.equal(brandFolders[0].count, 2);
    assert.equal(brandFolders[0].totalBytes, 3000);
    assert.equal(brandFolders[1].count, 0);
    assert.equal(brandFolders[1].totalBytes, 0);
    assert.equal(generalItems.length, 1);
  });
});
