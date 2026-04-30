'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import ReceiptUploader from '@/components/ReceiptUploader';
import { useLang } from '@/hooks/useLang';
import { tm } from '@/lib/i18n/toastMessages';

type Props = {
  number: number;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function SubmitNumberModal({
  number,
  open,
  onClose,
  onSubmitted,
}: Props) {
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptKey, setReceiptKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { lang } = useLang();

  if (!open) return null;

  const handleSubmit = async () => {
    setError('');

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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          number,
          receiptUrl,
          receiptKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || tm(lang, 'submitFailed');
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
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-xl font-bold">
              {lang === 'am'
                ? `ቁጥር #${number} ያስገቡ`
                : `Submit Number #${number}`}
            </h2>

            <p className="text-sm text-gray-600">
              {lang === 'am'
                ? 'ከማስገባትዎ በፊት የክፍያ ደረሰኝ ይጫኑ።'
                : 'Upload payment receipt before submitting.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg bg-gray-200 px-3 py-1 text-sm font-semibold disabled:opacity-50"
          >
            ✕
          </button>
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
            {lang === 'am' ? 'ይቅር' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !receiptUrl}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {submitting
              ? lang === 'am'
                ? 'በመላክ ላይ...'
                : 'Submitting...'
              : lang === 'am'
              ? 'አስገባ'
              : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
