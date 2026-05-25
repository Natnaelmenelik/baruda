import { NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const client = await pool.connect();

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Hold id is required" }, { status: 400 });
    }

    const rows = await client.query(
      `
      UPDATE payment_holds
      SET
        status = CASE
          WHEN status = 'active' AND expires_at <= NOW()
          THEN 'expired'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id::text = $1
      RETURNING *
      `,
      [id],
    );

    if (!rows.rows.length) {
      return NextResponse.json({ error: "Hold not found" }, { status: 404 });
    }

    return NextResponse.json(rows.rows[0], {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load hold" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const client = await pool.connect();

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Hold id is required" }, { status: 400 });
    }

    await client.query("BEGIN");

    const affectedRows = await client.query(
      `
      SELECT COALESCE(array_agg(DISTINCT phi.number ORDER BY phi.number), '{}'::integer[]) AS numbers
      FROM payment_holds ph
      LEFT JOIN payment_hold_items phi ON phi.hold_id = ph.id
      WHERE ph.id::text = $1
      `,
      [id],
    );

    const affectedNumbers: number[] = affectedRows.rows?.[0]?.numbers || [];

    const rows = await client.query(
      `
      UPDATE payment_holds
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id::text = $1
        AND status = 'active'
      RETURNING id, client_hold_key, numbers, status, updated_at
      `,
      [id],
    );

    const hold = rows.rows?.[0] || null;

    if (affectedNumbers.length) {
      await client.query(
        "SELECT public.refresh_number_status_summary_cache_many($1::integer[])",
        [affectedNumbers],
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        ok: true,
        hold,
        numbers: affectedNumbers,
        action: "hold_released",
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    return NextResponse.json(
      { error: error.message || "Failed to cancel hold" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
