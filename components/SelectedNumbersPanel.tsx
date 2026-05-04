'use client';

import { translations, Lang } from '@/lib/i18n/translations';

type Props = { selectedNumbers: number[]; ticketPrice: number; onProceed: () => void; onClear: () => void; onRemove: (num: number) => void; lang: Lang; };

export default function SelectedNumbersPanel({ selectedNumbers, ticketPrice, onProceed, onClear, onRemove, lang }: Props) {
  const txt = translations[lang];
  const totalAmount = ticketPrice * selectedNumbers.length;
  return (
    <aside className="sticky top-4 h-fit self-start rounded-2xl border border-blue-100 bg-white p-4 shadow-lg">
      <div className="border-b pb-3"><h3 className="text-lg font-bold text-gray-900">{txt.selectedNumbers}</h3><p className="text-sm text-gray-500">{txt.numbersLockedImmediately}</p></div>
      {selectedNumbers.length === 0 ? <div className="py-8 text-center text-sm text-gray-500">{txt.noNumbersSelectedYet}</div> : <>
        <div className="my-4 flex max-h-56 flex-wrap gap-2 overflow-auto pr-1">{selectedNumbers.map((num) => <button key={num} type="button" onClick={() => onRemove(num)} className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white hover:bg-blue-700" title={txt.clickToRemove}>{num}</button>)}</div>
        <div className="space-y-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-950"><div className="flex justify-between"><span>{txt.ticketPriceLower}</span><b>{ticketPrice.toLocaleString()} {txt.birr}</b></div><div className="flex justify-between"><span>{txt.quantity}</span><b>{selectedNumbers.length}</b></div><div className="flex justify-between border-t border-blue-200 pt-2 text-base"><span>{txt.total}</span><b>{totalAmount.toLocaleString()} {txt.birr}</b></div></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onClear} className="rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700">{txt.clear}</button><button type="button" onClick={onProceed} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">{txt.proceed}</button></div>
      </>}
    </aside>
  );
}
