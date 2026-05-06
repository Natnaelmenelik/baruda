export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

async function getSettingNumber(key: string, fallback: number) {
  try {
    const rows = await sql`
      SELECT value
      FROM settings
      WHERE key = ${key}
      LIMIT 1
    `;

    const value = Number(rows?.[0]?.value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const gridSize = await getSettingNumber('grid_size', 2000);

    const [usersRows, soldRows, pendingRows, revenueRows] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS count
        FROM users
      `,

      sql`
        SELECT COUNT(DISTINCT number)::int AS count
        FROM submissions
        WHERE status = 'approved'
      `,

      sql`
        SELECT COUNT(DISTINCT number)::int AS count
        FROM submissions
        WHERE status = 'pending'
      `,

      sql`
        SELECT COALESCE(SUM(group_total), 0)::int AS revenue
        FROM (
          SELECT
            COALESCE(submission_group_id::text, id::text) AS group_key,
            MAX(COALESCE(total_amount, ticket_price, 0))::int AS group_total
          FROM submissions
          WHERE status = 'approved'
          GROUP BY COALESCE(submission_group_id::text, id::text)
        ) grouped
      `,
    ]);

    const totalUsers = Number(usersRows?.[0]?.count || 0);
    const numbersSold = Number(soldRows?.[0]?.count || 0);
    const pendingApprovals = Number(pendingRows?.[0]?.count || 0);
    const revenue = Number(revenueRows?.[0]?.revenue || 0);

    return NextResponse.json(
      {
        totalUsers,
        numbersSold,
        pendingApprovals,
        revenue,
        numbersLeft: Math.max(gridSize - numbersSold - pendingApprovals, 0),
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
      {
        status:
          err.message === 'Forbidden'
            ? 403
            : err.message === 'Unauthorized'
              ? 401
              : 500,
      }
    );
  }
}
