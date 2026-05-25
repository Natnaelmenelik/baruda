'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

type Options = {
  enabled?: boolean;
  onChange: () => void | Promise<void>;
};

export function useNumberStatusRealtime({ enabled = true, onChange }: Options) {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('number-status-summary-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'number_status_summary',
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
