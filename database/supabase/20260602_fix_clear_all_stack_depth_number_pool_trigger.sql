-- Fix: stack depth limit exceeded during Clear & Start New Round.
-- Cause: number_pools trigger calls refresh_number_status_summary_cache(),
-- while refresh_number_status_summary_cache() itself updates number_pools.
-- That creates recursive loop:
-- refresh_number_status_summary_cache -> UPDATE number_pools -> trigger -> refresh_number_status_summary_cache -> ...

BEGIN;

-- 1) Drop triggers on number_pools that call refresh_cache_from_number_pool().
--    This is the recursion source shown in the Postgres error stack.
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

-- 2) Make the old trigger function harmless if any future migration recreates a trigger using it.
--    It no longer calls refresh_number_status_summary_cache(), so it cannot recurse.
CREATE OR REPLACE FUNCTION public.refresh_cache_from_number_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Intentionally no recursive refresh call here.
  -- Cache refreshes should be triggered explicitly by API routes/functions:
  --   refresh_number_status_summary_cache(number)
  --   refresh_number_status_summary_cache_many(numbers)
  --   refresh_all_number_status_summary_cache()
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Rebuild summary cache from current DB state once, after removing recursion.
SELECT public.refresh_all_number_status_summary_cache();

-- 4) Re-sync legacy number_pools from the now-correct cache without triggering recursion.
UPDATE public.number_pools np
SET current_amount = c.sold_amount,
    status = c.status,
    target_amount = c.target_amount,
    updated_at = now()
FROM public.number_status_summary_cache c
WHERE c.number = np.number;

COMMIT;

-- Optional verification after running:
-- SELECT tg.tgname, pr.proname
-- FROM pg_trigger tg
-- JOIN pg_class cls ON cls.oid = tg.tgrelid
-- JOIN pg_namespace ns ON ns.oid = cls.relnamespace
-- JOIN pg_proc pr ON pr.oid = tg.tgfoid
-- WHERE ns.nspname = 'public'
--   AND cls.relname = 'number_pools'
--   AND NOT tg.tgisinternal;
