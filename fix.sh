#!/usr/bin/env bash
set -euo pipefail

FILES=(
  "components/ReceiptUploader.tsx"
  "components/SubmitNumberModal.tsx"
)

STAMP="$(date +%Y%m%d_%H%M%S)"

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "❌ File not found: $FILE"
    exit 1
  fi
  cp "$FILE" "$FILE.backup-fix-hold-fire-forget-$STAMP"
done

python3 <<'PY'
from pathlib import Path
import re

def remove_res_leftover(path_str: str, fallback_var: str):
    path = Path(path_str)
    text = path.read_text()
    original = text

    # Remove leftover blocks created after replacing:
    # const res = await fetch(...)
    # with:
    # void fetch(...)
    #
    # Handles both activeNumbers and selectedNumbers fallback names.
    pattern = re.compile(
        r"""
\s*const\s+data\s*=\s*await\s+res\.json\(\)\.catch\(\(\)\s*=>\s*\(\{\}\)\);\s*
\s*const\s+releasedNumbers\s*=\s*Array\.isArray\(data\?\.numbers\)\s*
\s*\?\s*data\.numbers\s*
\s*:\s*Array\.isArray\(hold\?\.numbers\)\s*
\s*\?\s*hold\.numbers\s*
\s*:\s*(activeNumbers|selectedNumbers|fallbackNumbers)\s*;
""",
        re.VERBOSE,
    )

    def repl(match):
        fallback = match.group(1) or fallback_var
        return f"""
        const releasedNumbers = Array.isArray(hold?.numbers)
          ? hold.numbers
          : {fallback};
"""

    text, count1 = pattern.subn(repl, text)

    # ReceiptUploader variant: remove res.json + data.numbers assignment entirely.
    pattern_receipt = re.compile(
        r"""
\s*const\s+data\s*=\s*await\s+res\.json\(\)\.catch\(\(\)\s*=>\s*\(\{\}\)\);\s*
\s*if\s*\(\s*Array\.isArray\(data\?\.numbers\)\s*&&\s*data\.numbers\.length\s*\)\s*\{\s*
\s*releasedNumbers\s*=\s*data\.numbers;\s*
\s*\}
""",
        re.VERBOSE,
    )
    text, count2 = pattern_receipt.subn("", text)

    if text != original:
        path.write_text(text)
        print(f"✅ Fixed leftover res.json block in {path_str} ({count1 + count2} replacement)")
    else:
        print(f"ℹ️ No leftover res.json block found in {path_str}")

def ensure_fire_and_forget(path_str: str):
    path = Path(path_str)
    text = path.read_text()
    original = text

    # Convert blocking delete fetch patterns to fire-and-forget.
    text = re.sub(
        r"""const\s+res\s*=\s*await\s+fetch\((`/api/holds/\$\{[^}]+\}`),\s*\{\s*method:\s*(['"])DELETE\2\s*\}\s*\);""",
        r"""void fetch(\1, { method: \2DELETE\2 });""",
        text,
    )

    text = re.sub(
        r"""await\s+fetch\((`/api/holds/\$\{[^}]+\}`),\s*\{\s*method:\s*(['"])DELETE\2\s*\}\s*\);""",
        r"""void fetch(\1, { method: \2DELETE\2 });""",
        text,
    )

    if text != original:
        path.write_text(text)
        print(f"✅ Converted blocking DELETE to fire-and-forget in {path_str}")

remove_res_leftover("components/ReceiptUploader.tsx", "fallbackNumbers")
remove_res_leftover("components/SubmitNumberModal.tsx", "activeNumbers")
ensure_fire_and_forget("components/ReceiptUploader.tsx")
ensure_fire_and_forget("components/SubmitNumberModal.tsx")

# Final safety check: no "await res.json" without const res in these files.
for path_str in ["components/ReceiptUploader.tsx", "components/SubmitNumberModal.tsx"]:
    text = Path(path_str).read_text()
    if "await res.json" in text:
        print(f"⚠️ Found remaining 'await res.json' in {path_str}. Check manually.")
PY

echo ""
echo "✅ Backups created with suffix: .backup-fix-hold-fire-forget-$STAMP"
echo "Now run:"
echo "npm run build"
