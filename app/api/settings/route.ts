import { NextResponse } from 'next/server';
import { getLotterySettings } from '@/lib/settings/lotterySettings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const settings = await getLotterySettings({ forceRefreshCache: true });

  return NextResponse.json(settings, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
