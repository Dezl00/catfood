import { NextResponse } from 'next/server';
import { deleteProduct, getBrand, updateProduct } from '../../../../lib/database';
import { deleteImage } from '../../../../lib/cloudinary';

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
    
    if (body.product?.imageUrl !== undefined) {
      const brand = await getBrand(body.brandId, true);
      const existing = brand?.products?.find((p) => p.id === productId);
      if (existing?.imageUrl && existing.imageUrl !== body.product.imageUrl) {
        deleteImage(existing.imageUrl).catch(() => {});
      }
    }

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

    const brand = await getBrand(brandId, true);
    const existing = brand?.products?.find((p) => p.id === productId);

    const removed = await deleteProduct(productId, brandId);
    if (removed && existing?.imageUrl) {
      deleteImage(existing.imageUrl).catch(() => {});
    }
    return removed ? NextResponse.json({ removed: true }) : NextResponse.json({ error: 'المنتج غير موجود.' }, { status: 404 });
  } catch (error) {
    return message(error);
  }
}
