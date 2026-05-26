-- Admin stats are now calculated live by app/api/admin/stats/route.ts.
-- This SQL is intentionally non-destructive.
-- Do not re-enable old trg_refresh_summary_* triggers just for admin stats.
-- Keep number_status_summary_cache as the source for number counts.

-- Optional one-time check:
SELECT
  (SELECT COUNT(*) FROM public.users) AS total_users,
  (SELECT COUNT(*) FROM public.submissions) AS total_submissions,
  (SELECT COUNT(*) FROM public.number_status_summary_cache) AS total_numbers_from_cache;
