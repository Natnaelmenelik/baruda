-- Hold release / affected-only number cache performance indexes
-- Safe to run multiple times in Supabase SQL Editor.

-- Fast lookup of affected numbers during DELETE /api/holds/:id
CREATE INDEX IF NOT EXISTS idx_payment_hold_items_hold_id_number
ON public.payment_hold_items (hold_id, number);

-- Fast cache refresh by number from active holds
CREATE INDEX IF NOT EXISTS idx_payment_hold_items_number_hold_id
ON public.payment_hold_items (number, hold_id);

-- Fast expiry checks for active holds only
CREATE INDEX IF NOT EXISTS idx_payment_holds_active_expires
ON public.payment_holds (expires_at)
WHERE status = 'active';

-- Fast joins from hold item to active hold
CREATE INDEX IF NOT EXISTS idx_payment_holds_status_id_expires
ON public.payment_holds (status, id, expires_at);

-- Fast approved/pending amount calculation per number
CREATE INDEX IF NOT EXISTS idx_submission_items_number_submission
ON public.submission_items (number, submission_id);

-- Fast join/filter by submission status
CREATE INDEX IF NOT EXISTS idx_submissions_status_id
ON public.submissions (status, id);

-- Optional but recommended if this unique constraint does not already exist.
-- It supports ON CONFLICT (hold_id, number) in app/api/holds/route.ts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_hold_items_hold_id_number_unique
ON public.payment_hold_items (hold_id, number);
