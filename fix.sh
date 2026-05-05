cat > update-layout-title-description-only.sh <<'EOF'
#!/bin/bash

echo "Updating only app/layout.tsx metadata title and description..."

FILE="app/layout.tsx"
BACKUP_DIR="backups-layout-title-description-only-$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$FILE" ]; then
  echo "Error: $FILE not found."
  echo "Run this script from the project root."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$FILE" "$BACKUP_DIR/layout.tsx.bak"

python3 <<'PY'
from pathlib import Path
import re

file_path = Path("app/layout.tsx")
content = file_path.read_text()

content, title_count = re.subn(
    r"title:\s*['\"][^'\"]*['\"]",
    "title: 'ኦዳ የመኪና እቁብ ሎተሪ'",
    content,
    count=1
)

content, desc_count = re.subn(
    r"description:\s*['\"][^'\"]*['\"]",
    "description: 'የእድል ቁጥርዎን ይምረጡ እና ያሸንፉ!'",
    content,
    count=1
)

if title_count == 0:
    print("Could not find metadata title field.")
    raise SystemExit(1)

if desc_count == 0:
    print("Could not find metadata description field.")
    raise SystemExit(1)

file_path.write_text(content)

print("app/layout.tsx metadata title and description updated successfully.")
PY

if [ $? -ne 0 ]; then
  echo "Update failed. Backup saved in: $BACKUP_DIR"
  exit 1
fi

echo ""
echo "Done."
echo "Backup saved in: $BACKUP_DIR"
echo ""
echo "Now run:"
echo "npm run build"
EOF

chmod +x update-layout-title-description-only.sh
./update-layout-title-description-only.sh