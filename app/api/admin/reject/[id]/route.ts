export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);

    const id = params.id;

    const target = await sql`
      SELECT id, user_id, submission_type, submission_group_id, receipt_key, receipt_url
      FROM submissions
      WHERE id::text = ${id}
         OR submission_group_id::text = ${id}
      LIMIT 1
    `;

    if (!target.length) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const sub = target[0];

    const updated = await sql`
      UPDATE submissions
      SET status = 'rejected',
          rejected_at = NOW(),
          approved_at = NULL
      WHERE
        id = ${sub.id}
        OR (
          ${sub.submission_group_id}::uuid IS NOT NULL
          AND submission_group_id = ${sub.submission_group_id}
        )
        OR (
          user_id = ${sub.user_id}
          AND ${sub.receipt_key}::text IS NOT NULL
          AND ${sub.receipt_key}::text <> ''
          AND receipt_key = ${sub.receipt_key}
        )
        OR (
          user_id = ${sub.user_id}
          AND ${sub.receipt_url}::text IS NOT NULL
          AND ${sub.receipt_url}::text <> ''
          AND receipt_url = ${sub.receipt_url}
        )
      RETURNING id, number, status
    `;

    return NextResponse.json({
      success: true,
      numbers: updated.map((row: any) => row.number),
      submissions: updated,
    });
  } catch (error: any) {
    console.error('Reject error:', error);
    return NextResponse.json(
      { error: error.message || 'Reject failed' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}
