import { NextResponse } from 'next/server';
import { deleteBrand, getBrand, updateBrand } from '../../../../lib/database';
import { uploadImage } from '../../../../lib/cloudinary';

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
    const logoUrl = logo instanceof File && logo.size
      ? await uploadImage(logo, 'brands')
      : String(formData.get('logoUrl') ?? current.logoUrl);
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
    const removed = await deleteBrand(brandId);
    return removed ? NextResponse.json({ removed: true }) : NextResponse.json({ error: 'البراند غير موجود.' }, { status: 404 });
  } catch (error) {
    return message(error);
  }
}
