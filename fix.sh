#!/usr/bin/env bash
set -euo pipefail

API_FILE="app/api/admin/manual-entries/route.ts"
PANEL_FILE="components/AdminNumbersPanel.tsx"

if [ ! -f "$API_FILE" ]; then
  echo "❌ File not found: $API_FILE"
  exit 1
fi

if [ ! -f "$PANEL_FILE" ]; then
  echo "❌ File not found: $PANEL_FILE"
  exit 1
fi

cp "$API_FILE" "$API_FILE.bak.$(date +%Y%m%d_%H%M%S)"
cp "$PANEL_FILE" "$PANEL_FILE.bak.$(date +%Y%m%d_%H%M%S)"

echo "✅ Backups created"

python3 <<'PY'
from pathlib import Path
import re

# -------------------------------------------------------------------
# 1) Frontend: show data.message/details before data.error code
# -------------------------------------------------------------------
panel = Path("components/AdminNumbersPanel.tsx")
s = panel.read_text()

old = '''  async function readJson(res: Response) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data?.error || `Request failed: ${res.status}`);
    return data;
  }
'''

new = '''  async function readJson(res: Response) {
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detailsMessage = Array.isArray(data?.details)
        ? data.details
            .map((item: any) =>
              typeof item === "string"
                ? item
                : item?.message
                  ? String(item.message)
                  : "",
            )
            .filter(Boolean)
            .join(" ")
        : "";

      const errorCode = typeof data?.error === "string" ? data.error : "";
      const humanMessage =
        data?.message ||
        detailsMessage ||
        (errorCode && errorCode !== "manual_entry_validation_failed"
          ? errorCode
          : "") ||
        `Request failed: ${res.status}`;

      const error = new Error(humanMessage) as Error & { data?: any; code?: string };
      error.data = data;
      error.code = errorCode;
      throw error;
    }

    return data;
  }
'''

if old in s:
    s = s.replace(old, new)
elif "manual_entry_validation_failed" not in s[s.find("async function readJson"):s.find("async function readJson")+1500]:
    s = re.sub(
        r"  async function readJson\(res: Response\) \{.*?\n  \}\n",
        new,
        s,
        count=1,
        flags=re.S,
    )

panel.write_text(s)
print("✅ Frontend now displays validation message/details instead of error code")

# -------------------------------------------------------------------
# 2) Backend: return clean 400 JSON for validation errors and avoid stack logs
# -------------------------------------------------------------------
api = Path("app/api/admin/manual-entries/route.ts")
s = api.read_text()

# Replace POST catch block if it logs every expected validation error.
old_catch = '''  } catch (error: any) {
    console.error("Manual entries POST error:", error);
    const message = error?.message || "Failed to close number for client";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}'''

new_catch = '''  } catch (error: any) {
    const message = error?.message || "Failed to close number for client";
    const status = errorStatus(message);

    // Expected admin input validation errors should not pollute server logs.
    // Only unexpected server errors should be logged.
    if (status >= 500) {
      console.error("Manual entries POST error:", error);
    }

    if (status === 400) {
      return NextResponse.json(
        {
          error: "manual_entry_validation_failed",
          message,
          details: [message],
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: message, message }, { status });
  }
}'''

if old_catch in s:
    s = s.replace(old_catch, new_catch)
else:
    # More robust replacement for the POST catch block near the end of file.
    s = re.sub(
        r'''  \} catch \(error: any\) \{\n\s*console\.error\("Manual entries POST error:", error\);\n\s*const message = error\?\.message \|\| "Failed to close number for client";\n\s*return NextResponse\.json\(\{ error: message \}, \{ status: errorStatus\(message\) \}\);\n\s*\}\n\}''',
        new_catch,
        s,
        count=1,
    )

api.write_text(s)
print("✅ Backend returns clean validation JSON and logs only unexpected 500 errors")
PY

echo ""
echo "✅ Done. Run:"
echo "npm run build"
echo "npm run dev"
echo ""
echo "Expected result:"
echo "- For amount > remaining, toast shows: Number X only has Y Birr remaining."
echo "- Terminal does NOT show a stack trace for that expected validation error."
