export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const [users, approved, pending, price] = await Promise.all([
      sql`SELECT COUNT(*)::int AS count FROM users`,
      sql`SELECT COUNT(*)::int AS count FROM submissions WHERE status = 'approved'`,
      sql`SELECT COUNT(*)::int AS count FROM submissions WHERE status = 'pending'`,
      sql`SELECT value FROM settings WHERE key = 'ticket_price'`,
    ]);

    const ticketPrice = Number(price[0]?.value || 40);
    const sold = Number(approved[0]?.count || 0);
    const pendingCount = Number(pending[0]?.count || 0);
    const totalUsers = Number(users[0]?.count || 0);

    return NextResponse.json(
      {
        totalUsers,
        numbersSold: sold,
        pendingApprovals: pendingCount,
        revenue: sold * ticketPrice,
        numbersLeft: 300 - sold,
        ticketPrice,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('Stats error:', err);

    return NextResponse.json(
      { error: err.message || 'Failed to load stats' },
      { status: err.message === 'Forbidden' ? 403 : 500 }
    );
  }
}
