-- Fast incremental approve/reject support.
-- Safe to run multiple times.

CREATE INDEX IF NOT EXISTS idx_submission_items_submission_id
ON public.submission_items (submission_id);

CREATE INDEX IF NOT EXISTS idx_submission_items_number
ON public.submission_items (number);

CREATE INDEX IF NOT EXISTS idx_submission_items_submission_number
ON public.submission_items (submission_id, number);

CREATE INDEX IF NOT EXISTS idx_submissions_submission_group_id
ON public.submissions (submission_group_id);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
ON public.submissions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_user_status_created
ON public.submissions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_number
ON public.number_status_summary_cache (number);

CREATE INDEX IF NOT EXISTS idx_number_pools_number
ON public.number_pools (number);

CREATE INDEX IF NOT EXISTS idx_number_locks_number
ON public.number_locks (number);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'number_status_summary_cache') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.number_status_summary_cache;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'submissions') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END IF;
END $$;
