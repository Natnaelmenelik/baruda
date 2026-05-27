#!/usr/bin/env bash
set -euo pipefail

FILE="components/SubmitNumberModal.tsx"
STAMP="$(date +%Y%m%d_%H%M%S)"

if [ ! -f "$FILE" ]; then
  echo "❌ File not found: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.backup-close-modal-after-submit-$STAMP"

python3 <<'PY'
from pathlib import Path

path = Path("components/SubmitNumberModal.tsx")
text = path.read_text()
original = text

old = """      setSavedDraft(null);

      dispatchNumbersRefresh({"""

new = """      setSavedDraft(null);
      setReservationHold(null);
      holdReadyToastShownRef.current = null;
      setClientHoldKey(makeClientHoldKey());

      dispatchNumbersRefresh({"""

if old in text:
    text = text.replace(old, new, 1)
else:
    print("⚠️ Could not find exact submit success cleanup block.")
    print("Trying fallback after setSavedDraft(null);")
    fallback = "      setSavedDraft(null);\n"
    if fallback in text and "setReservationHold(null);" not in text:
        text = text.replace(
            fallback,
            fallback
            + "      setReservationHold(null);\n"
            + "      holdReadyToastShownRef.current = null;\n"
            + "      setClientHoldKey(makeClientHoldKey());\n",
            1,
        )
    else:
        raise SystemExit("❌ Could not safely patch submit cleanup.")

if text == original:
    print("⚠️ No changes made. File may already be patched.")
else:
    path.write_text(text)
    print("✅ Submit success now clears reservationHold so modal can close.")
PY

echo ""
echo "✅ Backup created: $FILE.backup-close-modal-after-submit-$STAMP"
echo "Now run:"
echo "npm run build"
