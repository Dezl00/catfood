import { NextResponse } from 'next/server';
import { createBrand, listBrands } from '../../../lib/database';
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
    const logoUrl = logo instanceof File && logo.size ? await uploadImage(logo, 'brands') : '';
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
