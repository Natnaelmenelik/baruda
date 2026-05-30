-- Fix lottery settings realtime visibility and stale setting refresh support.
-- Run this once in Supabase SQL Editor.

ALTER TABLE public.lottery_settings_cache REPLICA IDENTITY FULL;

-- Keep this table public-readable for anon realtime listeners.
ALTER TABLE public.lottery_settings_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read lottery settings cache" ON public.lottery_settings_cache;
CREATE POLICY "Read lottery settings cache"
ON public.lottery_settings_cache
FOR SELECT
USING (true);

-- Make sure it is in Supabase Realtime publication.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lottery_settings_cache;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

-- Rebuild one settings cache row now.
SELECT public.refresh_lottery_settings_cache();
