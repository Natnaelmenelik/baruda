-- 023_enable_realtime_admin_dashboard.sql
-- Ensures realtime events are published for admin dashboard updates.
-- submissions triggers /api/admin/submissions + /api/admin/stats refetch.
-- admin_stats_summary can also notify stats-only changes.

DO $$
BEGIN
  IF to_regclass('public.submissions') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'submissions'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;

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
END $$;

ALTER TABLE public.submissions REPLICA IDENTITY FULL;
ALTER TABLE public.admin_stats_summary REPLICA IDENTITY FULL;

SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('submissions', 'admin_stats_summary')
ORDER BY tablename;
