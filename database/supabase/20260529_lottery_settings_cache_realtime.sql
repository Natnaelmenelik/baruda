-- Lottery settings cache for immediate frontend updates.
-- Run this once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.lottery_settings_cache (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ticket_price integer NOT NULL DEFAULT 2000,
  grid_size integer NOT NULL DEFAULT 2000,
  numbers_grid_status text NOT NULL DEFAULT 'open' CHECK (numbers_grid_status IN ('open', 'closed')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lottery_settings_cache
  ADD COLUMN IF NOT EXISTS ticket_price integer NOT NULL DEFAULT 10000;

ALTER TABLE public.lottery_settings_cache
  ADD COLUMN IF NOT EXISTS grid_size integer NOT NULL DEFAULT 100;

ALTER TABLE public.lottery_settings_cache
  ADD COLUMN IF NOT EXISTS numbers_grid_status text NOT NULL DEFAULT 'open';

ALTER TABLE public.lottery_settings_cache
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.refresh_lottery_settings_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_price integer;
  v_grid_size integer;
  v_numbers_grid_status text;
BEGIN
  v_ticket_price := COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'ticket_price'), '')::integer, 2000);
  v_grid_size := COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'grid_size'), '')::integer, 2000);
  v_numbers_grid_status := CASE
    WHEN lower(COALESCE(NULLIF((SELECT value FROM public.settings WHERE key = 'numbers_grid_status'), ''), 'open')) = 'closed'
      THEN 'closed'
    ELSE 'open'
  END;

  INSERT INTO public.lottery_settings_cache (
    id,
    ticket_price,
    grid_size,
    numbers_grid_status,
    updated_at
  )
  VALUES (
    1,
    v_ticket_price,
    v_grid_size,
    v_numbers_grid_status,
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    ticket_price = EXCLUDED.ticket_price,
    grid_size = EXCLUDED.grid_size,
    numbers_grid_status = EXCLUDED.numbers_grid_status,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_lottery_settings_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_lottery_settings_cache();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_lottery_settings_cache ON public.settings;

CREATE TRIGGER trg_refresh_lottery_settings_cache
AFTER INSERT OR UPDATE OR DELETE ON public.settings
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_refresh_lottery_settings_cache();

SELECT public.refresh_lottery_settings_cache();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lottery_settings_cache;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
