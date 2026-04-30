export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await context.params;

    const result = await sql`
      SELECT receipt_url
      FROM submissions
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!result.length || !result[0].receipt_url) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    return NextResponse.json({
      receiptUrl: result[0].receipt_url,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load receipt' },
      { status: 500 }
    );
  }
}
