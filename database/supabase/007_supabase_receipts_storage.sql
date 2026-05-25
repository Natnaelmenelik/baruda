-- Create private Supabase Storage bucket for receipts.
-- Run in Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  4194304,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 4194304,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Service role bypasses RLS automatically.
-- This policy also allows authenticated Supabase users later if you enable Supabase Auth.
DROP POLICY IF EXISTS "receipts_bucket_private_read" ON storage.objects;
DROP POLICY IF EXISTS "receipts_bucket_private_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_bucket_private_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_bucket_private_delete" ON storage.objects;

CREATE POLICY "receipts_bucket_private_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

CREATE POLICY "receipts_bucket_private_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_bucket_private_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_bucket_private_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts');
