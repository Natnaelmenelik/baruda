import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function clearRound(req: Request) {
  await requireAdmin(req);

  const gridRows = await sql`
    SELECT value FROM settings WHERE key = 'grid_size' LIMIT 1
  `;

  const targetRows = await sql`
    SELECT value FROM settings WHERE key = 'default_target_amount' LIMIT 1
  `;

  const gridSize = Math.max(1, Number(gridRows?.[0]?.value || 100));
  const defaultTargetAmount = Math.max(1, Number(targetRows?.[0]?.value || 5000));

  // Mark all existing submissions as historical/cleared.
  // This keeps receipt history in DB but removes them from active round logic.
  await sql`
    UPDATE submissions
    SET
      status = 'cleared_round',
      approved_at = NULL,
      rejected_at = NULL,
      updated_at = NOW()
    WHERE status IS DISTINCT FROM 'cleared_round'
  `;

  // Fully reset number pools for the active grid.
  await sql`
    DELETE FROM number_pools
    WHERE number > ${gridSize}
  `;

  await sql`
    INSERT INTO number_pools (
      number,
      target_amount,
      current_amount,
      status,
      updated_at
    )
    SELECT
      gs,
      ${defaultTargetAmount},
      0,
      'open',
      NOW()
    FROM generate_series(1, ${gridSize}) gs
    ON CONFLICT (number)
    DO UPDATE SET
      target_amount = EXCLUDED.target_amount,
      current_amount = 0,
      status = 'open',
      updated_at = NOW()
  `;

  return NextResponse.json(
    {
      ok: true,
      message: "New round started",
      gridSize,
      targetAmount: defaultTargetAmount,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function POST(req: Request) {
  try {
    return await clearRound(req);
  } catch (error: any) {
    console.error("Clear round error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear round" },
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

export async function DELETE(req: Request) {
  try {
    return await clearRound(req);
  } catch (error: any) {
    console.error("Clear round error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear round" },
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
