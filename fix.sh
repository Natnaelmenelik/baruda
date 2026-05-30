#!/usr/bin/env bash
set -euo pipefail

FILE="components/SubmitNumberModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ $FILE not found. Run this script from the project root."
  exit 1
fi

cp "$FILE" "$FILE.bak-receipt-expiry-immediate-$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
from pathlib import Path
p = Path("components/SubmitNumberModal.tsx")
s = p.read_text()

# 1) Add expiry handled ref beside existing modal refs.
old = """  const reservingHoldRef = useRef(false);\n  const closingModalRef = useRef(false);\n\n    const lastReservationSignatureRef = useRef<string>(\"\");"""
new = """  const reservingHoldRef = useRef(false);\n  const closingModalRef = useRef(false);\n  const holdExpiryHandledRef = useRef(false);\n\n    const lastReservationSignatureRef = useRef<string>(\"\");"""
if old not in s:
    raise SystemExit("Could not find ref block to patch")
s = s.replace(old, new, 1)

# 2) Reset expiry flag when modal opens.
old = """  useEffect(() => {\n    if (!open) return;\n\n    if (!selectedNumbers.length || totalAmount <= 0) {"""
new = """  useEffect(() => {\n    if (!open) return;\n\n    closingModalRef.current = false;\n    holdExpiryHandledRef.current = false;\n\n    if (!selectedNumbers.length || totalAmount <= 0) {"""
if old not in s:
    raise SystemExit("Could not find open effect to patch")
s = s.replace(old, new, 1)

# 3) Add immediate UI cleanup helper + expiry handler after releaseActivePaymentHold.
marker = """  async function closeModal() {\n    if (submitting) return;\n    closingModalRef.current = true;\n    await releaseActivePaymentHold();\n    setError(\"\");\n    onClose();\n  }"""
insert = """  function clearPaymentHoldUiState() {\n    if (typeof window !== \"undefined\") {\n      localStorage.removeItem(HOLD_STORAGE_KEY);\n      localStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);\n      localStorage.removeItem(\"baruda_payment_hold_id\");\n      localStorage.removeItem(\"lottery_selected_numbers\");\n      localStorage.removeItem(\"lottery_contribution_amounts\");\n      localStorage.removeItem(\"pooled_contribution_amounts\");\n    }\n\n    setSavedDraft(null);\n    setReservationHold(null);\n    holdReadyToastShownRef.current = null;\n    lastReservationSignatureRef.current = \"\";\n    setClientHoldKey(makeClientHoldKey());\n    setReceiptUrl(\"\");\n    setReceiptKey(\"\");\n    setReservingHold(false);\n  }\n\n  function handleHoldExpiredImmediate() {\n    if (holdExpiryHandledRef.current) return;\n\n    holdExpiryHandledRef.current = true;\n    closingModalRef.current = true;\n\n    const hold = reservationHold || readStoredActiveHold();\n    const holdId = hold?.id || (typeof window !== \"undefined\" ? localStorage.getItem(\"baruda_payment_hold_id\") : null);\n    const releasedNumbers = Array.isArray(hold?.numbers) && hold.numbers.length ? hold.numbers : activeNumbers;\n    const releasedClientHoldKey = hold?.client_hold_key || activeClientHoldKey;\n\n    // Close and clear first. Do not wait for the API.\n    clearPaymentHoldUiState();\n    setError(\"\");\n    onClose();\n\n    if (releasedNumbers.length) {\n      dispatchNumbersRefresh({\n        action: \"hold_released\",\n        numbers: releasedNumbers,\n        status: \"available\",\n        holdId,\n        clientHoldKey: releasedClientHoldKey,\n      });\n\n      broadcastNumbersUpdate({\n        action: \"hold_released\",\n        numbers: releasedNumbers,\n        status: \"available\",\n        holdId,\n        clientHoldKey: releasedClientHoldKey,\n        source: \"receipt-timer-expired-immediate\",\n      });\n    }\n\n    if (holdId) {\n      void fetch(`/api/holds/${holdId}?reason=timer_expired`, { method: \"DELETE\" })\n        .then(async (res) => {\n          const data = await res.json().catch(() => ({}));\n          const apiNumbers = Array.isArray(data?.numbers) ? data.numbers : releasedNumbers;\n\n          if (apiNumbers.length) {\n            dispatchNumbersRefresh({\n              action: \"hold_released\",\n              numbers: apiNumbers,\n              status: \"available\",\n              holdId,\n              clientHoldKey: releasedClientHoldKey,\n            });\n\n            broadcastNumbersUpdate({\n              action: \"hold_released\",\n              numbers: apiNumbers,\n              status: \"available\",\n              holdId,\n              clientHoldKey: releasedClientHoldKey,\n              source: \"receipt-timer-expired-api-confirmed\",\n            });\n          }\n        })\n        .catch(() => {\n          // Backend cleanup can still catch it later. UI is already released.\n        });\n    }\n  }\n\n  async function closeModal() {\n    if (submitting) return;\n    closingModalRef.current = true;\n    await releaseActivePaymentHold();\n    setError(\"\");\n    onClose();\n  }"""
if marker not in s:
    raise SystemExit("Could not find closeModal block to patch")
s = s.replace(marker, insert, 1)

# 4) Prevent reserve effect from recreating a hold after timer-expiry cleanup.
old = """      if (!effectiveOpen) return;\n      if (closingModalRef.current) return;\n      if (reservingHoldRef.current) return;"""
new = """      if (!effectiveOpen) return;\n      if (closingModalRef.current) return;\n      if (holdExpiryHandledRef.current) return;\n      if (reservingHoldRef.current) return;"""
if old not in s:
    raise SystemExit("Could not find reserve guard to patch")
s = s.replace(old, new, 1)

# 5) Connect ReceiptUploader to immediate expiry handler instead of normal closeModal.
old = "onHoldExpired={closeModal}"
new = "onHoldExpired={handleHoldExpiredImmediate}"
if old not in s:
    raise SystemExit("Could not find ReceiptUploader onHoldExpired={closeModal}")
s = s.replace(old, new, 1)

p.write_text(s)
PY

echo "✅ Patched receipt timer expiry to close immediately and release hold in background."
echo "Next: npm run build"
