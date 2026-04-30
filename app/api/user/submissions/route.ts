export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireUser } from '@/lib/auth/server';

export async function GET(req: Request) {
  try {
    const user = requireUser(req);

    const submissions = await sql`
      SELECT id, number, receipt_url, status, submitted_at, approved_at, rejected_at
      FROM submissions
      WHERE user_id = ${user.userId}
      ORDER BY submitted_at DESC
    `;

    return NextResponse.json(submissions, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
