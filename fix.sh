#!/usr/bin/env bash
set -e

TARGET="app/layout.tsx"

cp "$TARGET" "$TARGET.bak-default-dark-am"

python3 <<'PY'
from pathlib import Path

path = Path("app/layout.tsx")
code = path.read_text()

code = code.replace('<html lang="en">', '<html lang="am">')

code = code.replace(
"""if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }""",
"""if (theme !== 'light') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }"""
)

path.write_text(code)
print("✅ layout now defaults to Amharic + dark before React loads.")
PY

echo "Run:"
echo "rm -rf .next"
echo "npm run dev"