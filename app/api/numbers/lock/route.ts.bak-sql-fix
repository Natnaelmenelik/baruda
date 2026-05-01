export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireUser } from '@/lib/auth/server';


async function getCurrentGridSize(prisma: any) {
  const settings = await prisma.settings.findFirst();

  return Number(
    settings?.grid_size ||
    settings?.table_size ||
    settings?.max_numbers ||
    200
  );
}

async function validateGridNumbers(
  prisma: any,
  numbers: number[]
) {
  const gridSize = await getCurrentGridSize(prisma);

  for (const num of numbers) {
    if (
      !Number.isInteger(num) ||
      num < 1 ||
      num > gridSize
    ) {
      throw new Error(
        `Number ${num} exceeds current grid size (${gridSize})`
      );
    }
  }

  return gridSize;
}



export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    const { number } = await req.json();

  await validateGridNumbers(
    prisma,
    [Number(number)]
  );

    const selectedNumber = Number(number);

    if (!selectedNumber || selectedNumber < 1 || selectedNumber > 20000) {
      return NextResponse.json({ error: 'Invalid number' }, { status: 400 });
    }

    await sql`DELETE FROM number_locks WHERE expires_at < NOW()`;

    const taken = await sql`
      SELECT number
      FROM submissions
      WHERE number = ${selectedNumber}
      AND status IN ('pending', 'approved')
      LIMIT 1
    `;

    if (taken.length) {
      return NextResponse.json(
        { error: 'This number is already taken or pending approval.' },
        { status: 409 }
      );
    }

    const existingLock = await sql`
      SELECT number, user_id::text AS user_id, expires_at
      FROM number_locks
      WHERE number = ${selectedNumber}
      LIMIT 1
    `;

    if (
      existingLock.length &&
      String(existingLock[0].user_id) !== String(user.userId)
    ) {
      return NextResponse.json(
        { error: 'This number is currently being selected by another user.' },
        { status: 409 }
      );
    }

    const lock = await sql`
      INSERT INTO number_locks (number, user_id, expires_at)
      VALUES (${selectedNumber}, ${user.userId}, NOW() + INTERVAL '5 minutes')
      ON CONFLICT (number)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW()
      RETURNING number, user_id::text AS user_id, expires_at
    `;

    return NextResponse.json({
      success: true,
      lock: lock[0],
    });
  } catch (error: any) {
    console.error('Number lock error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to lock number' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}