export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireUser } from "@/lib/auth/server";

export async function GET(req: Request) {
  try {
    const user = requireUser(req);
    const userId = String(user.userId || user.id || "");
    const userPhone = String(user.phone || "");

    if (!userId && !userPhone) {
      return NextResponse.json({ notifications: [] });
    }

    /*
      Latest approval only:
      - Do not show old previous approvals.
      - Show the most recently approved unseen submission for this user.
      - If admin sends a submission back to pending then approves again,
        approved_at/updated_at makes it the latest again.
    */
    const rows = await sql`
      SELECT
        id,
        number,
        numbers,
        total_amount,
        ticket_price,
        number_amounts,
        status,
        approved_at,
        updated_at,
        submitted_at
      FROM submissions
      WHERE status = 'approved'
        AND COALESCE(is_seen_by_user, FALSE) = FALSE
        AND (
          (${userId} <> '' AND user_id::text = ${userId})
          OR (${userPhone} <> '' AND COALESCE(user_phone, '') = ${userPhone})
          OR (${userPhone} <> '' AND COALESCE(contact_phone, '') = ${userPhone})
        )
      ORDER BY approved_at DESC NULLS LAST, updated_at DESC
      LIMIT 1
    `;

    return NextResponse.json(
      { notifications: rows },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (err: any) {
    console.error("User notifications error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load notifications" },
      { status: err.message === "Unauthorized" ? 401 : 500 },
    );
  }
}
