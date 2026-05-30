"use client";

import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/hooks/useLang";
import { translateApiError } from "@/lib/i18n/apiErrorMessages";
import { emitSettingsUpdated } from "@/lib/realtime/appRealtimeEvents";

type GridStatus = "open" | "closed";

type LotterySettingsResponse = {
  ticketPrice?: number;
  ticket_price?: number;
  gridSize?: number;
  grid_size?: number;
  defaultTargetAmount?: number;
  default_target_amount?: number;
  numbersGridStatus?: GridStatus | string;
  numbers_grid_status?: GridStatus | string;
  numbersGridOpen?: boolean;
  numbers_grid_open?: boolean;
  updatedAt?: string | null;
  updated_at?: string | null;
};

function normalizeLotterySettings(
  data: LotterySettingsResponse,
  fallback?: {
    ticketPrice?: number;
    gridSize?: number;
    numbersGridStatus?: GridStatus;
  },
) {
  const ticketPrice = Number(
    data.ticketPrice ?? data.ticket_price ?? fallback?.ticketPrice ?? 300,
  );
  const gridSize = Number(
    data.gridSize ?? data.grid_size ?? fallback?.gridSize ?? 2000,
  );
  const defaultTargetAmount = Number(
    data.defaultTargetAmount ?? data.default_target_amount ?? 5000,
  );
  const numbersGridStatus: GridStatus =
    String(
      data.numbersGridStatus ??
        data.numbers_grid_status ??
        fallback?.numbersGridStatus ??
        "open",
    ).toLowerCase() === "closed"
      ? "closed"
      : "open";
  const updatedAt = data.updatedAt ?? data.updated_at ?? null;

  return {
    ticketPrice,
    ticket_price: ticketPrice,
    gridSize,
    grid_size: gridSize,
    defaultTargetAmount,
    default_target_amount: defaultTargetAmount,
    numbersGridStatus,
    numbers_grid_status: numbersGridStatus,
    numbersGridOpen: numbersGridStatus !== "closed",
    numbers_grid_open: numbersGridStatus !== "closed",
    updatedAt,
    updated_at: updatedAt,
  };
}

function patchNumbersGridMeta(oldData: any, settings: ReturnType<typeof normalizeLotterySettings>) {
  if (Array.isArray(oldData)) {
    return {
      numbers: oldData,
      gridSize: settings.gridSize,
      grid_size: settings.gridSize,
    };
  }

  if (oldData && typeof oldData === "object") {
    return {
      ...oldData,
      gridSize: settings.gridSize,
      grid_size: settings.gridSize,
    };
  }

  return oldData;
}

export default function AdminSettingsPanel() {
  const queryClient = useQueryClient();
  const { lang } = useLang();

  const text = {
    en: {
      title: "Lottery Settings",
      description:
        "Set ticket price, numbers grid size, and selection status from the admin panel.",
      loading: "Loading settings...",
      ticketPrice: "Ticket Price",
      gridSize: "Numbers Grid Size",
      save: "Save Settings",
      saving: "Saving...",
      invalidPrice: "Ticket price must be a positive number",
      invalidGrid: "Grid size must be between 1 and 20000",
      loadError: "Failed to load settings",
      saveError: "Failed to save settings",
      saved: "Lottery settings updated successfully",
      numbersGridStatus: "Numbers Grid Status",
      numbersGridStatusHelp:
        "When closed, users can see the grid but cannot touch/select numbers.",
      numbersGridOpen: "Open",
      numbersGridClosed: "Closed",
    },
    am: {
      title: "የሎተሪ ቅንብሮች",
      description:
        "የቲኬት ዋጋን፣ የቁጥሮች መጠንን እና የመምረጫ ሁኔታን ከአድሚን ፓነል ያስተካክሉ።",
      loading: "ቅንብሮች በመጫን ላይ...",
      ticketPrice: "የቲኬት ዋጋ",
      gridSize: "የቁጥሮች መጠን",
      save: "ቅንብሮችን አስቀምጥ",
      saving: "በማስቀመጥ ላይ...",
      invalidPrice: "የቲኬት ዋጋ ከ0 በላይ መሆን አለበት",
      invalidGrid: "የቁጥሮች መጠን ከ1 እስከ 20000 መሆን አለበት",
      loadError: "ቅንብሮችን መጫን አልተቻለም",
      saveError: "ቅንብሮችን ማስቀመጥ አልተቻለም",
      saved: "የሎተሪ ቅንብሮች ተሻሽለዋል",
      numbersGridStatus: "የቁጥሮች መደብ ሁኔታ",
      numbersGridStatusHelp:
        "ሲዘጋ ተጠቃሚዎች መደቡን ማየት ይችላሉ፣ ግን ቁጥሮችን መንካት/መምረጥ አይችሉም።",
      numbersGridOpen: "ክፍት",
      numbersGridClosed: "ዝግ",
    },
    om: {
      title: "Sajataa Loatarii",
      description:
        "Gatii tikkeetii, hamma lakkoofsotaa fi haala filannoo paaneelii bulchiinsaa irraa sirreessi.",
      loading: "Sajataa fe'aa jira...",
      ticketPrice: "Gatii Tikkeetii",
      gridSize: "Hamma Lakkoofsotaa",
      save: "Sajataa Oolchi",
      saving: "Oolchaa jira...",
      invalidPrice: "Gatiin tikkeetii lakkoofsa lakkii ta'uu qaba",
      invalidGrid: "Hammi lakkoofsaa 1 hanga 20000 gidduu ta’uu qaba",
      loadError: "Sajataa fe'uun hin danda'amne",
      saveError: "Sajataa oolchuun hin danda’amne",
      saved: "Sajataan loatarii milkiidhaan fooyya’eera",
      numbersGridStatus: "Haala Giriidii Lakkoofsotaa",
      numbersGridStatusHelp:
        "Yoo cufame, fayyadamtoonni giriidii ni argu garuu lakkoofsa tuquu/filachuu hin danda’an.",
      numbersGridOpen: "Banaa",
      numbersGridClosed: "Cufaa",
    },
  } as const;

  const t = text[lang];

  const [ticketPrice, setTicketPrice] = useState("");
  const [gridSize, setGridSize] = useState("");
  const [numbersGridStatus, setNumbersGridStatus] = useState<GridStatus>("open");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function syncSettings(settings: ReturnType<typeof normalizeLotterySettings>) {
    queryClient.setQueryData(["lottery-settings"], (old: any) => ({
      ...(old || {}),
      ...settings,
    }));

    queryClient.setQueryData(["settings"], (old: any) => ({
      ...(old || {}),
      ...settings,
    }));

    queryClient.setQueryData(["numbers"], (old: any) =>
      patchNumbersGridMeta(old, settings),
    );

    emitSettingsUpdated(settings);

    // Compatibility for manual tests and any old listener using the literal name.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("settings-updated", { detail: settings }),
      );
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.loadError);
      }

      const settings = normalizeLotterySettings(data);
      setTicketPrice(String(settings.ticketPrice));
      setGridSize(String(settings.gridSize));
      setNumbersGridStatus(settings.numbersGridStatus);
      syncSettings(settings);
    } catch (error: any) {
      toast.error(translateApiError(error, lang) || t.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();

    const price = Number(ticketPrice);
    const size = Number(gridSize);

    if (!Number.isInteger(price) || price <= 0) {
      toast.error(t.invalidPrice);
      return;
    }

    if (!Number.isInteger(size) || size < 1 || size > 20000) {
      toast.error(t.invalidGrid);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketPrice: price,
          ticket_price: price,
          gridSize: size,
          grid_size: size,
          numbersGridStatus,
          numbers_grid_status: numbersGridStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.saveError);
      }

      const settings = normalizeLotterySettings(data, {
        ticketPrice: price,
        gridSize: size,
        numbersGridStatus,
      });

      setTicketPrice(String(settings.ticketPrice));
      setGridSize(String(settings.gridSize));
      setNumbersGridStatus(settings.numbersGridStatus);
      syncSettings(settings);
      toast.success(t.saved);
    } catch (error: any) {
      toast.error(translateApiError(error, lang) || t.saveError);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-5 mb-6 bg-white shadow rounded-xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">{t.title}</h2>
        <p className="text-sm text-gray-500">{t.description}</p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">{t.loading}</div>
      ) : (
        <form onSubmit={saveSettings} className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-700">
              {t.ticketPrice}
            </label>
            <input
              type="number"
              min="1"
              value={ticketPrice}
              onChange={(e) => setTicketPrice(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
              placeholder="300"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-700">
              {t.gridSize}
            </label>
            <input
              type="number"
              min="1"
              max="20000"
              value={gridSize}
              onChange={(e) => setGridSize(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
              placeholder="2000"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-700">
              {t.numbersGridStatus}
            </label>
            <button
              type="button"
              onClick={() => {
                setNumbersGridStatus((current) =>
                  current === "closed" ? "open" : "closed",
                );
              }}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-bold transition ${
                numbersGridStatus === "closed"
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {numbersGridStatus === "closed"
                ? t.numbersGridClosed
                : t.numbersGridOpen}
            </button>
            <p className="mt-1 text-xs text-gray-500">
              {t.numbersGridStatusHelp}
            </p>
          </div>

          <div className="flex items-start pt-6">
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? t.saving : t.save}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
