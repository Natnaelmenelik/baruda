import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { cleanupExpiredHoldsIfNeeded } from "@/lib/db/cleanupExpiredHolds";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    await cleanupExpiredHoldsIfNeeded();

    const gridRows = await sql`
      SELECT value FROM settings WHERE key = 'grid_size' LIMIT 1
    `;

    const targetRows = await sql`
      SELECT value FROM settings WHERE key = 'default_target_amount' LIMIT 1
    `;

    const gridSize = Math.max(1, Number(gridRows?.[0]?.value || 100));
    const defaultTargetAmount = Math.max(1, Number(targetRows?.[0]?.value || 5000));

    const rows = await sql`
      WITH active_items AS (
        SELECT si.number, si.amount, s.status
        FROM submission_items si
        JOIN submissions s ON s.id = si.submission_id
        WHERE s.status IN ('pending', 'approved')

        UNION ALL

        SELECT
          n::int AS number,
          COALESCE(
            NULLIF(s.number_amounts ->> (n::text), '')::int,
            CASE
              WHEN array_length(s.numbers, 1) > 0
              THEN COALESCE(s.total_amount, 0) / array_length(s.numbers, 1)
              ELSE COALESCE(s.ticket_price, s.total_amount, 0)
            END
          )::int AS amount,
          s.status
        FROM submissions s
        CROSS JOIN LATERAL unnest(s.numbers) AS n
        WHERE s.status IN ('pending', 'approved')
          AND s.numbers IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM submission_items si
            WHERE si.submission_id = s.id AND si.number = n
          )

        UNION ALL

        SELECT
          s.number::int AS number,
          COALESCE(NULLIF(s.total_amount, 0), NULLIF(s.ticket_price, 0), 0)::int AS amount,
          s.status
        FROM submissions s
        WHERE s.status IN ('pending', 'approved')
          AND s.number IS NOT NULL
          AND (s.numbers IS NULL OR array_length(s.numbers, 1) IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM submission_items si WHERE si.submission_id = s.id
          )
      ),
      active_holds AS (
        SELECT key::int AS number, value::int AS amount
        FROM payment_holds h,
        LATERAL jsonb_each_text(
          CASE
            WHEN jsonb_typeof(h.number_amounts) = 'object'
            THEN h.number_amounts
            ELSE '{}'::jsonb
          END
        )
        WHERE h.status = 'active'
          AND h.expires_at > NOW()
      ),
      totals AS (
        SELECT
          number,
          COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::int AS approved_amount,
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::int AS pending_amount,
          COUNT(*)::int AS submission_count,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count
        FROM active_items
        GROUP BY number
      ),
      hold_totals AS (
        SELECT number, COALESCE(SUM(amount), 0)::int AS hold_amount
        FROM active_holds
        GROUP BY number
      )
      SELECT
        np.number,
        COALESCE(np.target_amount, ${defaultTargetAmount})::int AS target_amount,
        COALESCE(t.approved_amount, 0)::int AS current_amount,
        COALESCE(t.approved_amount, 0)::int AS approved_amount,
        COALESCE(t.pending_amount, 0)::int AS pending_amount,
        COALESCE(h.hold_amount, 0)::int AS hold_amount,
        (
          COALESCE(t.approved_amount, 0)
          + COALESCE(t.pending_amount, 0)
          + COALESCE(h.hold_amount, 0)
        )::int AS reserved_amount,
        CASE
          WHEN np.status = 'closed' THEN 0
          ELSE GREATEST(
            COALESCE(np.target_amount, ${defaultTargetAmount})
            - COALESCE(t.approved_amount, 0)
            - COALESCE(t.pending_amount, 0)
            - COALESCE(h.hold_amount, 0),
            0
          )
        END::int AS remaining,
        CASE
          WHEN np.status = 'closed'
            OR (
              COALESCE(t.approved_amount, 0)
              + COALESCE(t.pending_amount, 0)
              + COALESCE(h.hold_amount, 0)
            ) >= COALESCE(np.target_amount, ${defaultTargetAmount})
          THEN 'closed'
          ELSE 'open'
        END AS status,
        COALESCE(t.submission_count, 0)::int AS submission_count,
        COALESCE(t.approved_count, 0)::int AS approved_count
      FROM number_pools np
      LEFT JOIN totals t ON t.number = np.number
      LEFT JOIN hold_totals h ON h.number = np.number
      WHERE np.number BETWEEN 1 AND ${gridSize}
      ORDER BY np.number ASC
    `;

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error: any) {
    console.error("Admin numbers error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load numbers" },
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
