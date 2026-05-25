-- =============================================================
-- ODDA / Number Picking System - Supabase Production Schema
-- Safe to run multiple times where possible.
-- Includes: extensions, base tables, constraints, indexes,
-- summary tables, refresh functions, triggers, realtime setup,
-- and initial seed helpers.
-- =============================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Base Tables ----------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  email text,
  password_hash text,
  is_admin boolean DEFAULT false,
  role text DEFAULT 'user',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.number_pools (
  number integer PRIMARY KEY,
  target_amount integer NOT NULL DEFAULT 5000 CHECK (target_amount > 0),
  current_amount integer NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','sold','locked')),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  contact_phone text,
  numbers integer[] NOT NULL DEFAULT '{}',
  number_amounts jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_amount integer NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','completed','cancelled')),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  client_hold_key text UNIQUE
);

CREATE TABLE IF NOT EXISTS public.submissions (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  number integer,
  numbers integer[],
  total_amount integer NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  ticket_price integer DEFAULT 0 CHECK (ticket_price >= 0),
  receipt_url text,
  receipt_key text,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  submission_type varchar(20) DEFAULT 'single' CHECK (submission_type IN ('single','group')),
  submission_group_id text,
  submitted_at timestamp DEFAULT now(),
  approved_at timestamp,
  rejected_at timestamp,
  has_receipt boolean DEFAULT false,
  contact_phone text,
  user_name text,
  user_phone text,
  number_amounts jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  is_seen_by_user boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.submission_items (
  id serial PRIMARY KEY,
  submission_id integer REFERENCES public.submissions(id) ON DELETE CASCADE,
  number integer NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.number_locks (
  id serial PRIMARY KEY,
  number integer NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  locked_until timestamp NOT NULL,
  expires_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_resets (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approved_entry_backups (
  id bigserial PRIMARY KEY,
  submission_id text NOT NULL UNIQUE,
  submission_group_id text,
  user_id text,
  full_name text,
  phone text,
  selected_numbers text,
  total_amount numeric DEFAULT 0,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_backups (
  id serial PRIMARY KEY,
  backup_data jsonb NOT NULL,
  reason text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.winners (
  id serial PRIMARY KEY,
  number integer NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  submission_id integer REFERENCES public.submissions(id) ON DELETE SET NULL,
  winner_name text,
  winner_phone text,
  drawn_at timestamp DEFAULT now(),
  user_name text,
  user_phone text,
  draw_round integer DEFAULT 1,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.winner_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_number integer NOT NULL,
  second_number integer NOT NULL,
  third_number integer NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------- Summary Tables ----------
CREATE TABLE IF NOT EXISTS public.number_status_summary (
  number integer PRIMARY KEY,
  target_amount integer NOT NULL DEFAULT 0,
  approved_amount integer NOT NULL DEFAULT 0,
  pending_amount integer NOT NULL DEFAULT 0,
  hold_amount integer NOT NULL DEFAULT 0,
  remaining_amount integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','sold','locked')),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.submission_stats_summary (
  id integer PRIMARY KEY DEFAULT 1,
  total_submissions integer NOT NULL DEFAULT 0,
  pending_submissions integer NOT NULL DEFAULT 0,
  approved_submissions integer NOT NULL DEFAULT 0,
  rejected_submissions integer NOT NULL DEFAULT 0,
  total_approved_amount integer NOT NULL DEFAULT 0,
  total_pending_amount integer NOT NULL DEFAULT 0,
  total_rejected_amount integer NOT NULL DEFAULT 0,
  today_submissions integer NOT NULL DEFAULT 0,
  today_approved_amount integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT submission_stats_summary_single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.admin_stats_summary (
  id integer PRIMARY KEY DEFAULT 1,
  total_users integer NOT NULL DEFAULT 0,
  total_submissions integer NOT NULL DEFAULT 0,
  pending_submissions integer NOT NULL DEFAULT 0,
  approved_submissions integer NOT NULL DEFAULT 0,
  rejected_submissions integer NOT NULL DEFAULT 0,
  total_revenue integer NOT NULL DEFAULT 0,
  pending_amount integer NOT NULL DEFAULT 0,
  total_numbers integer NOT NULL DEFAULT 0,
  sold_numbers integer NOT NULL DEFAULT 0,
  open_numbers integer NOT NULL DEFAULT 0,
  pending_numbers integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_stats_summary_single_row CHECK (id = 1)
);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings(key);
CREATE INDEX IF NOT EXISTS idx_number_pools_status ON public.number_pools(status);
CREATE INDEX IF NOT EXISTS idx_number_pools_updated_at ON public.number_pools(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_holds_status_expires ON public.payment_holds(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_holds_client_hold_key ON public.payment_holds(client_hold_key);
CREATE INDEX IF NOT EXISTS idx_payment_holds_numbers_gin ON public.payment_holds USING gin(numbers);
CREATE INDEX IF NOT EXISTS idx_payment_holds_number_amounts_gin ON public.payment_holds USING gin(number_amounts);
CREATE INDEX IF NOT EXISTS idx_submissions_status_submitted_desc ON public.submissions(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_user_submitted_desc ON public.submissions(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_group_id ON public.submissions(submission_group_id);
CREATE INDEX IF NOT EXISTS idx_submissions_receipt_key ON public.submissions(receipt_key);
CREATE INDEX IF NOT EXISTS idx_submissions_numbers_gin ON public.submissions USING gin(numbers);
CREATE INDEX IF NOT EXISTS idx_submission_items_submission_id ON public.submission_items(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_items_number ON public.submission_items(number);
CREATE INDEX IF NOT EXISTS idx_number_status_summary_status ON public.number_status_summary(status);
CREATE INDEX IF NOT EXISTS idx_admin_stats_summary_updated_at ON public.admin_stats_summary(updated_at DESC);

-- ---------- Default Settings ----------
INSERT INTO public.settings(key, value) VALUES
  ('grid_size', '100'),
  ('default_target_amount', '10000'),
  ('ticket_price', '1000')
ON CONFLICT (key) DO NOTHING;

-- ---------- Number Pool Seed ----------
INSERT INTO public.number_pools(number, target_amount, current_amount, status, updated_at)
SELECT gs, COALESCE((SELECT value::integer FROM public.settings WHERE key = 'default_target_amount'), 10000), 0, 'open', now()
FROM generate_series(1, COALESCE((SELECT value::integer FROM public.settings WHERE key = 'grid_size'), 100)) AS gs
ON CONFLICT (number) DO NOTHING;

-- ---------- Refresh Functions ----------
CREATE OR REPLACE FUNCTION public.refresh_number_status_summary(p_number integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_target integer := 0;
  v_approved integer := 0;
  v_pending integer := 0;
  v_hold integer := 0;
  v_remaining integer := 0;
  v_status varchar(20) := 'open';
BEGIN
  SELECT COALESCE(target_amount, COALESCE((SELECT value::integer FROM public.settings WHERE key='default_target_amount'), 10000))
  INTO v_target FROM public.number_pools WHERE number = p_number;
  IF v_target IS NULL OR v_target <= 0 THEN v_target := COALESCE((SELECT value::integer FROM public.settings WHERE key='default_target_amount'), 10000); END IF;

  SELECT COALESCE(SUM(si.amount), 0) INTO v_approved
  FROM public.submission_items si JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number AND s.status = 'approved';

  SELECT COALESCE(SUM(si.amount), 0) INTO v_pending
  FROM public.submission_items si JOIN public.submissions s ON s.id = si.submission_id
  WHERE si.number = p_number AND s.status = 'pending';

  SELECT COALESCE(SUM((e.value)::integer), 0) INTO v_hold
  FROM public.payment_holds ph, jsonb_each_text(COALESCE(ph.number_amounts, '{}'::jsonb)) e(key, value)
  WHERE ph.status = 'active' AND ph.expires_at > now() AND e.key::integer = p_number;

  v_remaining := GREATEST(v_target - v_approved - v_pending - v_hold, 0);
  IF v_approved >= v_target THEN v_status := 'sold';
  ELSIF v_pending > 0 OR v_hold > 0 THEN v_status := 'pending';
  ELSE v_status := 'open'; END IF;

  INSERT INTO public.number_status_summary(number,target_amount,approved_amount,pending_amount,hold_amount,remaining_amount,status,updated_at)
  VALUES(p_number,v_target,v_approved,v_pending,v_hold,v_remaining,v_status,now())
  ON CONFLICT(number) DO UPDATE SET
    target_amount=EXCLUDED.target_amount,
    approved_amount=EXCLUDED.approved_amount,
    pending_amount=EXCLUDED.pending_amount,
    hold_amount=EXCLUDED.hold_amount,
    remaining_amount=EXCLUDED.remaining_amount,
    status=EXCLUDED.status,
    updated_at=now();

  UPDATE public.number_pools
  SET current_amount = v_approved,
      status = CASE WHEN v_status = 'sold' THEN 'sold' ELSE 'open' END,
      updated_at = now()
  WHERE number = p_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_number_status_summary()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT number FROM public.number_pools ORDER BY number LOOP
    PERFORM public.refresh_number_status_summary(r.number);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_submission_stats_summary()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.submission_stats_summary(
    id,total_submissions,pending_submissions,approved_submissions,rejected_submissions,
    total_approved_amount,total_pending_amount,total_rejected_amount,today_submissions,today_approved_amount,updated_at
  )
  SELECT 1,
    (SELECT COUNT(*) FROM public.submissions),
    (SELECT COUNT(*) FROM public.submissions WHERE status='pending'),
    (SELECT COUNT(*) FROM public.submissions WHERE status='approved'),
    (SELECT COUNT(*) FROM public.submissions WHERE status='rejected'),
    (SELECT COALESCE(SUM(total_amount),0) FROM public.submissions WHERE status='approved'),
    (SELECT COALESCE(SUM(total_amount),0) FROM public.submissions WHERE status='pending'),
    (SELECT COALESCE(SUM(total_amount),0) FROM public.submissions WHERE status='rejected'),
    (SELECT COUNT(*) FROM public.submissions WHERE submitted_at::date = CURRENT_DATE),
    (SELECT COALESCE(SUM(total_amount),0) FROM public.submissions WHERE status='approved' AND approved_at::date = CURRENT_DATE),
    now()
  ON CONFLICT(id) DO UPDATE SET
    total_submissions=EXCLUDED.total_submissions,
    pending_submissions=EXCLUDED.pending_submissions,
    approved_submissions=EXCLUDED.approved_submissions,
    rejected_submissions=EXCLUDED.rejected_submissions,
    total_approved_amount=EXCLUDED.total_approved_amount,
    total_pending_amount=EXCLUDED.total_pending_amount,
    total_rejected_amount=EXCLUDED.total_rejected_amount,
    today_submissions=EXCLUDED.today_submissions,
    today_approved_amount=EXCLUDED.today_approved_amount,
    updated_at=now();
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_admin_stats_summary()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_submission_stats_summary();
  INSERT INTO public.admin_stats_summary(
    id,total_users,total_submissions,pending_submissions,approved_submissions,rejected_submissions,
    total_revenue,pending_amount,total_numbers,sold_numbers,open_numbers,pending_numbers,updated_at
  )
  SELECT 1,
    (SELECT COUNT(*) FROM public.users),
    (SELECT total_submissions FROM public.submission_stats_summary WHERE id=1),
    (SELECT pending_submissions FROM public.submission_stats_summary WHERE id=1),
    (SELECT approved_submissions FROM public.submission_stats_summary WHERE id=1),
    (SELECT rejected_submissions FROM public.submission_stats_summary WHERE id=1),
    (SELECT total_approved_amount FROM public.submission_stats_summary WHERE id=1),
    (SELECT total_pending_amount FROM public.submission_stats_summary WHERE id=1),
    (SELECT COUNT(*) FROM public.number_status_summary),
    (SELECT COUNT(*) FROM public.number_status_summary WHERE status='sold'),
    (SELECT COUNT(*) FROM public.number_status_summary WHERE status='open'),
    (SELECT COUNT(*) FROM public.number_status_summary WHERE status='pending'),
    now()
  ON CONFLICT(id) DO UPDATE SET
    total_users=EXCLUDED.total_users,
    total_submissions=EXCLUDED.total_submissions,
    pending_submissions=EXCLUDED.pending_submissions,
    approved_submissions=EXCLUDED.approved_submissions,
    rejected_submissions=EXCLUDED.rejected_submissions,
    total_revenue=EXCLUDED.total_revenue,
    pending_amount=EXCLUDED.pending_amount,
    total_numbers=EXCLUDED.total_numbers,
    sold_numbers=EXCLUDED.sold_numbers,
    open_numbers=EXCLUDED.open_numbers,
    pending_numbers=EXCLUDED.pending_numbers,
    updated_at=now();
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_payment_holds()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE k text;
DECLARE rec record;
BEGIN
  FOR rec IN SELECT * FROM public.payment_holds WHERE status='active' AND expires_at <= now() LOOP
    UPDATE public.payment_holds SET status='expired', updated_at=now() WHERE id=rec.id;
    FOR k IN SELECT jsonb_object_keys(COALESCE(rec.number_amounts, '{}'::jsonb)) LOOP
      PERFORM public.refresh_number_status_summary(k::integer);
    END LOOP;
  END LOOP;
  PERFORM public.refresh_admin_stats_summary();
END;
$$;

-- ---------- Trigger Functions ----------
CREATE OR REPLACE FUNCTION public.trg_refresh_from_submission_items()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN PERFORM public.refresh_number_status_summary(NEW.number); RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN PERFORM public.refresh_number_status_summary(OLD.number); PERFORM public.refresh_number_status_summary(NEW.number); RETURN NEW; END IF;
  IF TG_OP = 'DELETE' THEN PERFORM public.refresh_number_status_summary(OLD.number); RETURN OLD; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_from_submissions()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
DECLARE sid integer;
BEGIN
  sid := COALESCE(NEW.id, OLD.id);
  FOR r IN SELECT number FROM public.submission_items WHERE submission_id = sid LOOP
    PERFORM public.refresh_number_status_summary(r.number);
  END LOOP;
  PERFORM public.refresh_admin_stats_summary();
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_from_payment_holds()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    FOR k IN SELECT jsonb_object_keys(COALESCE(NEW.number_amounts, '{}'::jsonb)) LOOP
      PERFORM public.refresh_number_status_summary(k::integer);
    END LOOP;
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    FOR k IN SELECT jsonb_object_keys(COALESCE(OLD.number_amounts, '{}'::jsonb)) LOOP
      PERFORM public.refresh_number_status_summary(k::integer);
    END LOOP;
  END IF;
  PERFORM public.refresh_admin_stats_summary();
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_from_number_pools()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM public.number_status_summary WHERE number=OLD.number; PERFORM public.refresh_admin_stats_summary(); RETURN OLD; END IF;
  PERFORM public.refresh_number_status_summary(NEW.number);
  PERFORM public.refresh_admin_stats_summary();
  RETURN NEW;
END;
$$;

-- Backup approved submissions
CREATE OR REPLACE FUNCTION public.sync_approved_entry_backup()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO public.approved_entry_backups(
      submission_id, submission_group_id, user_id, full_name, phone, selected_numbers, total_amount, approved_at, updated_at
    ) VALUES (
      NEW.id::text,
      NEW.submission_group_id,
      NEW.user_id::text,
      COALESCE(NEW.user_name, ''),
      COALESCE(NEW.user_phone, NEW.contact_phone, ''),
      COALESCE(NEW.numbers::text, NEW.number::text, ''),
      NEW.total_amount,
      COALESCE(NEW.approved_at, now()),
      now()
    )
    ON CONFLICT(submission_id) DO UPDATE SET
      submission_group_id=EXCLUDED.submission_group_id,
      user_id=EXCLUDED.user_id,
      full_name=EXCLUDED.full_name,
      phone=EXCLUDED.phone,
      selected_numbers=EXCLUDED.selected_numbers,
      total_amount=EXCLUDED.total_amount,
      approved_at=EXCLUDED.approved_at,
      updated_at=now();
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- Triggers ----------
DROP TRIGGER IF EXISTS trg_refresh_summary_submission_items ON public.submission_items;
CREATE TRIGGER trg_refresh_summary_submission_items
AFTER INSERT OR UPDATE OR DELETE ON public.submission_items
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_from_submission_items();

DROP TRIGGER IF EXISTS trg_refresh_summary_submissions ON public.submissions;
CREATE TRIGGER trg_refresh_summary_submissions
AFTER INSERT OR UPDATE OR DELETE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_from_submissions();

DROP TRIGGER IF EXISTS trg_refresh_summary_payment_holds ON public.payment_holds;
CREATE TRIGGER trg_refresh_summary_payment_holds
AFTER INSERT OR UPDATE OR DELETE ON public.payment_holds
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_from_payment_holds();

DROP TRIGGER IF EXISTS trg_refresh_summary_number_pools ON public.number_pools;
CREATE TRIGGER trg_refresh_summary_number_pools
AFTER INSERT OR UPDATE OR DELETE ON public.number_pools
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_from_number_pools();

DROP TRIGGER IF EXISTS trg_sync_approved_entry_backup ON public.submissions;
CREATE TRIGGER trg_sync_approved_entry_backup
AFTER INSERT OR UPDATE OF status ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.sync_approved_entry_backup();

-- ---------- Initial Refresh ----------
SELECT public.refresh_all_number_status_summary();
SELECT public.refresh_admin_stats_summary();

-- ---------- Realtime Publication ----------
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.number_status_summary; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_stats_summary; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.submission_stats_summary; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_holds; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ---------- RLS Baseline ----------
-- Keep RLS decisions aligned with your existing auth model.
-- If your app uses custom JWT/auth through API routes only, keep direct table access restricted.
-- Uncomment and customize policies only when frontend reads Supabase tables directly.
-- ALTER TABLE public.number_status_summary ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public can read number summaries" ON public.number_status_summary FOR SELECT USING (true);
