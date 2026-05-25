-- Fast approve/reject RPC functions.
-- Run this in Supabase SQL Editor before testing the patched routes.

CREATE INDEX IF NOT EXISTS idx_submissions_submission_group_id
ON public.submissions (submission_group_id);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
ON public.submissions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_items_submission_id
ON public.submission_items (submission_id);

CREATE INDEX IF NOT EXISTS idx_submission_items_submission_number
ON public.submission_items (submission_id, number);

CREATE INDEX IF NOT EXISTS idx_number_status_summary_cache_number
ON public.number_status_summary_cache (number);

CREATE INDEX IF NOT EXISTS idx_number_pools_number
ON public.number_pools (number);

CREATE INDEX IF NOT EXISTS idx_number_locks_number
ON public.number_locks (number);

CREATE OR REPLACE FUNCTION public.approve_submission_fast(p_submission_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission public.submissions%ROWTYPE;
  v_numeric_id integer;
  v_affected_numbers integer[];
  v_items_count integer;
BEGIN
  IF p_submission_ref IS NULL OR btrim(p_submission_ref) = '' THEN
    RAISE EXCEPTION 'Missing submission id';
  END IF;

  IF p_submission_ref ~ '^[0-9]+$' THEN
    v_numeric_id := p_submission_ref::integer;

    SELECT *
    INTO v_submission
    FROM public.submissions
    WHERE id = v_numeric_id
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT *
    INTO v_submission
    FROM public.submissions
    WHERE submission_group_id = p_submission_ref
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_submission.status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already approved',
      'approvedSubmissionId', v_submission.id,
      'affectedNumbers', jsonb_build_array()
    );
  END IF;

  IF v_submission.status <> 'pending' THEN
    RAISE EXCEPTION 'Submission is already %', v_submission.status;
  END IF;

  CREATE TEMP TABLE tmp_approve_items (
    number integer PRIMARY KEY,
    amount integer NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_approve_items(number, amount)
  SELECT
    si.number,
    SUM(si.amount)::integer
  FROM public.submission_items si
  WHERE si.submission_id = v_submission.id
  GROUP BY si.number;

  GET DIAGNOSTICS v_items_count = ROW_COUNT;

  IF v_items_count = 0 THEN
    IF v_submission.number_amounts IS NOT NULL
       AND jsonb_typeof(v_submission.number_amounts) = 'object'
       AND v_submission.number_amounts <> '{}'::jsonb THEN
      INSERT INTO tmp_approve_items(number, amount)
      SELECT
        key::integer,
        value::integer
      FROM jsonb_each_text(v_submission.number_amounts)
      WHERE key ~ '^[0-9]+$'
        AND value ~ '^[0-9]+$'
      ON CONFLICT (number)
      DO UPDATE SET amount = tmp_approve_items.amount + EXCLUDED.amount;
    ELSIF v_submission.numbers IS NOT NULL
          AND array_length(v_submission.numbers, 1) IS NOT NULL THEN
      INSERT INTO tmp_approve_items(number, amount)
      SELECT
        n::integer,
        GREATEST(
          COALESCE(v_submission.total_amount, 0) / GREATEST(array_length(v_submission.numbers, 1), 1),
          COALESCE(v_submission.ticket_price, 0)
        )::integer
      FROM unnest(v_submission.numbers) AS n
      WHERE n IS NOT NULL
      ON CONFLICT (number)
      DO UPDATE SET amount = tmp_approve_items.amount + EXCLUDED.amount;
    ELSIF v_submission.number IS NOT NULL THEN
      INSERT INTO tmp_approve_items(number, amount)
      VALUES (
        v_submission.number,
        GREATEST(COALESCE(v_submission.total_amount, 0), COALESCE(v_submission.ticket_price, 0))
      );
    END IF;
  END IF;

  DELETE FROM tmp_approve_items
  WHERE number IS NULL
     OR number <= 0
     OR amount IS NULL
     OR amount <= 0;

  SELECT array_agg(number ORDER BY number)
  INTO v_affected_numbers
  FROM tmp_approve_items;

  IF v_affected_numbers IS NULL OR array_length(v_affected_numbers, 1) IS NULL THEN
    RAISE EXCEPTION 'No valid contribution items found';
  END IF;

  INSERT INTO public.number_status_summary_cache (
    number,
    target_amount,
    approved_amount,
    pending_amount,
    hold_amount,
    sold_amount,
    remaining_amount,
    status,
    updated_at
  )
  SELECT
    np.number,
    np.target_amount,
    np.current_amount,
    0,
    0,
    np.current_amount,
    GREATEST(np.target_amount - np.current_amount, 0),
    CASE
      WHEN np.current_amount >= np.target_amount THEN 'sold'
      ELSE np.status::text
    END,
    now()
  FROM public.number_pools np
  WHERE np.number = ANY(v_affected_numbers)
  ON CONFLICT (number) DO NOTHING;

  -- Lock only affected cache rows.
  PERFORM 1
  FROM public.number_status_summary_cache cache
  WHERE cache.number = ANY(v_affected_numbers)
  ORDER BY cache.number
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM tmp_approve_items item
    JOIN public.number_status_summary_cache cache ON cache.number = item.number
    WHERE item.amount > (cache.remaining_amount + item.amount)
  ) THEN
    RAISE EXCEPTION 'Amount exceeds remaining balance';
  END IF;

  UPDATE public.submissions
  SET
    status = 'approved',
    is_seen_by_user = false,
    approved_at = now(),
    rejected_at = NULL,
    updated_at = now()
  WHERE id = v_submission.id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission could not be approved';
  END IF;

  -- Incremental cache update: pending -> approved.
  UPDATE public.number_status_summary_cache cache
  SET
    approved_amount = cache.approved_amount + item.amount,
    sold_amount = cache.sold_amount + item.amount,
    pending_amount = GREATEST(cache.pending_amount - item.amount, 0),
    remaining_amount = GREATEST(
      cache.target_amount
        - (cache.approved_amount + item.amount)
        - GREATEST(cache.pending_amount - item.amount, 0)
        - cache.hold_amount,
      0
    ),
    status = CASE
      WHEN cache.approved_amount + item.amount >= cache.target_amount THEN 'sold'
      WHEN GREATEST(cache.pending_amount - item.amount, 0) > 0 OR cache.hold_amount > 0 THEN 'pending'
      ELSE 'open'
    END,
    updated_at = now()
  FROM tmp_approve_items item
  WHERE cache.number = item.number;

  -- Keep legacy number_pools in sync.
  UPDATE public.number_pools np
  SET
    current_amount = np.current_amount + item.amount,
    status = CASE
      WHEN np.current_amount + item.amount >= np.target_amount THEN 'sold'
      ELSE 'open'
    END,
    updated_at = now()
  FROM tmp_approve_items item
  WHERE np.number = item.number;

  DELETE FROM public.number_locks
  WHERE number = ANY(v_affected_numbers);

  RETURN jsonb_build_object(
    'success', true,
    'approvedSubmissionId', v_submission.id,
    'affectedNumbers', to_jsonb(v_affected_numbers)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_submission_fast(p_submission_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_numeric_id integer;
  v_submission_ids integer[];
  v_approved_count integer;
  v_pending_count integer;
  v_rejected_count integer;
  v_total_count integer;
  v_affected_numbers integer[];
  v_updated_ids integer[];
BEGIN
  IF p_submission_ref IS NULL OR btrim(p_submission_ref) = '' THEN
    RAISE EXCEPTION 'Missing submission id';
  END IF;

  CREATE TEMP TABLE tmp_reject_submissions (
    id integer PRIMARY KEY,
    status text
  ) ON COMMIT DROP;

  IF p_submission_ref ~ '^[0-9]+$' THEN
    v_numeric_id := p_submission_ref::integer;

    INSERT INTO tmp_reject_submissions(id, status)
    SELECT id, status::text
    FROM public.submissions
    WHERE id = v_numeric_id
    FOR UPDATE;
  ELSE
    INSERT INTO tmp_reject_submissions(id, status)
    SELECT id, status::text
    FROM public.submissions
    WHERE submission_group_id = p_submission_ref
    ORDER BY created_at ASC NULLS LAST, id ASC
    FOR UPDATE;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    array_agg(id ORDER BY id)
  INTO
    v_total_count,
    v_approved_count,
    v_pending_count,
    v_rejected_count,
    v_submission_ids
  FROM tmp_reject_submissions;

  IF v_total_count = 0 THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_approved_count > 0 THEN
    RAISE EXCEPTION 'Approved submissions cannot be rejected directly. Return them to pending first if needed.';
  END IF;

  IF v_pending_count = 0 AND v_rejected_count = v_total_count THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already rejected',
      'updated', 0,
      'rejectedSubmissionIds', jsonb_build_array(),
      'affectedNumbers', jsonb_build_array()
    );
  END IF;

  IF v_pending_count <> v_total_count THEN
    RAISE EXCEPTION 'Submission is not pending';
  END IF;

  CREATE TEMP TABLE tmp_reject_items (
    number integer PRIMARY KEY,
    amount integer NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_reject_items(number, amount)
  SELECT
    si.number,
    SUM(si.amount)::integer
  FROM public.submission_items si
  WHERE si.submission_id = ANY(v_submission_ids)
  GROUP BY si.number;

  IF NOT EXISTS (SELECT 1 FROM tmp_reject_items) THEN
    INSERT INTO tmp_reject_items(number, amount)
    SELECT
      key::integer,
      SUM(value::integer)::integer
    FROM public.submissions s
    CROSS JOIN LATERAL jsonb_each_text(s.number_amounts) AS j(key, value)
    WHERE s.id = ANY(v_submission_ids)
      AND s.number_amounts IS NOT NULL
      AND jsonb_typeof(s.number_amounts) = 'object'
      AND key ~ '^[0-9]+$'
      AND value ~ '^[0-9]+$'
    GROUP BY key::integer
    ON CONFLICT (number)
    DO UPDATE SET amount = tmp_reject_items.amount + EXCLUDED.amount;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tmp_reject_items) THEN
    INSERT INTO tmp_reject_items(number, amount)
    SELECT
      n::integer,
      SUM(
        GREATEST(
          COALESCE(s.total_amount, 0) / GREATEST(array_length(s.numbers, 1), 1),
          COALESCE(s.ticket_price, 0)
        )
      )::integer
    FROM public.submissions s
    CROSS JOIN LATERAL unnest(s.numbers) AS n
    WHERE s.id = ANY(v_submission_ids)
      AND s.numbers IS NOT NULL
    GROUP BY n::integer
    ON CONFLICT (number)
    DO UPDATE SET amount = tmp_reject_items.amount + EXCLUDED.amount;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tmp_reject_items) THEN
    INSERT INTO tmp_reject_items(number, amount)
    SELECT
      s.number,
      SUM(GREATEST(COALESCE(s.total_amount, 0), COALESCE(s.ticket_price, 0)))::integer
    FROM public.submissions s
    WHERE s.id = ANY(v_submission_ids)
      AND s.number IS NOT NULL
    GROUP BY s.number
    ON CONFLICT (number)
    DO UPDATE SET amount = tmp_reject_items.amount + EXCLUDED.amount;
  END IF;

  DELETE FROM tmp_reject_items
  WHERE number IS NULL
     OR number <= 0
     OR amount IS NULL
     OR amount <= 0;

  SELECT array_agg(number ORDER BY number)
  INTO v_affected_numbers
  FROM tmp_reject_items;

  IF v_affected_numbers IS NULL OR array_length(v_affected_numbers, 1) IS NULL THEN
    RAISE EXCEPTION 'No valid contribution items found';
  END IF;

  INSERT INTO public.number_status_summary_cache (
    number,
    target_amount,
    approved_amount,
    pending_amount,
    hold_amount,
    sold_amount,
    remaining_amount,
    status,
    updated_at
  )
  SELECT
    np.number,
    np.target_amount,
    np.current_amount,
    0,
    0,
    np.current_amount,
    GREATEST(np.target_amount - np.current_amount, 0),
    CASE
      WHEN np.current_amount >= np.target_amount THEN 'sold'
      ELSE np.status::text
    END,
    now()
  FROM public.number_pools np
  WHERE np.number = ANY(v_affected_numbers)
  ON CONFLICT (number) DO NOTHING;

  PERFORM 1
  FROM public.number_status_summary_cache cache
  WHERE cache.number = ANY(v_affected_numbers)
  ORDER BY cache.number
  FOR UPDATE;

  UPDATE public.submissions
  SET
    status = 'rejected',
    rejected_at = now(),
    approved_at = NULL,
    is_seen_by_user = false,
    updated_at = now()
  WHERE id = ANY(v_submission_ids)
    AND status = 'pending'
  RETURNING id
  INTO v_numeric_id;

  SELECT array_agg(id ORDER BY id)
  INTO v_updated_ids
  FROM public.submissions
  WHERE id = ANY(v_submission_ids)
    AND status = 'rejected';

  -- Incremental reject: release pending amount.
  UPDATE public.number_status_summary_cache cache
  SET
    pending_amount = GREATEST(cache.pending_amount - item.amount, 0),
    remaining_amount = GREATEST(
      cache.target_amount
        - cache.approved_amount
        - GREATEST(cache.pending_amount - item.amount, 0)
        - cache.hold_amount,
      0
    ),
    status = CASE
      WHEN cache.approved_amount >= cache.target_amount THEN 'sold'
      WHEN GREATEST(cache.pending_amount - item.amount, 0) > 0 OR cache.hold_amount > 0 THEN 'pending'
      ELSE 'open'
    END,
    updated_at = now()
  FROM tmp_reject_items item
  WHERE cache.number = item.number;

  RETURN jsonb_build_object(
    'success', true,
    'updated', COALESCE(array_length(v_updated_ids, 1), 0),
    'rejectedSubmissionIds', COALESCE(to_jsonb(v_updated_ids), '[]'::jsonb),
    'affectedNumbers', to_jsonb(v_affected_numbers)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_submission_fast(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_submission_fast(text) TO authenticated;
