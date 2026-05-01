'use client';

type Props = {
  selectedNumbers: number[];
  ticketPrice: number;
  onProceed: () => void;
  onClear: () => void;
  onRemove: (num: number) => void;
  lang: 'en' | 'am';
};

export default function SelectedNumbersPanel({
  selectedNumbers,
  ticketPrice,
  onProceed,
  onClear,
  onRemove,
  lang,
}: Props) {
  const totalAmount = ticketPrice * selectedNumbers.length;

  return (
    <aside className="sticky top-4 h-fit self-start rounded-2xl border border-blue-100 bg-white p-4 shadow-lg">
      <div className="border-b pb-3">
        <h3 className="text-lg font-bold text-gray-900">
          {lang === 'am' ? 'የተመረጡ ቁጥሮች' : 'Selected Numbers'}
        </h3>

        <p className="text-sm text-gray-500">
          {lang === 'am'
            ? 'ቁጥሮች ሲመረጡ ወዲያውኑ ይቆለፋሉ።'
            : 'Numbers are locked immediately when selected.'}
        </p>
      </div>

      {selectedNumbers.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          {lang === 'am'
            ? 'እስካሁን ቁጥር አልመረጡም።'
            : 'No numbers selected yet.'}
        </div>
      ) : (
        <>
          <div className="my-4 flex max-h-56 flex-wrap gap-2 overflow-auto pr-1">
            {selectedNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onRemove(num)}
                className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white hover:bg-blue-700"
                title={lang === 'am' ? 'ለማስወገድ ይጫኑ' : 'Click to remove'}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="space-y-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-950">
            <div className="flex justify-between">
              <span>{lang === 'am' ? 'የቲኬት ዋጋ' : 'Ticket price'}</span>
              <b>{ticketPrice.toLocaleString()} Birr</b>
            </div>

            <div className="flex justify-between">
              <span>{lang === 'am' ? 'ብዛት' : 'Quantity'}</span>
              <b>{selectedNumbers.length}</b>
            </div>

            <div className="flex justify-between border-t border-blue-200 pt-2 text-base">
              <span>{lang === 'am' ? 'ጠቅላላ' : 'Total'}</span>
              <b>{totalAmount.toLocaleString()} Birr</b>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700"
            >
              {lang === 'am' ? 'ሁሉን ሰርዝ' : 'Clear'}
            </button>

            <button
              type="button"
              onClick={onProceed}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
            >
              {lang === 'am' ? 'ቀጥል' : 'Proceed'}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
