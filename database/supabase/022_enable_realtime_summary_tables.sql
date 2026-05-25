-- 022_enable_realtime_summary_tables.sql
-- Enables Supabase Realtime only on small summary/cache tables.
-- Safe for performance because these tables are tiny and change only after important actions.

DO $$
BEGIN
  IF to_regclass('public.admin_stats_summary') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'admin_stats_summary'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_stats_summary;
  END IF;

  IF to_regclass('public.submission_stats_summary') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'submission_stats_summary'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submission_stats_summary;
  END IF;

  IF to_regclass('public.number_status_summary_cache') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'number_status_summary_cache'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.number_status_summary_cache;
  END IF;
END $$;

ALTER TABLE public.admin_stats_summary REPLICA IDENTITY FULL;
ALTER TABLE public.submission_stats_summary REPLICA IDENTITY FULL;
ALTER TABLE public.number_status_summary_cache REPLICA IDENTITY FULL;

SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN (
    'admin_stats_summary',
    'submission_stats_summary',
    'number_status_summary_cache'
  )
ORDER BY tablename;
