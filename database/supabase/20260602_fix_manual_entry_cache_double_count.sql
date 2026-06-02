-- Fix manual entry amounts being counted more than once in number_status_summary_cache.
-- Root cause: some submissions have both legacy columns (submissions.number/numbers/number_amounts)
-- and normalized rows in submission_items. The refresh function must count submission_items first,
-- and only fall back to legacy submission fields when no submission_items exist for that submission.

BEGIN;

-- Required for item-level removal/rejection history. Safe if already exists.
ALTER TABLE public.submission_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status = ANY (ARRAY['active'::text, 'rejected'::text]));

ALTER TABLE public.submission_items
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;

-- Prevent recursion when refresh_number_status_summary_cache() updates number_pools.
CREATE OR REPLACE FUNCTION public.refresh_cache_from_number_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.refreshing_number_cache', true) = '1' THEN
    RETURN NEW;
  END IF;

  PERFORM public.refresh_number_status_summary_cache(NEW.number);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_number_status_summary_cache(p_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target integer := 0;
  v_approved integer := 0;
  v_pending integer := 0;
  v_hold integer := 0;
  v_sold integer := 0;
  v_remaining integer := 0;
  v_status text := 'open';
BEGIN
  IF p_number IS NULL OR p_number <= 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(np.target_amount, 0)::integer
  INTO v_target
  FROM public.number_pools np
  WHERE np.number = p_number;

  v_target := COALESCE(v_target, 0);

  -- Count normalized submission_items. Rejected item rows do not count.
  SELECT
    COALESCE(SUM(CASE WHEN s.status = 'approved' THEN si.amount ELSE 0 END), 0)::integer,
    COALESCE(SUM(CASE WHEN s.status = 'pending' THEN si.amount ELSE 0 END), 0)::integer
  INTO v_approved, v_pending
  FROM public.submission_items si
  JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number
    AND COALESCE(si.status, 'active') <> 'rejected'
    AND COALESCE(s.status, '') IN ('pending', 'approved');

  -- Legacy fallback: count submissions directly only when that submission has no item rows.
  -- This prevents double counting when both submissions.number_amounts and submission_items exist.
  WITH legacy AS (
    SELECT
      s.status,
      CASE
        WHEN s.number_amounts ? p_number::text
          THEN NULLIF(s.number_amounts ->> p_number::text, '')::numeric
        WHEN s.number = p_number
          THEN COALESCE(s.total_amount, 0)::numeric
        ELSE 0::numeric
      END AS amount
    FROM public.submissions s
    WHERE COALESCE(s.status, '') IN ('pending', 'approved')
      AND NOT EXISTS (
        SELECT 1
        FROM public.submission_items si
        WHERE si.submission_id = s.id
      )
      AND (
        s.number = p_number
        OR (s.numbers IS NOT NULL AND p_number = ANY(s.numbers))
        OR (s.number_amounts ? p_number::text)
      )
  )
  SELECT
    v_approved + COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0)::integer,
    v_pending + COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::integer
  INTO v_approved, v_pending
  FROM legacy;

  -- Active non-expired holds count as hold_amount.
  SELECT COALESCE(SUM(phi.amount), 0)::integer
  INTO v_hold
  FROM public.payment_hold_items phi
  JOIN public.payment_holds ph ON ph.id = phi.hold_id
  WHERE phi.number = p_number
    AND ph.status = 'active'
    AND ph.expires_at > now();

  v_approved := COALESCE(v_approved, 0);
  v_pending := COALESCE(v_pending, 0);
  v_hold := COALESCE(v_hold, 0);
  v_sold := v_approved + v_pending + v_hold;
  v_remaining := GREATEST(v_target - v_sold, 0);

  v_status := CASE
    WHEN v_remaining <= 0 THEN 'sold'
    WHEN v_hold > 0 THEN 'locked'
    WHEN v_pending > 0 THEN 'pending'
    ELSE 'open'
  END;

  INSERT INTO public.number_status_summary_cache (
    number,
    target_amount,
    approved_amount,
    pending_amount,
    hold_amount,
    sold_amount,
    remaining_amount,
    status,
    updated_at
  )
  VALUES (
    p_number,
    v_target,
    v_approved,
    v_pending,
    v_hold,
    v_sold,
    v_remaining,
    v_status,
    now()
  )
  ON CONFLICT (number) DO UPDATE SET
    target_amount = EXCLUDED.target_amount,
    approved_amount = EXCLUDED.approved_amount,
    pending_amount = EXCLUDED.pending_amount,
    hold_amount = EXCLUDED.hold_amount,
    sold_amount = EXCLUDED.sold_amount,
    remaining_amount = EXCLUDED.remaining_amount,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO public.number_status_summary (
    number,
    target_amount,
    approved_amount,
    pending_amount,
    hold_amount,
    remaining_amount,
    status,
    updated_at
  )
  VALUES (
    p_number,
    v_target,
    v_approved,
    v_pending,
    v_hold,
    v_remaining,
    v_status,
    now()
  )
  ON CONFLICT (number) DO UPDATE SET
    target_amount = EXCLUDED.target_amount,
    approved_amount = EXCLUDED.approved_amount,
    pending_amount = EXCLUDED.pending_amount,
    hold_amount = EXCLUDED.hold_amount,
    remaining_amount = EXCLUDED.remaining_amount,
    status = EXCLUDED.status,
    updated_at = now();

  -- Keep legacy number_pools in sync without recursively re-triggering this function.
  PERFORM set_config('app.refreshing_number_cache', '1', true);

  UPDATE public.number_pools
  SET current_amount = v_sold,
      status = v_status,
      updated_at = now()
  WHERE number = p_number;

  PERFORM set_config('app.refreshing_number_cache', '0', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_number_status_summary_cache_many(p_numbers integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_number integer;
BEGIN
  IF p_numbers IS NULL OR array_length(p_numbers, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_number IN ARRAY (
    SELECT ARRAY_AGG(DISTINCT n ORDER BY n)
    FROM unnest(p_numbers) AS n
    WHERE n IS NOT NULL AND n > 0
  )
  LOOP
    PERFORM public.refresh_number_status_summary_cache(v_number);
  END LOOP;
END;
$function$;

-- Recalculate every number once after replacing the function.
SELECT public.refresh_number_status_summary_cache_many(
  ARRAY(
    SELECT number FROM public.number_pools
    UNION
    SELECT number FROM public.number_status_summary_cache
    UNION
    SELECT number FROM public.submission_items
    UNION
    SELECT number FROM public.payment_hold_items
  )::integer[]
);

COMMIT;
