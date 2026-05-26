'use client';

import { useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type Options = {
  enabled?: boolean;
  onChange: () => void | Promise<void>;
};

export function useNumberStatusRealtime({ enabled = true, onChange }: Options) {
  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel('number-status-summary-cache-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'number_status_summary_cache',
        },
        () => {
          onChange();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onChange]);
}
