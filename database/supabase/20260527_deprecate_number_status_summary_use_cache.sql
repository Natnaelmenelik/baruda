-- 20260527_deprecate_number_status_summary_use_cache.sql
-- Purpose:
--   Make number_status_summary_cache the single active number availability source.
--   Keep number_status_summary table for temporary backup/history, but stop old triggers/realtime usage.
--   Run this in Supabase SQL Editor after deploying the app code patch.

BEGIN;

-- Safety/performance indexes for the active cache + hold calculation path.
CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_number
  ON public.number_status_summary_cache (number);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_status
  ON public.number_status_summary_cache (status);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_updated_at
  ON public.number_status_summary_cache (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_hold_id_number
  ON public.payment_hold_items (hold_id, number);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_number_hold_id
  ON public.payment_hold_items (number, hold_id);

CREATE INDEX IF NOT EXISTS idx_payment_holds_active_expires
  ON public.payment_holds (expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_submission_items_number_submission
  ON public.submission_items (number, submission_id);

CREATE INDEX IF NOT EXISTS idx_submissions_status_id
  ON public.submissions (status, id);

-- Stop legacy triggers that maintain public.number_status_summary.
-- Keep the table itself for now; do not drop data yet.
DROP TRIGGER IF EXISTS trg_refresh_summary_submission_items ON public.submission_items;
DROP TRIGGER IF EXISTS trg_refresh_summary_submissions ON public.submissions;
DROP TRIGGER IF EXISTS trg_refresh_summary_payment_holds ON public.payment_holds;
DROP TRIGGER IF EXISTS trg_refresh_summary_number_pools ON public.number_pools;

-- Ensure cache realtime is enabled.
DO $$
BEGIN
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

-- Remove old summary table from realtime publication if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'number_status_summary'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.number_status_summary;
  END IF;
END $$;

-- Admin stats must read counts from cache instead of legacy number_status_summary.
CREATE OR REPLACE FUNCTION public.refresh_admin_stats_summary()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_submission_stats_summary();

  INSERT INTO public.admin_stats_summary(
    id,
    total_users,
    total_submissions,
    pending_submissions,
    approved_submissions,
    rejected_submissions,
    total_revenue,
    pending_amount,
    total_numbers,
    sold_numbers,
    open_numbers,
    pending_numbers,
    updated_at
  )
  SELECT
    1,
    (SELECT COUNT(*) FROM public.users),
    COALESCE((SELECT total_submissions FROM public.submission_stats_summary WHERE id = 1), 0),
    COALESCE((SELECT pending_submissions FROM public.submission_stats_summary WHERE id = 1), 0),
    COALESCE((SELECT approved_submissions FROM public.submission_stats_summary WHERE id = 1), 0),
    COALESCE((SELECT rejected_submissions FROM public.submission_stats_summary WHERE id = 1), 0),
    COALESCE((SELECT total_approved_amount FROM public.submission_stats_summary WHERE id = 1), 0),
    COALESCE((SELECT total_pending_amount FROM public.submission_stats_summary WHERE id = 1), 0),
    (SELECT COUNT(*) FROM public.number_status_summary_cache),
    (SELECT COUNT(*) FROM public.number_status_summary_cache WHERE status = 'sold'),
    (SELECT COUNT(*) FROM public.number_status_summary_cache WHERE status = 'open'),
    (SELECT COUNT(*) FROM public.number_status_summary_cache WHERE status = 'pending'),
    now()
  ON CONFLICT(id) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    total_submissions = EXCLUDED.total_submissions,
    pending_submissions = EXCLUDED.pending_submissions,
    approved_submissions = EXCLUDED.approved_submissions,
    rejected_submissions = EXCLUDED.rejected_submissions,
    total_revenue = EXCLUDED.total_revenue,
    pending_amount = EXCLUDED.pending_amount,
    total_numbers = EXCLUDED.total_numbers,
    sold_numbers = EXCLUDED.sold_numbers,
    open_numbers = EXCLUDED.open_numbers,
    pending_numbers = EXCLUDED.pending_numbers,
    updated_at = now();
END;
$$;

-- Rebuild the active cache once after migration, then refresh admin stats from it.
SELECT public.refresh_all_number_status_summary_cache();
SELECT public.refresh_admin_stats_summary();

COMMIT;

-- Verification queries:
-- SELECT COUNT(*) FROM public.number_status_summary_cache;
-- SELECT status, COUNT(*) FROM public.number_status_summary_cache GROUP BY status ORDER BY status;
-- SELECT * FROM public.admin_stats_summary WHERE id = 1;
