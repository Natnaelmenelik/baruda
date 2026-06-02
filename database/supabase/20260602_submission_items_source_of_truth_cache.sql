-- Make submission_items the source of truth for number cache calculations.
-- submissions.number_amounts is used only as a fallback for legacy submissions
-- that do not have any submission_items rows.
-- Also prevents number_pools trigger recursion during cache refresh.

BEGIN;

-- 1) Make sure item-level rejection fields exist.
ALTER TABLE public.submission_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status = ANY (ARRAY['active'::text, 'rejected'::text]));

ALTER TABLE public.submission_items
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;

ALTER TABLE public.submission_items
  ADD COLUMN IF NOT EXISTS rejected_reason text;

-- 2) Remove/neutralize the recursive number_pools trigger path.
-- The recursion stack was:
-- refresh_number_status_summary_cache -> UPDATE number_pools -> trigger -> refresh_number_status_summary_cache -> ...
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tg.tgname
    FROM pg_trigger tg
    JOIN pg_class cls ON cls.oid = tg.tgrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN pg_proc pr ON pr.oid = tg.tgfoid
    WHERE ns.nspname = 'public'
      AND cls.relname = 'number_pools'
      AND NOT tg.tgisinternal
      AND pr.proname = 'refresh_cache_from_number_pool'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.number_pools', r.tgname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_cache_from_number_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Intentionally no refresh call here. Cache refreshes are called explicitly.
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Replace the single-number refresh function.
CREATE OR REPLACE FUNCTION public.refresh_number_status_summary_cache(p_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Main source of truth: active/non-rejected submission_items.
  SELECT
    COALESCE(SUM(CASE WHEN s.status = 'approved' THEN si.amount ELSE 0 END), 0)::integer,
    COALESCE(SUM(CASE WHEN s.status = 'pending' THEN si.amount ELSE 0 END), 0)::integer
  INTO v_approved, v_pending
  FROM public.submission_items si
  JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number
    AND COALESCE(si.status, 'active') <> 'rejected'
    AND COALESCE(s.status, '') IN ('pending', 'approved');

  -- Legacy fallback: use submissions fields only for submissions with NO item rows.
  -- This prevents double counting manual entries that have both submission_items and number_amounts.
  WITH legacy AS (
    SELECT
      s.id,
      s.status,
      CASE
        WHEN s.number_amounts IS NOT NULL
          AND jsonb_typeof(s.number_amounts) = 'object'
          AND s.number_amounts ? p_number::text
          THEN NULLIF(s.number_amounts ->> p_number::text, '')::numeric
        WHEN s.number = p_number
          THEN COALESCE(s.total_amount, 0)::numeric
        WHEN s.numbers IS NOT NULL AND p_number = ANY(s.numbers)
          THEN COALESCE(s.ticket_price, s.total_amount, 0)::numeric
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
        OR (
          s.number_amounts IS NOT NULL
          AND jsonb_typeof(s.number_amounts) = 'object'
          AND s.number_amounts ? p_number::text
        )
      )
  ), legacy_totals AS (
    SELECT
      COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0)::integer AS approved_amount,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::integer AS pending_amount
    FROM legacy
  )
  SELECT
    COALESCE(v_approved, 0) + COALESCE(approved_amount, 0),
    COALESCE(v_pending, 0) + COALESCE(pending_amount, 0)
  INTO v_approved, v_pending
  FROM legacy_totals;

  -- Active, non-expired payment holds.
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
  ) VALUES (
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
  ) VALUES (
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

  -- Keep legacy pool table in sync. The recursive number_pools trigger is removed/neutralized above.
  UPDATE public.number_pools
  SET current_amount = v_sold,
      status = v_status,
      updated_at = now()
  WHERE number = p_number;
END;
$$;

-- 4) Many-number refresh.
CREATE OR REPLACE FUNCTION public.refresh_number_status_summary_cache_many(p_numbers integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_number integer;
BEGIN
  IF p_numbers IS NULL OR array_length(p_numbers, 1) IS NULL THEN
    RETURN;
  END IF;

  FOR v_number IN
    SELECT DISTINCT n
    FROM unnest(p_numbers) AS n
    WHERE n IS NOT NULL AND n > 0
    ORDER BY n
  LOOP
    PERFORM public.refresh_number_status_summary_cache(v_number);
  END LOOP;
END;
$$;

-- 5) Full refresh helper.
CREATE OR REPLACE FUNCTION public.refresh_all_number_status_summary_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numbers integer[];
BEGIN
  WITH all_numbers AS (
    SELECT np.number
    FROM public.number_pools np

    UNION
    SELECT c.number
    FROM public.number_status_summary_cache c

    UNION
    SELECT si.number
    FROM public.submission_items si

    UNION
    SELECT phi.number
    FROM public.payment_hold_items phi

    UNION
    SELECT s.number
    FROM public.submissions s
    WHERE s.number IS NOT NULL

    UNION
    SELECT unnest(s.numbers) AS number
    FROM public.submissions s
    WHERE s.numbers IS NOT NULL

    UNION
    SELECT key::integer AS number
    FROM public.submissions s
    CROSS JOIN LATERAL jsonb_object_keys(s.number_amounts) AS key
    WHERE s.number_amounts IS NOT NULL
      AND jsonb_typeof(s.number_amounts) = 'object'
      AND key ~ '^[0-9]+$'
  )
  SELECT ARRAY_AGG(DISTINCT number ORDER BY number)
  INTO v_numbers
  FROM all_numbers
  WHERE number IS NOT NULL AND number > 0;

  PERFORM public.refresh_number_status_summary_cache_many(v_numbers);
END;
$$;

-- 6) Recalculate everything once using the corrected logic.
SELECT public.refresh_all_number_status_summary_cache();

COMMIT;

-- Verification examples:
-- SELECT * FROM public.number_status_summary_cache WHERE number = 1;
-- SELECT status, COUNT(*) FROM public.submission_items GROUP BY status;
