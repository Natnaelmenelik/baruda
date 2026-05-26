import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    await requireAdmin(req);

    const resolvedParams = await context.params;
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json({ error: "Missing submission id" }, { status: 400 });
    }

    const affectedBefore = await sql`
      SELECT id
      FROM submissions
      WHERE id::text = ${id}
         OR submission_group_id::text = ${id}
    `;

    if (!affectedBefore.length) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const affectedNumbers = await sql`
      WITH affected_submissions AS (
        SELECT id, numbers, number
        FROM submissions
        WHERE id::text = ${id}
           OR submission_group_id::text = ${id}
      ),
      numbers_from_items AS (
        SELECT DISTINCT si.number
        FROM submission_items si
        JOIN affected_submissions s ON s.id = si.submission_id
      ),
      numbers_from_array AS (
        SELECT DISTINCT n::int AS number
        FROM affected_submissions s
        CROSS JOIN LATERAL unnest(s.numbers) AS n
        WHERE s.numbers IS NOT NULL
      ),
      numbers_from_single AS (
        SELECT DISTINCT number
        FROM affected_submissions
        WHERE number IS NOT NULL
      )
      SELECT DISTINCT number
      FROM (
        SELECT number FROM numbers_from_items
        UNION ALL
        SELECT number FROM numbers_from_array
        UNION ALL
        SELECT number FROM numbers_from_single
      ) x
    `;

    await sql`
      UPDATE submissions
      SET
        status = 'pending',
        approved_at = NULL,
        rejected_at = NULL,
        updated_at = NOW()
      WHERE id::text = ${id}
         OR submission_group_id::text = ${id}
    `;

    if (affectedNumbers.length) {
      const nums = affectedNumbers.map((r: any) => Number(r.number));

      await sql`
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
              SELECT 1
              FROM submission_items si
              WHERE si.submission_id = s.id
                AND si.number = n
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
        approved_totals AS (
          SELECT
            ui.number,
            COALESCE(SUM(ui.amount), 0)::int AS approved_amount
          FROM unified_items ui
          JOIN submissions s ON s.id = ui.submission_id
          WHERE s.status = 'approved'
            AND ui.number = ANY(${nums})
          GROUP BY ui.number
        )
        UPDATE number_pools np
        SET
          current_amount = COALESCE(at.approved_amount, 0),
          status = CASE
            WHEN COALESCE(at.approved_amount, 0) >= COALESCE(np.target_amount, 5000)
            THEN 'sold'
            ELSE 'open'
          END,
          updated_at = NOW()
        FROM unnest(${nums}::int[]) AS n(number)
        LEFT JOIN approved_totals at ON at.number = n.number
        WHERE np.number = n.number
      `;
    }

    return NextResponse.json({
      ok: true,
      updated: affectedBefore.length,
      message: "Submission returned to pending",
    });
  } catch (error: any) {
    console.error("Minsam return pending error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to return submission to pending" },
      {
        status:
          error.message === "Unauthorized"
            ? 401
            : error.message === "Forbidden"
              ? 403
              : 500,
      },
    );
  }
}
