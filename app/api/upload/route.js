import { NextResponse } from 'next/server';
import { uploadImageDetailed } from '../../../lib/cloudinary';
import { createMediaRecord } from '../../../lib/database';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = String(formData.get('folder') || 'products');
    const brandId = formData.get('brandId') || (folder.includes('/') ? folder.split('/')[0] : null);

    const detail = await uploadImageDetailed(file, folder);

    // Also index into catalog_media
    try {
      await createMediaRecord({
        brandId: brandId || null,
        folder: brandId || folder,
        filename: detail.originalFilename || file.name || 'image',
        url: detail.url,
        publicId: detail.publicId,
        bytes: detail.bytes,
        width: detail.width,
        height: detail.height,
        format: detail.format,
      });
    } catch (dbErr) {
      console.warn('Failed to index uploaded image to catalog_media:', dbErr);
    }

    return NextResponse.json({ url: detail.url, ...detail }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Image upload failed.' }, { status: 500 });
  }
}
