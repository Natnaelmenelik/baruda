export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';
import { createReceiptSignedUrl } from '@/lib/supabase/storage';

export async function POST(req: Request) {
  try {
    requireUser(req);
    const body = await req.json().catch(() => ({}));
    const receiptKey = String(body.receiptKey || body.receipt_key || body.key || body.path || '');
    if (!receiptKey) return NextResponse.json({ error: 'Receipt key is required.' }, { status: 400 });
    const signedUrl = await createReceiptSignedUrl(receiptKey, 60 * 10);
    return NextResponse.json({ success: true, signedUrl, url: signedUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create receipt signed URL.' }, { status: error?.message === 'Unauthorized' ? 401 : 500 });
  }
}
