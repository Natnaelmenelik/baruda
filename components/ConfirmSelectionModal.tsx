'use client';

type Props = {
  open: boolean;
  selectedNumbers: number[];
  ticketPrice: number;
  onCancel: () => void;
  onConfirm: () => void;
  lang: 'en' | 'am';
};

export default function ConfirmSelectionModal({
  open,
  selectedNumbers,
  ticketPrice,
  onCancel,
  onConfirm,
  lang,
}: Props) {
  if (!open) return null;

  const totalAmount = ticketPrice * selectedNumbers.length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold">
          {lang === 'am' ? 'ምርጫዎን ያረጋግጡ' : 'Confirm Selection'}
        </h2>

        <p className="mt-3 text-sm text-gray-600">
          {lang === 'am'
            ? 'እነዚህን ቁጥሮች ለመቀጠል ይፈልጋሉ?'
            : 'Do you want to proceed with these selected numbers?'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {selectedNumbers.map((num) => (
            <span key={num} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
              {num}
            </span>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">
          <div className="flex justify-between">
            <span>{lang === 'am' ? 'የቲኬት ዋጋ' : 'Ticket Price'}</span>
            <b>{ticketPrice.toLocaleString()} Birr</b>
          </div>
          <div className="flex justify-between">
            <span>{lang === 'am' ? 'ብዛት' : 'Quantity'}</span>
            <b>{selectedNumbers.length}</b>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2">
            <span>{lang === 'am' ? 'ጠቅላላ' : 'Total'}</span>
            <b>{totalAmount.toLocaleString()} Birr</b>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border px-4 py-3 font-semibold">
            {lang === 'am' ? 'ይቅር' : 'Cancel'}
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">
            {lang === 'am' ? 'አዎ፣ ቀጥል' : 'Yes, Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}
