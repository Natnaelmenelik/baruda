python3 - <<'PY'
from pathlib import Path
import re

p = Path("components/AdminNumbersPanel.tsx")
s = p.read_text()

# Make dashboard message modal content vertically scrollable
s = re.sub(
    r'className="([^"]*w-full max-w-[^"]*bg-white[^"]*)"',
    lambda m: 'className="' + m.group(1) + ' max-h-[90vh] overflow-y-auto"',
    s,
    count=1
)

# Safer fallback: add scroll to any dashboard message modal container if not added
if "max-h-[90vh] overflow-y-auto" not in s:
    s = s.replace(
        'className="w-full max-w-lg',
        'className="max-h-[90vh] w-full max-w-lg overflow-y-auto',
        1
    )

p.write_text(s)
print("✅ Made admin message modal vertically scrollable")
PY