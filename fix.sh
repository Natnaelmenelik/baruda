#!/usr/bin/env bash
set -euo pipefail

FILE="hooks/useAdmin.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ File not found: $FILE"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.backup-no-stats-polling-$STAMP"

python3 <<'PY'
from pathlib import Path
import re

path = Path("hooks/useAdmin.ts")
text = path.read_text()

original = text

# Remove/disable any 10-second polling for stats.
text = re.sub(
    r"(\s*)refetchInterval\s*:\s*10000\s*,",
    r"\1refetchInterval: false,",
    text,
)

# Force React Query stats behavior to no automatic refetch.
# Replace common active options if present.
replacements = {
    r"refetchOnWindowFocus\s*:\s*true\s*,": "refetchOnWindowFocus: false,",
    r"refetchOnMount\s*:\s*true\s*,": "refetchOnMount: false,",
    r"refetchOnReconnect\s*:\s*true\s*,": "refetchOnReconnect: false,",
    r"staleTime\s*:\s*0\s*,": "staleTime: Infinity,",
}

for pattern, replacement in replacements.items():
    text = re.sub(pattern, replacement, text)

# If useStats query does not already include the safety options, insert them after queryFn.
# This targets the useStats block only.
def patch_use_stats(match):
    block = match.group(0)

    if "refetchInterval:" not in block:
        block = re.sub(
            r"(queryFn\s*:\s*[^,\n]+,)",
            r"\1\n    refetchInterval: false,",
            block,
            count=1,
        )

    required = [
        ("refetchOnWindowFocus:", "    refetchOnWindowFocus: false,"),
        ("refetchOnMount:", "    refetchOnMount: false,"),
        ("refetchOnReconnect:", "    refetchOnReconnect: false,"),
        ("staleTime:", "    staleTime: Infinity,"),
        ("retry:", "    retry: false,"),
    ]

    insert_after = "refetchInterval: false,"
    for key, line in required:
        if key not in block:
            block = block.replace(insert_after, insert_after + "\n" + line, 1)

    return block

text = re.sub(
    r"export\s+(?:const|function)\s+useStats[\s\S]*?\n\};",
    patch_use_stats,
    text,
    count=1,
)

if text == original:
    print("⚠️ No changes made. The file may already be patched or has a different structure.")
else:
    path.write_text(text)
    print("✅ Disabled admin stats polling in hooks/useAdmin.ts")
    print("✅ Backup created next to the file")
PY

echo ""
echo "Now run:"
echo "npm run build"
