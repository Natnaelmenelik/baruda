-- ============================================================
-- Fix double-encoded payment_holds.number_amounts values
-- Example bad value: "{\"3\":10000}" stored as JSONB string
-- Correct value: {"3":10000} stored as JSONB object
-- ============================================================

-- Convert JSON strings that contain JSON objects into real JSON objects
UPDATE public.payment_holds
SET number_amounts = (number_amounts #>> '{}')::jsonb
WHERE jsonb_typeof(number_amounts) = 'string'
  AND (number_amounts #>> '{}') ~ '^\s*\{.*\}\s*$';

-- Any remaining invalid values become empty object
UPDATE public.payment_holds
SET number_amounts = '{}'::jsonb
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) <> 'object';

-- Keep/enforce safety constraint
ALTER TABLE public.payment_holds
DROP CONSTRAINT IF EXISTS payment_holds_number_amounts_object_check;

ALTER TABLE public.payment_holds
ADD CONSTRAINT payment_holds_number_amounts_object_check
CHECK (jsonb_typeof(number_amounts) = 'object');

-- Refresh summaries
SELECT public.refresh_all_number_status_summary();
SELECT public.refresh_admin_stats_summary();

-- Verify
SELECT
  COUNT(*) AS invalid_payment_holds
FROM public.payment_holds
WHERE number_amounts IS NULL
   OR jsonb_typeof(number_amounts) <> 'object';
