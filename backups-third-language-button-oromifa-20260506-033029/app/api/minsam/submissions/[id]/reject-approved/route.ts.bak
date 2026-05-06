export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin(req);
    const id = params.id;

    const target = await sql`
      SELECT id, submission_group_id, status
      FROM submissions
      WHERE id::text = ${id}
         OR submission_group_id::text = ${id}
      LIMIT 1
    `;

    if (!target.length) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    const sub = target[0];

    if (sub.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved submissions can be changed to rejected.' },
        { status: 400 }
      );
    }

    const targetRows = await sql`
      SELECT id, number
      FROM submissions
      WHERE
        id = ${sub.id}
        OR (
          ${sub.submission_group_id}::uuid IS NOT NULL
          AND submission_group_id = ${sub.submission_group_id}
        )
    `;

    const numbers = targetRows
      .map((row: any) => Number(row.number))
      .filter((num: number) => Number.isFinite(num));

    if (!numbers.length) {
      return NextResponse.json(
        { error: 'No numbers found for this submission.' },
        { status: 400 }
      );
    }

    /*
      Important:
      Your database has a unique constraint like UNIQUE(number, status).
      If another rejected row already exists for the same number, updating
      approved -> rejected will fail.

      To make the approved row become rejected and make the number free,
      we first remove older rejected duplicate rows for the same number(s).
    */
    await sql`
      DELETE FROM submissions
      WHERE number = ANY(${numbers}::int[])
        AND status = 'rejected'
        AND NOT (
          id = ${sub.id}
          OR (
            ${sub.submission_group_id}::uuid IS NOT NULL
            AND submission_group_id = ${sub.submission_group_id}
          )
        )
    `;

    const updated = await sql`
      UPDATE submissions
      SET
        status = 'rejected',
        rejected_at = NOW(),
        approved_at = NULL
      WHERE
        (
          id = ${sub.id}
          OR (
            ${sub.submission_group_id}::uuid IS NOT NULL
            AND submission_group_id = ${sub.submission_group_id}
          )
        )
        AND status = 'approved'
      RETURNING id, number, status, approved_at, rejected_at
    `;

    await sql`
      DELETE FROM number_locks
      WHERE number = ANY(${numbers}::int[])
    `;

    try {
      await sql`
        INSERT INTO audit_logs(admin_id, action, details)
        VALUES (
          ${admin.userId || admin.id || null},
          'minsam_approved_changed_to_rejected',
          ${JSON.stringify({
            submissionId: id,
            numbers,
            changedBy: admin.userId || admin.id || null,
            changedAt: new Date().toISOString(),
            note: 'Approved submission changed to rejected. Older duplicate rejected rows for same numbers were removed to satisfy submissions_number_status_key.',
          })}
        )
      `;
    } catch (auditError) {
      console.warn('Minsam: audit log skipped:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Approved submission changed to rejected. Number is now available.',
      numbers,
      submissions: updated,
    });
  } catch (error: any) {
    console.error('Minsam reject-approved error:', error);

    return NextResponse.json(
      {
        error:
          error.message || 'Failed to change approved submission to rejected',
      },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
            ? 403
            : 500,
      }
    );
  }
}
