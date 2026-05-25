python3 - <<'PY'
from pathlib import Path
import re

p = Path("app/(protected)/dashboard/page.tsx")
text = p.read_text()

text = re.sub(
    r"\n\s*const announcementPoll = window\.setInterval\(\(\) => \{\n\s*if \(document\.visibilityState === \"visible\"\) \{\n\s*void refreshAnnouncementsTogether\(\);\n\s*\}\n\s*\}, 3000\);\n",
    "\n",
    text,
)

text = text.replace("      window.clearInterval(announcementPoll);\n", "")

p.write_text(text)
print("Removed announcement polling")
PY

npm run build