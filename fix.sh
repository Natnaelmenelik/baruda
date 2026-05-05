cat > update-social-preview-odda.sh <<'EOF'
#!/bin/bash

echo "Updating social media preview metadata for oddda.vercel.app..."

FILE="app/layout.tsx"
BACKUP_DIR="backups-social-preview-$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$FILE" ]; then
  echo "Error: $FILE not found."
  echo "Run this script from your project root."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$FILE" "$BACKUP_DIR/layout.tsx.bak"

python3 <<'PY'
from pathlib import Path
import re

file_path = Path("app/layout.tsx")
content = file_path.read_text()

# Ensure Metadata import exists
if "import type { Metadata } from 'next';" not in content and 'import type { Metadata } from "next";' not in content:
    content = "import type { Metadata } from 'next';\n" + content

metadata_block = """export const metadata: Metadata = {
  metadataBase: new URL('https://oddda.vercel.app'),
  title: 'ኦዳ የመኪና እቁብ ሎተሪ',
  description: 'ከዕድለኛ ቁጥርዎ ጋር የመኪና እድልዎን ይሞክሩ!',
  openGraph: {
    title: 'ኦዳ የመኪና እቁብ ሎተሪ',
    description: 'ከዕድለኛ ቁጥርዎ ጋር የመኪና እድልዎን ይሞክሩ!',
    url: 'https://oddda.vercel.app',
    siteName: 'ኦዳ የመኪና እቁብ ሎተሪ',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ኦዳ የመኪና እቁብ ሎተሪ',
      },
    ],
    locale: 'am_ET',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ኦዳ የመኪና እቁብ ሎተሪ',
    description: 'ከዕድለኛ ቁጥርዎ ጋር የመኪና እድልዎን ይሞክሩ!',
    images: ['/og-image.jpg'],
  },
};"""

pattern = re.compile(
    r"export\s+const\s+metadata\s*(?::\s*Metadata)?\s*=\s*\{.*?\};",
    re.DOTALL
)

if pattern.search(content):
    content = pattern.sub(metadata_block, content, count=1)
else:
    content = content.replace("\nexport default", "\n" + metadata_block + "\n\nexport default", 1)

file_path.write_text(content)
print("app/layout.tsx social preview metadata updated successfully.")
PY

if [ $? -ne 0 ]; then
  echo "Update failed. Backup saved in: $BACKUP_DIR"
  exit 1
fi

echo ""
echo "Done."
echo "Backup saved in: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Add your preview image as public/og-image.jpg"
echo "2. Run: npm run build"
echo "3. Deploy to Vercel"
echo "4. Open: https://oddda.vercel.app/og-image.jpg"
echo "5. Refresh Telegram preview with @WebpageBot"
EOF

chmod +x update-social-preview-odda.sh
./update-social-preview-odda.sh