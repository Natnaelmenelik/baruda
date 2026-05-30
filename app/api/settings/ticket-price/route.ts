export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getLotterySettings } from '@/lib/settings/lotterySettings';

export async function GET() {
  const settings = await getLotterySettings({ forceRefreshCache: true });

  return NextResponse.json(settings, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
