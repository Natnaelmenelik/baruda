#!/usr/bin/env bash
set -e

echo "======================================"
echo "DEFAULT AMHARIC + DARK MODE PATCH"
echo "======================================"

python3 <<'PY'
from pathlib import Path
import re

# ---------------------------
# 1. useLang hook
# ---------------------------
lang_files = [
    "hooks/useLang.ts",
    "lib/hooks/useLang.ts",
]

for file in lang_files:
    path = Path(file)

    if not path.exists():
        continue

    code = path.read_text()

    code = code.replace(
        "useState<'en' | 'am'>('en')",
        "useState<'en' | 'am'>('am')"
    )

    code = code.replace(
        "localStorage.getItem('lang') || 'en'",
        "localStorage.getItem('lang') || 'am'"
    )

    path.write_text(code)

    print(f"✅ {file} → default Amharic")


# ---------------------------
# 2. Theme provider
# ---------------------------
theme_files = [
    "components/ThemeProvider.tsx",
    "providers/ThemeProvider.tsx",
    "app/providers.tsx",
]

for file in theme_files:
    path = Path(file)

    if not path.exists():
        continue

    code = path.read_text()

    code = code.replace(
        'defaultTheme="light"',
        'defaultTheme="dark"'
    )

    code = code.replace(
        "defaultTheme='light'",
        "defaultTheme='dark'"
    )

    code = code.replace(
        'theme: "light"',
        'theme: "dark"'
    )

    code = code.replace(
        "theme: 'light'",
        "theme: 'dark'"
    )

    path.write_text(code)

    print(f"✅ {file} → default Dark")


# ---------------------------
# 3. Local theme hook fallback
# ---------------------------
hook_files = [
    "hooks/useTheme.ts",
]

for file in hook_files:
    path = Path(file)

    if not path.exists():
        continue

    code = path.read_text()

    code = code.replace(
        "|| 'light'",
        "|| 'dark'"
    )

    path.write_text(code)

    print(f"✅ {file} → dark fallback")


print("")
print("DONE.")
PY

echo ""
echo "Run:"
echo "rm -rf .next"
echo "npm run dev"