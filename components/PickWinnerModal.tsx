'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '@/lib/auth/client';
import type { Lang } from '@/lib/i18n/translations';

type Props = {
  open: boolean;
  onClose: () => void;
  onPicked?: () => void;
  lang: Lang;
};

const copy = {
  en: {
    enterValidNumbersOnly: 'Enter valid numbers only.',
    duplicateNumbersNotAllowed: 'Duplicate numbers are not allowed.',
    failedPickWinner: 'Failed to pick winner.',
    winnerPicked: 'Winner picked!',
    pickWinnerTitle: 'Pick Winner',
    pickWinnerDescription:
      'Enter up to 8 numbers. Empty fields are optional. Winner is selected only from approved numbers.',
    winner: 'Winner',
    cancel: 'Cancel',
    picking: 'Picking...',
    pickWinner: 'Pick Winner',
  },
  am: {
    enterValidNumbersOnly: 'ትክክለኛ ቁጥሮችን ያስገቡ።',
    duplicateNumbersNotAllowed: 'የተደጋገሙ ቁጥሮች አይፈቀዱም።',
    failedPickWinner: 'አሸናፊ መምረጥ አልተሳካም።',
    winnerPicked: 'አሸናፊ ተመርጧል!',
    pickWinnerTitle: 'አሸናፊ ምረጥ',
    pickWinnerDescription:
      'እስከ 8 ቁጥሮች ያስገቡ። ባዶ ቦታዎች አማራጭ ናቸው። አሸናፊው የሚመረጠው ከጸደቁ ቁጥሮች ብቻ ነው።',
    winner: 'አሸናፊ',
    cancel: 'ይቅር',
    picking: 'በመምረጥ ላይ...',
    pickWinner: 'አሸናፊ ምረጥ',
  },
  om: {
    enterValidNumbersOnly: 'Lakkoofsota sirrii qofa galchi.',
    duplicateNumbersNotAllowed: "Lakkoofsota irra deebii galchuun hin danda'amu.",
    failedPickWinner: "Mo'ataa filuun hin danda'amne.",
    winnerPicked: "Mo'ataan filatameera!",
    pickWinnerTitle: "Mo'ataa Filadhu",
    pickWinnerDescription:
      "Hanga lakkoofsa 8 galchi. Bakki duwwaan dabalata. Mo'ataan lakkoofsota mirkanaa'an qofa irraa filatama.",
    winner: "Mo'ataa",
    cancel: 'Haqi',
    picking: 'Filachaa jira...',
    pickWinner: "Mo'ataa Filadhu",
  },
} as const;

export default function PickWinnerModal({ open, onClose, onPicked, lang }: Props) {
  const [values, setValues] = useState<string[]>(Array(8).fill(''));
  const [loading, setLoading] = useState(false);
  const [winner, setWinner] = useState<any>(null);

  const txt = copy[lang];

  if (!open) return null;

  const updateValue = (index: number, value: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const pickWinner = async () => {
    const numbers = values
      .map((v) => v.trim())
      .filter(Boolean)
      .map(Number);

    const invalid = numbers.some((n) => !Number.isInteger(n) || n <= 0);

    if (invalid) {
      toast.error(txt.enterValidNumbersOnly);
      return;
    }

    const unique = Array.from(new Set(numbers));

    if (unique.length !== numbers.length) {
      toast.error(txt.duplicateNumbersNotAllowed);
      return;
    }

    try {
      setLoading(true);

      const res = await apiFetch('/api/admin/pick-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: unique }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || txt.failedPickWinner);
      }

      setWinner(data.winner);
      toast.success(txt.winnerPicked);
      onPicked?.();
    } catch (err: any) {
      toast.error(err.message || txt.failedPickWinner);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {txt.pickWinnerTitle}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-200 px-3 py-1 font-bold dark:bg-slate-800"
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-slate-300">
          {txt.pickWinnerDescription}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {values.map((value, index) => (
            <input
              key={index}
              type="number"
              value={value}
              onChange={(e) => updateValue(index, e.target.value)}
              placeholder={`${index + 1}`}
              className="rounded-xl border px-3 py-3 text-center font-bold outline-none focus:border-blue-500 dark:bg-slate-900"
            />
          ))}
        </div>

        {winner && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-700 dark:bg-green-950">
            <p className="text-sm font-bold text-green-700 dark:text-green-300">
              🎉 {txt.winner}
            </p>

            <h3 className="mt-1 text-4xl font-extrabold text-green-800 dark:text-green-200">
              #{winner.number}
            </h3>

            <p className="mt-2 font-bold text-gray-800 dark:text-white">
              {winner.user_name}
            </p>

            <p className="text-sm text-gray-600 dark:text-slate-300">
              {winner.user_phone}
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-3 font-semibold"
          >
            {txt.cancel}
          </button>

          <button
            type="button"
            onClick={pickWinner}
            disabled={loading}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? txt.picking : txt.pickWinner}
          </button>
        </div>
      </div>
    </div>
  );
}
