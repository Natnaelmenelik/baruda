'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLang } from '@/hooks/useLang';
import { tm } from '@/lib/i18n/toastMessages';
import { translateApiError } from '@/lib/i18n/apiErrorMessages';

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
const SERVER_OFFSET_STORAGE_KEY = 'baruda_server_offset_ms';

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
    requestFailed: 'Gaaffiin hin milkoofne',
  },
} as const;

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function saveServerOffset(serverNow?: string) {
  if (typeof window === 'undefined' || !serverNow) return;

  const serverNowMs = new Date(serverNow).getTime();
  if (!Number.isFinite(serverNowMs)) return;

  const offsetMs = serverNowMs - Date.now();
  localStorage.setItem(SERVER_OFFSET_STORAGE_KEY, String(Math.round(offsetMs)));
}

function getCorrectedNow() {
  if (typeof window === 'undefined') return Date.now();

  const offsetMs = Number(localStorage.getItem(SERVER_OFFSET_STORAGE_KEY) || '0');
  return Date.now() + (Number.isFinite(offsetMs) ? offsetMs : 0);
}

function calculateRemainingSeconds(expiresAt?: string) {
  if (!expiresAt) return 180;

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return 180;

  return Math.max(0, Math.ceil((expiresAtMs - getCorrectedNow()) / 1000));
}

function readStoredHold() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(HOLD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ReceiptUploader({
  value,
  onChange,
  onHoldExpired,
  initialPaymentHold,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  /*
    IMPORTANT:
    SubmitNumberModal owns hold creation/release.
    ReceiptUploader only displays the timer and uploads the receipt.
    This avoids duplicate POST /api/holds calls after refresh.
  */
  const [storedPaymentHold] = useState(() => readStoredHold());

  const paymentHold = initialPaymentHold?.id ? initialPaymentHold : storedPaymentHold;
  const paymentHoldId = paymentHold?.id;
  const paymentHoldExpiresAt = paymentHold?.expires_at;
  const paymentHoldServerNow = paymentHold?.server_now;

  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    calculateRemainingSeconds(paymentHoldExpiresAt),
  );

  const holdExpiredHandledRef = useRef(false);
  const { lang } = useLang();
  const txt = copy[lang];

  useEffect(() => {
    if (!paymentHoldId) return;

    saveServerOffset(paymentHoldServerNow);
    holdExpiredHandledRef.current = false;
    setRemainingSeconds(calculateRemainingSeconds(paymentHoldExpiresAt));
  }, [paymentHoldId, paymentHoldExpiresAt, paymentHoldServerNow]);

  useEffect(() => {
    if (!paymentHoldExpiresAt || value) return;

    const tick = () => {
      const remaining = calculateRemainingSeconds(paymentHoldExpiresAt);

      setRemainingSeconds((prev) => (prev === remaining ? prev : remaining));

      if (remaining <= 0 && !holdExpiredHandledRef.current) {
        holdExpiredHandledRef.current = true;
        toast.error(txt.holdExpired);
        onHoldExpired?.();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
    // Keep this dependency list intentionally small and primitive.
    // onHoldExpired/txt can change parent references and restart the interval loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentHoldExpiresAt, value]);

  const uploadToSupabaseStorage = async (file: File) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();

    formData.append('file', file);
    if (paymentHoldId) {
      formData.append('holdId', paymentHoldId);
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

      onChange(fileUrl, fileKey, paymentHoldId);
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
      {paymentHoldExpiresAt && !value && (
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
            disabled={uploading}
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
