"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
export type NumberSummaryCacheRow = {
  number: number;
  target_amount?: number;
  approved_amount?: number;
  pending_amount?: number;
  hold_amount?: number;
  sold_amount?: number;
  remaining_amount?: number;
  status?: string;
  updated_at?: string;
};

export type NumberSummaryRealtimeRow = {
  number: number;
  target_amount?: number;
  approved_amount?: number;
  pending_amount?: number;
  hold_amount?: number;
  sold_amount?: number;
  remaining_amount?: number;
  status?: string;
  updated_at?: string;
};

/**
 * Event-driven number grid realtime.
 *
 * It listens to the ready-to-display summary cache table and gives the changed
 * row to the UI. The UI should patch that one card directly instead of
 * invalidating/refetching /api/numbers.
 */
export function useNumberSummaryRealtime(
  onRowChange?: (row: NumberSummaryRealtimeRow) => void,
) {
  useEffect(() => {
    if (typeof onRowChange !== "function") return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel("number-status-summary-cache-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "number_status_summary_cache",
        },
        (payload) => {
          const row = (payload.new ||
            payload.old) as NumberSummaryRealtimeRow | null;
          if (!row || typeof row.number === "undefined") return;
          onRowChange(row);
        },
      )
      .subscribe((status) => {
        console.log("[Realtime] number_status_summary_cache:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRowChange]);
}
