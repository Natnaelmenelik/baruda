import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MESSAGE_SETTING_KEY = "dashboard_message";

type DashboardMessage = {
  id?: string;
  message?: string;
  createdAt?: string;
  expiresAt?: string;
};

function parseMessage(value: unknown): DashboardMessage | null {
  if (!value) return null;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;

    if (!parsed || typeof parsed !== "object") return null;
    if (typeof (parsed as any).message !== "string") return null;

    return parsed as DashboardMessage;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    await requireUser(req);

    const rows = await sql`
      SELECT value FROM settings
      WHERE key = ${MESSAGE_SETTING_KEY}
      LIMIT 1
    `;

    const message = parseMessage(rows?.[0]?.value);

    if (!message?.message || !message?.expiresAt) {
      return NextResponse.json({ message: null }, { headers: { "Cache-Control": "no-store" } });
    }

    const expiresAt = new Date(message.expiresAt).getTime();

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return NextResponse.json({ message: null }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      {
        message: {
          id: message.id || String(expiresAt),
          text: message.message,
          createdAt: message.createdAt || null,
          expiresAt: message.expiresAt,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load message" },
      {
        status:
          error?.message === "Unauthorized"
            ? 401
            : error?.message === "Forbidden"
              ? 403
              : 500,
      },
    );
  }
}
