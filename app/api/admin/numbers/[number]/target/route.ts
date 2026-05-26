import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  context: { params: Promise<{ number: string }> }
) {
  try {
    await requireAdmin(req);

    const resolvedParams = await context.params;
    const number = Number(resolvedParams.number);
    const body = await req.json().catch(() => ({}));
    const targetAmount = Number(body.targetAmount || body.target_amount);

    if (!Number.isInteger(number) || number <= 0) {
      return NextResponse.json({ error: "Invalid number" }, { status: 400 });
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      return NextResponse.json({ error: "Invalid target amount" }, { status: 400 });
    }

    const rows = await sql`
      SELECT current_amount, status
      FROM number_pools
      WHERE number = ${number}
      LIMIT 1
    `;

    const currentAmount = Number(rows?.[0]?.current_amount || 0);

    if (rows?.[0]?.status === "sold" || rows?.[0]?.status === "closed") {
      return NextResponse.json(
        { error: "Closed number target cannot be edited" },
        { status: 400 }
      );
    }

    if (targetAmount < currentAmount) {
      return NextResponse.json(
        { error: "Target cannot be less than current amount" },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO number_pools (number, target_amount, current_amount, status, updated_at)
      VALUES (${number}, ${targetAmount}, 0, 'open', NOW())
      ON CONFLICT (number)
      DO UPDATE SET
        target_amount = ${targetAmount},
        status = CASE
          WHEN number_pools.current_amount >= ${targetAmount} THEN 'sold'
          ELSE 'open'
        END,
        updated_at = NOW()
    `;


    await sql`SELECT public.refresh_number_status_summary_cache(${number}::int)`;

    return NextResponse.json({ ok: true, number, targetAmount });
  } catch (error: any) {
    console.error("Update number target error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update target" },
      { status: error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500 }
    );
  }
}
