export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireUser } from '@/lib/auth/server';

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    const body = await req.json();
    const numbers = Array.from(
      new Set((body.numbers || []).map((n: any) => Number(n)).filter(Boolean))
    ) as number[];

    if (numbers.length) {
      await sql`
        DELETE FROM number_locks
        WHERE number = ANY(${numbers})
        AND user_id = ${user.userId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bulk unlock error:', error);
    return NextResponse.json({ success: true });
  }
}
