export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id,
        number,
        user_name,
        user_phone,
        draw_round,
        drawn_at
      FROM winners
      WHERE drawn_at >= NOW() - INTERVAL '24 hours'
      ORDER BY drawn_at DESC
      LIMIT 1
    `;

    return NextResponse.json(
      { winner: rows[0] || null },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Latest winner error:', error);
    return NextResponse.json({ winner: null });
  }
}
