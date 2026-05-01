#!/usr/bin/env bash
set -e

TARGET="app/api/numbers/lock/route.ts"

if [ ! -f "$TARGET" ]; then
  echo "❌ Missing $TARGET"
  exit 1
fi

cp "$TARGET" "$TARGET.bak-sql-fix"

python3 <<'PY'
from pathlib import Path
import re

path = Path("app/api/numbers/lock/route.ts")
code = path.read_text()

# Replace Prisma helper block with sql helper
pattern = r"""async function getCurrentGridSize\(prisma: any\) \{[\s\S]*?return gridSize;\n\}"""

replacement = """async function getCurrentGridSize() {
  const rows = await sql`
    SELECT value
    FROM settings
    WHERE key = 'grid_size'
    LIMIT 1
  `;

  return Number(rows[0]?.value || 200);
}

async function validateGridNumbers(
  numbers: number[]
) {
  const gridSize = await getCurrentGridSize();

  for (const num of numbers) {
    if (
      !Number.isInteger(num) ||
      num < 1 ||
      num > gridSize
    ) {
      throw new Error(
        `Number ${num} exceeds current grid size (${gridSize})`
      );
    }
  }

  return gridSize;
}"""

code = re.sub(
    pattern,
    replacement,
    code,
    flags=re.S
)

# Replace prisma call
code = code.replace(
"""await validateGridNumbers(
    prisma,
    [Number(number)]
  );""",
"""await validateGridNumbers(
    [Number(number)]
  );"""
)

# Remove old hardcoded 20000 validation
code = code.replace(
"""if (!selectedNumber || selectedNumber < 1 || selectedNumber > 20000) {""",
"""if (!Number.isInteger(selectedNumber)) {"""
)

path.write_text(code)

print("✅ lock route now uses sql instead of prisma.")
print("✅ grid size is dynamic from settings.")
PY

echo ""
echo "Run:"
echo "npm run build"