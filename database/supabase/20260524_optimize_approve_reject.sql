-- Optimize approve/reject lookups.
-- Safe to run multiple times.

CREATE INDEX IF NOT EXISTS idx_submission_items_submission_id
ON public.submission_items (submission_id);

CREATE INDEX IF NOT EXISTS idx_submission_items_number
ON public.submission_items (number);

CREATE INDEX IF NOT EXISTS idx_submission_items_number_submission_id
ON public.submission_items (number, submission_id);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
ON public.submissions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_group_status
ON public.submissions (submission_group_id, status);

CREATE INDEX IF NOT EXISTS idx_submissions_user_status_created
ON public.submissions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_user_status_approved_created
ON public.submissions (user_id, status, approved_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_number_pools_number_status
ON public.number_pools (number, status);

CREATE INDEX IF NOT EXISTS idx_number_locks_number
ON public.number_locks (number);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_number
ON public.number_status_summary_cache (number);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_number
ON public.number_status_summary (number);

-- Keep summary cache realtime available for frontend card-level updates.
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
