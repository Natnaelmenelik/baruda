#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

if [ ! -f "components/SubmitNumberModal.tsx" ]; then
  echo "ERROR: run this from the project root. components/SubmitNumberModal.tsx not found."
  exit 1
fi

cp components/SubmitNumberModal.tsx components/SubmitNumberModal.tsx.bak_timer_expiry_final
cp lib/realtime/numbersLive.ts lib/realtime/numbersLive.ts.bak_timer_expiry_final

python3 <<'PY'
from pathlib import Path

submit = Path('components/SubmitNumberModal.tsx')
s = submit.read_text()

# 1) Timer expiry must use the immediate expiry handler, not closeModal.
s = s.replace('onHoldExpired={closeModal}', 'onHoldExpired={handleHoldExpiredImmediate}')

# 2) Add Authorization header to releaseActivePaymentHold normal release flow.
s = s.replace(
'''      if (hold?.id) {
        const res = await fetch(`/api/holds/${hold.id}`, { method: "DELETE" });''',
'''      if (hold?.id) {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/holds/${hold.id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });'''
)

# 3) Add Authorization header to the timer-expired DELETE request.
s = s.replace(
'''    if (holdId) {
      void fetch(`/api/holds/${holdId}?reason=timer_expired`, { method: "DELETE" })''',
'''    if (holdId) {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      void fetch(`/api/holds/${holdId}?reason=timer_expired`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })'''
)

submit.write_text(s)

# 4) Make the existing local refresh helper also fire the event that NumberGrid actually listens to.
numbers_live = Path('lib/realtime/numbersLive.ts')
n = numbers_live.read_text()
old = "window.dispatchEvent(new CustomEvent('numbers-refresh', { detail: payload || {} }));"
new = """window.dispatchEvent(new CustomEvent('numbers-refresh', { detail: payload || {} }));
    window.dispatchEvent(new CustomEvent('numbers-updated', { detail: payload || {} }));"""
if old in n and "new CustomEvent('numbers-updated'" not in n:
    n = n.replace(old, new)
elif old in n:
    # Ensure both exist even if a previous patch partially touched the file.
    if "window.dispatchEvent(new CustomEvent('numbers-updated'" not in n:
        n = n.replace(old, new)

numbers_live.write_text(n)
PY

# Verification output
echo "--- onHoldExpired usage ---"
grep -n "onHoldExpired" components/SubmitNumberModal.tsx components/ReceiptUploader.tsx || true

echo "--- DELETE /api/holds usage ---"
grep -n "api/holds/.*DELETE\|method: \"DELETE\"" components/SubmitNumberModal.tsx | head -20 || true

echo "--- local number refresh events ---"
grep -n "numbers-refresh\|numbers-updated" lib/realtime/numbersLive.ts || true

echo ""
echo "Done. Now run: npm run build"
