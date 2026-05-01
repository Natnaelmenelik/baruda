#!/usr/bin/env bash
set -e

TARGET="components/SubmitNumberModal.tsx"

if [ ! -f "$TARGET" ]; then
  echo "❌ Missing $TARGET"
  exit 1
fi

cp "$TARGET" "$TARGET.bak-payment-highlight"

python3 <<'PY'
from pathlib import Path
import re

path = Path("components/SubmitNumberModal.tsx")
code = path.read_text()

# Remove old Telebirr masked number if present
code = code.replace("0936******56", "0911121314")
code = code.replace("0936********56", "0911121314")

# Remove unwanted CBE number if still present
code = code.replace("010805525936", "")

# Remove Awash lines if present
code = re.sub(r".*Awash.*\n?", "", code, flags=re.IGNORECASE)

# CBE label color/size
code = code.replace(
    'className="text-xl font-extrabold" style={{ color: "#5A3A1A" }}',
    'className="text-lg font-extrabold" style={{ color: "#5A3A1A" }}'
)

# Telebirr label color/size
code = code.replace(
    'className="text-xl font-extrabold" style={{ color: "#00A651" }}',
    'className="text-lg font-extrabold" style={{ color: "#00A651" }}'
)

# Highlight CBE account number
code = code.replace(
    "1000251763646",
    '<span className="text-lg font-extrabold" style={{ color: "#5A3A1A" }}>1000251763646</span>'
)

# Highlight Telebirr number
code = code.replace(
    "0911121314",
    '<span className="text-lg font-extrabold" style={{ color: "#00A651" }}>0911121314</span>'
)

path.write_text(code)
print("✅ Payment details highlighted with smaller text size.")
PY

echo ""
echo "✅ Done."
echo "Run:"
echo "npm run dev"