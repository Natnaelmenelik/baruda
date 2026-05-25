'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type Options = {
  enabled?: boolean;
  userId?: string;
  onChange: (payload?: any) => void | Promise<void>;
  debounceMs?: number;
};

/**
 * Realtime listener for public.submissions.
 *
 * Admin usage:
 *   userId omitted -> listens to all submissions.
 *
 * User usage:
 *   userId provided -> listens only to that user's submissions.
 *
 * debounceMs = 0 means immediate execution.
 */
export function useSubmissionsRealtime({
  enabled = true,
  userId,
  onChange,
  debounceMs = 0,
}: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    const schedule = (payload?: any) => {
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

    const filter = userId ? `user_id=eq.${userId}` : undefined;

    const channel = supabase
      .channel(userId ? `submissions-user-${userId}` : 'submissions-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          ...(filter ? { filter } : {}),
        },
        schedule,
      )
      .subscribe((status) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Realtime] submissions:', status);
        }
      });

    return () => {
      cancelled = true;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      supabase.removeChannel(channel);
    };
  }, [enabled, userId, onChange, debounceMs]);
}
