export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireUser } from '@/lib/auth/server';

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    const { number } = await req.json();

    const selectedNumber = Number(number);

    if (!selectedNumber) {
      return NextResponse.json({ success: true });
    }

    await sql`
      DELETE FROM number_locks
      WHERE number = ${selectedNumber}
      AND user_id = ${user.userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Number unlock error:', error);
    return NextResponse.json({ success: true });
  }
}
