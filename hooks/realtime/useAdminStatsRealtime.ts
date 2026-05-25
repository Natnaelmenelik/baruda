'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type RealtimePayload = {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  new?: Record<string, any>;
  old?: Record<string, any>;
};

type Options = {
  enabled?: boolean;
  debounceMs?: number;
  onChange: (payload: RealtimePayload) => void | Promise<void>;
};

/**
 * Realtime listener for public.admin_stats_summary.
 *
 * Used by admin dashboard to refresh stats quickly after the summary row changes.
 * debounceMs = 0 means immediate execution.
 */
export function useAdminStatsRealtime({
  enabled = true,
  debounceMs = 0,
  onChange,
}: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    const schedule = (payload: RealtimePayload) => {
      if (cancelled) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (debounceMs <= 0) {
        void onChange(payload);
        return;
      }

      timerRef.current = setTimeout(() => {
        if (!cancelled) {
          void onChange(payload);
        }
      }, debounceMs);
    };

    const channel = supabase
      .channel('admin-stats-summary-direct-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_stats_summary',
          filter: 'id=eq.1',
        },
        schedule,
      )
      .subscribe((status) => {
        if (
          process.env.NODE_ENV !== 'production' &&
          (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
        ) {
          console.warn('[Realtime] admin_stats_summary connection problem:', status);
        }
      });

    return () => {
      cancelled = true;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      supabase.removeChannel(channel);
    };
  }, [enabled, debounceMs, onChange]);
}
