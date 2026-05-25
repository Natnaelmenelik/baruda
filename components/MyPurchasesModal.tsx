"use client";

import { useState } from "react";

import type { Lang } from "@/lib/i18n/translations";

type Props = {
  open: boolean;
  onClose: () => void;
  subs: any[];
  lang: Lang;
  title: string;
};

const copy = {
  en: {
    noPurchases: "No purchases found.",
    date: "Date",
    numbers: "Numbers",
    contributionBreakdown: "Contribution Breakdown",
    totalAmount: "Total Amount",
    receipt: "Receipt",
    viewReceipt: "View Receipt",
    noReceipt: "No receipt",
    birr: "Birr",
    approved: "Approved",
    pending: "Pending",
    rejected: "Rejected",
    status: "Status",
    close: "Close",
  },
  am: {
    noPurchases: "ምንም ግዢ የለም።",
    date: "ቀን",
    numbers: "ቁጥሮች",
    contributionBreakdown: "የመዋጮ ዝርዝር",
    totalAmount: "ጠቅላላ መጠን",
    receipt: "ደረሰኝ",
    viewReceipt: "ደረሰኝ ይመልከቱ",
    noReceipt: "ደረሰኝ የለም",
    birr: "ብር",
    approved: "ጸድቋል",
    pending: "በመጠባበቅ ላይ",
    rejected: "ውድቅ ተደርጓል",
    status: "ሁኔታ",
    close: "ዝጋ",
  },
  om: {
    noPurchases: "Bittoonni hin argamne.",
    date: "Guyyaa",
    numbers: "Lakkoofsota",
    contributionBreakdown: "Ibsa Gumaachaa",
    totalAmount: "Waliigala Hanga",
    receipt: "Nagahee",
    viewReceipt: "Nagahee Ilaali",
    noReceipt: "Nagaheen hin jiru",
    birr: "Birrii",
    approved: "Mirkanaa'eera",
    pending: "Eeggannaa irra",
    rejected: "Kufifameera",
    status: "Haala",
    close: "Cufi",
  },
} as const;

export default function MyPurchasesModal({
  open,
  onClose,
  subs,
  lang,
  title,
}: Props) {
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  if (!open) return null;

  const txt = (copy[lang as 'en' | 'am' | 'om'] || copy.en) as Record<string, string>;

  const getItems = (sub: any) => {
    const itemSource =
      Array.isArray(sub.items) && sub.items.length > 0
        ? sub.items
        : Array.isArray(sub.submission_items) && sub.submission_items.length > 0
          ? sub.submission_items
          : [];

    if (itemSource.length > 0) {
      return itemSource
        .map((item: any) => ({
          number: Number(item.number),
          amount: Number(item.amount || 0),
        }))
        .filter((item: any) => Number.isFinite(item.number) && item.number > 0);
    }

    if (Array.isArray(sub.numbers) && sub.numbers.length > 0) {
      const perNumberAmount =
        sub.number_amounts && typeof sub.number_amounts === "object"
          ? null
          : sub.numbers.length > 0
            ? Number(sub.total_amount || 0) / sub.numbers.length
            : 0;

      return sub.numbers
        .map((n: any) => {
          const number = Number(n);
          return {
            number,
            amount: Number(
              sub.number_amounts?.[n] ||
                sub.number_amounts?.[String(n)] ||
                perNumberAmount ||
                sub.ticket_price ||
                0,
            ),
          };
        })
        .filter((item: any) => Number.isFinite(item.number) && item.number > 0);
    }

    if (sub.number) {
      return [
        {
          number: Number(sub.number),
          amount: Number(sub.total_amount || sub.ticket_price || 0),
        },
      ];
    }

    return [];
  };

  const getNumbers = (sub: any) => getItems(sub).map((item: any) => item.number);

  const getTotal = (sub: any) => {
    const items = getItems(sub);
    const itemTotal = items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
    return itemTotal || Number(sub.total_amount || 0);
  };

  const getStatusText = (status: string) => {
    if (status === "approved") return txt.approved;
    if (status === "pending") return txt.pending;
    if (status === "rejected") return txt.rejected;
    return status || "-";
  };

  const statusClass = (status: string) => {
    if (status === "approved") return "bg-green-100 text-green-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "rejected") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-200 px-3 py-1 text-sm font-bold text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-white"
          >
            ×
          </button>
        </div>

        {subs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">
            {txt.noPurchases}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto p-5">
            <div className="grid gap-4">
              {subs.map((sub: any) => {
                const items = getItems(sub);
                const numbers = getNumbers(sub);
                const total = getTotal(sub);

                return (
                  <div
                    key={sub.id || sub.submission_group_id || sub.primary_submission_id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">
                            {txt.numbers}:
                          </span>
                          {numbers.length ? (
                            numbers.map((num: any, index: number) => (
                              <span
                                key={`${num}-${index}`}
                                className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                              >
                                {num}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {items.map((item: any, index: number) => (
                            <div
                              key={`${item.number}-${index}`}
                              className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2 text-sm dark:bg-blue-950/50"
                            >
                              <span className="font-bold text-blue-700 dark:text-blue-200">
                                {item.number}
                              </span>
                              <span className="font-semibold text-gray-800 dark:text-slate-100">
                                {Number(item.amount || 0).toLocaleString()} {txt.birr}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="w-full rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-800 md:w-64">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-gray-500 dark:text-slate-400">
                            {txt.status}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(sub.status)}`}
                          >
                            {getStatusText(sub.status)}
                          </span>
                        </div>

                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-gray-500 dark:text-slate-400">
                            {txt.totalAmount}
                          </span>
                          <b className="text-gray-900 dark:text-white">
                            {Number(total || 0).toLocaleString()} {txt.birr}
                          </b>
                        </div>

                        <div className="mb-3">
                          <span className="block text-gray-500 dark:text-slate-400">
                            {txt.date}
                          </span>
                          <b className="text-gray-900 dark:text-white">
                            {sub.submitted_at
                              ? new Date(sub.submitted_at).toLocaleString(
                                  lang === "am" ? "am-ET" : "en-US",
                                )
                              : "-"}
                          </b>
                        </div>

                        {sub.receipt_url ? (
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptUrl(sub.receipt_url)}
                            className="block rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            {txt.viewReceipt}
                          </button>
                        ) : (
                          <div className="rounded-xl bg-gray-100 px-4 py-2.5 text-center text-sm font-semibold text-gray-500 dark:bg-slate-700 dark:text-slate-300">
                            {txt.noReceipt}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t px-5 py-4 text-right dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {txt.close}
          </button>
        </div>
        {selectedReceiptUrl && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelectedReceiptUrl(null)}
          >
            <div
              className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between border-b pb-3 dark:border-slate-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {txt.receiptPreview || txt.receipt}
                </h3>

                <button
                  type="button"
                  onClick={() => setSelectedReceiptUrl(null)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  {txt.close}
                </button>
              </div>

              <div className="max-h-[75vh] overflow-auto rounded-xl bg-gray-100 p-3 dark:bg-slate-800">
                <img
                  src={selectedReceiptUrl}
                  alt={txt.receiptPreview || txt.receipt}
                  className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
