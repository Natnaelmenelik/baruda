#!/usr/bin/env bash
set -euo pipefail

FILE="app/(protected)/dashboard/page.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ $FILE not found. Run this from your project root."
  exit 1
fi

cp "$FILE" "$FILE.bak.$(date +%Y%m%d%H%M%S)"

python3 <<'PY'
from pathlib import Path

path = Path("app/(protected)/dashboard/page.tsx")
text = path.read_text()

replacements = [
    (
        'const [winningAmount, setWinningAmount] = useState(560000);',
        'const [winningAmount, setWinningAmount] = useState<number | null>(null);'
    ),
    (
        'function formatWinningAmount(value: number) {\n    return `${Number(value || 0).toLocaleString()} ብር`;\n  }',
        'function formatWinningAmount(value: number | null) {\n    if (value === null) return "";\n    return `${Number(value || 0).toLocaleString()} ብር`;\n  }'
    ),
    (
        '''const amount = Number(
      value?.winningAmount ??
        value?.winning_amount ??
        value?.new?.winning_amount ??
        560000,
    );''',
        '''const amount = Number(
      value?.winningAmount ??
        value?.winning_amount ??
        value?.new?.winning_amount,
    );'''
    ),
    (
        '''              <p className="max-w-4xl mx-auto my-4 text-xl font-black leading-tight tracking-tight text-blue-700 dark:text-blue-200 sm:text-2xl md:text-3xl md:leading-tight lg:text-4xl lg:leading-tight">
                {formatWinningAmount(winningAmount)}
              </p>''',
        '''              {winningAmount !== null && (
                <p className="max-w-4xl mx-auto my-4 text-xl font-black leading-tight tracking-tight text-blue-700 dark:text-blue-200 sm:text-2xl md:text-3xl md:leading-tight lg:text-4xl lg:leading-tight">
                  {formatWinningAmount(winningAmount)}
                </p>
              )}'''
    ),
]

changed = False

for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
        changed = True
    else:
        print(f"⚠️ Pattern not found, skipped:\n{old[:120]}...\n")

if not changed:
    raise SystemExit("❌ No matching patterns found. Please check dashboard page manually.")

path.write_text(text)

print("✅ Updated dashboard winning amount loading behavior")
print("✅ Removed fake 560,000 fallback flash")
print("✅ Winning amount stays hidden until real settings data loads")
PY

echo ""
echo "Now run:"
echo "npm run build"