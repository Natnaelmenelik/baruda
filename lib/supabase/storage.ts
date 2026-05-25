import { createSupabaseAdminClient } from './server';

export const RECEIPTS_BUCKET = process.env.SUPABASE_RECEIPTS_BUCKET || 'receipts';

export async function uploadReceiptFile(params: { file: File; userId: string; holdId?: string }) {
  const supabase = createSupabaseAdminClient();
  const safeName = String(params.file.name || 'receipt.jpg').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);
  const path = `${params.userId}/${params.holdId || 'no-hold'}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await params.file.arrayBuffer());

  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, bytes, {
    contentType: params.file.type || 'image/jpeg',
    upsert: false,
    cacheControl: '3600',
  });

  if (error) throw error;
  return data.path;
}

export async function createReceiptSignedUrl(path: string, expiresInSeconds = 600) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(String(path).replace(/^\/+/, ''), expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
