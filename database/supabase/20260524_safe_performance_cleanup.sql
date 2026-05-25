-- Safe performance cleanup for number grid / holds / settings.
-- Run this in Supabase SQL Editor after applying the number_status_summary_cache migration.
-- This script is idempotent and does not replace your business source tables.

BEGIN;

-- Payment hold lookup speed.
CREATE INDEX IF NOT EXISTS idx_payment_holds_client_active
  ON public.payment_holds(client_hold_key, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_holds_active_expiry
  ON public.payment_holds(expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_number_hold_amount
  ON public.payment_hold_items(number, hold_id, amount);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_hold_number_amount
  ON public.payment_hold_items(hold_id, number, amount);

-- Submissions/admin list speed, safe if already exists.
CREATE INDEX IF NOT EXISTS idx_submissions_status_created_id
  ON public.submissions(status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_user_status_created
  ON public.submissions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_items_submission_number_amount
  ON public.submission_items(submission_id, number, amount);

CREATE INDEX IF NOT EXISTS idx_settings_key
  ON public.settings(key);

-- Expire only holds that touch selected numbers instead of scanning all holds on every request.
CREATE OR REPLACE FUNCTION public.expire_payment_holds_for_numbers(p_numbers integer[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_numbers IS NULL OR array_length(p_numbers, 1) IS NULL THEN
    RETURN 0;
  END IF;

  WITH expired AS (
    UPDATE public.payment_holds ph
    SET status = 'expired', updated_at = now()
    WHERE ph.status = 'active'
      AND ph.expires_at <= now()
      AND EXISTS (
        SELECT 1
        FROM public.payment_hold_items phi
        WHERE phi.hold_id = ph.id
          AND phi.number = ANY(p_numbers)
      )
    RETURNING ph.id
  )
  SELECT COUNT(*)::integer INTO v_count FROM expired;

  -- Triggers on payment_holds should refresh affected cache rows.
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Faster batch refresh helper for frontend/API paths that know the affected numbers.
CREATE OR REPLACE FUNCTION public.refresh_number_status_summary_cache_many(p_numbers integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF p_numbers IS NULL OR array_length(p_numbers, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH n IN ARRAY p_numbers LOOP
    IF n IS NOT NULL AND n > 0 THEN
      PERFORM public.refresh_number_status_summary_cache(n);
    END IF;
  END LOOP;
END;
$$;

-- Make sure cache table is realtime-enabled.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.number_status_summary_cache;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

COMMIT;
