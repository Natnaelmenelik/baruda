"use client";

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
    birr: "Birr",
    approved: "approved",
    pending: "pending",
    rejected: "rejected",
  },
  am: {
    noPurchases: "ምንም ግዢ የለም።",
    date: "ቀን",
    birr: "ብር",
    approved: "ጸድቋል",
    pending: "በመጠባበቅ ላይ",
    rejected: "ውድቅ ተደርጓል",
  },
  om: {
    noPurchases: "Bittoonni hin argamne.",
    date: "Guyyaa",
    birr: "Birrii",
    approved: "mirkanaa'eera",
    pending: "eeggannaa irra",
    rejected: "kufifameera",
  },
} as const;

export default function MyPurchasesModal({
  open,
  onClose,
  subs,
  lang,
  title,
}: Props) {
  if (!open) return null;

  const txt = copy[lang];

  const getSubmissionNumbers = (sub: any) => {
    if (Array.isArray(sub.numbers) && sub.numbers.length > 0)
      return sub.numbers;
    if (sub.number) return [sub.number];
    return [];
  };

  const getStatusText = (status: string) => {
    if (status === "approved") return txt.approved;
    if (status === "pending") return txt.pending;
    if (status === "rejected") return txt.rejected;
    return status;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-sm font-semibold bg-gray-200 rounded-lg"
          >
            ×
          </button>
        </div>

        {subs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{txt.noPurchases}</div>
        ) : (
          <div className="max-h-[68vh] overflow-y-auto pr-1">
            <div className="grid gap-3">
              {subs.map((s: any) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-3 p-3 border rounded-xl sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {getSubmissionNumbers(s).map((num: any) => (
                        <span
                          key={num}
                          className="px-3 py-1 text-sm font-bold text-blue-800 bg-blue-100 rounded-full"
                        >
                          {num}
                        </span>
                      ))}
                    </div>

                    {s.total_amount && (
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {Number(s.total_amount).toLocaleString()} {txt.birr}
                      </p>
                    )}
                  </div>

                  <div className="w-full text-left text-base font-semibold text-slate-600 sm:w-auto sm:min-w-[180px] sm:text-right">
                    <div className="text-lg font-extrabold text-slate-800">
                      {txt.date}
                    </div>
                    <div>
                      {s.submitted_at
                        ? new Date(s.submitted_at).toLocaleString()
                        : "-"}
                    </div>
                  </div>

                  <span
                    className={`w-fit whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                      s.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : s.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {getStatusText(s.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
