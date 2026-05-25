#!/usr/bin/env bash
set -euo pipefail

# fix-write-message-dark-mode.sh
#
# Fixes invisible "Write a Message" button in dark mode.
#
# Run:
#   chmod +x fix-write-message-dark-mode.sh
#   ./fix-write-message-dark-mode.sh
#   npm run build

FILE="app/(protected)/admin/page.tsx"

if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak.$(date +%Y%m%d%H%M%S)"

python3 <<'PY'
from pathlib import Path

path = Path("app/(protected)/admin/page.tsx")
text = path.read_text()

old = 'bg-yellow-100'
new = 'bg-yellow-100 dark:bg-gradient-to-r dark:from-amber-500 dark:to-orange-600 dark:text-white dark:hover:from-amber-400 dark:hover:to-orange-500'

if old in text:
    text = text.replace(old, new)
    path.write_text(text)
    print("Updated Write a Message button dark mode styles.")
else:
    print("Could not find bg-yellow-100 automatically.")
PY

echo
echo "Done."
echo "Now run:"
echo "npm run build"