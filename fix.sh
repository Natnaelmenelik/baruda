python3 <<'PY'
from pathlib import Path
import re

path = Path("app/(protected)/admin/page.tsx")
code = path.read_text()

code = re.sub(
r"""onPicked=\{\(\) => \{\s*
\s*setShowPickWinnerModal\(false\);\s*
\s*\}\}""",
"onPicked={() => {}}",
code,
flags=re.S
)

path.write_text(code)
print("✅ Pick Winner modal now stays open and shows the winner result.")
PY

npm run dev