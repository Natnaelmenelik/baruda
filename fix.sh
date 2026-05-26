#!/usr/bin/env bash
set -euo pipefail

FILE="lib/i18n/translations.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ File not found: $FILE"
  echo "Run this from your project root."
  exit 1
fi

cp "$FILE" "$FILE.backup-close-unclose-translations"

python3 <<'PY'
from pathlib import Path
import re

path = Path("lib/i18n/translations.ts")
text = path.read_text()

# Translation keys needed by AdminNumbersPanel close/unclose UI.
langs = {
    "en": {
        "closed": "Closed",
        "uncloseNumber": "Unclose",
        "numberUnclosed": "Number reopened",
        "failedToUncloseNumber": "Failed to reopen number",
        "confirmUncloseNumberTitle": "Reopen this number?",
        "confirmUncloseNumberMessage": "This number will be marked as open again and users will be able to submit payment for it.",
        "numberClosed": "Number closed",
        "failedToCloseNumber": "Failed to close number",
    },
    "am": {
        "closed": "ተዘግቷል",
        "uncloseNumber": "እንደገና ክፈት",
        "numberUnclosed": "ቁጥሩ እንደገና ተከፍቷል",
        "failedToUncloseNumber": "ቁጥሩን እንደገና መክፈት አልተሳካም",
        "confirmUncloseNumberTitle": "ይህን ቁጥር እንደገና መክፈት ይፈልጋሉ?",
        "confirmUncloseNumberMessage": "ይህ ቁጥር እንደገና ክፍት ይሆናል፣ ተጠቃሚዎችም ለዚህ ቁጥር ክፍያ ማስገባት ይችላሉ።",
        "numberClosed": "ቁጥሩ ተዘግቷል",
        "failedToCloseNumber": "ቁጥሩን መዝጋት አልተሳካም",
    },
    "om": {
        "closed": "Cufame",
        "uncloseNumber": "Irra Deebi'i Bani",
        "numberUnclosed": "Lakkoofsi irra deebi'ee banameera",
        "failedToUncloseNumber": "Lakkoofsa irra deebiin banuun hin milkoofne",
        "confirmUncloseNumberTitle": "Lakkoofsa kana irra deebitee banuu barbaaddaa?",
        "confirmUncloseNumberMessage": "Lakkoofsi kun deebi'ee banaa ta'a; fayyadamtoonni lakkoofsa kanaaf kaffaltii galchuu ni danda'u.",
        "numberClosed": "Lakkoofsi cufameera",
        "failedToCloseNumber": "Lakkoofsa cufuun hin milkoofne",
    },
}


def find_object_bounds(src: str, lang: str):
    marker = f"  {lang}: {{"
    start = src.find(marker)
    if start == -1:
        raise SystemExit(f"❌ Could not find language block: {lang}")
    brace_start = src.find("{", start)
    depth = 0
    in_str = None
    esc = False
    for i in range(brace_start, len(src)):
        ch = src[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == in_str:
                in_str = None
            continue
        if ch in ('"', "'", '`'):
            in_str = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return brace_start, i
    raise SystemExit(f"❌ Could not parse language block: {lang}")


def upsert_key(block: str, key: str, value: str) -> str:
    safe = value.replace('\\', '\\\\').replace('"', '\\"')
    # Match one-line string value: key: "...",
    pattern = re.compile(rf"(^\s*{re.escape(key)}\s*:\s*)\"[^\"]*\"(\s*,)", re.M)
    if pattern.search(block):
        return pattern.sub(rf'\1"{safe}"\2', block, count=1)

    # Insert after closeNumber when possible, otherwise after closed/open area.
    insert_line = f'    {key}: "{safe}",\n'
    anchors = ["    closeNumber:", "    closed:", "    open:"]
    for anchor in anchors:
        pos = block.find(anchor)
        if pos != -1:
            line_end = block.find("\n", pos)
            return block[:line_end+1] + insert_line + block[line_end+1:]
    return block[:-1] + insert_line + block[-1:]

for lang, keys in langs.items():
    start, end = find_object_bounds(text, lang)
    block = text[start:end+1]
    for key, value in keys.items():
        block = upsert_key(block, key, value)
    text = text[:start] + block + text[end+1:]

path.write_text(text)
print("✅ Added/updated close & unclose translation keys for English, Amharic, and Afaan Oromo.")
print(f"🗂 Backup saved: {path}.backup-close-unclose-translations")
PY

echo "✅ Now run: npm run build"
