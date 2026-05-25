export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';

function maskPhone(phone?: string) {
  if (!phone) return '';
  return phone.length <= 6 ? phone : `${phone.slice(0, 4)}****${phone.slice(-2)}`;
}
function maskName(name?: string) {
  if (!name) return 'Winner';
  return name.length <= 2 ? `${name[0]}*` : `${name[0]}***${name.slice(-1)}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 3), 10);
    const rows = await sql`
      SELECT number,
             COALESCE(winner_name, user_name, '') AS name,
             COALESCE(winner_phone, user_phone, '') AS phone,
             drawn_at
      FROM winners
      ORDER BY drawn_at DESC
      LIMIT ${limit}
    `;
    return NextResponse.json(rows.map((w: any) => ({ ...w, maskedName: maskName(w.name), maskedPhone: maskPhone(w.phone) })));
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load winners' }, { status: 500 });
  }
}
