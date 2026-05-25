"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLang } from "@/hooks/useLang";
import { translateApiError } from "@/lib/i18n/apiErrorMessages";

export default function AdminSettingsPanel() {
  const { lang } = useLang();

  const text = {
    en: {
      title: "Lottery Settings",
      description:
        "Set ticket price and numbers grid size from the admin panel.",
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
    },
    am: {
      title: "የሎተሪ ቅንብሮች",
      description: "የቲኬት ዋጋን እና የቁጥሮች መጠንን ከአድሚን ፓነል ያስተካክሉ።",
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
    },
    om: {
      title: "Sajataa Loatarii",
      description:
        "Gatii tikkeetii fi hamma lakkoofsotaa paaneelii bulchiinsaa irraa sirreessi.",
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
    },
  } as const;

  const t = text[lang];

  const [ticketPrice, setTicketPrice] = useState("");
  const [gridSize, setGridSize] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/settings", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.loadError);
      }

      setTicketPrice(String(data.ticketPrice ?? 300));
      setGridSize(String(data.gridSize ?? 2000));
    } catch (error: any) {
      toast.error(translateApiError(error, lang) || t.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketPrice: price,
          gridSize: size,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.saveError);
      }

      toast.success(t.saved);
      await loadSettings();
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
        <form onSubmit={saveSettings} className="grid gap-4 md:grid-cols-3">
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

          <div className="flex items-end">
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
