#!/usr/bin/env bash
set -euo pipefail

FILES=("components/ReceiptUploader.tsx" "components/SubmitNumberModal.tsx")
STAMP="$(date +%Y%m%d_%H%M%S)"

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "❌ File not found: $FILE"
    exit 1
  fi
  cp "$FILE" "$FILE.backup-restore-timer-release-method-$STAMP"
done

python3 <<'PY'
from pathlib import Path
import re

# ReceiptUploader: timer only notifies parent. Parent releases same as Cancel/X.
receipt = Path("components/ReceiptUploader.tsx")
text = receipt.read_text()

if "holdExpiredHandledRef" not in text:
    text = text.replace(
        "const holdToastShownRef = useRef<string | null>(null);",
        "const holdToastShownRef = useRef<string | null>(null);\n  const holdExpiredHandledRef = useRef(false);",
        1,
    )

if "holdExpiredHandledRef.current = false;" not in text:
    text = text.replace(
        "setPaymentHold(initialPaymentHold);",
        "setPaymentHold(initialPaymentHold);\n    holdExpiredHandledRef.current = false;",
        1,
    )
    text = text.replace(
        "setPaymentHold(data);",
        "setPaymentHold(data);\n        holdExpiredHandledRef.current = false;",
        1,
    )

pattern = re.compile(r"  useEffect\(\(\) => \{\n    if \(!paymentHold\?\.expires_at \|\| value\) return;[\s\S]*?\n  \}, \[[^\]]*paymentHold\?\.expires_at[\s\S]*?\]\);", re.M)

replacement = """  useEffect(() => {
    if (!paymentHold?.expires_at || value) return;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(paymentHold.expires_at).getTime() - Date.now()) / 1000),
      );

      setRemainingSeconds(remaining);

      if (remaining <= 0 && !holdExpiredHandledRef.current) {
        holdExpiredHandledRef.current = true;
        onHoldExpired?.();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [paymentHold?.id, paymentHold?.expires_at, value, onHoldExpired]);"""

text, c = pattern.subn(replacement, text, count=1)
receipt.write_text(text)
print("✅ ReceiptUploader patched" if c else "⚠️ ReceiptUploader expiry effect not matched")

# SubmitNumberModal: one release function used by Cancel/X and timer expiry.
submit = Path("components/SubmitNumberModal.tsx")
text = submit.read_text()

release_pattern = re.compile(r"  async function releaseActivePaymentHold\(\) \{[\s\S]*?\n  \}\n\n  async function closeModal\(\) \{", re.M)

release_replacement = """  async function releaseActivePaymentHold() {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(HOLD_STORAGE_KEY);
      const hold = raw ? JSON.parse(raw) : null;

      if (hold?.id) {
        const res = await fetch(`/api/holds/${hold.id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        const releasedNumbers = Array.isArray(data?.numbers)
          ? data.numbers
          : Array.isArray(hold?.numbers)
            ? hold.numbers
            : activeNumbers;

        dispatchNumbersRefresh({
          action: "hold_released",
          numbers: releasedNumbers,
          status: "available",
          holdId: hold.id,
          clientHoldKey: hold.client_hold_key || activeClientHoldKey,
        });

        broadcastNumbersUpdate({
          action: "hold_released",
          numbers: releasedNumbers,
          status: "available",
          holdId: hold.id,
          clientHoldKey: hold.client_hold_key || activeClientHoldKey,
          source: "submit-modal-release",
        });
      }
    } catch {
      // ignore release errors
    }

    localStorage.removeItem(HOLD_STORAGE_KEY);
    localStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
    localStorage.removeItem("baruda_payment_hold_id");
    setSavedDraft(null);
    setReservationHold(null);
    holdReadyToastShownRef.current = null;
    setClientHoldKey(makeClientHoldKey());
    setReceiptUrl("");
    setReceiptKey("");
  }

  async function closeModal() {"""

text, c1 = release_pattern.subn(release_replacement, text, count=1)

close_pattern = re.compile(r"  async function closeModal\(\) \{[\s\S]*?\n  \}\n\n  async function handleHoldExpired\(\) \{", re.M)
close_replacement = """  async function closeModal() {
    if (submitting) return;
    await releaseActivePaymentHold();
    setError("");
    onClose();
  }

  async function handleHoldExpired() {"""
text, c2 = close_pattern.subn(close_replacement, text, count=1)

expired_pattern = re.compile(r"  async function handleHoldExpired\(\) \{[\s\S]*?\n  \}\n\n  useEffect\(\(\) => \{", re.M)
expired_replacement = """  async function handleHoldExpired() {
    await releaseActivePaymentHold();
    setError("");
    onClose();
  }

  useEffect(() => {"""
text, c3 = expired_pattern.subn(expired_replacement, text, count=1)

submit.write_text(text)
print(f"✅ SubmitNumberModal patched: release={c1}, close={c2}, expired={c3}")
PY

echo ""
echo "✅ Backups created with suffix: .backup-restore-timer-release-method-$STAMP"
echo "Now run:"
echo "npm run build"
