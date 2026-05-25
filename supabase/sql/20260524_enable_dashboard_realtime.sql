-- Required for dashboard messages / winner announcements / approved-number messages
-- to appear without refreshing the logged-in user's dashboard.
-- Run this once in Supabase Dashboard → SQL Editor.

-- 1) Make UPDATE payloads complete.
ALTER TABLE IF EXISTS public.settings REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.winner_announcements REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.submissions REPLICA IDENTITY FULL;

-- 2) Add tables to Supabase Realtime publication.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN RAISE NOTICE 'supabase_realtime publication does not exist yet';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.winner_announcements;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN RAISE NOTICE 'supabase_realtime publication does not exist yet';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN RAISE NOTICE 'supabase_realtime publication does not exist yet';
END $$;

-- 3) Global dashboard messages and winner announcements are public display data.
--    These SELECT grants allow browser Realtime to receive their postgres_changes.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.winner_announcements TO anon, authenticated;
GRANT SELECT ON public.settings TO anon, authenticated;

-- IMPORTANT ABOUT submissions:
-- For approved-number user messages, Realtime on submissions is user-specific.
-- If your app uses custom JWT auth, Supabase cannot automatically know the logged-in app user
-- unless your JWT is Supabase-compatible and RLS policies are configured for that claim.
-- Do NOT blindly grant public SELECT on submissions if it contains private user/payment data.
-- If approved-number Realtime does not fire, use a separate safe notification table or Supabase-compatible JWT.

-- 4) Quick check.
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('settings', 'winner_announcements', 'submissions')
ORDER BY tablename;
