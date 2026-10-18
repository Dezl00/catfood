import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

const BrandSettingsSchema = z.object({
  footerText: z.string().max(250).optional(),
  currency: z.string().max(20).optional(),
  headerType: z.enum(['text', 'image']).optional().describe('نوع الشعار في الهيدر: text أو image'),
  headerTextAr: z.string().max(250).optional().describe('نص الهيدر العربي'),
  headerTextEn: z.string().max(250).optional().describe('نص الهيدر الإنجليزي'),
  headerLogoUrl: z.string().url().or(z.literal('')).optional().describe('رابط صورة شعار الهيدر'),
  visible: z
    .object({
      description: z.boolean().optional(),
      prices: z.boolean().optional(),
      cartonPrice: z.boolean().optional(),
      carton: z.boolean().optional(),
      barcode: z.boolean().optional(),
    })
    .optional(),
});

describe('Catalog Header Branding & Settings', () => {
  it('validates text-type header with custom Arabic and English text', () => {
    const parsed = BrandSettingsSchema.parse({
      headerType: 'text',
      headerTextAr: 'رويال كانين',
      headerTextEn: 'ROYAL CANIN',
    });
    assert.equal(parsed.headerType, 'text');
    assert.equal(parsed.headerTextAr, 'رويال كانين');
    assert.equal(parsed.headerTextEn, 'ROYAL CANIN');
  });

  it('validates image-type header with Cloudinary logo URL', () => {
    const parsed = BrandSettingsSchema.parse({
      headerType: 'image',
      headerLogoUrl: 'https://res.cloudinary.com/catfood/image/upload/v12345/logo.png',
    });
    assert.equal(parsed.headerType, 'image');
    assert.equal(parsed.headerLogoUrl, 'https://res.cloudinary.com/catfood/image/upload/v12345/logo.png');
  });

  it('rejects invalid headerType values', () => {
    assert.throws(() => {
      BrandSettingsSchema.parse({
        // @ts-expect-error Testing invalid runtime value
        headerType: 'invalid-type',
      });
    }, (err) => err instanceof z.ZodError);
  });

  it('rejects invalid logo URLs that are not valid URLs or empty string', () => {
    assert.throws(() => {
      BrandSettingsSchema.parse({
        headerType: 'image',
        headerLogoUrl: 'not-a-valid-url',
      });
    });
  });

  it('allows empty headerLogoUrl when no logo is set', () => {
    const parsed = BrandSettingsSchema.parse({
      headerType: 'image',
      headerLogoUrl: '',
    });
    assert.equal(parsed.headerLogoUrl, '');
  });
});
