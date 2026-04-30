python3 - <<'PY'
from pathlib import Path
import re

p = Path("app/(auth)/login/page.tsx")
text = p.read_text()

# Replace any react import with Suspense included
text = re.sub(
    r"import\s*\{([^}]*)\}\s*from\s*['\"]react['\"]\s*;",
    lambda m: (
        "import { "
        + ", ".join(
            dict.fromkeys(
                ["Suspense"] +
                [x.strip() for x in m.group(1).split(",") if x.strip()]
            )
        )
        + " } from 'react';"
    ),
    text,
    count=1
)

p.write_text(text)
print("✅ Login Suspense import fixed")
PY
