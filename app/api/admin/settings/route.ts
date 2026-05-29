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

async function applyTicketPriceAsGlobalTarget(
  gridSize: number,
  ticketPrice: number,
  force = false,
) {
  const safeGridSize = Math.max(1, Number(gridSize || 100));
  const safeTicketPrice = Math.max(1, Number(ticketPrice || 100));

  // Same safety check as Manage Numbers -> Global Target Amount.
  // If a number already has approved contributions greater than the new ticket price,
  // block the update unless force=true is explicitly sent.
  const blocked = await sql`
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
    SELECT
      number,
      approved_amount
    FROM approved_totals
    WHERE approved_amount > ${safeTicketPrice}
    ORDER BY number ASC
    LIMIT 20
  `;

  if (blocked.length > 0 && !force) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Ticket price is lower than approved contributions for some numbers",
          blocked,
        },
        { status: 400 },
      ),
    };
  }

  // Create missing rows up to grid size with the new ticket price as target_amount.
  await sql`
    INSERT INTO number_pools (number, target_amount, current_amount, status, updated_at)
    SELECT gs, ${safeTicketPrice}, 0, 'open', NOW()
    FROM generate_series(1, ${safeGridSize}) gs
    ON CONFLICT (number) DO NOTHING
  `;

  // Remove rows above new grid size so the grid follows the admin setting.
  await sql`
    DELETE FROM number_pools
    WHERE number > ${safeGridSize}
  `;

  // EXACT Global Target behavior for Ticket Price:
  // update every number's target_amount to the ticket price,
  // recalculate approved current_amount,
  // and update sold/open status from the new target.
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
      target_amount = ${safeTicketPrice},
      current_amount = COALESCE(at.approved_amount, 0),
      status = CASE
        WHEN COALESCE(at.approved_amount, 0) >= ${safeTicketPrice}
        THEN 'sold'
        ELSE 'open'
      END,
      updated_at = NOW()
    FROM generate_series(1, ${safeGridSize}) AS gs(number)
    LEFT JOIN approved_totals at ON at.number = gs.number
    WHERE np.number = gs.number
  `;

  // Keep the number status cache in sync with number_pools.
  await sql`SELECT public.refresh_all_number_status_summary_cache()`;

  return { ok: true as const };
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

  if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
    return NextResponse.json({ error: "Invalid ticket price" }, { status: 400 });
  }

  if (!Number.isInteger(gridSize) || gridSize <= 0) {
    return NextResponse.json({ error: "Invalid grid size" }, { status: 400 });
  }

  // IMPORTANT:
  // Do NOT update settings.default_target_amount here.
  // Ticket Price should behave like Global Target Amount for number_pools/cache,
  // but it should only save settings.ticket_price and settings.grid_size.
  const result = await applyTicketPriceAsGlobalTarget(
    gridSize,
    ticketPrice,
    Boolean(body.force),
  );

  if (!result.ok) {
    return result.response;
  }

  await upsertSetting("ticket_price", String(ticketPrice));
  await upsertSetting("grid_size", String(gridSize));

  const defaultTargetAmount = await getSetting("default_target_amount", "5000");

  return NextResponse.json({
    ok: true,
    ticketPrice,
    ticket_price: ticketPrice,
    gridSize,
    grid_size: gridSize,
    defaultTargetAmount: Number(defaultTargetAmount),
    default_target_amount: Number(defaultTargetAmount),
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
