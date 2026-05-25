// REALTIME_REFRESH_POINT:
// After this route succeeds, the frontend action handler should refresh only affected data:
// settings update/global target -> settings-updated + numbers-updated
// dashboard message update      -> dashboard-message-refresh
// winner announcement update    -> winner-announcement-refresh

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const winners = await sql`
      SELECT
        id,
        number,
        user_id,
        user_name,
        user_phone,
        draw_round,
        drawn_at
      FROM winners
      ORDER BY drawn_at DESC
      LIMIT 50
    `;

    return NextResponse.json(winners, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load winners' },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
            ? 403
            : 500,
      }
    );
  }
}
