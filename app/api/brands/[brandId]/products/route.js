import { NextResponse } from 'next/server';
import { createProducts, getBrand, reorderProducts } from '../../../../../lib/database';

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
    const items = Array.isArray(body.products) ? body.products.filter(Boolean) : (body.product ? [body.product] : []);
    if (!items.length) return NextResponse.json({ error: 'لا توجد منتجات للحفظ.' }, { status: 400 });
    const products = await createProducts(brandId, items);
    return NextResponse.json({ products }, { status: 201 });
  } catch (error) {
    return message(error);
  }
}

export async function PUT(request, context) {
  try {
    const { brandId } = await context.params;
    const brand = await getBrand(brandId, false);
    if (!brand) return NextResponse.json({ error: 'البراند غير موجود.' }, { status: 404 });
    const body = await request.json();
    if (!Array.isArray(body.productIds) || !body.productIds.length) {
      return NextResponse.json({ error: 'productIds array is required.' }, { status: 400 });
    }
    const ok = await reorderProducts(brandId, body.productIds);
    if (!ok) {
      return NextResponse.json({ error: 'بعض المنتجات غير موجودة أو تعذر تحديث ترتيبها.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return message(error);
  }
}
