#!/usr/bin/env bash
set -euo pipefail

FILE="components/SubmitNumberModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ $FILE not found. Run this script from the project root."
  exit 1
fi

cp "$FILE" "$FILE.bak.timer-cancel-logic.$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

path = Path("components/SubmitNumberModal.tsx")
text = path.read_text()
original = text

# Make timer expiry use the exact same callback path as Cancel/X.
# This avoids the previous fire-and-forget/background release path where UI closed
# but amount recalculation waited longer.
text = re.sub(r"onHoldExpired=\{[^}\n]+\}", "onHoldExpired={closeModal}", text)

# Prevent double release if timer expires while user also clicks X/Cancel.
text = text.replace(
    "async function closeModal() {\n    if (submitting) return;\n    closingModalRef.current = true;",
    "async function closeModal() {\n    if (submitting || closingModalRef.current) return;\n    closingModalRef.current = true;",
)

# Some earlier patches may have added timer-only handlers that close first and release in the background.
# They can remain unused safely, but make sure the receipt uploader is not wired to them.

if text == original:
    print("⚠️ No changes were needed. Timer expiry already appears to use closeModal.")
else:
    path.write_text(text)
    print("✅ Updated timer expiry to use the same release/close logic as Cancel/X.")
PY

echo "\nDone. Now run:"
echo "npm run build"
