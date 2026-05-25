-- Run this in Supabase SQL Editor to verify NumberGrid data source.

SELECT COUNT(*) AS number_summary_count
FROM public.number_status_summary;

SELECT
  number,
  target_amount,
  approved_amount,
  pending_amount,
  hold_amount,
  remaining_amount,
  status,
  updated_at
FROM public.number_status_summary
ORDER BY number ASC
LIMIT 20;

-- If count is 0, run:
-- SELECT public.refresh_all_number_status_summary();
-- SELECT public.refresh_admin_stats_summary();
-- SELECT public.refresh_submission_stats_summary();
