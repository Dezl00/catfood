import { NextResponse } from 'next/server';
import { deleteProduct, updateProduct } from '../../../../lib/database';

export const runtime = 'nodejs';

function message(error, status = 500) {
  console.error(error);
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, { status });
}

export async function PATCH(request, context) {
  try {
    const { productId } = await context.params;
    const body = await request.json();
    if (!body.brandId) return NextResponse.json({ error: 'brandId مطلوب.' }, { status: 400 });
    const product = await updateProduct(productId, body.brandId, body.product);
    return product ? NextResponse.json({ product }) : NextResponse.json({ error: 'المنتج غير موجود.' }, { status: 404 });
  } catch (error) {
    return message(error);
  }
}

export async function DELETE(request, context) {
  try {
    const { productId } = await context.params;
    const brandId = new URL(request.url).searchParams.get('brandId');
    if (!brandId) return NextResponse.json({ error: 'brandId مطلوب.' }, { status: 400 });
    const removed = await deleteProduct(productId, brandId);
    return removed ? NextResponse.json({ removed: true }) : NextResponse.json({ error: 'المنتج غير موجود.' }, { status: 404 });
  } catch (error) {
    return message(error);
  }
}
