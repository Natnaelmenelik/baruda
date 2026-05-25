-- ============================================================
-- ODDA: Relational payment hold items migration
-- Replaces fragile payment_holds.number_amounts JSONB unpacking
-- with payment_hold_items rows.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_hold_items (
  id bigserial PRIMARY KEY,
  hold_id uuid NOT NULL REFERENCES public.payment_holds(id) ON DELETE CASCADE,
  number integer NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (hold_id, number)
);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_hold_id
ON public.payment_hold_items(hold_id);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_number
ON public.payment_hold_items(number);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_number_hold
ON public.payment_hold_items(number, hold_id);

-- Clean invalid JSONB rows before optional migration.
UPDATE public.payment_holds
SET number_amounts = '{}'::jsonb
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) NOT IN ('object', 'string');

-- Convert double-encoded JSON string objects to real JSON objects.
UPDATE public.payment_holds
SET number_amounts = (number_amounts #>> '{}')::jsonb
WHERE jsonb_typeof(number_amounts) = 'string'
  AND (number_amounts #>> '{}') ~ '^\s*\{.*\}\s*$';

-- Any remaining non-object becomes empty object.
UPDATE public.payment_holds
SET number_amounts = '{}'::jsonb
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) <> 'object';

-- Migrate existing hold JSON object entries into payment_hold_items.
INSERT INTO public.payment_hold_items (hold_id, number, amount, created_at)
SELECT
  ph.id,
  e.key::integer AS number,
  e.value::integer AS amount,
  COALESCE(ph.created_at, now()) AS created_at
FROM public.payment_holds ph
CROSS JOIN LATERAL jsonb_each_text(ph.number_amounts) AS e(key, value)
WHERE jsonb_typeof(ph.number_amounts) = 'object'
  AND e.key ~ '^[0-9]+$'
  AND e.value ~ '^[0-9]+$'
  AND e.value::integer > 0
ON CONFLICT (hold_id, number)
DO UPDATE SET amount = EXCLUDED.amount;

-- Keep payment_holds.number_amounts as legacy compatibility, but force object.
ALTER TABLE public.payment_holds
DROP CONSTRAINT IF EXISTS payment_holds_number_amounts_object_check;

ALTER TABLE public.payment_holds
ADD CONSTRAINT payment_holds_number_amounts_object_check
CHECK (jsonb_typeof(number_amounts) = 'object');

DROP TRIGGER IF EXISTS trg_refresh_summary_payment_holds ON public.payment_holds;
DROP TRIGGER IF EXISTS trg_refresh_summary_payment_hold_items ON public.payment_hold_items;

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

  SELECT COALESCE(SUM(phi.amount), 0)
  INTO v_hold
  FROM public.payment_hold_items phi
  JOIN public.payment_holds ph ON ph.id = phi.hold_id
  WHERE phi.number = p_number
    AND ph.status = 'active'
    AND ph.expires_at > now();

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

CREATE OR REPLACE FUNCTION public.trg_refresh_from_payment_hold_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_number_status_summary(NEW.number);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.refresh_number_status_summary(OLD.number);
    PERFORM public.refresh_number_status_summary(NEW.number);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_number_status_summary(OLD.number);
  END IF;

  PERFORM public.refresh_admin_stats_summary();

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

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

CREATE TRIGGER trg_refresh_summary_payment_hold_items
AFTER INSERT OR UPDATE OR DELETE ON public.payment_hold_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_from_payment_hold_items();

CREATE TRIGGER trg_refresh_summary_payment_holds
AFTER INSERT OR UPDATE OR DELETE ON public.payment_holds
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_from_payment_hold();

-- Update cleanup function to refresh summaries indirectly through status trigger.
CREATE OR REPLACE FUNCTION public.cleanup_expired_payment_holds()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.payment_holds
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'active'
    AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

SELECT public.refresh_all_number_status_summary();
SELECT public.refresh_admin_stats_summary();

COMMIT;

-- Verification
SELECT COUNT(*) AS payment_hold_items_count FROM public.payment_hold_items;
SELECT COUNT(*) AS invalid_payment_holds
FROM public.payment_holds
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) <> 'object';
