import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MESSAGE_SETTING_KEY = "dashboard_message";

type DashboardMessage = {
  id: string;
  text: string;
  createdAt?: string | null;
  expiresAt?: string | null;
};

function parseDashboardMessage(value: unknown): DashboardMessage | null {
  if (!value) return null;

  const raw = typeof value === "string" ? value.trim() : value;
  if (!raw) return null;

  let parsed: any = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        id: `dashboard-message:${raw}`,
        text: raw,
        createdAt: null,
        expiresAt: null,
      };
    }
  }

  if (!parsed || typeof parsed !== "object") return null;

  const text = String(parsed.message || parsed.text || "").trim();
  if (!text) return null;

  const expiresAt = parsed.expiresAt || parsed.expires_at || null;

  if (expiresAt) {
    const expiresMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return null;
  }

  return {
    id: String(parsed.id || parsed.createdAt || parsed.created_at || expiresAt || `dashboard-message:${text}`),
    text,
    createdAt: parsed.createdAt || parsed.created_at || null,
    expiresAt,
  };
}

function normalizeWinnerAnnouncement(row: any) {
  if (!row?.id) return null;

  if (row.expires_at) {
    const expiresMs = new Date(row.expires_at).getTime();
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) return null;
  }

  return row;
}

export async function GET(req: Request) {
  try {
    let user: any = null;

    try {
      user = await requireUser(req);
    } catch {
      user = null;
    }

    const dashboardMessagePromise = sql`
      SELECT value, updated_at
      FROM settings
      WHERE key = ${MESSAGE_SETTING_KEY}
      LIMIT 1
    `;

    const winnerPromise = sql`
      SELECT
        id,
        first_number,
        second_number,
        third_number,
        expires_at,
        created_at
      FROM winner_announcements
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const approvedPromise = user?.id
      ? sql`
          SELECT
            s.id,
            s.submission_group_id,
            s.status,
            s.total_amount,
            s.approved_at,
            s.created_at,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'number', si.number,
                  'amount', si.amount
                )
                ORDER BY si.number
              ) FILTER (WHERE si.id IS NOT NULL),
              '[]'::jsonb
            ) AS items
          FROM submissions s
          LEFT JOIN submission_items si ON si.submission_id = s.id
          WHERE s.user_id = ${user.id}
            AND s.status = 'approved'
            AND COALESCE(s.is_seen_by_user, false) = false
          GROUP BY s.id
          ORDER BY s.approved_at DESC NULLS LAST, s.created_at DESC
          LIMIT 3
        `
      : Promise.resolve([]);

    const [dashboardMessageRows, winnerRows, approvedRows] = await Promise.all([
      dashboardMessagePromise,
      winnerPromise,
      approvedPromise,
    ]);

    const dashboardMessage = parseDashboardMessage(dashboardMessageRows?.[0]?.value);
    const winnerAnnouncement = normalizeWinnerAnnouncement(winnerRows?.[0] ?? null);

    const approvedNumberMessages = (approvedRows || []).map((approved: any) => {
      const items = approved.items || [];
      return {
        id: approved.id,
        submission_group_id: approved.submission_group_id,
        status: approved.status,
        total_amount: approved.total_amount,
        approved_at: approved.approved_at,
        created_at: approved.created_at,
        items,
        numbers: items.map((item: any) => item.number),
        message: "Your selected number has been approved.",
      };
    });

    return NextResponse.json(
      {
        dashboardMessage,
        winnerAnnouncement,
        approvedNumberMessage: approvedNumberMessages[0] || null,
        approvedNumberMessages,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/dashboard/announcements failed:", error);

    return NextResponse.json(
      { error: "Failed to load dashboard announcements" },
      { status: 500 },
    );
  }
}
