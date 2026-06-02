BEGIN;

ALTER TABLE public.lottery_settings_cache
  ADD COLUMN IF NOT EXISTS winning_amount integer NOT NULL DEFAULT 560000;

INSERT INTO public.settings (key, value, updated_at)
VALUES ('winning_amount', '560000', now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_lottery_settings_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_winning_amount integer := 560000;
  v_ticket_price integer := 300;
  v_grid_size integer := 2000;
  v_numbers_grid_status text := 'open';
BEGIN
  SELECT COALESCE(NULLIF(value, '')::integer, 560000)
  INTO v_winning_amount
  FROM public.settings
  WHERE key = 'winning_amount'
  LIMIT 1;

  SELECT COALESCE(NULLIF(value, '')::integer, 300)
  INTO v_ticket_price
  FROM public.settings
  WHERE key = 'ticket_price'
  LIMIT 1;

  SELECT COALESCE(NULLIF(value, '')::integer, 2000)
  INTO v_grid_size
  FROM public.settings
  WHERE key = 'grid_size'
  LIMIT 1;

  SELECT CASE WHEN lower(COALESCE(value, 'open')) = 'closed' THEN 'closed' ELSE 'open' END
  INTO v_numbers_grid_status
  FROM public.settings
  WHERE key = 'numbers_grid_status'
  LIMIT 1;

  v_winning_amount := COALESCE(v_winning_amount, 560000);
  v_ticket_price := COALESCE(v_ticket_price, 300);
  v_grid_size := COALESCE(v_grid_size, 2000);
  v_numbers_grid_status := COALESCE(v_numbers_grid_status, 'open');

  INSERT INTO public.lottery_settings_cache (
    id,
    winning_amount,
    ticket_price,
    grid_size,
    numbers_grid_status,
    updated_at
  )
  VALUES (
    1,
    v_winning_amount,
    v_ticket_price,
    v_grid_size,
    v_numbers_grid_status,
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    winning_amount = EXCLUDED.winning_amount,
    ticket_price = EXCLUDED.ticket_price,
    grid_size = EXCLUDED.grid_size,
    numbers_grid_status = EXCLUDED.numbers_grid_status,
    updated_at = now();
END;
$$;

SELECT public.refresh_lottery_settings_cache();

COMMIT;
