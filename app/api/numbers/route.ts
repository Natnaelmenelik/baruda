import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { cleanupExpiredHoldsNow } from "@/lib/db/cleanupExpiredHolds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeRow(row: any) {
  const approved = Number(row.approved_amount || 0);
  const pending = Number(row.pending_amount || 0);
  const hold = Number(row.hold_amount || 0);
  const remaining = Number(row.remaining_amount || 0);
  const status = String(row.status || "open");

  return {
    number: Number(row.number),
    target_amount: Number(row.target_amount || 0),
    approved_amount: approved,
    pending_amount: pending,
    hold_amount: hold,
    sold_amount: Number(row.sold_amount ?? approved + pending + hold),
    current_amount: approved,
    remaining_amount: remaining,
    remaining,
    status: status === "sold" || status === "closed" ? "closed" : status === "pending" ? "pending" : "open",
    updated_at: row.updated_at,
  };
}

export async function GET() {
  try {
    // User-side numbers must not depend on the browser successfully calling DELETE /api/holds/:id.
    // Expire stale holds and refresh affected cache entries before reading number_status_summary_cache.
    await cleanupExpiredHoldsNow();

    let rows = await sql`
      SELECT
        number,
        target_amount,
        approved_amount,
        pending_amount,
        hold_amount,
        sold_amount,
        remaining_amount,
        status,
        updated_at
      FROM number_status_summary_cache
      ORDER BY number ASC
    `;

    // Safe fallback for first deploys where the SQL migration was not run yet or cache is empty.
    if (!rows.length) {
      try {
        await sql`SELECT public.refresh_all_number_status_summary_cache()`;
        rows = await sql`
          SELECT
            number,
            target_amount,
            approved_amount,
            pending_amount,
            hold_amount,
            sold_amount,
            remaining_amount,
            status,
            updated_at
          FROM number_status_summary_cache
          ORDER BY number ASC
        `;
      } catch (refreshError) {
        console.warn("number_status_summary_cache refresh fallback failed:", refreshError);
      }
    }

    return NextResponse.json(rows.map(normalizeRow), {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Numbers cache API error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to load numbers" },
      { status: 500 },
    );
  }
}
