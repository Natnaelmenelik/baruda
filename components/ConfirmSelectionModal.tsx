'use client';

import { translations, Lang } from '@/lib/i18n/translations';

type Props = { open: boolean; selectedNumbers: number[]; ticketPrice: number; onCancel: () => void; onConfirm: () => void; lang: Lang; };

export default function ConfirmSelectionModal({ open, selectedNumbers, ticketPrice, onCancel, onConfirm, lang }: Props) {
  if (!open) return null;
  const txt = translations[lang];
  const totalAmount = ticketPrice * selectedNumbers.length;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold">{txt.confirmSelection}</h2>
        <p className="mt-3 text-sm text-gray-600">{txt.confirmSelectionMessage}</p>
        <div className="mt-4 flex flex-wrap gap-2">{selectedNumbers.map((num) => <span key={num} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">{num}</span>)}</div>
        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>{txt.ticketPrice}</span><b>{ticketPrice.toLocaleString()} {txt.birr}</b></div>
          <div className="flex justify-between"><span>{txt.quantity}</span><b>{selectedNumbers.length}</b></div>
          <div className="mt-2 flex justify-between border-t pt-2"><span>{txt.total}</span><b>{totalAmount.toLocaleString()} {txt.birr}</b></div>
        </div>
        <div className="mt-6 flex gap-3"><button onClick={onCancel} className="flex-1 rounded-xl border px-4 py-3 font-semibold">{txt.cancel}</button><button onClick={onConfirm} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{txt.yesProceed}</button></div>
      </div>
    </div>
  );
}
