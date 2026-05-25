import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request, context: { params: Promise<{ number: string }> }) {
  try {
    await requireAdmin(req);

    const resolvedParams = await context.params;

    const number = Number(resolvedParams.number);

    if (!Number.isInteger(number) || number <= 0) {
      return NextResponse.json({ error: "Invalid number" }, { status: 400 });
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
      )
      SELECT
        ui.number,
        ui.amount,
        s.id::text AS submission_id,
        s.status,
        COALESCE(s.submitted_at, s.created_at) AS submitted_at,
        s.receipt_url,
        COALESCE(u.name, s.user_name, 'Unknown') AS user_name,
        COALESCE(u.phone, s.user_phone, s.contact_phone, '-') AS user_phone
      FROM unified_items ui
      JOIN submissions s ON s.id = ui.submission_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE ui.number = ${number}
        AND s.status = 'approved'
      ORDER BY COALESCE(s.submitted_at, s.created_at) DESC
    `;

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error: any) {
    console.error("Admin number submissions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load number submissions" },
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
