import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const entries =
      Array.isArray(body?.submissions)
        ? body.submissions
        : Array.isArray(body?.items)
          ? body.items
          : Array.isArray(body?.numbers)
            ? body.numbers.map((n: any) => ({
                number: Number(n),
                amount: Number(body?.amounts?.[n] || body?.amounts?.[String(n)] || 0),
              }))
            : [];

    if (!entries.length) {
      return NextResponse.json(
        { valid: false, errors: [{ message: "No numbers selected" }] },
        { status: 400 },
      );
    }

    const errors: any[] = [];

    for (const item of entries) {
      const number = Number(item.number);
      const amount = Number(item.amount || 0);

      if (!Number.isInteger(number) || number <= 0) {
        errors.push({ number, message: "Invalid number" });
        continue;
      }

      if (!amount || amount <= 0) {
        errors.push({ number, message: "Invalid amount" });
        continue;
      }

      const rows = await sql`
        WITH unified_items AS (
          SELECT si.submission_id, si.number, si.amount
          FROM submission_items si

          UNION ALL

          SELECT
            s.id AS submission_id,
            n::int AS number,
            COALESCE(
              NULLIF(s.number_amounts ->> (n::text), '')::int,
              CASE
                WHEN array_length(s.numbers, 1) > 0
                THEN COALESCE(s.total_amount, 0) / array_length(s.numbers, 1)
                ELSE COALESCE(s.ticket_price, s.total_amount, 0)
              END
            )::int AS amount
          FROM submissions s
          CROSS JOIN LATERAL unnest(s.numbers) AS n
          WHERE s.numbers IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM submission_items si
              WHERE si.submission_id = s.id AND si.number = n
            )

          UNION ALL

          SELECT
            s.id AS submission_id,
            s.number::int AS number,
            COALESCE(NULLIF(s.total_amount, 0), NULLIF(s.ticket_price, 0), 0)::int AS amount
          FROM submissions s
          WHERE s.number IS NOT NULL
            AND (s.numbers IS NULL OR array_length(s.numbers, 1) IS NULL)
            AND NOT EXISTS (
              SELECT 1 FROM submission_items si WHERE si.submission_id = s.id
            )
        ),
        totals AS (
          SELECT
            ui.number,
            COALESCE(SUM(ui.amount) FILTER (WHERE s.status = 'approved'), 0)::int AS approved_amount,
            COALESCE(SUM(ui.amount) FILTER (WHERE s.status = 'pending'), 0)::int AS pending_amount
          FROM unified_items ui
          JOIN submissions s ON s.id = ui.submission_id
          WHERE s.status IN ('pending', 'approved')
            AND ui.number = ${number}
          GROUP BY ui.number
        )
        SELECT
          np.number,
          COALESCE(np.target_amount, 5000)::int AS target_amount,
          COALESCE(t.approved_amount, 0)::int AS approved_amount,
          COALESCE(t.pending_amount, 0)::int AS pending_amount,
          GREATEST(
            COALESCE(np.target_amount, 5000)
            - COALESCE(t.approved_amount, 0)
            - COALESCE(t.pending_amount, 0),
            0
          )::int AS remaining,
          COALESCE(np.status, 'open') AS status
        FROM number_pools np
        LEFT JOIN totals t ON t.number = np.number
        WHERE np.number = ${number}
        LIMIT 1
      `;

      const pool = rows?.[0];

      if (!pool) {
        errors.push({ number, message: "Number pool not found" });
        continue;
      }

      const remaining = Number(pool.remaining || 0);

      if (pool.status === "closed" || remaining <= 0) {
        errors.push({ number, message: "Number target already reserved/reached", remaining });
        continue;
      }

      if (amount > remaining) {
        errors.push({
          number,
          message: `Amount exceeds remaining balance (${remaining})`,
          remaining,
        });
      }
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
    });
  } catch (error: any) {
    console.error("Validate bulk error:", error);
    return NextResponse.json(
      { valid: false, error: error.message || "Validation failed" },
      { status: 500 },
    );
  }
}
