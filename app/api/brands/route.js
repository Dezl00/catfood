import { NextResponse } from 'next/server';
import { createBrand, listBrands, updateAllBrandsSettings } from '../../../lib/database';
import { uploadImage } from '../../../lib/cloudinary';

export const runtime = 'nodejs';

function message(error, status = 500) {
  console.error(error);
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, { status });
}

function safeJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export async function GET() {
  try {
    return NextResponse.json({ brands: await listBrands() });
  } catch (error) {
    return message(error);
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const nameAr = String(formData.get('nameAr') || '').trim();
    if (!nameAr) return NextResponse.json({ error: 'اسم البراند بالعربي مطلوب.' }, { status: 400 });
    const logo = formData.get('logo');
    let logoUrl = '';
    if (logo instanceof File && logo.size) {
      logoUrl = await uploadImage(logo, 'brands');
    } else if (formData.has('logoUrl')) {
      logoUrl = String(formData.get('logoUrl') || '');
    }
    const brand = await createBrand({
      id: crypto.randomUUID(),
      nameAr,
      nameEn: String(formData.get('nameEn') || ''),
      logoUrl,
      settings: safeJson(formData.get('settings')),
    });
    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    return message(error);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    if (body.action === 'apply_settings_all') {
      const updatedCount = await updateAllBrandsSettings(body.settings || {});
      return NextResponse.json({ success: true, count: updatedCount });
    }
    return NextResponse.json({ error: 'إجراء غير معروف.' }, { status: 400 });
  } catch (error) {
    return message(error);
  }
}
