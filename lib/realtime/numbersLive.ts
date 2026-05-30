'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type NumbersLivePayload = {
  action: 'hold_created' | 'hold_released' | 'submission_created' | 'approved' | 'rejected' | 'sync';
  numbers: number[];
  status?: 'pending' | 'available' | 'taken' | 'closed' | 'open';
  holdId?: string;
  clientHoldKey?: string;
  source?: string;
  at?: string;
};

export const NUMBERS_LIVE_CHANNEL = 'numbers-live';
export const NUMBERS_UPDATED_EVENT = 'numbers-updated';

export function normalizeLiveNumbers(numbers: any): number[] {
  if (!Array.isArray(numbers)) return [];

  return Array.from(
    new Set(
      numbers
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  );
}

export async function broadcastNumbersUpdate(payload: NumbersLivePayload) {
  try {
    const numbers = normalizeLiveNumbers(payload.numbers);
    if (!numbers.length) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(NUMBERS_LIVE_CHANNEL, {
      config: { broadcast: { self: false } },
    });

    await channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;

      await channel.send({
        type: 'broadcast',
        event: NUMBERS_UPDATED_EVENT,
        payload: {
          ...payload,
          numbers,
          at: payload.at || new Date().toISOString(),
        },
      });

      setTimeout(() => supabase.removeChannel(channel), 250);
    });
  } catch (error) {
    console.warn('[numbers-live] broadcast failed:', error);
  }
}

export function dispatchNumbersRefresh(payload?: Partial<NumbersLivePayload>) {
  try {
    window.dispatchEvent(new CustomEvent('numbers-refresh', { detail: payload || {} }));
    window.dispatchEvent(new CustomEvent('numbers-updated', { detail: payload || {} }));
    // Legacy number-amounts-refresh dispatch disabled. NumberGrid updates from Supabase Realtime payload directly.
} catch {}
}
