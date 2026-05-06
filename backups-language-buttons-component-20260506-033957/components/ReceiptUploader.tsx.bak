'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useUploadThing } from '@/utils/uploadthing';
import { useLang } from '@/hooks/useLang';
import { tm } from '@/lib/i18n/toastMessages';

type Props = {
  value: string;
  onChange: (url: string, key?: string) => void;
};

const copy = {
  en: {
    uploadPaymentReceipt: 'Upload Payment Receipt',
    receiptUploaderHelp: 'Take a clear photo or choose from your gallery.',
    receiptFileHint: 'JPG/PNG, max 4MB.',
    uploading: 'Uploading...',
    chooseFile: 'Choose File',
    receiptUploadedSuccessfully: 'Receipt uploaded successfully',
    receiptPreview: 'Receipt preview',
    removeUploadAgain: 'Remove / Upload Again',
  },
  am: {
    uploadPaymentReceipt: 'የክፍያ ደረሰኝ ይጫኑ',
    receiptUploaderHelp: 'ግልጽ ፎቶ ያንሱ ወይም ከጋለሪ ይምረጡ።',
    receiptFileHint: 'JPG/PNG, max 4MB.',
    uploading: 'በመጫን ላይ...',
    chooseFile: 'ፋይል ይምረጡ',
    receiptUploadedSuccessfully: 'ደረሰኝ በተሳካ ሁኔታ ተጫኗል',
    receiptPreview: 'የደረሰኝ ቅድመ እይታ',
    removeUploadAgain: 'አስወግድ / እንደገና ጫን',
  },
  om: {
    uploadPaymentReceipt: 'Nagahee Kafaltii Ol-kaasi',
    receiptUploaderHelp: 'Suuraa ifaa kaasi ykn galarii kee keessaa filadhu.',
    receiptFileHint: 'JPG/PNG, max 4MB.',
    uploading: 'Ol-kaasaa jira...',
    chooseFile: 'Faayila Filadhu',
    receiptUploadedSuccessfully: "Nagaheen milkiidhaan ol-ka'eera",
    receiptPreview: 'Nagahee dursa ilaali',
    removeUploadAgain: "Balleessi / Irra deebi'ii ol-kaasi",
  },
} as const;

export default function ReceiptUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const { lang } = useLang();

  const txt = copy[lang];

  const { startUpload } = useUploadThing('receiptUploader', {
    headers: (): Record<string, string> => {
      const token = localStorage.getItem('token');

      if (!token) {
        return {};
      }

      return {
        Authorization: `Bearer ${token}`,
      };
    },

    onUploadBegin: () => {
      setUploading(true);
      toast.loading(tm(lang, 'uploadLoading'), { id: 'receipt-upload' });
    },

    onClientUploadComplete: (res) => {
      setUploading(false);

      const file = res?.[0];

      const fileUrl =
        file?.serverData?.url ||
        file?.ufsUrl ||
        file?.appUrl ||
        '';

      const fileKey =
        file?.serverData?.key ||
        file?.key ||
        '';

      if (!fileUrl) {
        toast.error(tm(lang, 'uploadNoUrl'), { id: 'receipt-upload' });
        return;
      }

      onChange(fileUrl, fileKey);
      toast.success(tm(lang, 'uploadSuccess'), { id: 'receipt-upload' });
    },

    onUploadError: (error) => {
      setUploading(false);
      toast.error(error.message || tm(lang, 'uploadFailed'), {
        id: 'receipt-upload',
      });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
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

    await startUpload(files);
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {!value ? (
        <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 to-white p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-3xl text-white shadow-md">
            <span className="text-white">↑</span>
          </div>

          <h3 className="text-lg font-bold text-gray-900">
            {txt.uploadPaymentReceipt}
          </h3>

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
            <img
              src={value}
              alt={txt.receiptPreview}
              className="h-48 w-full rounded-lg object-contain"
            />
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
