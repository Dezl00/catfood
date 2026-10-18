import { NextResponse } from 'next/server';
import { uploadImageDetailed } from '../../../lib/cloudinary';
import {
  listMedia,
  createMediaRecord,
  getMediaFoldersWithCounts,
} from '../../../lib/database';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || undefined;
    const brandId = searchParams.get('brandId') || undefined;
    const search = searchParams.get('search') || undefined;

    const [media, folders] = await Promise.all([
      listMedia({ folder, brandId, search }),
      getMediaFoldersWithCounts(),
    ]);

    return NextResponse.json({ media, folders }, { status: 200 });
  } catch (error) {
    console.error('Failed to list media:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve media.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle JSON actions (e.g. create_folder)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.action === 'create_folder' || body.name) {
        const { createCustomFolder } = await import('../../../lib/database');
        const name = String(body.name || '').trim();
        if (!name) {
          return NextResponse.json({ error: 'اسم المجلد مطلوب.' }, { status: 400 });
        }
        const folder = await createCustomFolder(name);
        const folders = await getMediaFoldersWithCounts();
        return NextResponse.json({ success: true, folder, folders }, { status: 201 });
      }
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    const formData = await request.formData();
    const folder = String(formData.get('folder') || 'general');
    const brandId = formData.get('brandId') ? String(formData.get('brandId')) : null;

    // Support single file or multiple files
    let files = formData.getAll('files');
    if (!files || !files.length) {
      const single = formData.get('file');
      if (single) files = [single];
    }

    if (!files || !files.length) {
      return NextResponse.json({ error: 'No image files provided for upload.' }, { status: 400 });
    }

    const uploaded = [];
    const errors = [];

    for (const file of files) {
      if (!(file instanceof File) || !file.type.startsWith('image/')) continue;
      try {
        const detail = await uploadImageDetailed(file, folder);
        const record = await createMediaRecord({
          brandId: brandId || null,
          folder: folder,
          filename: file.name || detail.originalFilename || 'image',
          url: detail.url,
          publicId: detail.publicId,
          bytes: detail.bytes,
          width: detail.width,
          height: detail.height,
          format: detail.format,
        });
        uploaded.push(record);
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        errors.push({ filename: file.name, error: err.message });
      }
    }

    const folders = await getMediaFoldersWithCounts();

    return NextResponse.json(
      {
        uploaded,
        count: uploaded.length,
        errors: errors.length ? errors : undefined,
        folders,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Media upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Media upload failed.' },
      { status: 500 }
    );
  }
}
