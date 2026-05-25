import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "20"), 1), 100);
    const offset = (page - 1) * limit;
    const rawNumber = (searchParams.get("number") || "").trim();
    const filterNumber = rawNumber ? Number(rawNumber) : null;

    if (rawNumber && (!Number.isInteger(filterNumber) || Number(filterNumber) <= 0)) {
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
      approved_items AS (
        SELECT
          COALESCE(u.name, s.user_name, 'Unknown') AS user_name,
          COALESCE(u.phone, s.user_phone, s.contact_phone, '-') AS user_phone,
          ui.number,
          ui.amount
        FROM unified_items ui
        JOIN submissions s ON s.id = ui.submission_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.status = 'approved'
          AND (${filterNumber}::int IS NULL OR ui.number = ${filterNumber}::int)
      ),
      grouped AS (
        SELECT
          user_name,
          user_phone,
          ARRAY_AGG(number ORDER BY number ASC)::int[] AS numbers,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'number', number,
              'amount', amount
            )
            ORDER BY number ASC
          ) AS number_amounts,
          COALESCE(SUM(amount), 0)::int AS total_amount,
          COUNT(*)::int AS approved_item_count,
          COUNT(*)::int AS submission_count
        FROM approved_items
        GROUP BY user_name, user_phone
      )
      SELECT
        *,
        COUNT(*) OVER()::int AS total_count
      FROM grouped
      ORDER BY user_name ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const total = Number(rows?.[0]?.total_count || 0);
    const users = rows.map((row: any) => {
      const { total_count, ...rest } = row;
      return rest;
    });

    return NextResponse.json(
      {
        users,
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error: any) {
    console.error("Approved users numbers error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load approved users" },
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
