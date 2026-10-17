import { NextResponse } from 'next/server';
import { deleteBrand, getBrand, updateBrand } from '../../../../lib/database';
import { uploadImage, deleteImage } from '../../../../lib/cloudinary';

export const runtime = 'nodejs';

function message(error, status = 500) {
  console.error(error);
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, { status });
}

function safeJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export async function GET(_request, context) {
  try {
    const { brandId } = await context.params;
    const brand = await getBrand(brandId);
    return brand ? NextResponse.json({ brand }) : NextResponse.json({ error: 'البراند غير موجود.' }, { status: 404 });
  } catch (error) {
    return message(error);
  }
}

export async function PATCH(request, context) {
  try {
    const { brandId } = await context.params;
    const current = await getBrand(brandId, false);
    if (!current) return NextResponse.json({ error: 'البراند غير موجود.' }, { status: 404 });

    const formData = await request.formData();
    const logo = formData.get('logo');
    let logoUrl = current.logoUrl;
    if (logo instanceof File && logo.size) {
      if (current.logoUrl) deleteImage(current.logoUrl).catch(() => {});
      logoUrl = await uploadImage(logo, 'brands');
    } else if (formData.has('logoUrl')) {
      logoUrl = String(formData.get('logoUrl') ?? '');
      if (!logoUrl && current.logoUrl) deleteImage(current.logoUrl).catch(() => {});
    }

    const brand = await updateBrand(brandId, {
      nameAr: String(formData.get('nameAr') ?? current.nameAr),
      nameEn: String(formData.get('nameEn') ?? current.nameEn),
      logoUrl,
      settings: safeJson(formData.get('settings'), current.settings),
    });
    return NextResponse.json({ brand });
  } catch (error) {
    return message(error);
  }
}

export async function DELETE(_request, context) {
  try {
    const { brandId } = await context.params;
    const current = await getBrand(brandId, true);
    if (!current) return NextResponse.json({ error: 'البراند غير موجود.' }, { status: 404 });
    const removed = await deleteBrand(brandId);
    if (removed) {
      if (current.logoUrl) deleteImage(current.logoUrl).catch(() => {});
      if (Array.isArray(current.products)) {
        for (const p of current.products) {
          if (p.imageUrl) deleteImage(p.imageUrl).catch(() => {});
        }
      }
    }
    return removed ? NextResponse.json({ removed: true }) : NextResponse.json({ error: 'البراند غير موجود.' }, { status: 404 });
  } catch (error) {
    return message(error);
  }
}
