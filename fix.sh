#!/usr/bin/env bash
set -euo pipefail

FILE="components/SelectedNumbersPanel.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found. Run this from your project root."
  exit 1
fi

cp "$FILE" "$FILE.bak_duplicate_disabled_$(date +%Y%m%d_%H%M%S)"

python3 - <<'PY'
from pathlib import Path

path = Path("components/SelectedNumbersPanel.tsx")
text = path.read_text()

# Remove duplicate JSX attributes named disabled inside each opening tag.
# Keeps the first disabled=... and removes any later disabled=... in the same tag.
out = []
i = 0
changed = 0

while i < len(text):
    if text[i] != '<' or i + 1 >= len(text) or text[i+1] in '/>!':
        out.append(text[i])
        i += 1
        continue

    start = i
    quote = None
    brace_depth = 0
    j = i + 1
    while j < len(text):
        ch = text[j]
        if quote:
            if ch == quote and text[j-1] != '\\':
                quote = None
        else:
            if ch in ('"', "'"):
                quote = ch
            elif ch == '{':
                brace_depth += 1
            elif ch == '}':
                brace_depth = max(0, brace_depth - 1)
            elif ch == '>' and brace_depth == 0:
                break
        j += 1

    if j >= len(text):
        out.append(text[start:])
        break

    tag = text[start:j+1]

    # Only process tags that contain disabled more than once.
    if tag.count('disabled=') <= 1:
        out.append(tag)
        i = j + 1
        continue

    pieces = []
    k = 0
    seen_disabled = False
    while k < len(tag):
        idx = tag.find('disabled=', k)
        if idx == -1:
            pieces.append(tag[k:])
            break

        pieces.append(tag[k:idx])

        # Parse disabled={...}, disabled="...", disabled='...', or bare-ish value until whitespace/>.
        end = idx + len('disabled=')
        if end < len(tag) and tag[end] == '{':
            depth = 0
            q = None
            m = end
            while m < len(tag):
                c = tag[m]
                if q:
                    if c == q and tag[m-1] != '\\':
                        q = None
                else:
                    if c in ('"', "'"):
                        q = c
                    elif c == '{':
                        depth += 1
                    elif c == '}':
                        depth -= 1
                        if depth == 0:
                            m += 1
                            break
                m += 1
            attr = tag[idx:m]
            k = m
        elif end < len(tag) and tag[end] in ('"', "'"):
            q = tag[end]
            m = end + 1
            while m < len(tag):
                if tag[m] == q and tag[m-1] != '\\':
                    m += 1
                    break
                m += 1
            attr = tag[idx:m]
            k = m
        else:
            m = end
            while m < len(tag) and not tag[m].isspace() and tag[m] not in '/>':
                m += 1
            attr = tag[idx:m]
            k = m

        if not seen_disabled:
            pieces.append(attr)
            seen_disabled = True
        else:
            changed += 1
            # Remove extra whitespace left before duplicate attr where possible.
            if pieces and pieces[-1].endswith(' '):
                pieces[-1] = pieces[-1].rstrip(' ')

    out.append(''.join(pieces))
    i = j + 1

new_text = ''.join(out)
path.write_text(new_text)
print(f"Fixed duplicate disabled attributes removed: {changed}")
PY

echo "Done. Now run: npm run build"
