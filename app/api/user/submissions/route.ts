export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireUser } from "@/lib/auth/server";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const userId = user.userId || user.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql`
      WITH user_submissions AS (
        SELECT *
        FROM submissions
        WHERE user_id = ${userId}
      ),
      unified_items AS (
        -- Normalized pooled items.
        SELECT
          si.submission_id,
          si.number,
          si.amount
        FROM submission_items si
        JOIN user_submissions s ON s.id = si.submission_id

        UNION ALL

        -- Missing array items fallback. This handles submissions where
        -- submissions.numbers has all numbers but submission_items is partial.
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
        FROM user_submissions s
        CROSS JOIN LATERAL unnest(s.numbers) AS n
        WHERE s.numbers IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM submission_items si
            WHERE si.submission_id = s.id
              AND si.number = n
          )

        UNION ALL

        -- Old single-number submissions fallback.
        SELECT
          s.id AS submission_id,
          s.number::int AS number,
          COALESCE(NULLIF(s.total_amount, 0), NULLIF(s.ticket_price, 0), 0)::int AS amount
        FROM user_submissions s
        WHERE s.number IS NOT NULL
          AND (s.numbers IS NULL OR array_length(s.numbers, 1) IS NULL)
          AND NOT EXISTS (
            SELECT 1
            FROM submission_items si
            WHERE si.submission_id = s.id
          )
      ),
      submission_rows AS (
        SELECT
          s.*,
          CASE
            WHEN s.submission_type = 'group' AND s.submission_group_id IS NOT NULL
            THEN s.submission_group_id::text
            ELSE s.id::text
          END AS group_key
        FROM user_submissions s
      ),
      grouped AS (
        SELECT
          sr.group_key AS id,
          MIN(sr.id::text) AS primary_submission_id,
          MAX(sr.submission_group_id::text) AS submission_group_id,
          MAX(COALESCE(sr.submission_type, 'single')) AS submission_type,

          ARRAY_AGG(ui.number ORDER BY COALESCE(sr.submitted_at, sr.created_at), ui.number) AS numbers,

          JSON_AGG(
            JSON_BUILD_OBJECT(
              'number', ui.number,
              'amount', ui.amount
            )
            ORDER BY COALESCE(sr.submitted_at, sr.created_at), ui.number
          ) AS items,

          COALESCE(SUM(ui.amount), MAX(COALESCE(sr.total_amount, 0)), 0)::int AS total_amount,
          MAX(COALESCE(sr.ticket_price, 0))::int AS ticket_price,

          MAX(sr.receipt_url) AS receipt_url,
          MAX(sr.receipt_key) AS receipt_key,

          CASE
            WHEN BOOL_OR(sr.status = 'pending') THEN 'pending'
            WHEN BOOL_OR(sr.status = 'approved') THEN 'approved'
            WHEN BOOL_OR(sr.status = 'rejected') THEN 'rejected'
            ELSE MAX(COALESCE(sr.status, 'pending'))
          END AS status,

          MIN(COALESCE(sr.submitted_at, sr.created_at)) AS submitted_at,
          MAX(sr.approved_at) AS approved_at,
          MAX(sr.rejected_at) AS rejected_at
        FROM submission_rows sr
        LEFT JOIN unified_items ui ON ui.submission_id = sr.id
        GROUP BY sr.group_key
      )
      SELECT
        id,
        primary_submission_id,
        submission_group_id,
        submission_type,
        COALESCE(numbers, ARRAY[]::int[]) AS numbers,
        COALESCE(items, '[]'::json) AS items,
        COALESCE(items, '[]'::json) AS submission_items,
        total_amount,
        ticket_price,
        receipt_url,
        receipt_key,
        CASE
          WHEN receipt_url IS NOT NULL AND receipt_url <> '' THEN true
          ELSE false
        END AS has_receipt,
        status,
        submitted_at,
        approved_at,
        rejected_at
      FROM grouped
      ORDER BY submitted_at DESC
      LIMIT 200
    `;

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("User submissions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load purchases" },
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
