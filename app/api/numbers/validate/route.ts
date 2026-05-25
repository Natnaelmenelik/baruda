import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const numbers = Array.isArray(body?.numbers) ? body.numbers.map(Number) : [];

    if (!numbers.length) {
      return NextResponse.json({ valid: true, taken: [], locked: [], notLockedByYou: [] });
    }

    const taken: number[] = [];

    for (const n of numbers) {
      const rows = await sql`
        WITH unified_items AS (
          SELECT si.submission_id, si.number, si.amount
          FROM submission_items si

          UNION ALL

          SELECT
            s.id AS submission_id,
            x::int AS number,
            COALESCE(
              NULLIF(s.number_amounts ->> (x::text), '')::int,
              CASE
                WHEN array_length(s.numbers, 1) > 0
                THEN COALESCE(s.total_amount, 0) / array_length(s.numbers, 1)
                ELSE COALESCE(s.ticket_price, s.total_amount, 0)
              END
            )::int AS amount
          FROM submissions s
          CROSS JOIN LATERAL unnest(s.numbers) AS x
          WHERE s.numbers IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM submission_items si
              WHERE si.submission_id = s.id AND si.number = x
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
            COALESCE(SUM(ui.amount) FILTER (WHERE s.status IN ('approved', 'pending')), 0)::int AS reserved_amount
          FROM unified_items ui
          JOIN submissions s ON s.id = ui.submission_id
          WHERE s.status IN ('pending', 'approved')
            AND ui.number = ${n}
          GROUP BY ui.number
        )
        SELECT
          np.number,
          COALESCE(np.target_amount, 5000)::int AS target_amount,
          COALESCE(t.reserved_amount, 0)::int AS reserved_amount,
          COALESCE(np.status, 'open') AS status
        FROM number_pools np
        LEFT JOIN totals t ON t.number = np.number
        WHERE np.number = ${n}
        LIMIT 1
      `;

      const pool = rows?.[0];
      if (!pool) continue;

      if (
        pool.status === "closed" ||
        Number(pool.reserved_amount || 0) >= Number(pool.target_amount || 5000)
      ) {
        taken.push(n);
      }
    }

    return NextResponse.json({
      valid: taken.length === 0,
      taken,
      locked: [],
      notLockedByYou: [],
    });
  } catch (error: any) {
    console.error("Validate numbers error:", error);
    return NextResponse.json(
      { error: error.message || "Validation failed" },
      { status: 500 },
    );
  }
}
