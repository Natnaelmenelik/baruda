import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_STATUSES = new Set(["all", "pending", "approved", "rejected"]);

function toPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const page = toPositiveInt(url.searchParams.get("page"), 1, 100000);
    const limit = toPositiveInt(url.searchParams.get("limit"), 20, 100);
    const offset = (page - 1) * limit;
    const requestedStatus = (url.searchParams.get("status") || "pending").toLowerCase();
    const status = VALID_STATUSES.has(requestedStatus) ? requestedStatus : "pending";
    const search = (url.searchParams.get("search") || "").trim();
    const searchLike = `%${search}%`;

    const countRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM submissions s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE (${status} = 'all' OR COALESCE(s.status, 'pending') = ${status})
        AND (
          ${search} = ''
          OR COALESCE(u.name, s.user_name, '') ILIKE ${searchLike}
          OR COALESCE(u.phone, s.user_phone, s.contact_phone, '') ILIKE ${searchLike}
          OR s.id::text ILIKE ${searchLike}
          OR s.submission_group_id::text ILIKE ${searchLike}
          OR EXISTS (
            SELECT 1
            FROM submission_items si_search
            WHERE si_search.submission_id = s.id
              AND si_search.number::text ILIKE ${searchLike}
          )
          OR s.number::text ILIKE ${searchLike}
        )
    `;

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rows = await sql`
      WITH item_data AS (
        SELECT
          si.submission_id,
          ARRAY_AGG(si.number ORDER BY si.created_at ASC, si.id ASC)::int[] AS item_numbers,
          COALESCE(SUM(si.amount), 0)::int AS item_total,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'number', si.number,
              'amount', si.amount
            )
            ORDER BY si.created_at ASC, si.id ASC
          ) AS items
        FROM submission_items si
        GROUP BY si.submission_id
      )
      SELECT
        s.id::text AS id,
        s.user_id::text AS user_id,
        COALESCE(u.name, s.user_name, 'Unknown') AS user_name,
        COALESCE(u.phone, s.user_phone, s.contact_phone, '-') AS user_phone,
        COALESCE(s.contact_phone, u.phone, s.user_phone, '-') AS contact_phone,

        COALESCE(
          idata.item_numbers,
          s.numbers,
          CASE
            WHEN s.number IS NOT NULL THEN ARRAY[s.number]::int[]
            ELSE ARRAY[]::int[]
          END
        ) AS numbers,

        s.number,
        COALESCE(idata.items, '[]'::json) AS items,
        COALESCE(idata.items, '[]'::json) AS submission_items,

        COALESCE(idata.item_total, s.total_amount, 0)::int AS total_amount,
        COALESCE(s.ticket_price, 0)::int AS ticket_price,

        s.receipt_url,
        s.receipt_key,
        CASE
          WHEN s.receipt_url IS NOT NULL AND s.receipt_url <> '' THEN true
          WHEN s.has_receipt IS TRUE THEN true
          ELSE false
        END AS has_receipt,

        COALESCE(s.status, 'pending') AS status,
        COALESCE(s.submission_type, 'single') AS submission_type,
        s.submission_group_id::text AS submission_group_id,
        s.number_amounts,
        COALESCE(s.submitted_at, s.created_at) AS submitted_at,
        s.approved_at,
        s.rejected_at
      FROM submissions s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN item_data idata ON idata.submission_id = s.id
      WHERE (${status} = 'all' OR COALESCE(s.status, 'pending') = ${status})
        AND (
          ${search} = ''
          OR COALESCE(u.name, s.user_name, '') ILIKE ${searchLike}
          OR COALESCE(u.phone, s.user_phone, s.contact_phone, '') ILIKE ${searchLike}
          OR s.id::text ILIKE ${searchLike}
          OR s.submission_group_id::text ILIKE ${searchLike}
          OR EXISTS (
            SELECT 1
            FROM submission_items si_search
            WHERE si_search.submission_id = s.id
              AND si_search.number::text ILIKE ${searchLike}
          )
          OR s.number::text ILIKE ${searchLike}
        )
      ORDER BY
        CASE COALESCE(s.status, 'pending')
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'rejected' THEN 2
          ELSE 3
        END ASC,
        COALESCE(s.submitted_at, s.created_at) DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return NextResponse.json(
      {
        submissions: rows,
        page,
        limit,
        total,
        totalPages,
        status,
        search,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error: any) {
    console.error("Admin submissions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load submissions" },
      {
        status:
          error.message === "Unauthorized"
            ? 401
            : error.message === "Forbidden"
              ? 403
              : 500,
      },
    );
  }
}
