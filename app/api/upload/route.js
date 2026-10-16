import { NextResponse } from 'next/server';
import { uploadImage } from '../../../lib/cloudinary';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = String(formData.get('folder') || 'products');
    const url = await uploadImage(file, folder);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Image upload failed.' }, { status: 500 });
  }
}
