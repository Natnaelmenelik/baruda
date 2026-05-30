#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

if [ ! -f "package.json" ] || [ ! -d "app" ]; then
  echo "ERROR: Run this script from the project root folder, for example: cd baruda"
  exit 1
fi

echo "Patching localhost project: change payment hold timeout status from expired to cancelled..."

backup_file() {
  local file="$1"
  if [ -f "$file" ] && [ ! -f "$file.bak_expired_to_cancelled" ]; then
    cp "$file" "$file.bak_expired_to_cancelled"
  fi
}

patch_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  backup_file "$file"
  perl -0pi -e "s/THEN 'expired'/THEN 'cancelled'/g" "$file"
  perl -0pi -e "s/SET status = 'expired'/SET status = 'cancelled'/g" "$file"
  perl -0pi -e "s/SET status='expired'/SET status='cancelled'/g" "$file"
  perl -0pi -e "s/status = 'expired'/status = 'cancelled'/g" "$file"
  perl -0pi -e "s/status='expired'/status='cancelled'/g" "$file"
}

# Runtime code that was actively turning timed-out holds into expired
patch_file "app/api/holds/[id]/route.ts"
patch_file "app/api/submit/route.ts"
patch_file "lib/db/cleanupExpiredHolds.ts"

# Database SQL/functions that can still mark timed-out holds as expired
patch_file "database/supabase/006_relational_payment_holds.sql"
patch_file "database/supabase/000_full_schema_production.sql"
patch_file "database/supabase/20260524_safe_performance_cleanup.sql"
patch_file "database/supabase/20260524_number_status_summary_cache.sql"

mkdir -p database/supabase
cat > database/supabase/20260530_timeout_holds_cancelled_not_expired.sql <<'SQL'
-- Make timed-out payment holds become cancelled, not expired.
-- Run this once in Supabase SQL Editor for the DB used by your localhost/project.

UPDATE public.payment_holds
SET status = 'cancelled', updated_at = now()
WHERE status = 'expired';

CREATE OR REPLACE FUNCTION public.cleanup_expired_payment_holds()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.payment_holds
  SET status = 'cancelled',
      updated_at = now()
  WHERE status = 'active'
    AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_payment_holds()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  k text;
  rec record;
BEGIN
  FOR rec IN SELECT * FROM public.payment_holds WHERE status='active' AND expires_at <= now() LOOP
    UPDATE public.payment_holds SET status='cancelled', updated_at=now() WHERE id=rec.id;
    FOR k IN SELECT jsonb_object_keys(COALESCE(rec.number_amounts, '{}'::jsonb)) LOOP
      PERFORM public.refresh_number_status_summary(k::integer);
    END LOOP;
  END LOOP;
  PERFORM public.refresh_admin_stats_summary();
END;
$$;
SQL

echo ""
echo "Done. Timed-out holds will now be marked cancelled instead of expired in the patched code."
echo "Generated SQL migration: database/supabase/20260530_timeout_holds_cancelled_not_expired.sql"
echo "Run that SQL in Supabase SQL Editor for your local/dev database if it uses Supabase."
echo ""
echo "Check remaining active status-setting references with:"
echo "grep -RIn \"status.*expired\|SET status.*expired\|THEN 'expired'\" app lib database supabase 2>/dev/null || true"
