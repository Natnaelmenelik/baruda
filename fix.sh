#!/usr/bin/env bash
set -euo pipefail

TARGET_FILE="app/(protected)/dashboard/page.tsx"

if [ ! -f "$TARGET_FILE" ]; then
  echo "Error: $TARGET_FILE not found."
  echo "Run this script from your project root."
  exit 1
fi

BACKUP_FILE="${TARGET_FILE}.bak.$(date +%Y%m%d%H%M%S)"
cp "$TARGET_FILE" "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE"

python3 - <<'PY'
from pathlib import Path
import re

path = Path("app/(protected)/dashboard/page.tsx")
text = path.read_text()
original = text

# Remove window focus listener lines.
text = re.sub(
    r'^\s*window\.addEventListener\(\s*["\']focus["\'][^\n]*\);\n',
    '',
    text,
    flags=re.MULTILINE,
)
text = re.sub(
    r'^\s*window\.removeEventListener\(\s*["\']focus["\'][^\n]*\);\n',
    '',
    text,
    flags=re.MULTILINE,
)

# Remove document visibilitychange listener lines.
text = re.sub(
    r'^\s*document\.addEventListener\(\s*["\']visibilitychange["\'][^\n]*\);\n',
    '',
    text,
    flags=re.MULTILINE,
)
text = re.sub(
    r'^\s*document\.removeEventListener\(\s*["\']visibilitychange["\'][^\n]*\);\n',
    '',
    text,
    flags=re.MULTILINE,
)

# Remove console warning text related to focus fallback, if present.
text = re.sub(
    r'^\s*console\.warn\([^\n]*Falling back to focus refresh[^\n]*\);\n',
    '',
    text,
    flags=re.MULTILINE,
)

# Remove simple orphaned refresh/focus handler blocks when they only existed for focus/visibility refresh.
patterns = [
    r'\n\s*const\s+refreshOnFocus\s*=\s*\(\)\s*=>\s*\{\s*(?:if\s*\([^{}]*\)\s*\{\s*)?[^{}]*?(?:refreshApprovedNotificationFallback|fetchAnnouncements|loadAnnouncements|getAnnouncements)\([^;]*\);\s*(?:\}\s*)?\};\n',
    r'\n\s*const\s+handleVisibilityChange\s*=\s*\(\)\s*=>\s*\{\s*if\s*\(\s*!document\.hidden\s*\)\s*\{\s*[^{}]*?(?:refreshApprovedNotificationFallback|fetchAnnouncements|loadAnnouncements|getAnnouncements)\([^;]*\);\s*\}\s*\};\n',
    r'\n\s*const\s+handleFocus\s*=\s*\(\)\s*=>\s*\{\s*[^{}]*?(?:refreshApprovedNotificationFallback|fetchAnnouncements|loadAnnouncements|getAnnouncements)\([^;]*\);\s*\};\n',
]
for pattern in patterns:
    text = re.sub(pattern, '\n', text, flags=re.MULTILINE | re.DOTALL)

if text == original:
    print("No focus/visibility refresh code was found to remove.")
else:
    path.write_text(text)
    print("Removed focus and visibilitychange refresh listeners from:", path)
PY

echo "Done. Now run: npm run build"
