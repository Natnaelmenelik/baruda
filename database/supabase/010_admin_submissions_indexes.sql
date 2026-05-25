-- Optimize admin submissions filtering and pagination.

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
ON public.submissions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_status_submitted
ON public.submissions(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_user_id
ON public.submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_users_phone
ON public.users(phone);

CREATE INDEX IF NOT EXISTS idx_users_name
ON public.users(name);

CREATE INDEX IF NOT EXISTS idx_submissions_user_phone
ON public.submissions(user_phone);

CREATE INDEX IF NOT EXISTS idx_submissions_contact_phone
ON public.submissions(contact_phone);
