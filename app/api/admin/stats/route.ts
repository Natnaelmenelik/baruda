import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getNumericSetting(key: string, fallback: number) {
  try {
    const rows = await sql`
      SELECT value
      FROM public.settings
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

    const [gridSize, ticketPrice, rows] = await Promise.all([
      getNumericSetting('grid_size', 2000),
      getNumericSetting('ticket_price', 300),
      sql`
        SELECT
          total_users,
          total_submissions,
          pending_submissions,
          approved_submissions,
          rejected_submissions,
          total_revenue,
          pending_amount,
          total_numbers,
          sold_numbers,
          open_numbers,
          pending_numbers,
          updated_at
        FROM public.admin_stats_summary
        WHERE id = 1
        LIMIT 1
      `,
    ]);

    const stats = rows?.[0] || {
      total_users: 0,
      total_submissions: 0,
      pending_submissions: 0,
      approved_submissions: 0,
      rejected_submissions: 0,
      total_revenue: 0,
      pending_amount: 0,
      total_numbers: gridSize,
      sold_numbers: 0,
      open_numbers: gridSize,
      pending_numbers: 0,
      updated_at: null,
    };

    const totalUsers = Number(stats.total_users || 0);
    const totalSubmissions = Number(stats.total_submissions || 0);
    const pendingSubmissions = Number(stats.pending_submissions || 0);
    const approvedSubmissions = Number(stats.approved_submissions || 0);
    const rejectedSubmissions = Number(stats.rejected_submissions || 0);

    const revenue = Number(stats.total_revenue || 0);
    const pendingAmount = Number(stats.pending_amount || 0);

    const totalNumbers = Number(stats.total_numbers || 0) || gridSize;
    const numbersSold = Number(stats.sold_numbers || 0);
    const numbersLeft = Number(stats.open_numbers || 0);
    const pendingNumbers = Number(stats.pending_numbers || 0);

    return NextResponse.json(
      {
        // Admin card fields
        totalUsers,
        numbersSold,
        pendingApprovals: pendingNumbers,
        pendingNumbers,
        revenue,
        numbersLeft,

        // Clear extra fields
        pendingSubmissions,
        totalSubmissions,
        approvedSubmissions,
        rejectedSubmissions,
        totalNumbers,
        gridSize,
        ticketPrice,
        pendingRevenue: pendingAmount,
        updatedAt: stats.updated_at,

        // Snake case compatibility
        total_users: totalUsers,
        sold_numbers: numbersSold,
        pending_numbers: pendingNumbers,
        pending_submissions: pendingSubmissions,
        total_revenue: revenue,
        open_numbers: numbersLeft,
        total_numbers: totalNumbers,
        total_submissions: totalSubmissions,
        approved_submissions: approvedSubmissions,
        rejected_submissions: rejectedSubmissions,
        pending_amount: pendingAmount,
        updated_at: stats.updated_at,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (error: any) {
    console.error('Admin stats error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to load stats' },
      {
        status:
          error.message === 'Forbidden'
            ? 403
            : error.message === 'Unauthorized'
              ? 401
              : 500,
      },
    );
  }
}
