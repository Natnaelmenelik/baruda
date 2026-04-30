export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { getTokenFromRequest } from '@/lib/auth/server';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'change-this-secret';

function getCurrentUserId(req: Request) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    const user = jwt.verify(token, SECRET) as any;
    return user.userId || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const currentUserId = getCurrentUserId(req);

    await sql`DELETE FROM number_locks WHERE expires_at < NOW()`;

    const submissions = await sql`
      SELECT number, status
      FROM submissions
      WHERE status IN ('pending', 'approved')
    `;

    const locks = await sql`
      SELECT number, user_id, expires_at
      FROM number_locks
    `;

    const statusMap = new Map<number, string>();

    submissions.forEach((s: any) => {
      statusMap.set(
        Number(s.number),
        s.status === 'approved' ? 'taken' : 'pending'
      );
    });

    locks.forEach((l: any) => {
      const num = Number(l.number);

      if (!statusMap.has(num)) {
        if (currentUserId && l.user_id === currentUserId) {
          statusMap.set(num, 'locked_by_me');
        } else {
          statusMap.set(num, 'locked');
        }
      }
    });

    const result = Array.from({ length: 300 }, (_, i) => {
      const num = i + 1;

      return {
        num,
        number: num,
        status: statusMap.get(num) || 'available',
      };
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Numbers API error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to load numbers' },
      { status: 500 }
    );
  }
}
