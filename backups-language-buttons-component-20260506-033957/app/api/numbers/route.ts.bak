export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { getTokenFromRequest } from '@/lib/auth/server';
import { getGridSize } from '@/lib/settings/lotterySettings';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'change-this-secret';

function getCurrentUserId(req: Request) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return null;

    const user = jwt.verify(token, SECRET) as any;
    return String(user.userId || user.id || '');
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const currentUserId = getCurrentUserId(req);
    const gridSize = await getGridSize();

    await sql`
      DELETE FROM number_locks
      WHERE expires_at < NOW()
    `;

    const submissions = await sql`
      SELECT number, status
      FROM submissions
      WHERE status IN ('pending', 'approved')
      AND number BETWEEN 1 AND ${gridSize}
    `;

    const locks = await sql`
      SELECT number, user_id::text AS user_id
      FROM number_locks
      WHERE number BETWEEN 1 AND ${gridSize}
    `;

    const statusMap = new Map<number, string>();

    submissions.forEach((s: any) => {
      const num = Number(s.number);

      if (s.status === 'approved') {
        statusMap.set(num, 'taken');
      }

      if (s.status === 'pending') {
        statusMap.set(num, 'pending');
      }
    });

    locks.forEach((l: any) => {
      const num = Number(l.number);

      if (!statusMap.has(num)) {
        statusMap.set(
          num,
          currentUserId && String(l.user_id) === String(currentUserId)
            ? 'locked_by_me'
            : 'locked'
        );
      }
    });

    const result = Array.from({ length: gridSize }, (_, index) => {
      const num = index + 1;

      return {
        num,
        number: num,
        status: statusMap.get(num) || 'available',
      };
    });

    return NextResponse.json(
      {
        gridSize,
        numbers: result,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Numbers API error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to load numbers' },
      { status: 500 }
    );
  }
}
