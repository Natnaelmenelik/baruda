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

    if (!['approved', 'rejected'].includes(sub.status)) {
      return NextResponse.json(
        { error: 'Only approved or rejected submissions can be returned to pending.' },
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
      Safety check:
      rejected -> pending can only happen if the number is not already
      pending or approved by another submission.
    */
    const conflicts = await sql`
      SELECT id, number, status
      FROM submissions
      WHERE number = ANY(${numbers}::int[])
        AND status IN ('pending', 'approved')
        AND NOT (
          id = ${sub.id}
          OR (
            ${sub.submission_group_id}::uuid IS NOT NULL
            AND submission_group_id = ${sub.submission_group_id}
          )
        )
      LIMIT 10
    `;

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: 'This number is already pending or approved by another submission.',
          conflicts,
        },
        { status: 409 }
      );
    }

    const updated = await sql`
      UPDATE submissions
      SET
        status = 'pending',
        approved_at = NULL,
        rejected_at = NULL
      WHERE
        (
          id = ${sub.id}
          OR (
            ${sub.submission_group_id}::uuid IS NOT NULL
            AND submission_group_id = ${sub.submission_group_id}
          )
        )
        AND status IN ('approved', 'rejected')
      RETURNING id, number, status, approved_at, rejected_at
    `;

    /*
      Do NOT delete number_locks here.
      Pending numbers must stay unavailable/yellow.
    */

    try {
      await sql`
        INSERT INTO audit_logs(admin_id, action, details)
        VALUES (
          ${admin.userId || admin.id || null},
          'minsam_returned_to_pending',
          ${JSON.stringify({
            submissionId: id,
            previousStatus: sub.status,
            numbers,
            changedBy: admin.userId || admin.id || null,
            changedAt: new Date().toISOString(),
          })}
        )
      `;
    } catch (auditError) {
      console.warn('Minsam return-pending audit log skipped:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Submission returned to pending.',
      previousStatus: sub.status,
      numbers,
      submissions: updated,
    });
  } catch (error: any) {
    console.error('Minsam return-pending error:', error);

    return NextResponse.json(
      {
        error:
          error.message || 'Failed to return submission to pending',
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
