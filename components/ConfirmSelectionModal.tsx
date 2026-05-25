"use client";

import { translations, Lang } from "@/lib/i18n/translations";

type PoolTarget = {
  number: number;
  target: number;
  current: number;
  remaining: number;
  status: string;
};

type Props = {
  open: boolean;
  selectedNumbers: number[];
  amounts: Record<number, string>;
  targetsByNumber: Record<number, PoolTarget>;
  onCancel: () => void;
  onConfirm: () => void;
  lang: Lang;
};

export default function ConfirmSelectionModal({
  open,
  selectedNumbers,
  amounts,
  targetsByNumber,
  onCancel,
  onConfirm,
  lang,
}: Props) {
  const txt = (translations[lang] || translations.am || translations.en) as Record<string, string>;

  if (!open) return null;

  const totalAmount = selectedNumbers.reduce(
    (sum, num) => sum + Number(amounts[num] || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {txt.confirmSelection}
        </h2>

        <p className="mt-2 text-sm text-gray-500 dark:text-slate-300">
          {txt.reviewContributionBeforeUpload}
        </p>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-xl bg-gray-50 p-3 dark:bg-slate-800">
          {selectedNumbers.map((num) => {
            const pool = targetsByNumber[num];
            const amount = Number(amounts[num] || 0);

            return (
              <div
                key={num}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-900"
              >
                <div>
                  <b className="text-gray-900 dark:text-white">{num}</b>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {txt.remainingAmount}:{" "}
                    {Number(pool?.remaining || 0).toLocaleString()} {txt.birr}
                  </p>
                </div>
                <b className="text-blue-700 dark:text-blue-300">
                  {amount.toLocaleString()} {txt.birr}
                </b>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl bg-blue-50 p-3 text-blue-950 dark:bg-blue-950/60 dark:text-blue-100">
          <div className="flex justify-between text-sm">
            <span>{txt.quantity}</span>
            <b>{selectedNumbers.length}</b>
          </div>
          <div className="mt-2 flex justify-between border-t border-blue-200 pt-2 text-base dark:border-blue-700">
            <span>{txt.totalContribution}</span>
            <b>
              {totalAmount.toLocaleString()} {txt.birr}
            </b>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {txt.cancel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            {txt.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
