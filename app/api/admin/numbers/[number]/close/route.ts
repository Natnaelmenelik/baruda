import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ number: string }> }
) {
  try {
    await requireAdmin(req);

    const resolvedParams = await context.params;
    const number = Number(resolvedParams.number);

    if (!Number.isInteger(number) || number <= 0) {
      return NextResponse.json({ error: "Invalid number" }, { status: 400 });
    }

    await sql`
      UPDATE number_pools
      SET status = 'closed', updated_at = NOW()
      WHERE number = ${number}
    `;

    return NextResponse.json({ ok: true, number, status: "closed" });
  } catch (error: any) {
    console.error("Close number error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to close number" },
      { status: error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500 }
    );
  }
}
