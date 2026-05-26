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

    const rows = await sql`
      UPDATE number_pools
      SET status = 'open', updated_at = NOW()
      WHERE number = ${number}
      RETURNING number, status
    `;

    if (!rows?.length) {
      return NextResponse.json({ error: "Number not found" }, { status: 404 });
    }

    await sql`SELECT public.refresh_number_status_summary_cache(${number}::int)`
      .catch(() => null);

    return NextResponse.json({ ok: true, number, status: "open" });
  } catch (error: any) {
    console.error("Unclose number error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to unclose number" },
      { status: error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500 }
    );
  }
}
