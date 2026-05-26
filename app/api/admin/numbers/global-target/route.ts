// REALTIME_REFRESH_POINT:
// After this route succeeds, the frontend action handler should refresh only affected data:
// settings update/global target -> settings-updated + numbers-updated
// dashboard message update      -> dashboard-message-refresh
// winner announcement update    -> winner-announcement-refresh

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const targetAmount = Number(
      body.targetAmount ?? body.target_amount ?? body.globalTargetAmount,
    );

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      return NextResponse.json({ error: "Invalid target amount" }, { status: 400 });
    }

    const settingRows = await sql`
      SELECT value FROM settings WHERE key = 'grid_size' LIMIT 1
    `;
    const gridSize = Math.max(1, Number(settingRows?.[0]?.value || 100));

    const blocked = await sql`
      WITH approved_totals AS (
        SELECT
          si.number,
          COALESCE(SUM(si.amount), 0)::int AS approved_amount
        FROM submission_items si
        JOIN submissions s ON s.id = si.submission_id
        WHERE s.status = 'approved'
          AND si.number BETWEEN 1 AND ${gridSize}
        GROUP BY si.number
      )
      SELECT
        np.number,
        COALESCE(at.approved_amount, 0)::int AS approved_amount
      FROM number_pools np
      LEFT JOIN approved_totals at ON at.number = np.number
      WHERE np.number BETWEEN 1 AND ${gridSize}
        AND COALESCE(at.approved_amount, 0) > ${targetAmount}
      ORDER BY np.number ASC
      LIMIT 20
    `;

    if (blocked.length > 0 && !body.force) {
      return NextResponse.json(
        {
          error: "Target amount is lower than approved contributions for some numbers",
          blocked,
        },
        { status: 400 },
      );
    }

    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('default_target_amount', ${String(targetAmount)}, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    const rows = await sql`
      WITH approved_totals AS (
        SELECT
          si.number,
          COALESCE(SUM(si.amount), 0)::int AS approved_amount
        FROM submission_items si
        JOIN submissions s ON s.id = si.submission_id
        WHERE s.status = 'approved'
          AND si.number BETWEEN 1 AND ${gridSize}
        GROUP BY si.number
      )
      UPDATE number_pools np
      SET
        target_amount = ${targetAmount},
        current_amount = COALESCE(at.approved_amount, 0),
        status = CASE
          WHEN COALESCE(at.approved_amount, 0) >= ${targetAmount}
          THEN 'sold'
          ELSE 'open'
        END,
        updated_at = NOW()
      FROM generate_series(1, ${gridSize}) AS gs(number)
      LEFT JOIN approved_totals at ON at.number = gs.number
      WHERE np.number = gs.number
      RETURNING np.number
    `;


    await sql`SELECT public.refresh_all_number_status_summary_cache()`;

    return NextResponse.json({ ok: true, targetAmount, updated: rows.length });
  } catch (error: any) {
    console.error("Global target update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update global target amount" },
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
