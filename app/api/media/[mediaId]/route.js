import { NextResponse } from 'next/server';
import { deleteImage } from '../../../../lib/cloudinary';
import { getMedia, deleteMediaRecord } from '../../../../lib/database';

export const runtime = 'nodejs';

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const mediaId = params?.mediaId;
    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required.' }, { status: 400 });
    }

    const media = await getMedia(mediaId);
    if (!media) {
      return NextResponse.json({ error: 'Media image not found.' }, { status: 404 });
    }

    // 1. Delete permanently from Cloudinary
    try {
      if (media.publicId || media.url) {
        await deleteImage(media.publicId || media.url);
      }
    } catch (cloudErr) {
      console.warn('Cloudinary delete warning for', mediaId, cloudErr);
    }

    // 2. Delete permanently from database
    await deleteMediaRecord(mediaId);

    return NextResponse.json(
      {
        success: true,
        message: 'تم حذف الصورة نهائياً من Cloudinary وقاعدة البيانات.',
        deletedId: mediaId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete media:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete media.' },
      { status: 500 }
    );
  }
}
