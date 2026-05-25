-- Final event-driven realtime cleanup support.
-- Safe to run multiple times.

CREATE INDEX IF NOT EXISTS idx_payment_holds_active_expires
  ON public.payment_holds (expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_payment_holds_status_updated
  ON public.payment_holds (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_hold_id_number
  ON public.payment_hold_items (hold_id, number);

CREATE INDEX IF NOT EXISTS idx_payment_hold_items_number_hold_id
  ON public.payment_hold_items (number, hold_id);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_updated
  ON public.number_status_summary_cache (updated_at DESC);

CREATE OR REPLACE FUNCTION public.refresh_number_status_summary_cache_many(p_numbers integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  n integer;
BEGIN
  IF p_numbers IS NULL THEN
    RETURN;
  END IF;

  FOREACH n IN ARRAY p_numbers LOOP
    IF n IS NOT NULL THEN
      PERFORM public.refresh_number_status_summary_cache(n);
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'number_status_summary_cache'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.number_status_summary_cache;
    END IF;
  END IF;
END $$;
