// REALTIME_REFRESH_POINT:
// After this route succeeds, the frontend action handler should refresh only affected data:
// settings update/global target -> settings-updated + numbers-updated
// dashboard message update      -> dashboard-message-refresh
// winner announcement update    -> winner-announcement-refresh

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

function parseWinnerNumber(value: any) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));

    const firstNumber = parseWinnerNumber(body.firstNumber ?? body.first_number);
    const secondNumber = parseWinnerNumber(body.secondNumber ?? body.second_number);
    const thirdNumber = parseWinnerNumber(body.thirdNumber ?? body.third_number);

    if (!firstNumber || !secondNumber || !thirdNumber) {
      return NextResponse.json(
        { error: "Please enter valid 1st, 2nd, and 3rd winner numbers." },
        { status: 400 },
      );
    }

    const rows = await sql`
      INSERT INTO winner_announcements (
        first_number,
        second_number,
        third_number,
        expires_at,
        created_at
      )
      VALUES (
        ${firstNumber},
        ${secondNumber},
        ${thirdNumber},
        NOW() + INTERVAL '24 hours',
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json(
      { success: true, announcement: rows[0] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (err: any) {
    console.error("Publish winner announcement error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to publish winner announcement" },
      {
        status:
          err.message === "Forbidden"
            ? 403
            : err.message === "Unauthorized"
              ? 401
              : 500,
      },
    );
  }
}
