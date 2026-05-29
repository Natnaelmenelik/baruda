import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MESSAGE_SETTING_KEY = "dashboard_message";
const BUCKET = process.env.SUPABASE_RECEIPTS_BUCKET || "receipts";
const MAX_IMAGES = 3;

type DashboardImage = {
  url?: string;
  key?: string;
};

type DashboardMessagePayload = {
  id?: string;
  message?: string;
  text?: string;
  images?: DashboardImage[];
  imageUrl?: string;
  imageKey?: string;
  createdAt?: string;
  expiresAt?: string;
};

function parseExisting(value: unknown): DashboardMessagePayload | null {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as DashboardMessagePayload;
  } catch {
    return null;
  }
}

function collectDashboardImageKeys(message: DashboardMessagePayload | null) {
  const keys = new Set<string>();

  if (message?.imageKey && message.imageKey.startsWith("dashboard-messages/")) {
    keys.add(message.imageKey);
  }

  for (const image of message?.images || []) {
    if (image?.key && image.key.startsWith("dashboard-messages/")) {
      keys.add(image.key);
    }
  }

  return Array.from(keys);
}

async function deleteOldDashboardImages(keys: string[]) {
  if (!keys.length) return;

  try {
    const supabase = createSupabaseAdminClient();
    await supabase.storage.from(BUCKET).remove(keys);
  } catch (error) {
    console.error("Failed to delete old dashboard images", error);
  }
}

function normalizeImages(input: unknown): Required<DashboardImage>[] {
  if (!Array.isArray(input)) return [];

  const normalized: Required<DashboardImage>[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const url = String((item as any).url || "").trim();
    const key = String((item as any).key || "").trim();

    if (!url || !key) continue;
    if (!key.startsWith("dashboard-messages/")) continue;

    normalized.push({ url, key });

    if (normalized.length >= MAX_IMAGES) break;
  }

  return normalized;
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || body?.text || "").trim();
    const images = normalizeImages(body?.images);

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 600) {
      return NextResponse.json({ error: "Message must be 600 characters or less" }, { status: 400 });
    }

    const oldRows = await sql`
      SELECT value FROM settings
      WHERE key = ${MESSAGE_SETTING_KEY}
      LIMIT 1
    `;

    const oldMessage = parseExisting(oldRows?.[0]?.value);
    const oldImageKeys = collectDashboardImageKeys(oldMessage);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const payload = {
      id: `${now.getTime()}`,
      message,
      images,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${MESSAGE_SETTING_KEY}, ${JSON.stringify(payload)}, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    await deleteOldDashboardImages(oldImageKeys);

    return NextResponse.json(
      { ok: true, message: payload },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to send message" },
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
