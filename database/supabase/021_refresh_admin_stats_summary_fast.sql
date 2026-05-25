-- Fast admin stats summary refresh.
-- Safe to run multiple times.

CREATE OR REPLACE FUNCTION public.refresh_admin_stats_summary()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_users int := 0;
  v_total_submissions int := 0;
  v_pending_submissions int := 0;
  v_approved_submissions int := 0;
  v_rejected_submissions int := 0;
  v_total_revenue int := 0;
  v_pending_amount int := 0;
  v_total_numbers int := 0;
  v_sold_numbers int := 0;
  v_open_numbers int := 0;
  v_pending_numbers int := 0;
BEGIN
  SELECT COUNT(*)::int
  INTO v_total_users
  FROM public.users u
  WHERE COALESCE(u.is_admin, false) = false
    AND COALESCE(u.role, 'user') <> 'admin';

  SELECT
    COUNT(DISTINCT COALESCE(s.submission_group_id::text, s.id::text))::int,
    COUNT(DISTINCT COALESCE(s.submission_group_id::text, s.id::text)) FILTER (WHERE s.status = 'pending')::int,
    COUNT(DISTINCT COALESCE(s.submission_group_id::text, s.id::text)) FILTER (WHERE s.status = 'approved')::int,
    COUNT(DISTINCT COALESCE(s.submission_group_id::text, s.id::text)) FILTER (WHERE s.status = 'rejected')::int,
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.status = 'approved'), 0)::int,
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.status = 'pending'), 0)::int
  INTO
    v_total_submissions,
    v_pending_submissions,
    v_approved_submissions,
    v_rejected_submissions,
    v_total_revenue,
    v_pending_amount
  FROM public.submissions s;

  /*
    Number counts should come from number_status_summary.
    This is fast and reflects approved/pending/hold totals when its refresh
    function/trigger is working.
  */
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (
      WHERE nss.status = 'sold'
         OR nss.remaining_amount <= 0
         OR nss.approved_amount >= nss.target_amount
    )::int,
    COUNT(*) FILTER (
      WHERE nss.remaining_amount > 0
        AND nss.status <> 'sold'
    )::int,
    COUNT(*) FILTER (
      WHERE nss.status = 'pending'
         OR nss.pending_amount > 0
         OR nss.hold_amount > 0
    )::int
  INTO
    v_total_numbers,
    v_sold_numbers,
    v_open_numbers,
    v_pending_numbers
  FROM public.number_status_summary nss;

  INSERT INTO public.admin_stats_summary (
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
  VALUES (
    1,
    COALESCE(v_total_users, 0),
    COALESCE(v_total_submissions, 0),
    COALESCE(v_pending_submissions, 0),
    COALESCE(v_approved_submissions, 0),
    COALESCE(v_rejected_submissions, 0),
    COALESCE(v_total_revenue, 0),
    COALESCE(v_pending_amount, 0),
    COALESCE(v_total_numbers, 0),
    COALESCE(v_sold_numbers, 0),
    COALESCE(v_open_numbers, 0),
    COALESCE(v_pending_numbers, 0),
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
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
    updated_at = NOW();
END;
$$;

-- Initialize after creating/replacing function.
SELECT public.refresh_admin_stats_summary();
