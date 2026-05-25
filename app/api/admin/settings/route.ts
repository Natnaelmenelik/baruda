// REALTIME_REFRESH_POINT:
// After this route succeeds, the frontend action handler should refresh only affected data:
// settings update/global target -> settings-updated + numbers-updated
// dashboard message update      -> dashboard-message-refresh
// winner announcement update    -> winner-announcement-refresh

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getSetting(key: string, fallback: string) {
  const rows = await sql`
    SELECT value FROM settings WHERE key = ${key} LIMIT 1
  `;
  return rows?.[0]?.value ?? fallback;
}

async function upsertSetting(key: string, value: string) {
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

async function syncNumberPools(gridSize: number, defaultTargetAmount: number) {
  const safeGridSize = Math.max(1, Number(gridSize || 100));
  const safeTarget = Math.max(1, Number(defaultTargetAmount || 5000));

  // Create missing rows up to grid size.
  await sql`
    INSERT INTO number_pools (number, target_amount, current_amount, status, updated_at)
    SELECT gs, ${safeTarget}, 0, 'open', NOW()
    FROM generate_series(1, ${safeGridSize}) gs
    ON CONFLICT (number) DO NOTHING
  `;

  // Remove rows above new grid size so Manage Numbers follows the admin setting.
  await sql`
    DELETE FROM number_pools
    WHERE number > ${safeGridSize}
  `;

  // Recalculate current_amount from approved contribution items.
  await sql`
    WITH approved_totals AS (
      SELECT
        si.number,
        COALESCE(SUM(si.amount), 0)::int AS approved_amount
      FROM submission_items si
      JOIN submissions s ON s.id = si.submission_id
      WHERE s.status = 'approved'
        AND si.number BETWEEN 1 AND ${safeGridSize}
      GROUP BY si.number
    )
    UPDATE number_pools np
    SET
      current_amount = COALESCE(at.approved_amount, 0),
      status = CASE
        WHEN COALESCE(at.approved_amount, 0) >= COALESCE(np.target_amount, ${safeTarget})
        THEN 'closed'
        ELSE 'open'
      END,
      updated_at = NOW()
    FROM approved_totals at
    WHERE np.number = at.number
  `;

  // Reset rows with no approved contribution.
  await sql`
    UPDATE number_pools np
    SET
      current_amount = 0,
      status = CASE
        WHEN np.status = 'closed' THEN 'closed'
        ELSE 'open'
      END,
      updated_at = NOW()
    WHERE np.number BETWEEN 1 AND ${safeGridSize}
      AND NOT EXISTS (
        SELECT 1
        FROM submission_items si
        JOIN submissions s ON s.id = si.submission_id
        WHERE si.number = np.number
          AND s.status = 'approved'
      )
  `;
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const ticketPrice = await getSetting("ticket_price", "100");
    const gridSize = await getSetting("grid_size", "100");
    const defaultTargetAmount = await getSetting("default_target_amount", "5000");

    return NextResponse.json({
      ticketPrice: Number(ticketPrice),
      ticket_price: Number(ticketPrice),
      gridSize: Number(gridSize),
      grid_size: Number(gridSize),
      defaultTargetAmount: Number(defaultTargetAmount),
      default_target_amount: Number(defaultTargetAmount),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load settings" },
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

async function saveSettings(req: Request) {
  await requireAdmin(req);

  const body = await req.json().catch(() => ({}));

  const ticketPrice = Number(
    body.ticketPrice ?? body.ticket_price ?? body.price ?? 100,
  );

  const gridSize = Number(
    body.gridSize ?? body.grid_size ?? body.numberGridSize ?? body.numbersGridSize ?? 100,
  );

  const defaultTargetAmount = Number(
    body.defaultTargetAmount ??
      body.default_target_amount ??
      body.targetAmount ??
      body.target_amount ??
      5000,
  );

  if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
    return NextResponse.json({ error: "Invalid ticket price" }, { status: 400 });
  }

  if (!Number.isInteger(gridSize) || gridSize <= 0) {
    return NextResponse.json({ error: "Invalid grid size" }, { status: 400 });
  }

  if (!Number.isFinite(defaultTargetAmount) || defaultTargetAmount <= 0) {
    return NextResponse.json({ error: "Invalid target amount" }, { status: 400 });
  }

  await upsertSetting("ticket_price", String(ticketPrice));
  await upsertSetting("grid_size", String(gridSize));
  await upsertSetting("default_target_amount", String(defaultTargetAmount));

  await syncNumberPools(gridSize, defaultTargetAmount);

  return NextResponse.json({
    ok: true,
    ticketPrice,
    ticket_price: ticketPrice,
    gridSize,
    grid_size: gridSize,
    defaultTargetAmount,
    default_target_amount: defaultTargetAmount,
  });
}

export async function POST(req: Request) {
  try {
    return await saveSettings(req);
  } catch (error: any) {
    console.error("Save admin settings error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save settings" },
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

export async function PUT(req: Request) {
  try {
    return await saveSettings(req);
  } catch (error: any) {
    console.error("Update admin settings error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update settings" },
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
