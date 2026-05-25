import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeStatus(value: string | null) {
  const status = String(value || "all").toLowerCase();
  return ["all", "pending", "approved", "rejected"].includes(status) ? status : "all";
}

function normalizePage(value: string | null) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeLimit(value: string | null) {
  const limit = Number(value || 20);
  if (!Number.isInteger(limit) || limit <= 0) return 20;
  return Math.min(limit, 100);
}

function normalizeNumber(value: string | null) {
  if (!value || !String(value).trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const page = normalizePage(url.searchParams.get("page"));
    const limit = normalizeLimit(url.searchParams.get("limit"));
    const offset = (page - 1) * limit;
    const status = normalizeStatus(url.searchParams.get("status"));
    const number = normalizeNumber(url.searchParams.get("number"));
    const search = String(url.searchParams.get("search") || "").trim();

    const countRows = await sql`
      WITH unified_items AS (
        SELECT si.submission_id, si.number, si.amount
        FROM submission_items si

        UNION ALL

        SELECT
          s.id AS submission_id,
          n::int AS number,
          COALESCE(
            NULLIF(s.number_amounts ->> (n::text), '')::int,
            CASE
              WHEN array_length(s.numbers, 1) > 0
              THEN COALESCE(s.total_amount, 0) / array_length(s.numbers, 1)
              ELSE COALESCE(s.ticket_price, s.total_amount, 0)
            END
          )::int AS amount
        FROM submissions s
        CROSS JOIN LATERAL unnest(s.numbers) AS n
        WHERE s.numbers IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM submission_items si
            WHERE si.submission_id = s.id AND si.number = n
          )

        UNION ALL

        SELECT
          s.id AS submission_id,
          s.number::int AS number,
          COALESCE(NULLIF(s.total_amount, 0), NULLIF(s.ticket_price, 0), 0)::int AS amount
        FROM submissions s
        WHERE s.number IS NOT NULL
          AND (s.numbers IS NULL OR array_length(s.numbers, 1) IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM submission_items si WHERE si.submission_id = s.id
          )
      ), filtered_items AS (
        SELECT
          ui.number,
          ui.amount,
          s.id::text AS submission_id,
          s.status,
          COALESCE(s.submitted_at, s.created_at) AS submitted_at,
          s.receipt_url,
          COALESCE(u.name, s.user_name, 'Unknown') AS user_name,
          COALESCE(u.phone, s.user_phone, s.contact_phone, '-') AS user_phone
        FROM unified_items ui
        JOIN submissions s ON s.id = ui.submission_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE (${status} = 'all' OR LOWER(COALESCE(s.status, '')) = ${status})
          AND (${number}::int IS NULL OR ui.number = ${number}::int)
          AND (
            ${search} = ''
            OR ui.number::text ILIKE '%' || ${search} || '%'
            OR s.id::text ILIKE '%' || ${search} || '%'
            OR COALESCE(u.name, s.user_name, '') ILIKE '%' || ${search} || '%'
            OR COALESCE(u.phone, s.user_phone, s.contact_phone, '') ILIKE '%' || ${search} || '%'
          )
      )
      SELECT COUNT(*)::int AS total
      FROM filtered_items
    `;

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    const rows = await sql`
      WITH unified_items AS (
        SELECT si.submission_id, si.number, si.amount
        FROM submission_items si

        UNION ALL

        SELECT
          s.id AS submission_id,
          n::int AS number,
          COALESCE(
            NULLIF(s.number_amounts ->> (n::text), '')::int,
            CASE
              WHEN array_length(s.numbers, 1) > 0
              THEN COALESCE(s.total_amount, 0) / array_length(s.numbers, 1)
              ELSE COALESCE(s.ticket_price, s.total_amount, 0)
            END
          )::int AS amount
        FROM submissions s
        CROSS JOIN LATERAL unnest(s.numbers) AS n
        WHERE s.numbers IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM submission_items si
            WHERE si.submission_id = s.id AND si.number = n
          )

        UNION ALL

        SELECT
          s.id AS submission_id,
          s.number::int AS number,
          COALESCE(NULLIF(s.total_amount, 0), NULLIF(s.ticket_price, 0), 0)::int AS amount
        FROM submissions s
        WHERE s.number IS NOT NULL
          AND (s.numbers IS NULL OR array_length(s.numbers, 1) IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM submission_items si WHERE si.submission_id = s.id
          )
      ), filtered_items AS (
        SELECT
          ui.number,
          ui.amount,
          s.id::text AS submission_id,
          s.status,
          COALESCE(s.submitted_at, s.created_at) AS submitted_at,
          s.receipt_url,
          COALESCE(u.name, s.user_name, 'Unknown') AS user_name,
          COALESCE(u.phone, s.user_phone, s.contact_phone, '-') AS user_phone
        FROM unified_items ui
        JOIN submissions s ON s.id = ui.submission_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE (${status} = 'all' OR LOWER(COALESCE(s.status, '')) = ${status})
          AND (${number}::int IS NULL OR ui.number = ${number}::int)
          AND (
            ${search} = ''
            OR ui.number::text ILIKE '%' || ${search} || '%'
            OR s.id::text ILIKE '%' || ${search} || '%'
            OR COALESCE(u.name, s.user_name, '') ILIKE '%' || ${search} || '%'
            OR COALESCE(u.phone, s.user_phone, s.contact_phone, '') ILIKE '%' || ${search} || '%'
          )
      )
      SELECT *
      FROM filtered_items
      ORDER BY number ASC, submitted_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return NextResponse.json(
      {
        selections: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasPrev: page > 1,
          hasNext: page < totalPages,
        },
        filters: { status, number, search },
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error: any) {
    console.error("Admin number selections error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load selections" },
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
