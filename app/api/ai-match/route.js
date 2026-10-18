import { NextResponse } from 'next/server';
import { getBrand, listMedia, batchUpdateProductImages } from '../../../lib/database';
import {
  getGeminiApiKeys,
  getActiveKeyInfo,
  batchMatchImages,
  matchImageToProducts,
} from '../../../lib/gemini-vision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const keys = getGeminiApiKeys();
    return NextResponse.json({
      configured: keys.length > 0,
      totalKeys: keys.length,
      activeKey: keys.length ? getActiveKeyInfo().index : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body.action || 'scan';
    const brandId = String(body.brandId || '').trim();

    if (!brandId) {
      return NextResponse.json({ error: 'معرّف البراند (brandId) مطلوب.' }, { status: 400 });
    }

    const brand = await getBrand(brandId);
    if (!brand) {
      return NextResponse.json({ error: 'البراند غير موجود.' }, { status: 404 });
    }

    // ----------------------------------------------------------------
    // ACTION: APPLY MATCHES
    // ----------------------------------------------------------------
    if (action === 'apply') {
      const matches = Array.isArray(body.matches) ? body.matches : [];
      if (!matches.length) {
        return NextResponse.json({ error: 'لا توجد مطابقات معتمدة للحفظ.' }, { status: 400 });
      }

      const count = await batchUpdateProductImages(brandId, matches);
      const updatedBrand = await getBrand(brandId);

      return NextResponse.json({
        success: true,
        updatedCount: count,
        products: updatedBrand.products,
        message: `تم ربط وتحديث ${count} منتج بنجاح.`,
      });
    }

    // ----------------------------------------------------------------
    // ACTION: SCAN & MATCH IMAGES
    // ----------------------------------------------------------------
    if (action === 'scan') {
      const keys = getGeminiApiKeys();
      if (!keys.length) {
        return NextResponse.json(
          { error: 'لم يتم العثور على مفاتيح Gemini API. يرجى إضافتها في ملف .env.local' },
          { status: 400 }
        );
      }

      const overwriteExisting = Boolean(body.overwriteExisting);
      let candidateProducts = brand.products || [];

      if (!overwriteExisting) {
        candidateProducts = candidateProducts.filter((p) => !p.imageUrl || !p.imageUrl.trim());
      }

      if (!candidateProducts.length) {
        return NextResponse.json(
          {
            error:
              'جميع منتجات هذا البراند تحتوي بالفعل على صور! فعّل خيار «استبدال الصور الحالية» إذا كنت ترغب في إعادة فحص ومطابقة جميع المنتجات.',
          },
          { status: 400 }
        );
      }

      // Determine images to scan
      const folder = body.folder || brandId;
      let mediaItems = [];

      if (Array.isArray(body.mediaIds) && body.mediaIds.length) {
        const allMedia = await listMedia({ brandId });
        const idSet = new Set(body.mediaIds);
        mediaItems = allMedia.filter((m) => idSet.has(m.id));
      } else {
        mediaItems = await listMedia({
          folder: folder === 'all' ? undefined : folder,
          brandId: folder === 'general' ? undefined : brandId,
        });
      }

      if (!mediaItems.length) {
        return NextResponse.json(
          { error: 'لم يتم العثور على أي صور في هذا المجلد لإجراء الفحص.' },
          { status: 400 }
        );
      }

      console.log(`[AI Match] بدء مطابقة ${mediaItems.length} صورة مع ${candidateProducts.length} منتج للبراند ${brand.nameAr}...`);

      const rawResults = await batchMatchImages(mediaItems, candidateProducts, {
        concurrency: 2,
      });

      // Product map for quick lookup
      const prodMap = new Map((brand.products || []).map((p) => [p.id, p]));

      const matched = [];
      const unmatched = [];

      for (const res of rawResults) {
        if (res.matchedProductId && prodMap.has(res.matchedProductId)) {
          const prod = prodMap.get(res.matchedProductId);
          matched.push({
            mediaId: res.mediaId,
            imageUrl: res.imageUrl,
            filename: res.filename,
            confidence: res.confidence,
            detectedDetails: res.detectedDetails,
            reason: res.reason,
            product: {
              id: prod.id,
              nameAr: prod.nameAr,
              nameEn: prod.nameEn,
              barcode: prod.barcode,
              currentImageUrl: prod.imageUrl,
            },
          });
        } else {
          unmatched.push({
            mediaId: res.mediaId,
            imageUrl: res.imageUrl,
            filename: res.filename,
            detectedDetails: res.detectedDetails,
            reason: res.reason || 'لم يتم العثور على منتج مطابق في هذا البراند.',
          });
        }
      }

      return NextResponse.json({
        success: true,
        totalImages: mediaItems.length,
        candidateProductsCount: candidateProducts.length,
        matchedCount: matched.length,
        unmatchedCount: unmatched.length,
        matched,
        unmatched,
        allProducts: (brand.products || []).map((p) => ({
          id: p.id,
          nameAr: p.nameAr,
          nameEn: p.nameEn,
        })),
        activeKeyInfo: getActiveKeyInfo(),
      });
    }

    return NextResponse.json({ error: `إجراء غير معروف: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[AI Match API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'حدث خطأ غير متوقع أثناء معالجة المطابقة الذكية.' },
      { status: 500 }
    );
  }
}
