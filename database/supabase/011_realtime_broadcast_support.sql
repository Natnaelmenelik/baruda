DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'number_status_summary'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.number_status_summary;
  END IF;

  IF to_regclass('public.payment_holds') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'payment_holds'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_holds;
  END IF;

  IF to_regclass('public.payment_hold_items') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'payment_hold_items'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_hold_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;
END $$;

ALTER TABLE public.number_status_summary REPLICA IDENTITY FULL;

SELECT *
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
