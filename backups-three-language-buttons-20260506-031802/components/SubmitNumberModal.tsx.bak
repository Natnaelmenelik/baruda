'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import ReceiptUploader from '@/components/ReceiptUploader';
import { useLang } from '@/hooks/useLang';
import { tm } from '@/lib/i18n/toastMessages';

type Props = {
  selectedNumbers: number[];
  ticketPrice: number;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

const copy = {
  en: {
    uploadReceipt: 'Upload Receipt',
    selectedNumbersColon: 'Selected numbers:',
    paymentDetails: 'Payment Details',
    cbe: 'CBE',
    telebirr: 'Telebirr',
    ticketPrice: 'Ticket Price',
    quantity: 'Quantity',
    totalAmount: 'Total Amount',
    birr: 'Birr',
    afterPaymentUploadReceipt: 'After payment, upload your receipt screenshot/image.',
    cancel: 'Cancel',
    submit: 'Submit',
    submitting: 'Submitting...',
    selectAtLeastOneNumber: 'Please select at least one number.',
  },
  am: {
    uploadReceipt: 'ደረሰኝ ይጫኑ',
    selectedNumbersColon: 'የተመረጡ ቁጥሮች:',
    paymentDetails: 'የክፍያ መረጃ',
    cbe: 'ንግድ ባንክ',
    telebirr: 'ቴሌብር',
    ticketPrice: 'የቲኬት ዋጋ',
    quantity: 'ብዛት',
    totalAmount: 'ጠቅላላ መጠን',
    birr: 'ብር',
    afterPaymentUploadReceipt: 'ክፍያውን ካደረጉ በኋላ የደረሰኝ ምስል ይጫኑ።',
    cancel: 'ይቅር',
    submit: 'አስገባ',
    submitting: 'በመላክ ላይ...',
    selectAtLeastOneNumber: 'ቢያንስ አንድ ቁጥር ይምረጡ።',
  },
  om: {
    uploadReceipt: 'Nagahee Ol-kaasi',
    selectedNumbersColon: 'Lakkoofsota filataman:',
    paymentDetails: 'Odeeffannoo Kafaltii',
    cbe: 'Baankii daldalaa',
    telebirr: 'Telee-birrii',
    ticketPrice: 'Gatii Tikkeetii',
    quantity: "Baay'ina",
    totalAmount: 'Waliigala Gatii',
    birr: 'Birrii',
    afterPaymentUploadReceipt: 'Erga kaffaltanii booda suuraa nagahee keessanii ol-kaasaa.',
    cancel: 'Haqi',
    submit: 'Galchi',
    submitting: 'Galchaa jira...',
    selectAtLeastOneNumber: 'Maaloo yoo xiqqaate lakkoofsa tokko filadhu.',
  },
} as const;

export default function SubmitNumberModal({
  selectedNumbers,
  ticketPrice,
  open,
  onClose,
  onSubmitted,
}: Props) {
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptKey, setReceiptKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { lang } = useLang();

  const txt = copy[lang];

  if (!open) return null;

  const quantity = selectedNumbers.length;
  const totalAmount = ticketPrice * quantity;

  const handleSubmit = async () => {
    setError('');

    if (!selectedNumbers.length) {
      const msg = txt.selectAtLeastOneNumber;
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!receiptUrl) {
      const msg = tm(lang, 'receiptRequired');
      setError(msg);
      toast.error(msg);
      return;
    }

    if (receiptUrl.startsWith('data:image')) {
      const msg = tm(lang, 'invalidReceipt');
      setError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    toast.loading(tm(lang, 'submitLoading'), { id: 'submit-number' });

    try {
      const token = localStorage.getItem('token');

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          numbers: selectedNumbers,
          receiptUrl,
          receiptKey,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const details = [...(data.taken || []), ...(data.locked || [])];
        const msg = details.length
          ? `${data.error}: ${details.join(', ')}`
          : data.error || tm(lang, 'submitFailed');

        setError(msg);
        toast.error(msg, { id: 'submit-number' });
        return;
      }

      toast.success(tm(lang, 'submitSuccess'), { id: 'submit-number' });
      setReceiptUrl('');
      setReceiptKey('');
      onSubmitted?.();
      onClose();
    } catch {
      const msg = tm(lang, 'networkError');
      setError(msg);
      toast.error(msg, { id: 'submit-number' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:rounded-2xl">
        <div className="mb-4 flex items-start justify-between border-b pb-3">
          <div>
            <h2 className="text-xl font-bold">{txt.uploadReceipt}</h2>

            <p className="text-base font-semibold text-gray-700">
              {txt.selectedNumbersColon} {selectedNumbers.join(', ')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg bg-gray-200 px-3 py-1 text-sm font-semibold disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <h3 className="mb-3 text-sm font-bold text-blue-900">
            {txt.paymentDetails}
          </h3>

          <div className="space-y-2 text-sm text-blue-900">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">
                <span
                  className="text-lg font-extrabold"
                  style={{ color: '#5A3A1A' }}
                >
                  {txt.cbe}
                </span>
              </span>

              <span className="text-right font-mono">
                <span
                  className="text-lg font-extrabold"
                  style={{ color: '#5A3A1A' }}
                >
                  1000251763646
                </span>
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="font-semibold">
                <span
                  className="text-lg font-extrabold"
                  style={{ color: '#00A651' }}
                >
                  {txt.telebirr}
                </span>
              </span>

              <span className="text-right font-mono">
                <span
                  className="text-lg font-extrabold"
                  style={{ color: '#00A651' }}
                >
                  0911121314
                </span>
              </span>
            </div>

            <div className="mt-3 space-y-2 border-t border-blue-200 pt-3">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">{txt.ticketPrice}</span>
                <span className="font-bold">
                  {ticketPrice.toLocaleString()} {txt.birr}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="font-semibold">{txt.quantity}</span>
                <span className="font-bold">{quantity}</span>
              </div>

              <div className="flex justify-between gap-3 text-base">
                <span className="font-bold">{txt.totalAmount}</span>
                <span className="font-extrabold">
                  {totalAmount.toLocaleString()} {txt.birr}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-blue-700">
            {txt.afterPaymentUploadReceipt}
          </p>
        </div>

        <ReceiptUploader
          value={receiptUrl}
          onChange={(url, key) => {
            setReceiptUrl(url);
            setReceiptKey(key || '');
          }}
        />

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border px-4 py-3 font-semibold disabled:opacity-50"
          >
            {txt.cancel}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !receiptUrl || !selectedNumbers.length}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? txt.submitting : txt.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
