-- ============================================================
-- Supabase Storage + Realtime setup
-- Run in Supabase SQL Editor after the main schema.
-- ============================================================

-- Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'number_status_summary'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.number_status_summary;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'admin_stats_summary'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_stats_summary;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'submission_stats_summary'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.submission_stats_summary;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'submissions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'payment_holds'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_holds;
    END IF;

  END IF;
END $$;

-- Storage bucket must exist in storage.buckets.
-- Private bucket is recommended for payment receipts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 4194304,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Basic private bucket policies.
-- Your app may upload using service role through API, or authenticated Supabase users if you later enable Supabase Auth.
DROP POLICY IF EXISTS "Receipts are private" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage receipts" ON storage.objects;

CREATE POLICY "Service role can manage receipts"
ON storage.objects
FOR ALL
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');
