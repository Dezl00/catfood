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
  headerLogoHeight: z.number().min(20).max(100).optional().describe('ارتفاع الشعار في الهيدر بنقاط الطباعة (pt) بين 20 و 100'),
  closingType: z.enum(['text', 'image']).optional().describe('نوع الشعار في صفحة الختام: text أو image'),
  closingTextAr: z.string().max(250).optional().describe('نص صفحة الختام العربي'),
  closingTextEn: z.string().max(250).optional().describe('نص صفحة الختام الإنجليزي'),
  closingLogoUrl: z.string().url().or(z.literal('')).optional().describe('رابط صورة شعار صفحة الختام'),
  closingLogoHeight: z.number().min(30).max(220).optional().describe('ارتفاع شعار صفحة الختام بنقاط الطباعة (pt) بين 30 و 220'),
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

  it('validates custom headerLogoHeight within valid bounds (20 to 100 pt)', () => {
    const parsed = BrandSettingsSchema.parse({
      headerType: 'image',
      headerLogoUrl: 'https://res.cloudinary.com/demo/image/upload/logo.png',
      headerLogoHeight: 85,
    });
    assert.equal(parsed.headerLogoHeight, 85);
  });

  it('rejects headerLogoHeight below minimum bound', () => {
    assert.throws(() => {
      BrandSettingsSchema.parse({
        headerLogoHeight: 15,
      });
    }, (err) => err instanceof z.ZodError);
  });
});

describe('Catalog Closing Sheet Branding & Settings', () => {
  it('validates text-type closing sheet with custom Arabic and English text', () => {
    const parsed = BrandSettingsSchema.parse({
      closingType: 'text',
      closingTextAr: 'شكراً لزيارتكم',
      closingTextEn: 'THANK YOU FOR VISITING',
    });
    assert.equal(parsed.closingType, 'text');
    assert.equal(parsed.closingTextAr, 'شكراً لزيارتكم');
    assert.equal(parsed.closingTextEn, 'THANK YOU FOR VISITING');
  });

  it('validates image-type closing sheet with Cloudinary logo URL', () => {
    const parsed = BrandSettingsSchema.parse({
      closingType: 'image',
      closingLogoUrl: 'https://res.cloudinary.com/catfood/image/upload/v12345/closing-logo.png',
    });
    assert.equal(parsed.closingType, 'image');
    assert.equal(parsed.closingLogoUrl, 'https://res.cloudinary.com/catfood/image/upload/v12345/closing-logo.png');
  });

  it('validates custom closingLogoHeight within valid bounds (30 to 220 pt)', () => {
    const parsed = BrandSettingsSchema.parse({
      closingType: 'image',
      closingLogoUrl: 'https://res.cloudinary.com/demo/image/upload/logo.png',
      closingLogoHeight: 150,
    });
    assert.equal(parsed.closingLogoHeight, 150);
  });

  it('rejects closingLogoHeight below minimum bound or above maximum bound', () => {
    assert.throws(() => {
      BrandSettingsSchema.parse({
        closingLogoHeight: 25,
      });
    }, (err) => err instanceof z.ZodError);

    assert.throws(() => {
      BrandSettingsSchema.parse({
        closingLogoHeight: 250,
      });
    }, (err) => err instanceof z.ZodError);
  });

  it('rejects invalid closingType values', () => {
    assert.throws(() => {
      BrandSettingsSchema.parse({
        // @ts-expect-error Testing invalid runtime value
        closingType: 'vector',
      });
    }, (err) => err instanceof z.ZodError);
  });
});
