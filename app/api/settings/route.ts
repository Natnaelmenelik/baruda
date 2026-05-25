export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getLotterySettings } from '@/lib/settings/lotterySettings';

export async function GET() {
  const settings = await getLotterySettings();

  return NextResponse.json(settings, {
    headers: {
      'Cache-Control': 'private, max-age=5, stale-while-revalidate=20',
    },
  });
}
