'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SubmitNumberModal from '@/components/SubmitNumberModal';
import { useLang } from '@/hooks/useLang';
import { apiFetch } from '@/lib/auth/client';

type NumberStatus =
  | 'available'
  | 'pending'
  | 'taken'
  | 'locked'
  | 'locked_by_me';

type NumberItem = {
  num: number;
  number?: number;
  status: NumberStatus;
};

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

async function fetchNumbers(): Promise<NumberItem[]> {
  const res = await apiFetch('/api/numbers?t=' + Date.now());
  return readJson(res);
}

export default function NumberGrid() {
  const queryClient = useQueryClient();
  const { lang } = useLang();

  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [lockingNumber, setLockingNumber] = useState<number | null>(null);

  const {
    data: numbers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['numbers'],
    queryFn: fetchNumbers,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const lockNumber = async (num: number) => {
    setLockingNumber(num);

    try {
      const res = await apiFetch('/api/numbers/lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number: num }),
      });

      await readJson(res);

      setSelectedNumber(num);

      await queryClient.invalidateQueries({ queryKey: ['numbers'] });
      await queryClient.refetchQueries({ queryKey: ['numbers'] });
    } catch (err: any) {
      toast.error(
        err.message ||
          (lang === 'am'
            ? 'ይህ ቁጥር በሌላ ተጠቃሚ ተይዟል።'
            : 'This number is currently locked by another user.')
      );

      await queryClient.invalidateQueries({ queryKey: ['numbers'] });
    } finally {
      setLockingNumber(null);
    }
  };

  const unlockNumber = async (num: number | null) => {
    if (!num) return;

    try {
      await apiFetch('/api/numbers/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number: num }),
      });
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['numbers'] });
      await queryClient.refetchQueries({ queryKey: ['numbers'] });
    }
  };

  const handleClick = (item: NumberItem) => {
    const num = item.num || item.number;

    if (!num) return;

    if (item.status === 'available') {
      lockNumber(num);
      return;
    }

    if (item.status === 'locked_by_me') {
      setSelectedNumber(num);
      return;
    }

    toast.error(
      lang === 'am'
        ? 'ይህ ቁጥር አሁን አይገኝም።'
        : 'This number is not available right now.'
    );
  };

  const handleCloseModal = async () => {
    const num = selectedNumber;
    setSelectedNumber(null);
    await unlockNumber(num);
  };

  const handleSubmitted = async () => {
    setSelectedNumber(null);
    await queryClient.invalidateQueries({ queryKey: ['numbers'] });
    await queryClient.invalidateQueries({ queryKey: ['user', 'submissions'] });
    await queryClient.refetchQueries({ queryKey: ['numbers'] });
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-500">
        {lang === 'am' ? 'ቁጥሮች በመጫን ላይ...' : 'Loading numbers...'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        {lang === 'am'
          ? 'ቁጥሮችን መጫን አልተቻለም።'
          : 'Failed to load numbers.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <Legend color="bg-gray-200" label={lang === 'am' ? 'ክፍት' : 'Available'} />
        <Legend color="bg-orange-400" label={lang === 'am' ? 'በሌላ ሰው ተይዟል' : 'Being selected'} />
        <Legend color="bg-yellow-400" label={lang === 'am' ? 'በመጠባበቅ' : 'Pending'} />
        <Legend color="bg-green-600" label={lang === 'am' ? 'ተይዟል' : 'Taken'} />
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
        {numbers.map((item) => {
          const num = item.num || item.number;
          const status = item.status;

          const colorClass =
            status === 'available'
              ? 'bg-gray-200 text-gray-900 hover:bg-gray-300 cursor-pointer border-gray-300'
              : status === 'locked_by_me'
              ? 'bg-blue-500 text-white cursor-pointer border-blue-600'
              : status === 'locked'
              ? 'bg-orange-400 text-orange-950 cursor-not-allowed border-orange-500'
              : status === 'pending'
              ? 'bg-yellow-400 text-yellow-950 cursor-not-allowed border-yellow-500'
              : 'bg-green-600 text-white cursor-not-allowed border-green-700';

          return (
            <button
              key={num}
              type="button"
              onClick={() => handleClick(item)}
              disabled={lockingNumber === num || status === 'pending' || status === 'taken' || status === 'locked'}
              className={`min-h-[48px] rounded-xl border text-sm font-bold transition active:scale-95 touch-manipulation disabled:opacity-80 ${colorClass}`}
              title={status}
            >
              {lockingNumber === num ? '...' : num}
            </button>
          );
        })}
      </div>

      {selectedNumber !== null && (
        <SubmitNumberModal
          number={selectedNumber}
          open={selectedNumber !== null}
          onClose={handleCloseModal}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-4 w-4 rounded ${color}`} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}
