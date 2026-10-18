import { NextResponse } from 'next/server';
import {
  createCustomFolder,
  deleteCustomFolder,
  getMediaFoldersWithCounts,
} from '../../../../lib/database';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const folders = await getMediaFoldersWithCounts();
    return NextResponse.json({ folders }, { status: 200 });
  } catch (error) {
    console.error('Failed to get media folders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve folders.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'يرجى إدخال اسم المجلد.' }, { status: 400 });
    }

    const folder = await createCustomFolder(name);
    const folders = await getMediaFoldersWithCounts();

    return NextResponse.json(
      {
        success: true,
        folder,
        folders,
        message: `تم إنشاء المجلد «${name}» بنجاح.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create custom folder:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create folder.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('name');
    if (!id) {
      return NextResponse.json({ error: 'Folder ID or name is required.' }, { status: 400 });
    }

    const deleted = await deleteCustomFolder(id);
    const folders = await getMediaFoldersWithCounts();

    return NextResponse.json(
      {
        success: true,
        deleted,
        folders,
        message: 'تم حذف المجلد بنجاح ونقل محتوياته إلى المجلد العام.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete custom folder:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete folder.' },
      { status: 500 }
    );
  }
}
