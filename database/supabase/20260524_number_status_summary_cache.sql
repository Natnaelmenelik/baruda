-- Number grid production cache layer
-- Run this once in Supabase SQL Editor.
-- It keeps existing business tables as source of truth and adds a fast realtime-ready cache table.

BEGIN;

CREATE TABLE IF NOT EXISTS public.number_status_summary_cache (
  number integer PRIMARY KEY,
  target_amount integer NOT NULL DEFAULT 0,
  approved_amount integer NOT NULL DEFAULT 0,
  pending_amount integer NOT NULL DEFAULT 0,
  hold_amount integer NOT NULL DEFAULT 0,
  sold_amount integer NOT NULL DEFAULT 0,
  remaining_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_status
  ON public.number_status_summary_cache(status);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_updated_at
  ON public.number_status_summary_cache(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_number_pools_number_status
  ON public.number_pools(number, status);

CREATE INDEX IF NOT EXISTS idx_number_pools_updated_at
  ON public.number_pools(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_status_user_created
  ON public.submissions(status, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON public.submissions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_group_status
  ON public.submissions(submission_group_id, status);

CREATE INDEX IF NOT EXISTS idx_submission_items_number_submission
  ON public.submission_items(number, submission_id);

CREATE INDEX IF NOT EXISTS idx_submission_items_submission_number
  ON public.submission_items(submission_id, number);

CREATE INDEX IF NOT EXISTS idx_payment_holds_status_expires
  ON public.payment_holds(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_number_hold
  ON public.payment_hold_items(number, hold_id);

CREATE OR REPLACE FUNCTION public.refresh_number_status_summary_cache(p_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target integer := 0;
  v_pool_status text := 'open';
  v_approved integer := 0;
  v_pending integer := 0;
  v_hold integer := 0;
  v_remaining integer := 0;
  v_status text := 'open';
BEGIN
  IF p_number IS NULL OR p_number <= 0 THEN
    RETURN;
  END IF;

  -- Expire stale holds before calculating available amount.
  UPDATE public.payment_holds
  SET status = 'expired', updated_at = now()
  WHERE status = 'active'
    AND expires_at <= now();

  SELECT
    COALESCE(np.target_amount, NULLIF((SELECT value FROM public.settings WHERE key = 'default_target_amount' LIMIT 1), '')::integer, 5000),
    COALESCE(np.status, 'open')
  INTO v_target, v_pool_status
  FROM public.number_pools np
  WHERE np.number = p_number
  LIMIT 1;

  IF v_target IS NULL OR v_target <= 0 THEN
    v_target := COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'default_target_amount' LIMIT 1), '')::integer, 5000);
  END IF;

  SELECT COALESCE(SUM(si.amount), 0)::integer
  INTO v_approved
  FROM public.submission_items si
  JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number
    AND s.status = 'approved';

  SELECT COALESCE(SUM(si.amount), 0)::integer
  INTO v_pending
  FROM public.submission_items si
  JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number
    AND s.status = 'pending';

  SELECT COALESCE(SUM(phi.amount), 0)::integer
  INTO v_hold
  FROM public.payment_hold_items phi
  JOIN public.payment_holds ph ON ph.id = phi.hold_id
  WHERE phi.number = p_number
    AND ph.status = 'active'
    AND ph.expires_at > now();

  v_remaining := GREATEST(v_target - v_approved - v_pending - v_hold, 0);

  v_status := CASE
    WHEN v_approved >= v_target THEN 'sold'
    WHEN v_pool_status IN ('sold', 'closed', 'locked') THEN v_pool_status
    WHEN v_pending > 0 OR v_hold > 0 THEN 'pending'
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
  ON CONFLICT (number)
  DO UPDATE SET
    target_amount = EXCLUDED.target_amount,
    approved_amount = EXCLUDED.approved_amount,
    pending_amount = EXCLUDED.pending_amount,
    hold_amount = EXCLUDED.hold_amount,
    sold_amount = EXCLUDED.sold_amount,
    remaining_amount = EXCLUDED.remaining_amount,
    status = EXCLUDED.status,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_number_status_summary_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
  v_grid_size integer := 2000;
BEGIN
  v_grid_size := COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'grid_size' LIMIT 1), '')::integer, 2000);

  INSERT INTO public.number_pools (number, target_amount, current_amount, status, updated_at)
  SELECT gs.number,
         COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'default_target_amount' LIMIT 1), '')::integer, 5000),
         0,
         'open',
         now()
  FROM generate_series(1, v_grid_size) AS gs(number)
  ON CONFLICT (number) DO NOTHING;

  FOR n IN SELECT number FROM public.number_pools ORDER BY number ASC LOOP
    PERFORM public.refresh_number_status_summary_cache(n);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_cache_from_submission_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_number_status_summary_cache(NEW.number);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_number_status_summary_cache(OLD.number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_cache_from_submission_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') IS DISTINCT FROM COALESCE(NEW.status, '') THEN
    FOR r IN SELECT DISTINCT number FROM public.submission_items WHERE submission_id IN (OLD.id, NEW.id) LOOP
      PERFORM public.refresh_number_status_summary_cache(r.number);
    END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_cache_from_hold_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_number_status_summary_cache(NEW.number);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_number_status_summary_cache(OLD.number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_cache_from_hold_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE', 'DELETE') THEN
    FOR r IN
      SELECT DISTINCT number
      FROM public.payment_hold_items
      WHERE hold_id = COALESCE(NEW.id, OLD.id)
    LOOP
      PERFORM public.refresh_number_status_summary_cache(r.number);
    END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_cache_from_number_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_number_status_summary_cache(NEW.number);
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.number_status_summary_cache WHERE number = OLD.number;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_cache_submission_items ON public.submission_items;
CREATE TRIGGER trg_refresh_cache_submission_items
AFTER INSERT OR UPDATE OR DELETE ON public.submission_items
FOR EACH ROW EXECUTE FUNCTION public.refresh_cache_from_submission_items();

DROP TRIGGER IF EXISTS trg_refresh_cache_submission_status ON public.submissions;
CREATE TRIGGER trg_refresh_cache_submission_status
AFTER UPDATE OF status ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.refresh_cache_from_submission_status();

DROP TRIGGER IF EXISTS trg_refresh_cache_hold_items ON public.payment_hold_items;
CREATE TRIGGER trg_refresh_cache_hold_items
AFTER INSERT OR UPDATE OR DELETE ON public.payment_hold_items
FOR EACH ROW EXECUTE FUNCTION public.refresh_cache_from_hold_items();

DROP TRIGGER IF EXISTS trg_refresh_cache_hold_status ON public.payment_holds;
CREATE TRIGGER trg_refresh_cache_hold_status
AFTER INSERT OR UPDATE OF status, expires_at OR DELETE ON public.payment_holds
FOR EACH ROW EXECUTE FUNCTION public.refresh_cache_from_hold_status();

DROP TRIGGER IF EXISTS trg_refresh_cache_number_pool ON public.number_pools;
CREATE TRIGGER trg_refresh_cache_number_pool
AFTER INSERT OR UPDATE OR DELETE ON public.number_pools
FOR EACH ROW EXECUTE FUNCTION public.refresh_cache_from_number_pool();

SELECT public.refresh_all_number_status_summary_cache();

-- Enable Supabase Realtime for the cache table.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.number_status_summary_cache;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

-- If RLS is enabled globally in your project, this read policy makes cache visible to clients.
ALTER TABLE public.number_status_summary_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read number summary cache" ON public.number_status_summary_cache;
CREATE POLICY "Read number summary cache"
ON public.number_status_summary_cache
FOR SELECT
USING (true);

COMMIT;
