-- ============================================================
-- Force payment_holds.number_amounts to always be a JSON object
-- and remove unsafe jsonb_each_text logic from DB functions.
-- ============================================================

-- 1. Clean existing rows
UPDATE public.payment_holds
SET number_amounts = '{}'::jsonb
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) <> 'object';

-- 2. Enforce future safety
ALTER TABLE public.payment_holds
DROP CONSTRAINT IF EXISTS payment_holds_number_amounts_object_check;

ALTER TABLE public.payment_holds
ADD CONSTRAINT payment_holds_number_amounts_object_check
CHECK (jsonb_typeof(number_amounts) = 'object');

-- 3. Drop and recreate payment hold trigger safely
DROP TRIGGER IF EXISTS trg_refresh_summary_payment_holds ON public.payment_holds;

-- 4. Refresh number summary WITHOUT jsonb_each_text
CREATE OR REPLACE FUNCTION public.refresh_number_status_summary(p_number integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_target integer := 5000;
  v_approved integer := 0;
  v_pending integer := 0;
  v_hold integer := 0;
  v_remaining integer := 0;
  v_status varchar(20) := 'open';
BEGIN
  SELECT COALESCE(target_amount, 5000)
  INTO v_target
  FROM public.number_pools
  WHERE number = p_number;

  IF v_target IS NULL OR v_target <= 0 THEN
    v_target := 5000;
  END IF;

  SELECT COALESCE(SUM(si.amount), 0)
  INTO v_approved
  FROM public.submission_items si
  JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number
    AND s.status = 'approved';

  SELECT COALESCE(SUM(si.amount), 0)
  INTO v_pending
  FROM public.submission_items si
  JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number
    AND s.status = 'pending';

  SELECT COALESCE(SUM(
    CASE
      WHEN jsonb_typeof(ph.number_amounts) = 'object'
       AND ph.number_amounts ? p_number::text
       AND (ph.number_amounts ->> p_number::text) ~ '^[0-9]+$'
      THEN (ph.number_amounts ->> p_number::text)::integer
      ELSE 0
    END
  ), 0)
  INTO v_hold
  FROM public.payment_holds ph
  WHERE ph.status = 'active'
    AND ph.expires_at > now()
    AND p_number = ANY(ph.numbers);

  v_remaining := GREATEST(v_target - v_approved - v_pending - v_hold, 0);

  IF v_approved >= v_target THEN
    v_status := 'sold';
  ELSIF v_pending > 0 OR v_hold > 0 THEN
    v_status := 'pending';
  ELSE
    v_status := 'open';
  END IF;

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
  ON CONFLICT (number)
  DO UPDATE SET
    target_amount = EXCLUDED.target_amount,
    approved_amount = EXCLUDED.approved_amount,
    pending_amount = EXCLUDED.pending_amount,
    hold_amount = EXCLUDED.hold_amount,
    remaining_amount = EXCLUDED.remaining_amount,
    status = EXCLUDED.status,
    updated_at = now();
END;
$$;

-- 5. Payment hold trigger WITHOUT jsonb_each_text/jsonb_object_keys
CREATE OR REPLACE FUNCTION public.trg_refresh_from_payment_hold()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    FOREACH n IN ARRAY COALESCE(NEW.numbers, ARRAY[]::integer[])
    LOOP
      PERFORM public.refresh_number_status_summary(n);
    END LOOP;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    FOREACH n IN ARRAY COALESCE(OLD.numbers, ARRAY[]::integer[])
    LOOP
      PERFORM public.refresh_number_status_summary(n);
    END LOOP;
  END IF;

  PERFORM public.refresh_admin_stats_summary();

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refresh_summary_payment_holds
AFTER INSERT OR UPDATE OR DELETE ON public.payment_holds
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_from_payment_hold();

-- 6. Refresh summaries
SELECT public.refresh_all_number_status_summary();
SELECT public.refresh_admin_stats_summary();

-- 7. Verify
SELECT COUNT(*) AS invalid_payment_holds
FROM public.payment_holds
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) <> 'object';
