export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

async function getSettingNumber(key: string, fallback: number) {
  const rows = await sql`
    SELECT value FROM settings
    WHERE key = ${key}
    LIMIT 1
  `;

  const value = Number(rows?.[0]?.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const ticketPrice = await getSettingNumber('ticket_price', 300);
    const gridSize = await getSettingNumber('grid_size', 2000);

    return NextResponse.json(
      {
        ticketPrice,
        gridSize,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load settings' },
      { status: error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json();

    const ticketPrice = Number(body.ticketPrice);
    const gridSize = Number(body.gridSize);

    if (!Number.isInteger(ticketPrice) || ticketPrice <= 0) {
      return NextResponse.json(
        { error: 'Invalid ticket price' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(gridSize) || gridSize < 1 || gridSize > 20000) {
      return NextResponse.json(
        { error: 'Invalid grid size. Use a number between 1 and 20000.' },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO settings(key, value)
      VALUES
        ('ticket_price', ${String(ticketPrice)}),
        ('grid_size', ${String(gridSize)})
      ON CONFLICT(key)
      DO UPDATE SET value = EXCLUDED.value
    `;

    return NextResponse.json({
      success: true,
      ticketPrice,
      gridSize,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save settings' },
      { status: error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}
