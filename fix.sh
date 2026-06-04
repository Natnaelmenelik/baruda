#!/usr/bin/env bash
set -euo pipefail

TARGET="components/AdminNumbersPanel.tsx"
CSS_FILE="app/globals.css"

if [ ! -f "$TARGET" ]; then
  echo "ERROR: $TARGET not found. Run this script from your Next.js project root."
  exit 1
fi

if [ ! -f "$CSS_FILE" ]; then
  echo "ERROR: $CSS_FILE not found. Run this script from your Next.js project root."
  exit 1
fi

cp "$TARGET" "$TARGET.bak.$(date +%Y%m%d_%H%M%S)"
cp "$CSS_FILE" "$CSS_FILE.bak.$(date +%Y%m%d_%H%M%S)"

python3 - <<'PY'
from pathlib import Path
p = Path('components/AdminNumbersPanel.tsx')
s = p.read_text()

replacements = {
    'className="px-4 py-2 text-sm font-semibold text-blue-700 transition bg-white border border-blue-200 shadow-sm rounded-xl hover:bg-blue-50 disabled:opacity-50 dark:bg-blue-600 dark:text-white dark:border-blue-500 dark:hover:bg-blue-500"':
    'className="admin-number-btn admin-number-btn-blue px-4 py-2 text-sm font-semibold text-blue-700 transition bg-white border border-blue-200 shadow-sm rounded-xl hover:bg-blue-50 disabled:opacity-50 dark:bg-blue-600 dark:text-white dark:border-blue-500 dark:hover:bg-blue-500"',

    'className="px-4 py-2 text-sm font-semibold text-green-700 transition bg-white border border-green-200 shadow-sm rounded-xl hover:bg-green-50 disabled:opacity-50 dark:bg-green-600 dark:text-white dark:border-green-500 dark:hover:bg-green-500"':
    'className="admin-number-btn admin-number-btn-green px-4 py-2 text-sm font-semibold text-green-700 transition bg-white border border-green-200 shadow-sm rounded-xl hover:bg-green-50 disabled:opacity-50 dark:bg-green-600 dark:text-white dark:border-green-500 dark:hover:bg-green-500"',

    'className="px-4 py-2 text-sm font-semibold text-purple-700 transition bg-white border border-purple-200 shadow-sm rounded-xl hover:bg-purple-50 disabled:opacity-50 dark:bg-purple-600 dark:text-white dark:border-purple-500 dark:hover:bg-purple-500"':
    'className="admin-number-btn admin-number-btn-purple px-4 py-2 text-sm font-semibold text-purple-700 transition bg-white border border-purple-200 shadow-sm rounded-xl hover:bg-purple-50 disabled:opacity-50 dark:bg-purple-600 dark:text-white dark:border-purple-500 dark:hover:bg-purple-500"',

    'className="px-4 py-2 text-sm font-semibold text-blue-600 transition bg-white border border-blue-200 shadow-sm rounded-xl hover:bg-blue-50 disabled:opacity-50 dark:bg-blue-600 dark:text-white dark:border-blue-500 dark:hover:bg-blue-500"':
    'className="admin-number-btn admin-number-btn-blue px-4 py-2 text-sm font-semibold text-blue-600 transition bg-white border border-blue-200 shadow-sm rounded-xl hover:bg-blue-50 disabled:opacity-50 dark:bg-blue-600 dark:text-white dark:border-blue-500 dark:hover:bg-blue-500"',
}

for old, new in replacements.items():
    s = s.replace(old, new)

# If the script is run multiple times, avoid duplicate marker classes.
s = s.replace('admin-number-btn admin-number-btn-blue admin-number-btn admin-number-btn-blue', 'admin-number-btn admin-number-btn-blue')
s = s.replace('admin-number-btn admin-number-btn-green admin-number-btn admin-number-btn-green', 'admin-number-btn admin-number-btn-green')
s = s.replace('admin-number-btn admin-number-btn-purple admin-number-btn admin-number-btn-purple', 'admin-number-btn admin-number-btn-purple')

p.write_text(s)
PY

cat >> "$CSS_FILE" <<'CSS'

/* Admin number action buttons dark-mode fix
   Reason: the existing global rule `html.dark button.bg-white` overrides Tailwind dark:bg-* colors.
   These selectors are more specific and force only the requested 5 admin buttons. */
html.dark button.admin-number-btn.admin-number-btn-blue {
  background-color: #2563eb !important;
  color: #ffffff !important;
  border-color: #3b82f6 !important;
}

html.dark button.admin-number-btn.admin-number-btn-blue:hover {
  background-color: #1d4ed8 !important;
}

html.dark button.admin-number-btn.admin-number-btn-green {
  background-color: #16a34a !important;
  color: #ffffff !important;
  border-color: #22c55e !important;
}

html.dark button.admin-number-btn.admin-number-btn-green:hover {
  background-color: #15803d !important;
}

html.dark button.admin-number-btn.admin-number-btn-purple {
  background-color: #9333ea !important;
  color: #ffffff !important;
  border-color: #a855f7 !important;
}

html.dark button.admin-number-btn.admin-number-btn-purple:hover {
  background-color: #7e22ce !important;
}
CSS

rm -rf .next

echo "Done. Fixed AdminNumbersPanel button dark mode and cleared .next cache."
echo "Now restart the server: npm run dev"
