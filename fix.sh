#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date +%Y%m%d_%H%M%S)"

for FILE in "components/ReceiptUploader.tsx" "components/SubmitNumberModal.tsx"; do
  if [ ! -f "$FILE" ]; then
    echo "❌ File not found: $FILE"
    exit 1
  fi
  cp "$FILE" "$FILE.backup-fire-and-forget-hold-delete-$STAMP"
done

python3 <<'PY'
from pathlib import Path
import re

def patch_file(path_str: str, hold_expr: str, quote: str):
    path = Path(path_str)
    text = path.read_text()
    original = text

    # Replace a blocking DELETE call:
    # const res = await fetch(`/api/holds/${...}`, { method: "DELETE" });
    # optional if (!res.ok) { ... }
    pattern = re.compile(
        rf"""
        \n\s*const\s+res\s*=\s*await\s+fetch\(
          \s*`/api/holds/\$\{{{re.escape(hold_expr)}\}}`\s*,\s*
          \{{\s*method:\s*['"]DELETE['"]\s*\}}\s*
        \)\s*;\s*
        (?:\n\s*if\s*\(\s*!res\.ok\s*\)\s*\{{[\s\S]*?\n\s*\}}\s*)?
        """,
        re.VERBOSE,
    )

    replacement = f"""
        void fetch(`/api/holds/${{{hold_expr}}}`, {{ method: {quote}DELETE{quote} }})
          .catch((error) => {{
            console.error({quote}Background hold release failed:{quote}, error);
          }})
          .finally(() => {{
            window.dispatchEvent(new Event({quote}numbers:refresh{quote}));
            window.dispatchEvent(new CustomEvent({quote}baruda:numbers-refresh{quote}));
          }});
"""

    text, count = pattern.subn(replacement, text, count=1)

    # Also replace direct await fetch without const res if present.
    if count == 0:
        pattern2 = re.compile(
            rf"""
            \n\s*await\s+fetch\(
              \s*`/api/holds/\$\{{{re.escape(hold_expr)}\}}`\s*,\s*
              \{{\s*method:\s*['"]DELETE['"]\s*\}}\s*
            \)\s*;
            """,
            re.VERBOSE,
        )
        text, count = pattern2.subn(replacement, text, count=1)

    path.write_text(text)

    if count:
        print(f"✅ Patched {path_str}")
    else:
        print(f"⚠️ No blocking DELETE pattern found in {path_str}. It may already be patched.")

patch_file("components/ReceiptUploader.tsx", "holdId", "'")
patch_file("components/SubmitNumberModal.tsx", "hold.id", '"')

# Add immediate localStorage cleanup to ReceiptUploader expiry handler if possible.
receipt = Path("components/ReceiptUploader.tsx")
text = receipt.read_text()
if "const releaseExpiredHoldNow" in text and "baruda_payment_hold_draft" in text:
    marker = "const releaseExpiredHoldNow = async () => {"
    cleanup = """const releaseExpiredHoldNow = async () => {
      try {
        localStorage.removeItem('baruda_payment_hold_id');
        localStorage.removeItem('baruda_payment_hold_draft');
      } catch {}
"""
    if marker in text and "removeItem('baruda_payment_hold_id')" not in text:
        text = text.replace(marker, cleanup, 1)
        receipt.write_text(text)
        print("✅ Added immediate localStorage cleanup in ReceiptUploader.tsx")
PY

echo ""
echo "✅ Backups created with suffix: .backup-fire-and-forget-hold-delete-$STAMP"
echo "Now run:"
echo "npm run build"
