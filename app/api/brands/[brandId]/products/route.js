import { NextResponse } from 'next/server';
import { createProducts, getBrand } from '../../../../../lib/database';

export const runtime = 'nodejs';

function message(error, status = 500) {
  console.error(error);
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, { status });
}

export async function POST(request, context) {
  try {
    const { brandId } = await context.params;
    const brand = await getBrand(brandId, false);
    if (!brand) return NextResponse.json({ error: 'البراند غير موجود.' }, { status: 404 });
    const body = await request.json();
    const items = Array.isArray(body.products) ? body.products : [body.product];
    if (!items.length) return NextResponse.json({ error: 'لا توجد منتجات للحفظ.' }, { status: 400 });
    const products = await createProducts(brandId, items);
    return NextResponse.json({ products }, { status: 201 });
  } catch (error) {
    return message(error);
  }
}
