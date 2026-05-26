'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLang } from '@/hooks/useLang';
import { tm } from '@/lib/i18n/toastMessages';
import { translateApiError } from '@/lib/i18n/apiErrorMessages';
import { broadcastNumbersUpdate, dispatchNumbersRefresh } from '@/lib/realtime/numbersLive';

type Props = {
  value: string;
  onChange: (url: string, key?: string, holdId?: string) => void;
  holdNumbers?: number[];
  holdNumberAmounts?: Record<string, number>;
  holdTotalAmount?: number;
  clientHoldKey?: string;
  contactPhone?: string;
  onHoldExpired?: () => void;
  initialPaymentHold?: any;
};

const HOLD_STORAGE_KEY = 'baruda_payment_hold_draft';

const copy = {
  en: {
    uploadPaymentReceipt: 'Upload Payment Receipt',
    receiptUploaderHelp: 'Take a clear photo or choose from your gallery.',
    receiptFileHint: 'JPG/PNG/WebP/HEIC, max 4MB.',
    uploading: 'Uploading...',
    chooseFile: 'Choose File',
    receiptUploadedSuccessfully: 'Receipt uploaded successfully',
    receiptPreview: 'Receipt preview',
    removeUploadAgain: 'Remove / Upload Again',
    paymentHoldTimer: 'Payment hold expires in',
    holdExpired: 'Payment hold expired',
    holdCreated: 'Your numbers are reserved for 3 minutes',
    requestFailed: 'Request failed',
  },
  am: {
    uploadPaymentReceipt: 'የክፍያ ደረሰኝ ይጫኑ',
    receiptUploaderHelp: 'ግልጽ ፎቶ ያንሱ ወይም ከጋለሪ ይምረጡ።',
    receiptFileHint: 'JPG/PNG/WebP/HEIC, max 4MB.',
    uploading: 'በመጫን ላይ...',
    chooseFile: 'ፋይል ይምረጡ',
    receiptUploadedSuccessfully: 'ደረሰኝ በተሳካ ሁኔታ ተጫኗል',
    receiptPreview: 'የደረሰኝ ቅድመ እይታ',
    removeUploadAgain: 'አስወግድ / እንደገና ጫን',
    paymentHoldTimer: 'የክፍያ መያዣው የሚያበቃው',
    holdExpired: 'የክፍያ መያዣው ጊዜው አልፏል',
    holdCreated: 'ቁጥሮችዎ ለ3 ደቂቃ ተይዘዋል',
    requestFailed: 'ጥያቄው አልተሳካም',
  },
  om: {
    uploadPaymentReceipt: 'Nagahee Kafaltii Ol-kaasi',
    receiptUploaderHelp: 'Suuraa ifaa kaasi ykn galarii kee keessaa filadhu.',
    receiptFileHint: 'JPG/PNG/WebP/HEIC, max 4MB.',
    uploading: 'Ol-kaasaa jira...',
    chooseFile: 'Faayila Filadhu',
    receiptUploadedSuccessfully: "Nagaheen milkiidhaan ol-ka'eera",
    receiptPreview: 'Nagahee dursa ilaali',
    removeUploadAgain: "Balleessi / Irra deebi'ii ol-kaasi",
    paymentHoldTimer: 'Qabannaan kaffaltii kan xumuramu',
    holdExpired: 'Qabannaan kaffaltii yeroon isaa darbeera',
    holdCreated: 'Lakkoofsonni kee daqiiqaa 3f qabamaniiru',
    requestFailed: 'Gaaffiin hin milkoofne',
  },
} as const;

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function ReceiptUploader({
  value,
  onChange,
  holdNumbers = [],
  holdNumberAmounts = {},
  holdTotalAmount = 0,
  clientHoldKey,
  contactPhone,
  onHoldExpired,
  initialPaymentHold,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentHold, setPaymentHold] = useState<any>(() => {
    if (initialPaymentHold?.id) return initialPaymentHold;
    if (typeof window === 'undefined') return null;

    try {
      const raw = localStorage.getItem(HOLD_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [holdLoading, setHoldLoading] = useState(false);
  const holdToastShownRef = useRef<string | null>(null);
  const { lang } = useLang();
  const txt = copy[lang];

  useEffect(() => {
    if (!initialPaymentHold?.id) return;

    setPaymentHold(initialPaymentHold);

    if (initialPaymentHold.expires_at) {
      setRemainingSeconds(
        Math.max(
          0,
          Math.floor((new Date(initialPaymentHold.expires_at).getTime() - Date.now()) / 1000),
        ),
      );
    }
  }, [initialPaymentHold?.id, initialPaymentHold?.expires_at]);

  useEffect(() => {
    async function createOrUpdateHold() {
      if (value || holdLoading) return;
      if (!clientHoldKey) return;
      if (!holdNumbers.length) return;
      if (Number(holdTotalAmount || 0) <= 0) return;
      if (!Object.keys(holdNumberAmounts || {}).length) return;
      if (initialPaymentHold?.id) return;
      if (
        paymentHold?.id &&
        paymentHold?.client_hold_key === clientHoldKey &&
        paymentHold?.expires_at &&
        new Date(paymentHold.expires_at).getTime() > Date.now()
      ) {
        return;
      }

      try {
        setHoldLoading(true);

        const res = await fetch('/api/holds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientHoldKey,
            numbers: holdNumbers,
            numberAmounts: holdNumberAmounts,
            totalAmount: holdTotalAmount,
            contactPhone,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to reserve selected amount');
        }

        localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem('baruda_payment_hold_id', data.id);
        setPaymentHold(data);

        dispatchNumbersRefresh({
          action: 'hold_created',
          numbers: holdNumbers,
          status: 'pending',
          holdId: data?.id,
          clientHoldKey,
        });

        broadcastNumbersUpdate({
          action: 'hold_created',
          numbers: holdNumbers,
          status: 'pending',
          holdId: data?.id,
          clientHoldKey,
          source: 'receipt-uploader',
        });

        // Immediate grid refresh
                

        if (data?.id && holdToastShownRef.current !== data.id) {
          holdToastShownRef.current = data.id;
          toast.success(txt.holdCreated, { id: `hold-created-${data.id}` });
        }
      } catch (error: any) {
        toast.error(translateApiError(error, lang) || txt.requestFailed || 'Failed to reserve selected amount');
      } finally {
        setHoldLoading(false);
      }
    }

    createOrUpdateHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientHoldKey, JSON.stringify(holdNumbers), JSON.stringify(holdNumberAmounts), holdTotalAmount, value]);

  useEffect(() => {
    if (!paymentHold?.expires_at || value) return;

    let releasing = false;

    const releaseExpiredHoldNow = async () => {
      if (releasing) return;
      releasing = true;

      const holdId = paymentHold?.id;
      const fallbackNumbers = Array.isArray(paymentHold?.numbers)
        ? paymentHold.numbers
        : holdNumbers;

      let releasedNumbers = fallbackNumbers;

      try {
        if (holdId) {
          const res = await fetch(`/api/holds/${holdId}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));

          if (Array.isArray(data?.numbers) && data.numbers.length) {
            releasedNumbers = data.numbers;
          }
        }
      } catch {
        // Even if the request fails, clear the local timer UI.
        // The server-side queries ignore expired holds using expires_at > NOW().
      }

      localStorage.removeItem(HOLD_STORAGE_KEY);
      localStorage.removeItem('baruda_payment_hold_id');
      setPaymentHold(null);

      dispatchNumbersRefresh({
        action: 'hold_released',
        numbers: releasedNumbers,
        status: 'available',
        holdId,
        clientHoldKey,
      });

      broadcastNumbersUpdate({
        action: 'hold_released',
        numbers: releasedNumbers,
        status: 'available',
        holdId,
        clientHoldKey,
        source: 'receipt-uploader-expired',
      });

      toast.error(txt.holdExpired);
      onHoldExpired?.();
    };

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(paymentHold.expires_at).getTime() - Date.now()) / 1000),
      );

      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        void releaseExpiredHoldNow();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [paymentHold?.id, paymentHold?.expires_at, value, txt.holdExpired, onHoldExpired, clientHoldKey, JSON.stringify(holdNumbers)]);

  const uploadToSupabaseStorage = async (file: File) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();

    formData.append('file', file);
    if (paymentHold?.id) {
      formData.append('holdId', paymentHold.id);
    }

    const res = await fetch('/api/storage/upload-receipt', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to upload receipt');
    }

    return data as { url: string; signedUrl: string; key: string; receiptKey: string };
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const file = files[0];

    if (!file.type.startsWith('image/')) {
      toast.error(tm(lang, 'imageOnly'));
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error(tm(lang, 'imageTooLarge'));
      return;
    }

    try {
      setUploading(true);
      toast.loading(tm(lang, 'uploadLoading'), { id: 'receipt-upload' });

      const uploaded = await uploadToSupabaseStorage(file);
      const fileUrl = uploaded.signedUrl || uploaded.url || '';
      const fileKey = uploaded.receiptKey || uploaded.key || '';

      if (!fileUrl || !fileKey) {
        toast.error(tm(lang, 'uploadNoUrl'), { id: 'receipt-upload' });
        return;
      }

      onChange(fileUrl, fileKey, paymentHold?.id);
      toast.success(tm(lang, 'uploadSuccess'), { id: 'receipt-upload' });
    } catch (error: any) {
      toast.error(translateApiError(error, lang) || tm(lang, 'uploadFailed'), {
        id: 'receipt-upload',
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {paymentHold?.expires_at && !value && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center">
          <div className="text-sm font-bold text-orange-800">{txt.paymentHoldTimer}</div>
          <div className="mt-1 text-3xl font-extrabold text-orange-700">
            {formatTime(remainingSeconds)}
          </div>
        </div>
      )}

      {!value ? (
        <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 to-white p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-3xl text-white shadow-md">
            <span className="text-white">↑</span>
          </div>

          <h3 className="text-lg font-bold text-gray-900">{txt.uploadPaymentReceipt}</h3>

          <p className="mt-2 text-sm text-gray-500">
            {txt.receiptUploaderHelp}
            <br />
            {txt.receiptFileHint}
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || holdLoading}
            className="mx-auto mt-5 block rounded-xl bg-blue-600 px-8 py-3 font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? txt.uploading : txt.chooseFile}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="mb-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-green-700 shadow-sm">
            {txt.receiptUploadedSuccessfully}
          </div>

          <div className="overflow-hidden rounded-xl border bg-white p-2">
            <img src={value} alt={txt.receiptPreview} className="h-48 w-full rounded-lg object-contain" />
          </div>

          <button
            type="button"
            onClick={() => {
              onChange('', '');
              toast(tm(lang, 'receiptRemoved'));
            }}
            className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700"
          >
            {txt.removeUploadAgain}
          </button>
        </div>
      )}
    </div>
  );
}
