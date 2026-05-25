-- Dashboard announcements performance indexes
-- Safe to run multiple times in Supabase SQL Editor.

CREATE INDEX IF NOT EXISTS idx_settings_key_value_lookup
ON public.settings (key);

CREATE INDEX IF NOT EXISTS idx_winner_announcements_created_at_desc
ON public.winner_announcements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_user_approved_latest
ON public.submissions (user_id, status, approved_at DESC, created_at DESC)
WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_submissions_user_created_at_desc
ON public.submissions (user_id, created_at DESC);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.winner_announcements;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
