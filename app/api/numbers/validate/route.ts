export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireUser } from '@/lib/auth/server';
import { getGridSize } from '@/lib/settings/lotterySettings';

function cleanNumbers(raw: any): number[] {
  return Array.from(
    new Set(
      (Array.isArray(raw) ? raw : [])
        .map((n: any) => Number(n))
        .filter((n: number) => Number.isInteger(n) && n > 0)
    )
  ) as number[];
}

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    const body = await req.json();
    const numbers = cleanNumbers(body.numbers);
    const gridSize = await getGridSize();

    if (!numbers.length) {
      return NextResponse.json({ error: 'No numbers selected' }, { status: 400 });
    }

    if (numbers.some((n) => n < 1 || n > gridSize)) {
      return NextResponse.json(
        { error: `Invalid number selected. Numbers must be between 1 and ${gridSize}.` },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM number_locks
      WHERE expires_at < NOW()
    `;

    const takenRows = await sql`
      SELECT number
      FROM submissions
      WHERE number = ANY(${numbers})
      AND status IN ('pending', 'approved')
    `;

    const lockedRows = await sql`
      SELECT number
      FROM number_locks
      WHERE number = ANY(${numbers})
      AND user_id::text <> ${String(user.userId)}
    `;

    const ownLockRows = await sql`
      SELECT number
      FROM number_locks
      WHERE number = ANY(${numbers})
      AND user_id::text = ${String(user.userId)}
    `;

    const taken = takenRows.map((r: any) => Number(r.number));
    const locked = lockedRows.map((r: any) => Number(r.number));
    const ownLocked = ownLockRows.map((r: any) => Number(r.number));
    const notLockedByYou = numbers.filter((n) => !ownLocked.includes(n));

    return NextResponse.json({
      valid: taken.length === 0 && locked.length === 0 && notLockedByYou.length === 0,
      taken,
      locked,
      notLockedByYou,
    });
  } catch (error: any) {
    console.error('Validate selected numbers error:', error);

    return NextResponse.json(
      { error: error.message || 'Validation failed' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
