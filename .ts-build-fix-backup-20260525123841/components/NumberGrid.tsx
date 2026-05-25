"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNumberSummaryRealtime, type NumberSummaryCacheRow } from '@/hooks/useNumberSummaryRealtime';
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SubmitNumberModal from "@/components/SubmitNumberModal";
import SelectedNumbersPanel from "@/components/SelectedNumbersPanel";
import ConfirmSelectionModal from "@/components/ConfirmSelectionModal";
import { useLang } from "@/hooks/useLang";
import { apiFetch } from "@/lib/auth/client";
import { translations } from "@/lib/i18n/translations";
import { translateApiError } from "@/lib/i18n/apiErrorMessages";

const SELECTED_NUMBERS_STORAGE_KEY = "baruda_selected_numbers";


type NumberStatus = "available" | "pending" | "taken" | "locked" | "locked_by_me" | "open" | "closed";

type NumberItem = {
  num?: number;
  number?: number;
  status?: NumberStatus;
  target?: number;
  current?: number;
  remaining?: number;
  target_amount?: number;
  current_amount?: number;
  remaining_amount?: number;
  sold_amount?: number;
  approved_amount?: number;
  pending_amount?: number;
  hold_amount?: number;
};

type PoolTarget = {
  number: number;
  target: number;
  current: number;
  remaining: number;
  status: string;
};

type NumbersApiResponse = {
  numbers: NumberItem[];
  gridSize: number;
};

const SELECTED_KEY = "lottery_selected_numbers";
const AMOUNTS_KEY = "lottery_contribution_amounts";

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function normalizeNumbersResponse(data: any): NumbersApiResponse {
  if (Array.isArray(data)) {
    return { numbers: data, gridSize: data.length || 2000 };
  }

  return {
    numbers: Array.isArray(data?.numbers) ? data.numbers : [],
    gridSize: Number(data?.gridSize || data?.grid_size || 2000),
  };
}


function applyLiveNumberPatch(oldData: any, payload: any) {
  if (!oldData) return oldData;

  const affected = new Set(
    Array.isArray(payload?.numbers)
      ? payload.numbers.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n))
      : [],
  );

  if (!affected.size) return oldData;

  const nextStatus =
    payload?.status === "available" || payload?.action === "hold_released"
      ? "available"
      : payload?.status === "taken" || payload?.status === "closed"
        ? "taken"
        : "pending";

  const patchItem = (item: any) => {
    const n = Number(item?.number ?? item?.num);
    if (!affected.has(n)) return item;
    return { ...item, status: nextStatus };
  };

  if (Array.isArray(oldData)) return oldData.map(patchItem);

  if (Array.isArray(oldData?.numbers)) {
    return { ...oldData, numbers: oldData.numbers.map(patchItem) };
  }

  return oldData;
}


function normalizeSummaryCacheRow(row: any): NumberItem | null {
  const number = Number(row?.number ?? row?.num);
  if (!Number.isInteger(number) || number <= 0) return null;

  const target = Number(row?.target_amount ?? row?.target ?? 0);
  const approved = Number(row?.approved_amount ?? row?.sold_amount ?? row?.current_amount ?? row?.current ?? 0);
  const pending = Number(row?.pending_amount ?? 0);
  const hold = Number(row?.hold_amount ?? 0);
  const remaining = Number(row?.remaining_amount ?? Math.max(target - approved - pending - hold, 0));
  const rawStatus = String(row?.status || '').toLowerCase();
  const status: NumberStatus = rawStatus === 'sold' || rawStatus === 'closed' || remaining <= 0
    ? 'taken'
    : pending > 0 || hold > 0 || rawStatus === 'pending'
      ? 'pending'
      : 'available';

  return {
    num: number,
    number,
    status,
    target: target,
    current: approved,
    remaining,
    target_amount: target,
    current_amount: approved,
    sold_amount: approved,
    approved_amount: approved,
    pending_amount: pending,
    hold_amount: hold,
    remaining_amount: remaining,
  };
}

function patchNumberInQueryData(oldData: any, row: any) {
  const patched = normalizeSummaryCacheRow(row);
  if (!patched) return oldData;

  const patchItem = (item: any) => {
    const n = Number(item?.number ?? item?.num);
    return n === patched.number ? { ...item, ...patched } : item;
  };

  if (Array.isArray(oldData)) {
    const exists = oldData.some((item) => Number(item?.number ?? item?.num) === patched.number);
    return exists ? oldData.map(patchItem) : [...oldData, patched].sort((a, b) => Number(a.number ?? a.num) - Number(b.number ?? b.num));
  }

  if (Array.isArray(oldData?.numbers)) {
    const exists = oldData.numbers.some((item: any) => Number(item?.number ?? item?.num) === patched.number);
    const numbers = exists
      ? oldData.numbers.map(patchItem)
      : [...oldData.numbers, patched].sort((a: any, b: any) => Number(a.number ?? a.num) - Number(b.number ?? b.num));
    return { ...oldData, numbers };
  }

  return oldData;
}

async function fetchNumbers(): Promise<NumbersApiResponse> {
  const res = await apiFetch("/api/numbers");
  return normalizeNumbersResponse(await readJson(res));
}

export default function NumberGrid() {
  const queryClient = useQueryClient();

  const handleNumberSummaryRealtime = useCallback((row: any) => {
    queryClient.setQueryData(["numbers"], (oldData: any) =>
      patchNumberInQueryData(oldData, row),
    );
  }, [queryClient]);
  
  useNumberSummaryRealtime(handleNumberSummaryRealtime);
const { lang } = useLang();
  const txt = translations[lang];

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(SELECTED_NUMBERS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed)
        ? parsed.map(Number).filter((num) => Number.isFinite(num))
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      SELECTED_NUMBERS_STORAGE_KEY,
      JSON.stringify(selectedNumbers),
    );
  }, [selectedNumbers]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [searchNumber, setSearchNumber] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 250;

  const numberRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const {
    data: numbersData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["numbers"],
    queryFn: fetchNumbers,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

const numbers: NumberItem[] = Array.isArray(numbersData?.numbers)
    ? numbersData.numbers
    : [];

  const gridSize = Number(numbersData?.gridSize || numbers.length || 2000);

  const targetsByNumber = useMemo(() => {
    const map: Record<number, PoolTarget> = {};

    for (const item of numbers) {
      const number = Number(item.number ?? item.num);
      if (!Number.isFinite(number) || number <= 0) continue;

      const target = Number(item.target ?? item.target_amount ?? 0);
      const current = Number(
        item.current ?? item.current_amount ?? item.sold_amount ?? 0,
      );
      const remaining = Number(
        item.remaining ?? item.remaining_amount ?? Math.max(target - current, 0),
      );

      map[number] = {
        number,
        target,
        current,
        remaining,
        status: String(item.status || (remaining <= 0 ? "closed" : "open")),
      };
    }

    return map;
  }, [numbers]);

  const safeNumbers = useMemo(() => {
    const raw = Array.isArray(numbers) && numbers.length
      ? numbers
      : Array.from({ length: gridSize }, (_, i) => ({ num: i + 1, status: "available" as NumberStatus }));

    return raw.map((item) => {
      const num = Number(('num' in item ? item.num : item.number));
      const pool = targetsByNumber[num];
      const remaining = Number(pool?.remaining ?? ('remaining' in item ? item.remaining : 1));
      const statusFromPool = pool?.status;
      const status =
        statusFromPool === "closed" || remaining <= 0 || item.status === "taken"
          ? "taken"
          : item.status === "pending"
            ? "pending"
            : "available";

      return {
        ...item,
        num,
        status,
        target: pool?.target ?? item.target ?? item.target_amount,
        current: pool?.current ?? item.current ?? item.current_amount,
        remaining,
      };
    });
  }, [numbers, gridSize, targetsByNumber]);

  const totalPages = Math.max(Math.ceil(safeNumbers.length / PAGE_SIZE), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleNumbers = safeNumbers.slice(startIndex, endIndex);

  useEffect(() => {
    try {
      const savedNumbers = localStorage.getItem(SELECTED_KEY);
      const savedAmounts = localStorage.getItem(AMOUNTS_KEY);

      if (savedNumbers) {
        const parsed = JSON.parse(savedNumbers);
        if (Array.isArray(parsed)) {
          setSelectedNumbers(parsed.map(Number).filter(Boolean));
        }
      }

      if (savedAmounts) {
        const parsed = JSON.parse(savedAmounts);
        if (parsed && typeof parsed === "object") setAmounts(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedNumbers));
  }, [selectedNumbers]);

  useEffect(() => {
    localStorage.setItem(AMOUNTS_KEY, JSON.stringify(amounts));
  }, [amounts]);

  useEffect(() => {
    if (!searchNumber) return;
    const num = Number(searchNumber);
    if (!num || num < 1 || num > safeNumbers.length) return;

    const page = Math.ceil(num / PAGE_SIZE);
    setCurrentPage(page);

    setTimeout(() => {
      numberRefs.current[num]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
  }, [searchNumber, safeNumbers.length]);

  const removeNumber = (num: number) => {
    setSelectedNumbers((prev) => prev.filter((n) => n !== num));
    setAmounts((prev) => {
      const next = { ...prev };
      delete next[num];
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedNumbers([]);
    setAmounts({});
    localStorage.removeItem(SELECTED_KEY);
    localStorage.removeItem(AMOUNTS_KEY);
  };

  const handleClick = (item: NumberItem) => {
    const num = Number(('num' in item ? item.num : item.number));
    if (!num) return;

    const selected = selectedNumbers.includes(num);

    if (selected) {
      removeNumber(num);
      return;
    }

    if (item.status === "taken" || item.status === "closed") {
      toast.error(txt.numberAlreadyTaken || "Number is already taken.");
      return;
    }

    setSelectedNumbers((prev) =>
      Array.from(new Set([...prev, num])).sort((a, b) => a - b)
    );
  };

  const handleAmountChange = (num: number, value: string) => {
    setAmounts((prev) => ({ ...prev, [num]: value }));
  };

const handleProceed = async () => {
    if (!selectedNumbers.length) {
      toast.error(txt.selectAtLeastOneNumber);
      return;
    }

    for (const num of selectedNumbers) {
      const amount = Number(amounts[num] || 0);
      const pool = targetsByNumber[num];
      const remaining = Number(pool?.remaining || 0);

      if (!amount || amount <= 0) {
        toast.error(txt.amountMustBePositive);
        return;
      }

      if (amount < 500) {
        toast.error(txt.minimumContributionAmount || "Minimum amount is 500 Birr");
        return;
      }

      if (amount % 500 !== 0) {
        toast.error(txt.amountMustBeMultipleOf500 || "Amount must be in multiples of 500");
        return;
      }

      if (pool && amount > remaining) {
        toast.error(txt.amountExceedsRemaining);
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleSubmitted = async () => {
    clearSelection();
    // Number status updates now arrive from number_status_summary_cache realtime.
  };

  if (isLoading) {
    return <div className="p-8 text-center">{txt.loading}</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center text-red-600">
        {txt.failedToLoadNumbers}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {txt.chooseYourNumbers}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-300">
            {txt.availableWhiteTakenGreen}
          </p>
        </div>

        <input
          type="number"
          value={searchNumber}
          onChange={(e) => setSearchNumber(e.target.value)}
          placeholder={txt.searchNumber}
          className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white md:w-64"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-1 xl:order-2">
          <SelectedNumbersPanel
            selectedNumbers={selectedNumbers}
            amounts={amounts}
            targetsByNumber={targetsByNumber}
            onAmountChange={handleAmountChange}
            onProceed={handleProceed}
            onClear={clearSelection}
            onRemove={removeNumber}
            lang={lang}
          />
        </div>

        <div className="order-2 xl:order-1 space-y-4">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16">
            {visibleNumbers.map((item) => {
              const num = Number(('num' in item ? item.num : item.number));
              const selected = selectedNumbers.includes(num);
              const status = item.status || "available";

              let colorClass =
                "border-gray-200 bg-white text-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

              if (status === "taken" || status === "closed") {
                colorClass =
                  "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200";
              }

              if (status === "pending") {
                colorClass =
                  "border-yellow-300 bg-yellow-100 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200";
              }

              if (selected) {
                colorClass =
                  "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none";
              }

              return (
                <button
                  key={num}
                  ref={(el) => {
                    numberRefs.current[num] = el;
                  }}
                  type="button"
                  onClick={() => handleClick(item)}
                  disabled={!selected && (status === "taken" || status === "closed")}
                  className={`min-h-[46px] rounded-xl border text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-80 sm:min-h-[48px] ${colorClass}`}
                  title={String(status)}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              {txt.page} {safeCurrentPage} / {totalPages} — {startIndex + 1} -{" "}
              {Math.min(endIndex, safeNumbers.length)}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={safeCurrentPage <= 1}
                className="flex-1 rounded-lg border px-4 py-2 font-semibold disabled:opacity-40 dark:border-slate-700 sm:flex-none"
              >
                {txt.previous}
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={safeCurrentPage >= totalPages}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40 sm:flex-none"
              >
                {txt.next}
              </button>
            </div>
          </div>

        </div>
      </div>

      <ConfirmSelectionModal
        open={showConfirmModal}
        selectedNumbers={selectedNumbers}
        amounts={amounts}
        targetsByNumber={targetsByNumber}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          setShowReceiptModal(true);
        }}
        lang={lang}
      />

      <SubmitNumberModal
        open={showReceiptModal}
        selectedNumbers={selectedNumbers}
        amounts={amounts}
        targetsByNumber={targetsByNumber}
        numberPools={targetsByNumber}
        pools={targetsByNumber}
        onClose={() => setShowReceiptModal(false)}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}
