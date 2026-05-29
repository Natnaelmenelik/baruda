python3 - <<'PY'
from pathlib import Path

p = Path("components/AdminSettingsPanel.tsx")
s = p.read_text()

if 'useQueryClient' not in s.split("export default function")[0]:
    s = s.replace(
        'import toast from "react-hot-toast";',
        'import toast from "react-hot-toast";\nimport { useQueryClient } from "@tanstack/react-query";'
    )

p.write_text(s)
print("✅ Added useQueryClient import")
PY