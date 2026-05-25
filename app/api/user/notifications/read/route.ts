export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireUser } from "@/lib/auth/server";

export async function PATCH(req: Request) {
  try {
    const user = requireUser(req);
    const userId = String(user.userId || user.id || "");
    const userPhone = String(user.phone || "");
    const body = await req.json().catch(() => ({}));

    const ids = Array.isArray(body.ids || body.submission_ids)
      ? (body.ids || body.submission_ids).map((id: any) => String(id)).filter(Boolean)
      : [];

    if (!userId && !userPhone) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    let rows;

    if (ids.length > 0) {
      rows = await sql`
        UPDATE submissions
        SET is_seen_by_user = TRUE,
            updated_at = NOW()
        WHERE status = 'approved'
          AND id::text = ANY(${ids})
          AND (
            (${userId} <> '' AND user_id::text = ${userId})
            OR (${userPhone} <> '' AND COALESCE(user_phone, '') = ${userPhone})
            OR (${userPhone} <> '' AND COALESCE(contact_phone, '') = ${userPhone})
          )
        RETURNING id
      `;
    } else {
      rows = await sql`
        UPDATE submissions
        SET is_seen_by_user = TRUE,
            updated_at = NOW()
        WHERE status = 'approved'
          AND COALESCE(is_seen_by_user, FALSE) = FALSE
          AND (
            (${userId} <> '' AND user_id::text = ${userId})
            OR (${userPhone} <> '' AND COALESCE(user_phone, '') = ${userPhone})
            OR (${userPhone} <> '' AND COALESCE(contact_phone, '') = ${userPhone})
          )
        RETURNING id
      `;
    }

    return NextResponse.json(
      { success: true, updated: rows.length },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (err: any) {
    console.error("Mark notifications read error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to mark notifications as read" },
      { status: err.message === "Unauthorized" ? 401 : 500 },
    );
  }
}
