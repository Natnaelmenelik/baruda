-- Allow read-only access to public number summary via Supabase REST.
-- number_status_summary contains public availability only, no private user info.

ALTER TABLE public.number_status_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "number_status_summary_public_read" ON public.number_status_summary;

CREATE POLICY "number_status_summary_public_read"
ON public.number_status_summary
FOR SELECT
USING (true);

-- Optional verification:
-- SELECT COUNT(*) FROM public.number_status_summary;
