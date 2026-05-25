"use client";

import { useEffect, useMemo, useState } from "react";
import { translations, Lang } from "@/lib/i18n/translations";

type NumberAmountRow = {
  number: number;
  target_amount?: number;
  sold_amount?: number;
  remaining_amount?: number;
  status?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lang: Lang;
};

export default function NumberAmountsModal({ open, onClose, lang }: Props) {
  const txt: any = translations[lang] || translations.en;
  const [rows, setRows] = useState<NumberAmountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function loadAmounts(silent = false) {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/numbers/amounts?t=" + Date.now(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || txt.failedToLoadNumberAmounts || "Failed to load number amounts");
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      if (!silent) setRows([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    loadAmounts();

    const interval = window.setInterval(() => {
      loadAmounts(true);
    }, 2000);

    const refreshHandler = () => {
      loadAmounts(true);
    };

    window.addEventListener("number-amounts-refresh", refreshHandler);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("number-amounts-refresh", refreshHandler);
    };
  }, [open]);

  const filteredRows = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter((row) => String(row.number).includes(q));
  }, [rows, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3 md:p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-3 border-b px-5 py-4 dark:border-slate-700 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{txt.numberAmounts || "Number Amounts"}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {txt.numberAmountsSubtitle || "View sold and remaining amount for each number"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="self-end rounded-lg bg-gray-200 px-3 py-1 text-sm font-bold text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-white">×</button>
        </div>

        <div className="border-b p-4 dark:border-slate-700">
          <input
            type="number"
            min={1}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={txt.searchNumber || "Search number"}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="p-3 text-left">{txt.number || "Number"}</th>
                <th className="p-3 text-right">{txt.soldAmount || "Sold Amount"}</th>
                <th className="p-3 text-right">{txt.remainingAmount || "Remaining Amount"}</th>
                <th className="p-3 text-right">{txt.targetAmount || "Target Amount"}</th>
                <th className="p-3 text-center">{txt.status || "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">{txt.loading || "Loading..."}</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">{txt.noData || "No data found"}</td></tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.number} className="border-b hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    <td className="p-3 font-bold text-gray-900 dark:text-white">{row.number}</td>
                    <td className="p-3 text-right font-semibold text-green-700 dark:text-green-300">{Number(row.sold_amount || 0).toLocaleString()} {txt.birr || "Birr"}</td>
                    <td className="p-3 text-right font-semibold text-blue-700 dark:text-blue-300">{Number(row.remaining_amount || 0).toLocaleString()} {txt.birr || "Birr"}</td>
                    <td className="p-3 text-right text-gray-700 dark:text-slate-300">{Number(row.target_amount || 0).toLocaleString()} {txt.birr || "Birr"}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.status === "closed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {row.status === "closed" ? txt.closed || "Closed" : txt.open || "Open"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
