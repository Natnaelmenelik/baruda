#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT"

required_files=(
  "components/SubmitNumberModal.tsx"
  "lib/db/cleanupExpiredHolds.ts"
  "app/api/numbers/route.ts"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file"
    echo "Run this script from your project root."
    exit 1
  fi
  cp "$file" "$file.bak.timer-expiry-no-receipt-change"
done

python3 - <<'PY'
from pathlib import Path

# 1) SubmitNumberModal: make DELETE /api/holds/:id more reliable with keepalive.
p = Path('components/SubmitNumberModal.tsx')
s = p.read_text()

# Case A: async cancel/release call that awaits the DELETE response.
s = s.replace(
'''        const res = await fetch(`/api/holds/${hold.id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });''',
'''        const res = await fetch(`/api/holds/${hold.id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          keepalive: true,
        });''',
1,
)

# Case B: timer-expiry best-effort DELETE call.
old = '''    void fetch(`/api/holds/${holdId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => {
      // Do not reopen or block the modal. Backend cleanup/realtime can recover.
    });'''
new = '''    void fetch(`/api/holds/${holdId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      keepalive: true,
    }).catch(() => {
      // Do not reopen or block the modal. Backend cleanup/realtime can recover.
    });'''
if old in s:
    s = s.replace(old, new, 1)

p.write_text(s)

# 2) cleanupExpiredHolds: expire due holds and refresh cache for affected numbers.
p = Path('lib/db/cleanupExpiredHolds.ts')
p.write_text('''import { sql } from "@/lib/db/sql";

type ExpiredHoldsCleanupResult = {
  expiredHoldCount: number;
  numbers: number[];
};

/**
 * Cleanup expired payment holds and refresh cache for the affected numbers.
 *
 * The frontend timer is only a UI timer. Browser DELETE requests can be missed
 * if a tab closes, refreshes, sleeps, or loses network. This backend cleanup makes
 * expires_at the source of truth for releasing held numbers.
 */
const DEFAULT_CLEANUP_INTERVAL_MS = 10_000;

let lastCleanupAt = 0;
let inFlightCleanup: Promise<ExpiredHoldsCleanupResult> | null = null;

function normalizeNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((number) => Number(number))
        .filter((number) => Number.isInteger(number) && number > 0),
    ),
  );
}

async function expireExpiredHoldsAndRefreshCache(): Promise<ExpiredHoldsCleanupResult> {
  const rows = await sql`
    WITH expired_holds AS (
      UPDATE payment_holds
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE status = 'active'
        AND expires_at <= NOW()
      RETURNING id
    ),
    affected_numbers AS (
      SELECT DISTINCT phi.number
      FROM payment_hold_items phi
      JOIN expired_holds eh ON eh.id = phi.hold_id
    )
    SELECT
      (SELECT COUNT(*)::int FROM expired_holds) AS expired_hold_count,
      COALESCE(array_agg(number ORDER BY number), '{}'::integer[]) AS numbers
    FROM affected_numbers
  `;

  const expiredHoldCount = Number(rows?.[0]?.expired_hold_count || 0);
  const numbers = normalizeNumbers(rows?.[0]?.numbers);

  if (numbers.length) {
    await sql`SELECT public.refresh_number_status_summary_cache_many(${numbers}::integer[])`;
  }

  return { expiredHoldCount, numbers };
}

export async function cleanupExpiredHoldsIfNeeded(
  intervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
): Promise<ExpiredHoldsCleanupResult> {
  const now = Date.now();

  if (now - lastCleanupAt < intervalMs) {
    return { expiredHoldCount: 0, numbers: [] };
  }

  if (inFlightCleanup) {
    return inFlightCleanup;
  }

  lastCleanupAt = now;

  inFlightCleanup = (async () => {
    try {
      return await expireExpiredHoldsAndRefreshCache();
    } catch (error) {
      // Do not break read routes if cleanup fails.
      console.error("Expired holds cleanup failed:", error);
      return { expiredHoldCount: 0, numbers: [] };
    } finally {
      inFlightCleanup = null;
    }
  })();

  return inFlightCleanup;
}

/**
 * Use this when correctness must be immediate, for example before returning user-side numbers.
 */
export async function cleanupExpiredHoldsNow(): Promise<ExpiredHoldsCleanupResult> {
  try {
    return await expireExpiredHoldsAndRefreshCache();
  } catch (error) {
    console.error("Expired holds immediate cleanup failed:", error);
    return { expiredHoldCount: 0, numbers: [] };
  }
}
''')

# 3) /api/numbers: cleanup stale holds before reading cache.
p = Path('app/api/numbers/route.ts')
s = p.read_text()
if 'cleanupExpiredHoldsNow' not in s:
    s = s.replace(
        'import { sql } from "@/lib/db/sql";\n',
        'import { sql } from "@/lib/db/sql";\nimport { cleanupExpiredHoldsNow } from "@/lib/db/cleanupExpiredHolds";\n',
        1,
    )

if 'await cleanupExpiredHoldsNow();' not in s:
    s = s.replace(
'''export async function GET() {
  try {
    let rows = await sql`''',
'''export async function GET() {
  try {
    // User-side numbers must not depend on the browser successfully calling DELETE /api/holds/:id.
    // Expire stale holds and refresh affected cache entries before reading number_status_summary_cache.
    await cleanupExpiredHoldsNow();

    let rows = await sql`''',
1,
)
p.write_text(s)
PY

echo "Timer expiry reliability updated without changing ReceiptUploader.tsx."
echo "Backups created with .bak.timer-expiry-no-receipt-change suffix."
echo "Next: run npm run build"
