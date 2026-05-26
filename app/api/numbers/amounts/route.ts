import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeRow(row: any) {
  const approved = Number(row.approved_amount || 0);
  const pending = Number(row.pending_amount || 0);
  const hold = Number(row.hold_amount || 0);
  const remaining = Number(row.remaining_amount || 0);

  return {
    number: Number(row.number),
    target_amount: Number(row.target_amount || 0),
    approved_amount: approved,
    pending_amount: pending,
    hold_amount: hold,
    sold_amount: Number(row.sold_amount ?? approved + pending + hold),
    remaining_amount: remaining,
    remaining,
    status: row.status === "sold" ? "closed" : row.status,
    updated_at: row.updated_at,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseReadClient();

    const { data, error } = await supabase
      .from("number_status_summary_cache")
      .select(
        "number,target_amount,approved_amount,pending_amount,hold_amount,sold_amount,remaining_amount,status,updated_at",
      )
      .order("number", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data || []).map(normalizeRow);

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Number amounts Supabase REST error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to load number amounts" },
      { status: 500 },
    );
  }
}
