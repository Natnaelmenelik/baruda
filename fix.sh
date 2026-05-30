#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

SUBMIT="components/SubmitNumberModal.tsx"
RECEIPT="components/ReceiptUploader.tsx"
HOLDS="app/api/holds/route.ts"

for f in "$SUBMIT" "$RECEIPT" "$HOLDS"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: $f not found. Run this script from your Next.js project root."
    exit 1
  fi
  cp "$f" "$f.bak_timer_$(date +%Y%m%d_%H%M%S)"
done

python3 - <<'PY'
from pathlib import Path

# 1) Fix timer reset on refresh: do not recompute server offset from stale stored server_now.
receipt = Path('components/ReceiptUploader.tsx')
s = receipt.read_text()
old = """function saveServerOffset(serverNow?: string) {
  if (typeof window === 'undefined' || !serverNow) return;

  const serverNowMs = new Date(serverNow).getTime();
  if (!Number.isFinite(serverNowMs)) return;

  const offsetMs = serverNowMs - Date.now();
  localStorage.setItem(SERVER_OFFSET_STORAGE_KEY, String(Math.round(offsetMs)));
}

function getCorrectedNow() {
  if (typeof window === 'undefined') return Date.now();

  const offsetMs = Number(localStorage.getItem(SERVER_OFFSET_STORAGE_KEY) || '0');
  return Date.now() + (Number.isFinite(offsetMs) ? offsetMs : 0);
}
"""
new = """function saveServerOffset(serverNow?: string) {
  // Important: server_now stored in localStorage becomes stale after refresh.
  // Recomputing offset from that old value makes the countdown jump back to 3:00.
  // Keep this as a no-op and always count down from the absolute expires_at value.
  void serverNow;
}

function getCorrectedNow() {
  return Date.now();
}
"""
if old not in s:
    print('WARN: ReceiptUploader timer offset block not found; skipping that exact replacement')
else:
    s = s.replace(old, new)
receipt.write_text(s)

# 2) Fix modal auto re-reserving/reopening when timer reaches 0.
submit = Path('components/SubmitNumberModal.tsx')
s = submit.read_text()

if 'const closingModalRef = useRef(false);' not in s:
    s = s.replace(
        '  const reservingHoldRef = useRef(false);\n',
        '  const reservingHoldRef = useRef(false);\n  const closingModalRef = useRef(false);\n'
    )

if 'closingModalRef.current = false;' not in s:
    marker = '  const activeClientHoldKey =\n    reservationHold?.client_hold_key || savedDraft?.clientHoldKey || clientHoldKey;\n'
    insert = marker + """

  useEffect(() => {
    if (open) {
      closingModalRef.current = false;
    }
  }, [open]);
"""
    if marker in s:
        s = s.replace(marker, insert)
    else:
        print('WARN: activeClientHoldKey marker not found; open reset effect not inserted')

# stop reservation while closing/expiring
s = s.replace(
    '      if (!effectiveOpen) return;\n      if (reservingHoldRef.current) return;',
    '      if (!effectiveOpen) return;\n      if (closingModalRef.current) return;\n      if (reservingHoldRef.current) return;'
)

# mark closing before releasing so useEffect cannot create a fresh 3-minute hold
s = s.replace(
    '  async function closeModal() {\n    if (submitting) return;\n    await releaseActivePaymentHold();',
    '  async function closeModal() {\n    if (submitting) return;\n    closingModalRef.current = true;\n    await releaseActivePaymentHold();'
)

# persist the payment draft immediately after backend hold creation, using backend expires_at.
old = """        localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem("baruda_payment_hold_id", data.id);
        setReservationHold(data);
        showHoldReadyToast(data);
"""
new = """        localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem("baruda_payment_hold_id", data.id);

        const nextDraftAmountMap = Object.fromEntries(
          Object.entries(holdAmountMap).map(([number, amount]) => [Number(number), Number(amount)]),
        ) as Record<number, number>;

        const nextDraft: PaymentDraft = {
          clientHoldKey: data.client_hold_key || activeClientHoldKey,
          numbers: activeNumbers,
          amountMap: nextDraftAmountMap,
          totalAmount,
          expiresAt: data.expires_at,
        };

        localStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
        setSavedDraft(nextDraft);
        setReservationHold(data);
        showHoldReadyToast(data);
"""
if old in s:
    s = s.replace(old, new)
else:
    print('WARN: hold creation storage block not found; draft persistence not inserted')

submit.write_text(s)

# 3) Make POST /api/holds safe if an expired client_hold_key is reused later.
holds = Path('app/api/holds/route.ts')
s = holds.read_text()
s = s.replace(
    '        expires_at = payment_holds.expires_at,\n        updated_at = NOW()',
    """        expires_at = CASE
          WHEN payment_holds.status = 'active' AND payment_holds.expires_at > NOW()
          THEN payment_holds.expires_at
          ELSE NOW() + INTERVAL '3 minutes'
        END,
        updated_at = NOW()"""
)
holds.write_text(s)
PY

echo "✅ Payment hold timer refresh/expiry fix applied."
echo "Next: run npm run build"
