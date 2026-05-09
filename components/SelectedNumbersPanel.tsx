// 'use client';

// import { translations, Lang } from '@/lib/i18n/translations';

// type Props = { selectedNumbers: number[]; ticketPrice: number; onProceed: () => void; onClear: () => void; onRemove: (num: number) => void; lang: Lang; };

// export default function SelectedNumbersPanel({ selectedNumbers, ticketPrice, onProceed, onClear, onRemove, lang }: Props) {
//   const txt = translations[lang];
//   const totalAmount = ticketPrice * selectedNumbers.length;
//   return (
//     <aside className="sticky self-start p-4 bg-white border border-blue-100 shadow-lg top-4 h-fit rounded-2xl">
//       <div className="pb-3 border-b"><h3 className="text-lg font-bold text-gray-900">{txt.selectedNumbers}</h3><p className="text-sm text-gray-500">{txt.numbersLockedImmediately}</p></div>
//       {selectedNumbers.length === 0 ? <div className="py-8 text-sm text-center text-gray-500">{txt.noNumbersSelectedYet}</div> : <>
//         <div className="flex flex-wrap gap-2 pr-1 my-4 overflow-auto max-h-56">{selectedNumbers.map((num) => <button key={num} type="button" onClick={() => onRemove(num)} className="px-3 py-1 text-sm font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700" title={txt.clickToRemove}>{num}</button>)}</div>
//         <div className="p-3 space-y-2 text-sm rounded-xl bg-blue-50 text-blue-950"><div className="flex justify-between"><span>{txt.ticketPriceLower}</span><b>{ticketPrice.toLocaleString()} {txt.birr}</b></div><div className="flex justify-between"><span>{txt.quantity}</span><b>{selectedNumbers.length}</b></div><div className="flex justify-between pt-2 text-base border-t border-blue-200"><span>{txt.total}</span><b>{totalAmount.toLocaleString()} {txt.birr}</b></div></div>
//         <div className="grid grid-cols-2 gap-2 mt-4"><button type="button" onClick={onClear} className="px-4 py-3 text-sm font-semibold text-gray-700 border rounded-xl">{txt.clear}</button><button type="button" onClick={onProceed} className="px-4 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl">{txt.proceed}</button></div>
//       </>}
//     </aside>
//   );
// }
"use client";

import { translations, Lang } from "@/lib/i18n/translations";

type Props = {
  selectedNumbers: number[];
  ticketPrice: number;
  onProceed: () => void;
  onClear: () => void;
  onRemove: (num: number) => void;
  lang: Lang;
};

export default function SelectedNumbersPanel({
  selectedNumbers,
  ticketPrice,
  onProceed,
  onClear,
  onRemove,
  lang,
}: Props) {
  const txt = translations[lang];

  const quantity = selectedNumbers.length;
  const totalAmount = ticketPrice * quantity;

  return (
    <aside className="sticky top-4 h-fit max-h-[calc(100vh-330px)] self-start overflow-y-auto rounded-2xl border border-blue-100 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="pb-3 border-b dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {txt.selectedNumbers}
        </h3>

        <p className="text-sm text-gray-500 dark:text-slate-300">
          {txt.numbersLockedImmediately}
        </p>
      </div>

      {selectedNumbers.length === 0 ? (
        <div className="py-8 text-sm text-center text-gray-500 dark:text-slate-400">
          {txt.noNumbersSelectedYet}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 pr-1 my-4">
            {selectedNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onRemove(num)}
                className="px-3 py-1 text-sm font-bold text-white transition bg-blue-600 rounded-full hover:bg-red-600"
                title={txt.clickToRemove}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-2 text-sm rounded-xl bg-blue-50 text-blue-950 dark:bg-blue-950/60 dark:text-blue-100">
            <div className="flex justify-between gap-3">
              <span>{txt.ticketPriceLower}</span>
              <b>
                {ticketPrice.toLocaleString()} {txt.birr}
              </b>
            </div>

            <div className="flex justify-between gap-3">
              <span>{txt.quantity}</span>
              <b>{quantity}</b>
            </div>

            <div className="flex justify-between gap-3 pt-2 text-base border-t border-blue-200 dark:border-blue-700">
              <span>{txt.total}</span>
              <b>
                {totalAmount.toLocaleString()} {txt.birr}
              </b>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={onClear}
              className="px-4 py-3 text-sm font-semibold text-gray-700 transition border rounded-xl hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {txt.clear}
            </button>

            <button
              type="button"
              onClick={onProceed}
              className="px-4 py-3 text-sm font-semibold text-white transition bg-blue-600 rounded-xl hover:bg-blue-700"
            >
              {txt.proceed}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
