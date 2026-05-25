#!/usr/bin/env bash
set -euo pipefail

# improve-message-approved-dark-mode.sh
#
# Improves dark mode styling for user-facing:
# - dashboard/message display components
# - approved number / good-luck / approval notification components
#
# Logic is unchanged. Only Tailwind classes are updated.
#
# Run:
#   chmod +x improve-message-approved-dark-mode.sh
#   ./improve-message-approved-dark-mode.sh
#   npm run build

ROOT="${1:-.}"
cd "$ROOT"

STAMP="$(date +%Y%m%d%H%M%S)"

echo "Searching likely components..."

FILES=$(find components app -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | grep -Ei "DashboardMessage|GoodLuck|Approved|Approval|Notification|Message|Winner|dashboard/page|NumberGrid|SubmitNumberModal" || true)

for file in $FILES; do
  if [ -f "$file" ]; then
    cp "$file" "$file.bak.message-approved-dark.$STAMP"
    echo "Backup: $file.bak.message-approved-dark.$STAMP"
  fi
done

python3 <<'PY'
from pathlib import Path
import re

TARGET_HINTS = [
    "dashboardMessage",
    "DashboardMessage",
    "goodLuck",
    "GoodLuck",
    "approved",
    "Approved",
    "approval",
    "Approval",
    "winnerAnnouncement",
    "messageVisible",
    "congrat",
    "Congratulations",
]

def should_patch(path: Path, text: str) -> bool:
    name = path.name.lower()
    if any(x in name for x in ["dashboardmessage", "goodluck", "approved", "approval", "notification"]):
        return True
    return any(h in text for h in TARGET_HINTS)

def safe_replace(text: str, old: str, new: str) -> str:
    if old in text:
        return text.replace(old, new)
    return text

def patch_file(path: Path):
    text = path.read_text()
    original = text

    replacements = [
        # Main cards / containers
        ("bg-white/95", "bg-white/95 dark:bg-slate-900/90"),
        ("bg-white/90", "bg-white/90 dark:bg-slate-900/85"),
        ("bg-white/80", "bg-white/80 dark:bg-slate-900/80"),
        ("bg-white/70", "bg-white/70 dark:bg-slate-900/70"),
        ("bg-white/60", "bg-white/60 dark:bg-slate-900/65"),
        ("bg-white/50", "bg-white/50 dark:bg-slate-900/60"),
        ("bg-white/40", "bg-white/40 dark:bg-slate-900/55"),
        ("bg-white/35", "bg-white/35 dark:bg-slate-900/60"),
        ("bg-white/30", "bg-white/30 dark:bg-slate-900/55"),
        ("bg-white", "bg-white dark:bg-slate-900"),

        # Text contrast
        ("text-gray-950", "text-gray-950 dark:text-white"),
        ("text-gray-900", "text-gray-900 dark:text-white"),
        ("text-gray-800", "text-gray-800 dark:text-slate-100"),
        ("text-gray-700", "text-gray-700 dark:text-slate-200"),
        ("text-gray-600", "text-gray-600 dark:text-slate-300"),
        ("text-gray-500", "text-gray-500 dark:text-slate-400"),
        ("text-slate-950", "text-slate-950 dark:text-white"),
        ("text-slate-900", "text-slate-900 dark:text-white"),
        ("text-slate-800", "text-slate-800 dark:text-slate-100"),
        ("text-slate-700", "text-slate-700 dark:text-slate-200"),
        ("text-slate-600", "text-slate-600 dark:text-slate-300"),
        ("text-slate-500", "text-slate-500 dark:text-slate-400"),

        # Borders / rings / shadows
        ("border-white/70", "border-white/70 dark:border-slate-700/70"),
        ("border-white/60", "border-white/60 dark:border-slate-700/60"),
        ("border-white/50", "border-white/50 dark:border-slate-700/60"),
        ("border-gray-100", "border-gray-100 dark:border-slate-700"),
        ("border-gray-200", "border-gray-200 dark:border-slate-700"),
        ("border-slate-100", "border-slate-100 dark:border-slate-700"),
        ("border-slate-200", "border-slate-200 dark:border-slate-700"),
        ("ring-blue-100", "ring-blue-100 dark:ring-slate-700"),
        ("ring-white/70", "ring-white/70 dark:ring-slate-700/70"),
        ("shadow-blue-950/10", "shadow-blue-950/10 dark:shadow-black/40"),
        ("shadow-black/10", "shadow-black/10 dark:shadow-black/40"),

        # Blue info/message styles
        ("bg-blue-50", "bg-blue-50 dark:bg-blue-950/30"),
        ("bg-blue-100", "bg-blue-100 dark:bg-blue-500/20"),
        ("bg-blue-200/40", "bg-blue-200/40 dark:bg-blue-500/20"),
        ("text-blue-950", "text-blue-950 dark:text-white"),
        ("text-blue-900", "text-blue-900 dark:text-blue-100"),
        ("text-blue-800", "text-blue-800 dark:text-blue-100"),
        ("text-blue-700", "text-blue-700 dark:text-blue-200"),
        ("text-blue-600", "text-blue-600 dark:text-blue-300"),
        ("border-blue-100", "border-blue-100 dark:border-blue-800/60"),
        ("border-blue-200", "border-blue-200 dark:border-blue-800/60"),

        # Amber message styles
        ("bg-amber-50", "bg-amber-50 dark:bg-amber-950/30"),
        ("bg-amber-100", "bg-amber-100 dark:bg-amber-500/20"),
        ("text-amber-950", "text-amber-950 dark:text-amber-50"),
        ("text-amber-900", "text-amber-900 dark:text-amber-100"),
        ("text-amber-800", "text-amber-800 dark:text-amber-200"),
        ("text-amber-700", "text-amber-700 dark:text-amber-200"),
        ("text-amber-600", "text-amber-600 dark:text-amber-300"),
        ("border-amber-100", "border-amber-100 dark:border-amber-800/60"),
        ("border-amber-200", "border-amber-200 dark:border-amber-800/60"),

        # Green / approved / good luck styles
        ("bg-green-50", "bg-green-50 dark:bg-emerald-950/30"),
        ("bg-green-100", "bg-green-100 dark:bg-emerald-500/20"),
        ("bg-emerald-50", "bg-emerald-50 dark:bg-emerald-950/30"),
        ("bg-emerald-100", "bg-emerald-100 dark:bg-emerald-500/20"),
        ("text-green-950", "text-green-950 dark:text-emerald-50"),
        ("text-green-900", "text-green-900 dark:text-emerald-100"),
        ("text-green-800", "text-green-800 dark:text-emerald-100"),
        ("text-green-700", "text-green-700 dark:text-emerald-200"),
        ("text-green-600", "text-green-600 dark:text-emerald-300"),
        ("text-emerald-950", "text-emerald-950 dark:text-emerald-50"),
        ("text-emerald-900", "text-emerald-900 dark:text-emerald-100"),
        ("text-emerald-800", "text-emerald-800 dark:text-emerald-100"),
        ("text-emerald-700", "text-emerald-700 dark:text-emerald-200"),
        ("text-emerald-600", "text-emerald-600 dark:text-emerald-300"),
        ("border-green-100", "border-green-100 dark:border-emerald-800/60"),
        ("border-green-200", "border-green-200 dark:border-emerald-800/60"),
        ("border-emerald-100", "border-emerald-100 dark:border-emerald-800/60"),
        ("border-emerald-200", "border-emerald-200 dark:border-emerald-800/60"),

        # Gradients common in approval/good luck cards
        ("from-green-50", "from-green-50 dark:from-emerald-950/40"),
        ("from-emerald-50", "from-emerald-50 dark:from-emerald-950/40"),
        ("from-blue-50", "from-blue-50 dark:from-blue-950/40"),
        ("from-amber-50", "from-amber-50 dark:from-amber-950/40"),
        ("via-white", "via-white dark:via-slate-900/60"),
        ("to-blue-50", "to-blue-50 dark:to-blue-950/30"),
        ("to-green-50", "to-green-50 dark:to-emerald-950/30"),
        ("to-emerald-50", "to-emerald-50 dark:to-emerald-950/30"),
        ("to-orange-50", "to-orange-50 dark:to-orange-950/30"),
        ("to-amber-50", "to-amber-50 dark:to-amber-950/30"),

        # Modal overlays/cards
        ("bg-black/60", "bg-black/60 dark:bg-black/75"),
        ("bg-black/70", "bg-black/70 dark:bg-black/80"),
    ]

    for old, new in replacements:
        text = safe_replace(text, old, new)

    # Add dark hover variants for common buttons without changing color intent.
    text = safe_replace(text, "hover:bg-gray-50", "hover:bg-gray-50 dark:hover:bg-slate-800")
    text = safe_replace(text, "hover:bg-blue-50", "hover:bg-blue-50 dark:hover:bg-blue-950/40")
    text = safe_replace(text, "hover:bg-green-50", "hover:bg-green-50 dark:hover:bg-emerald-950/40")
    text = safe_replace(text, "hover:bg-amber-50", "hover:bg-amber-50 dark:hover:bg-amber-950/40")

    if text != original:
        path.write_text(text)
        return True
    return False

changed = []

for root in [Path("components"), Path("app")]:
    if not root.exists():
        continue

    for path in root.rglob("*"):
        if path.suffix not in [".tsx", ".ts"]:
            continue

        text = path.read_text(errors="ignore")
        if should_patch(path, text):
            if patch_file(path):
                changed.append(str(path))

print("Changed files:")
for file in changed:
    print(" -", file)

if not changed:
    print("No files changed. Check component names manually.")
PY

echo
echo "Done."
echo "Backups created with suffix: .bak.message-approved-dark.$STAMP"
echo
echo "Now run:"
echo "  npm run build"
