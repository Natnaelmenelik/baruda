'use client';

import type { Lang } from '@/lib/i18n/translations';

type Props = {
  open: boolean;
  lang: Lang;
  isLoading: boolean;
  cancelLabel: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ReturnApprovedToPendingModal({
  open,
  lang,
  isLoading,
  cancelLabel,
  confirmLabel,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  const title =
    lang === 'am'
      ? 'ግቤቱን ወደ በመጠባበቅ መመለስ?'
      : 'Return Submission to Pending?';

  const message =
    lang === 'am'
      ? 'ይህን ግቤት ወደ በመጠባበቅ ሁኔታ መመለስ ይፈልጋሉ?'
      : 'Are you sure you want to return this submission to pending review?';

  const warning =
    lang === 'am'
      ? 'ይህ እርምጃ ቁጥሩን ነፃ አያደርገውም። ቁጥሩ በቢጫ የበመጠባበቅ ሁኔታ ይቆያል።'
      : 'This action will not release the number. It will stay pending/yellow for further review.';

  const loadingText = lang === 'am' ? 'በመመለስ ላይ...' : 'Returning...';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 dark:bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>

        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-300">{message}</p>

        <div className="mt-5 rounded-xl border border-yellow-100 bg-yellow-50 p-3 text-sm text-yellow-800">
          {warning}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {isLoading ? loadingText : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
