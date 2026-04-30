export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const submissions = await sql`
      SELECT
        s.id,
        s.number,
        s.contact_phone,
        s.status,
        s.submitted_at,
        s.approved_at,
        s.rejected_at,
        CASE
          WHEN s.receipt_url IS NULL OR s.receipt_url = '' THEN false
          ELSE true
        END AS has_receipt,
        u.name AS user_name,
        u.phone AS user_phone,
        u.email AS user_email
      FROM submissions s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.submitted_at DESC
      LIMIT 200
    `;

    return NextResponse.json(submissions, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Admin submissions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load submissions' },
      { status: error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}
