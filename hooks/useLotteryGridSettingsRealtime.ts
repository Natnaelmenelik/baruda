"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type LotteryGridStatus = "open" | "closed";

export type LotteryGridSettingsRealtimeRow = {
  id: number;
  ticketPrice: number;
  ticket_price: number;
  gridSize: number;
  grid_size: number;
  numbersGridStatus: LotteryGridStatus;
  numbers_grid_status: LotteryGridStatus;
  numbersGridOpen: boolean;
  numbers_grid_open: boolean;
  updatedAt: string | null;
  updated_at: string | null;
};

function positiveInteger(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeStatus(value: unknown): LotteryGridStatus {
  return String(value || "open").toLowerCase() === "closed" ? "closed" : "open";
}

export function normalizeLotteryGridSettingsRow(row: any): LotteryGridSettingsRealtimeRow | null {
  const raw = row?.new || row?.row || row;
  if (!raw || Number(raw.id ?? 1) !== 1) return null;

  const ticketPrice = positiveInteger(raw.ticketPrice ?? raw.ticket_price, 300);
  const gridSize = positiveInteger(raw.gridSize ?? raw.grid_size, 2000);
  const numbersGridStatus = normalizeStatus(raw.numbersGridStatus ?? raw.numbers_grid_status);
  const updatedAt = raw.updatedAt ?? raw.updated_at ?? null;

  return {
    id: 1,
    ticketPrice,
    ticket_price: ticketPrice,
    gridSize,
    grid_size: gridSize,
    numbersGridStatus,
    numbers_grid_status: numbersGridStatus,
    numbersGridOpen: numbersGridStatus !== "closed",
    numbers_grid_open: numbersGridStatus !== "closed",
    updatedAt,
    updated_at: updatedAt,
  };
}

/**
 * Fresh grid settings realtime hook.
 * Mirrors useNumberSummaryRealtime:
 * realtime row -> normalized row -> onChange(row)
 */
export function useLotteryGridSettingsRealtime(
  onChange?: (row: LotteryGridSettingsRealtimeRow) => void,
) {
  useEffect(() => {
    if (typeof onChange !== "function") return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("lottery-grid-settings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lottery_settings_cache",
          filter: "id=eq.1",
        },
        (payload) => {
          const row = normalizeLotteryGridSettingsRow(payload);
          if (row) onChange(row);
        },
      )
      .subscribe((status) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("[Realtime] lottery_grid_settings:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onChange]);
}
