-- ============================================================
-- Fix payment_holds.number_amounts JSONB safety
-- Problem: cannot call jsonb_each_text on a non-object
-- ============================================================

-- 1) Fix existing invalid rows
UPDATE public.payment_holds
SET number_amounts = '{}'::jsonb
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) <> 'object';

-- 2) Optional but recommended: prevent future invalid values
ALTER TABLE public.payment_holds
DROP CONSTRAINT IF EXISTS payment_holds_number_amounts_object_check;

ALTER TABLE public.payment_holds
ADD CONSTRAINT payment_holds_number_amounts_object_check
CHECK (jsonb_typeof(number_amounts) = 'object');

-- 3) Safe summary refresh function
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

  SELECT COALESCE(SUM((hold_item.value)::integer), 0)
  INTO v_hold
  FROM public.payment_holds ph
  CROSS JOIN LATERAL jsonb_each_text(
    CASE
      WHEN jsonb_typeof(ph.number_amounts) = 'object'
      THEN ph.number_amounts
      ELSE '{}'::jsonb
    END
  ) AS hold_item(key, value)
  WHERE ph.status = 'active'
    AND ph.expires_at > now()
    AND hold_item.key ~ '^[0-9]+$'
    AND hold_item.value ~ '^[0-9]+$'
    AND hold_item.key::integer = p_number;

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

-- 4) Safe payment-hold trigger
CREATE OR REPLACE FUNCTION public.trg_refresh_from_payment_hold()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  k text;
  safe_new jsonb := '{}'::jsonb;
  safe_old jsonb := '{}'::jsonb;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    safe_new :=
      CASE
        WHEN jsonb_typeof(NEW.number_amounts) = 'object'
        THEN NEW.number_amounts
        ELSE '{}'::jsonb
      END;

    FOR k IN SELECT jsonb_object_keys(safe_new)
    LOOP
      IF k ~ '^[0-9]+$' THEN
        PERFORM public.refresh_number_status_summary(k::integer);
      END IF;
    END LOOP;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    safe_old :=
      CASE
        WHEN jsonb_typeof(OLD.number_amounts) = 'object'
        THEN OLD.number_amounts
        ELSE '{}'::jsonb
      END;

    FOR k IN SELECT jsonb_object_keys(safe_old)
    LOOP
      IF k ~ '^[0-9]+$' THEN
        PERFORM public.refresh_number_status_summary(k::integer);
      END IF;
    END LOOP;
  END IF;

  PERFORM public.refresh_admin_stats_summary();

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- 5) Recalculate
SELECT public.refresh_all_number_status_summary();
SELECT public.refresh_admin_stats_summary();

-- 6) Verify
SELECT COUNT(*) AS invalid_payment_holds
FROM public.payment_holds
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) <> 'object';
