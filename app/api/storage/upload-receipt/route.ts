export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';
import { createReceiptSignedUrl, uploadReceiptFile } from '@/lib/supabase/storage';

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    const userId = String(user.userId || user.id || '');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file');
    const holdId = String(formData.get('holdId') || formData.get('hold_id') || '');

    if (!(file instanceof File)) return NextResponse.json({ error: 'Receipt image is required.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Only image receipts are allowed.' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Receipt image must be 4MB or smaller.' }, { status: 400 });

    const receiptKey = await uploadReceiptFile({ file, userId, holdId });
    const signedUrl = await createReceiptSignedUrl(receiptKey, 60 * 60);

    return NextResponse.json({ success: true, url: signedUrl, signedUrl, key: receiptKey, receiptKey });
  } catch (error: any) {
    console.error('Supabase receipt upload error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to upload receipt.' }, { status: error?.message === 'Unauthorized' ? 401 : 500 });
  }
}
