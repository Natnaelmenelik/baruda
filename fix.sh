#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

SUBMIT="components/SubmitNumberModal.tsx"
HOLD_ROUTE="app/api/holds/[id]/route.ts"

if [ ! -f "$SUBMIT" ]; then
  echo "ERROR: $SUBMIT not found. Run this from the project root." >&2
  exit 1
fi

if [ ! -f "$HOLD_ROUTE" ]; then
  echo "ERROR: $HOLD_ROUTE not found. Run this from the project root." >&2
  exit 1
fi

cp "$SUBMIT" "$SUBMIT.bak.timer-release-$(date +%Y%m%d%H%M%S)"
cp "$HOLD_ROUTE" "$HOLD_ROUTE.bak.idempotent-delete-$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
from pathlib import Path

submit = Path('components/SubmitNumberModal.tsx')
text = submit.read_text()

insert_after = '''function readStoredActiveHold() {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(HOLD_STORAGE_KEY);
    if (!raw) return null;

    const hold = JSON.parse(raw);

    if (
      hold?.id &&
      hold?.expires_at &&
      new Date(hold.expires_at).getTime() > Date.now()
    ) {
      return hold;
    }
  } catch {
    // ignore invalid stored hold
  }

  return null;
}
'''

release_reader = '''function readStoredHoldForRelease() {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(HOLD_STORAGE_KEY);
    if (!raw) return null;

    const hold = JSON.parse(raw);

    // Release/cancel must not require expires_at > Date.now().
    // At timer expiry, expires_at is already passed, but the hold still
    // needs to be cancelled through DELETE /api/holds/:id.
    if (hold?.id) return hold;
  } catch {
    // ignore invalid stored hold
  }

  return null;
}
'''

if 'function readStoredHoldForRelease()' not in text:
    if insert_after not in text:
        raise SystemExit('Could not find readStoredActiveHold block to insert release reader')
    text = text.replace(insert_after, insert_after + '\n' + release_reader)

old = 'const hold = reservationHold || readStoredActiveHold();'
new = 'const hold = reservationHold || readStoredHoldForRelease();'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('Could not find timer expiry hold lookup line')

submit.write_text(text)

route = Path('app/api/holds/[id]/route.ts')
rt = route.read_text()
old_sql = '''UPDATE payment_holds
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id::text = $1
        AND status = 'active'
      RETURNING id, client_hold_key, numbers, status, updated_at'''
new_sql = '''UPDATE payment_holds
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id::text = $1
        AND status <> 'completed'
      RETURNING id, client_hold_key, numbers, status, updated_at'''
if old_sql in rt:
    rt = rt.replace(old_sql, new_sql, 1)
elif "AND status <> 'completed'" not in rt:
    raise SystemExit('Could not find DELETE update SQL to make idempotent')

route.write_text(rt)
PY

echo "Done. Patched:"
echo "- components/SubmitNumberModal.tsx: timer release reads stored hold even after expires_at passed"
echo "- app/api/holds/[id]/route.ts: DELETE is idempotent for non-completed holds"
echo ""
echo "Now run:"
echo "  npm run build"
