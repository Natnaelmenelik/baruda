#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
MANUAL_FILE="app/api/admin/manual-entries/[id]/route.ts"
SUBMISSIONS_FILE="app/api/admin/submissions/route.ts"
REJECT_FILE="app/api/admin/reject/[id]/route.ts"

for f in "$MANUAL_FILE" "$SUBMISSIONS_FILE" "$REJECT_FILE"; do
  if [ ! -f "$f" ]; then
    echo "❌ $f not found. Run this from your project root."
    exit 1
  fi
  cp "$f" "$f.bak.$(date +%Y%m%d%H%M%S)"
done

python3 <<'PY'
from pathlib import Path

# 1) Manual entry edit: preserve existing submission status after edit.
manual = Path("app/api/admin/manual-entries/[id]/route.ts")
text = manual.read_text()

old = """      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
      const numberAmounts = Object.fromEntries(items.map((item) => [String(item.number), item.amount]));
      const submissionType = items.length > 1 ? "group" : "single";
      const firstNumber = items[0]?.number ?? null;
      const activeStatus = items.length ? "pending" : "rejected";
"""
new = """      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
      const numberAmounts = Object.fromEntries(items.map((item) => [String(item.number), item.amount]));
      const submissionType = items.length > 1 ? "group" : "single";
      const firstNumber = items[0]?.number ?? null;
      const currentStatus = String(submissionRows[0]?.status || "pending").toLowerCase();
      const activeStatus = items.length
        ? currentStatus === "approved"
          ? "approved"
          : "pending"
        : "rejected";
"""
if old not in text:
    raise SystemExit("❌ Could not find manual-entry status block to replace")
text = text.replace(old, new, 1)

old = """            status = ${activeStatus},
            submission_type = ${submissionType},
            number_amounts = ${JSON.stringify(numberAmounts)}::jsonb,
            approved_at = NULL,
            rejected_at = CASE WHEN ${activeStatus} = 'rejected' THEN NOW() ELSE NULL END,
            updated_at = NOW()
"""
new = """            status = ${activeStatus},
            submission_type = ${submissionType},
            number_amounts = ${JSON.stringify(numberAmounts)}::jsonb,
            approved_at = CASE
              WHEN ${activeStatus} = 'approved' THEN COALESCE(approved_at, NOW())
              ELSE NULL
            END,
            rejected_at = CASE WHEN ${activeStatus} = 'rejected' THEN NOW() ELSE NULL END,
            updated_at = NOW()
"""
if old not in text:
    raise SystemExit("❌ Could not find manual-entry approved_at block to replace")
text = text.replace(old, new, 1)
manual.write_text(text)

# 2) Admin submissions list: main row should display active items only, while details keep full item history.
subs = Path("app/api/admin/submissions/route.ts")
text = subs.read_text()
old = """      WITH item_data AS (
        SELECT
          si.submission_id,
          ARRAY_AGG(si.number ORDER BY si.created_at ASC, si.id ASC)::int[] AS item_numbers,
          COALESCE(SUM(si.amount), 0)::int AS item_total,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'number', si.number,
              'amount', si.amount
            )
            ORDER BY si.created_at ASC, si.id ASC
          ) AS items
        FROM submission_items si
        GROUP BY si.submission_id
      )
"""
new = """      WITH item_data AS (
        SELECT
          si.submission_id,
          COALESCE(
            ARRAY_AGG(si.number ORDER BY si.created_at ASC, si.id ASC)
              FILTER (WHERE COALESCE(si.status, 'active') <> 'rejected'),
            ARRAY[]::int[]
          ) AS item_numbers,
          COALESCE(
            SUM(si.amount) FILTER (WHERE COALESCE(si.status, 'active') <> 'rejected'),
            0
          )::int AS item_total,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'number', si.number,
                'amount', si.amount,
                'status', COALESCE(si.status, 'active'),
                'rejected_at', si.rejected_at,
                'rejected_reason', si.rejected_reason
              )
              ORDER BY si.created_at ASC, si.id ASC
            ),
            '[]'::json
          ) AS items
        FROM submission_items si
        GROUP BY si.submission_id
      )
"""
if old not in text:
    raise SystemExit("❌ Could not find admin submissions item_data CTE to replace")
text = text.replace(old, new, 1)
subs.write_text(text)

# 3) Reject route: ignore rejected item rows and recalculate from source of truth instead of manual decrement.
rej = Path("app/api/admin/reject/[id]/route.ts")
text = rej.read_text()
old = """        SELECT submission_id, number, amount
        FROM submission_items
        WHERE submission_id = ANY($1::int[])
        ORDER BY number ASC
"""
new = """        SELECT submission_id, number, amount
        FROM submission_items
        WHERE submission_id = ANY($1::int[])
          AND COALESCE(status, 'active') <> 'rejected'
        ORDER BY number ASC
"""
if old in text:
    text = text.replace(old, new, 1)

start_marker = """    const values: any[] = [];
    const placeholders: string[] = [];

    affectedNumbers.forEach((number, index) => {
      const base = index * 2 + 1;
      placeholders.push(`($${base}::int, $${base + 1}::int)`);
      values.push(number, amountByNumber.get(number) || 0);
    });

    /*
      Affected numbers only:
      release pending amount.
      No full number recalculation.
    */
    await client.query(
      `
        WITH item_updates(number, amount) AS (
          VALUES ${placeholders.join(", ")}
        )
        UPDATE number_status_summary_cache cache
        SET
          pending_amount = GREATEST(cache.pending_amount - item_updates.amount, 0),
          remaining_amount = GREATEST(
            cache.target_amount
              - cache.approved_amount
              - GREATEST(cache.pending_amount - item_updates.amount, 0)
              - cache.hold_amount,
            0
          ),
          status = CASE
            WHEN cache.approved_amount >= cache.target_amount THEN 'sold'
            WHEN GREATEST(cache.pending_amount - item_updates.amount, 0) > 0 OR cache.hold_amount > 0 THEN 'pending'
            ELSE 'open'
          END,
          updated_at = NOW()
        FROM item_updates
        WHERE cache.number = item_updates.number
      `,
      values,
    );
"""
replacement = """    /*
      Status changed from pending -> rejected above.
      Do NOT manually decrement cache here. Recalculate affected numbers from
      submission_items/submissions so manual entries and rejected item rows stay accurate.
    */
    await client.query(
      `SELECT public.refresh_number_status_summary_cache_many($1::integer[])`,
      [affectedNumbers],
    );
"""
if start_marker in text:
    text = text.replace(start_marker, replacement, 1)
else:
    print("⚠️ Reject route manual decrement block was not found; skipped that block.")
rej.write_text(text)

print("✅ Patched manual entry edit to preserve approved/pending status")
print("✅ Patched admin submissions display to show active items only in main rows")
print("✅ Patched reject route to refresh from source of truth")
PY

echo ""
echo "Now run:"
echo "npm run build"
