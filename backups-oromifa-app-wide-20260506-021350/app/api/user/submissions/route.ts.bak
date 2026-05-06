export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireUser } from '@/lib/auth/server';

export async function GET(req: Request) {
  try {
    const user = requireUser(req);

    const submissions = await sql`
      SELECT
        CASE
          WHEN s.submission_type = 'group' AND s.submission_group_id IS NOT NULL
          THEN s.submission_group_id::text
          ELSE s.id::text
        END AS id,

        MAX(s.submission_group_id::text) AS submission_group_id,
        MAX(s.submission_type) AS submission_type,

        ARRAY_AGG(s.number ORDER BY s.number DESC) AS numbers,
        MIN(s.number)::int AS number,
        COUNT(*)::int AS quantity,

        MAX(s.receipt_url) AS receipt_url,
        MAX(s.receipt_key) AS receipt_key,

        CASE
          WHEN BOOL_OR(s.status = 'pending') THEN 'pending'
          WHEN BOOL_OR(s.status = 'approved') THEN 'approved'
          WHEN BOOL_OR(s.status = 'rejected') THEN 'rejected'
          ELSE MAX(s.status)
        END AS status,

        MIN(s.submitted_at) AS submitted_at,
        MAX(s.approved_at) AS approved_at,
        MAX(s.rejected_at) AS rejected_at,

        MAX(COALESCE(s.ticket_price, 100))::int AS ticket_price,
        MAX(COALESCE(s.total_amount, 0))::int AS total_amount

      FROM submissions s
      WHERE s.user_id = ${user.userId}
      GROUP BY
        CASE
          WHEN s.submission_type = 'group' AND s.submission_group_id IS NOT NULL
          THEN s.submission_group_id::text
          ELSE s.id::text
        END
      ORDER BY MIN(s.submitted_at) DESC
      LIMIT 200
    `;

    return NextResponse.json(submissions, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    console.error('User submissions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load submissions' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
