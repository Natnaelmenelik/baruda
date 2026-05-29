#!/usr/bin/env bash
set -e

echo "🔧 Making numbers_grid_status behave like Ticket Price (instant UI update)"

FILE="components/AdminSettingsPanel.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Cannot find $FILE"
  exit 1
fi

cp "$FILE" "${FILE}.bak_grid_status_instant"

python3 <<'PY'
from pathlib import Path

p = Path("components/AdminSettingsPanel.tsx")
s = p.read_text()

# Ensure useQueryClient import exists
if "useQueryClient" not in s:
    s = s.replace(
        "from '@tanstack/react-query';",
        "from '@tanstack/react-query';"
    )

# Inject queryClient after component start
if "const queryClient = useQueryClient();" not in s:
    marker = "export default function AdminSettingsPanel("
    idx = s.find(marker)
    if idx != -1:
        brace = s.find("{", idx)
        s = s[:brace+1] + "\n  const queryClient = useQueryClient();\n" + s[brace+1:]

# Find grid status toggle handler and add optimistic cache update
if "numbersGridStatus" in s and 'queryKey: ["lottery-settings"]' not in s:
    s = s.replace(
        """setNumbersGridStatus(nextStatus);""",
        """setNumbersGridStatus(nextStatus);

      queryClient.setQueryData(
        ["lottery-settings"],
        (old: any) => ({
          ...(old || {}),
          numbersGridStatus: nextStatus,
        })
      );"""
    )

# After successful save, keep admin reload
s = s.replace(
    """await loadSettings();""",
    """await loadSettings();

      // Refresh public settings consumers
      queryClient.invalidateQueries({
        queryKey: ["lottery-settings"],
      });"""
)

p.write_text(s)
print("✅ Instant numbers_grid_status update added")
PY

echo ""
echo "✅ Done"
echo ""
echo "Behavior:"
echo "Admin toggles Open/Closed"
echo "→ Overlay updates immediately"
echo "→ POST /api/admin/settings"
echo "→ GET /api/admin/settings"
echo "→ lottery-settings cache refreshed"
echo ""
echo "Same feel as Ticket Price."