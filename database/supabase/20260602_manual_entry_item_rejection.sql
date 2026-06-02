-- Manual Entry item-level rejection support.
-- Run this once in Supabase SQL Editor before deploying the code changes.

ALTER TABLE public.submission_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.submission_items
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;

ALTER TABLE public.submission_items
  ADD COLUMN IF NOT EXISTS rejected_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'submission_items_status_check'
      AND conrelid = 'public.submission_items'::regclass
  ) THEN
    ALTER TABLE public.submission_items
      ADD CONSTRAINT submission_items_status_check
      CHECK (status IN ('active', 'rejected'));
  END IF;
END $$;

UPDATE public.submission_items
SET status = 'active'
WHERE status IS NULL OR status NOT IN ('active', 'rejected');

CREATE INDEX IF NOT EXISTS idx_submission_items_submission_status
  ON public.submission_items (submission_id, status);

CREATE INDEX IF NOT EXISTS idx_submission_items_number_status
  ON public.submission_items (number, status);

-- Rebuild number cache using only non-rejected submission_items.
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
  v_remaining integer := 0;
  v_status text := 'open';
BEGIN
  IF p_number IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(np.target_amount, 0)::integer
    INTO v_target
  FROM public.number_pools np
  WHERE np.number = p_number;

  IF v_target IS NULL OR v_target <= 0 THEN
    SELECT COALESCE(target_amount, 0)::integer
      INTO v_target
    FROM public.number_status_summary_cache
    WHERE number = p_number;
  END IF;

  v_target := COALESCE(v_target, 0);

  SELECT COALESCE(SUM(si.amount), 0)::integer
    INTO v_approved
  FROM public.submission_items si
  JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number
    AND COALESCE(si.status, 'active') <> 'rejected'
    AND COALESCE(s.status, '') = 'approved';

  SELECT COALESCE(SUM(si.amount), 0)::integer
    INTO v_pending
  FROM public.submission_items si
  JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number
    AND COALESCE(si.status, 'active') <> 'rejected'
    AND COALESCE(s.status, '') = 'pending';

  SELECT COALESCE(SUM(phi.amount), 0)::integer
    INTO v_hold
  FROM public.payment_hold_items phi
  JOIN public.payment_holds ph ON ph.id = phi.hold_id
  WHERE phi.number = p_number
    AND ph.status = 'active'
    AND ph.expires_at > now();

  v_remaining := GREATEST(v_target - v_approved - v_pending - v_hold, 0);

  v_status := CASE
    WHEN v_target > 0 AND v_remaining <= 0 THEN 'sold'
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
    v_approved + v_pending + v_hold,
    v_remaining,
    v_status,
    now()
  )
  ON CONFLICT (number) DO UPDATE
  SET target_amount = EXCLUDED.target_amount,
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
  ON CONFLICT (number) DO UPDATE
  SET target_amount = EXCLUDED.target_amount,
      approved_amount = EXCLUDED.approved_amount,
      pending_amount = EXCLUDED.pending_amount,
      hold_amount = EXCLUDED.hold_amount,
      remaining_amount = EXCLUDED.remaining_amount,
      status = EXCLUDED.status,
      updated_at = now();

  UPDATE public.number_pools
  SET current_amount = v_approved + v_pending + v_hold,
      status = v_status,
      updated_at = now()
  WHERE number = p_number;
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

  FOREACH v_number IN ARRAY p_numbers LOOP
    PERFORM public.refresh_number_status_summary_cache(v_number);
  END LOOP;
END;
$function$;
