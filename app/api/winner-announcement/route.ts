export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id,
        first_number,
        second_number,
        third_number,
        expires_at,
        created_at
      FROM winner_announcements
      WHERE expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return NextResponse.json(
      { announcement: rows[0] || null },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (err: any) {
    console.error("Winner announcement fetch error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load winner announcement" },
      { status: 500 },
    );
  }
}
