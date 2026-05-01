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

export default function ReceiptUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const { lang } = useLang();

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
            {lang === 'am' ? 'የክፍያ ደረሰኝ ይጫኑ' : 'Upload Payment Receipt'}
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            {lang === 'am'
              ? 'ግልጽ ፎቶ ያንሱ ወይም ከጋለሪ ይምረጡ።'
              : 'Take a clear photo or choose from your gallery.'}
            <br />
            JPG/PNG, max 4MB.
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
            {uploading
              ? lang === 'am'
                ? 'በመጫን ላይ...'
                : 'Uploading...'
              : lang === 'am'
              ? 'ፋይል ይምረጡ'
              : 'Choose File'}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="mb-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-green-700 shadow-sm">
            {lang === 'am'
              ? 'ደረሰኝ በተሳካ ሁኔታ ተጫኗል'
              : 'Receipt uploaded successfully'}
          </div>

          <div className="overflow-hidden rounded-xl border bg-white p-2">
            <img
              src={value}
              alt="Receipt preview"
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
            {lang === 'am' ? 'አስወግድ / እንደገና ጫን' : 'Remove / Upload Again'}
          </button>
        </div>
      )}
    </div>
  );
}
