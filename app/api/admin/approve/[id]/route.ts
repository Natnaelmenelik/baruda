export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { createAutomaticBackup } from '@/lib/backup/autoBackup';
import { requireAdmin } from '@/lib/auth/server';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await context.params;

    const updated = await sql`
      UPDATE submissions
      SET status = 'approved',
          approved_at = NOW(),
          rejected_at = NULL
      WHERE id = ${id}
      RETURNING id, number, status
    `;

    if (!updated.length) {
      await createAutomaticBackup('approve');

    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Submission approved',
      submission: updated[0],
    });
  } catch (error: any) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { error: error.message || 'Approve failed' },
      { status: error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}
