export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);

    const rows = await sql`
      SELECT receipt_url, receipt_key
      FROM submissions
      WHERE id = ${params.id}
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({
      receiptUrl: rows[0].receipt_url,
      receiptKey: rows[0].receipt_key,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load receipt' },
      { status: error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
