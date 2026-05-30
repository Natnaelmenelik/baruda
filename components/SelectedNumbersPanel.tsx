"use client";

import { translations, Lang } from "@/lib/i18n/translations";

type PoolTarget = {
  number: number;
  target: number;
  current: number;
  remaining: number;
  status: string;
};

type Props = {
  selectedNumbers: number[];
  amounts: Record<number, string>;
  targetsByNumber: Record<number, PoolTarget>;
  onAmountChange: (num: number, value: string) => void;
  onProceed: () => void;
  onClear: () => void;
  onRemove: (num: number) => void;
  lang: Lang;
  disabled?: boolean;
};

export default function SelectedNumbersPanel({
  selectedNumbers,
  amounts,
  targetsByNumber,
  onAmountChange,
  onProceed,
  onClear,
  onRemove,
  lang,
  disabled = false,
}: Props) {
  const txt = translations[lang];

  function getAmountError(amount: number, remaining: number) {
    if (!amount || amount <= 0) {
      return txt.amountMustBePositive;
    }

    if (amount < 500) {
      return txt.minimumContributionAmount || "Minimum amount is 500 Birr";
    }

    if (amount % 500 !== 0) {
      return txt.amountMustBeMultipleOf500 || "Amount must be in multiples of 500";
    }

    if (remaining > 0 && amount > remaining) {
      return txt.amountExceedsRemaining;
    }

    return "";
  }


  const quantity = selectedNumbers.length;
  const totalAmount = selectedNumbers.reduce(
    (sum, num) => sum + Number(amounts[num] || 0),
    0
  );

  const hasInvalidAmount = selectedNumbers.some((num) => {
    const pool = targetsByNumber[num];
    const remaining = Number(pool?.remaining ?? 0);
    const amount = Number(amounts[num] || 0);

    return Boolean(getAmountError(amount, remaining));
  });


  const disabledTitle =
    txt.numbersGridClosedTitle || "Number Selection Closed";
  const disabledMessage =
    txt.numbersGridClosedMessage ||
    "Number selection is temporarily closed. Please check back later.";

  const handleClear = () => {
    if (disabled) return;
    onClear();
  };

  const handleRemove = (num: number) => {
    if (disabled) return;
    onRemove(num);
  };

  const handleAmountChange = (num: number, value: string) => {
    if (disabled) return;
    onAmountChange(num, value);
  };

  const handleProceed = () => {
    if (disabled) return;
    onProceed();
  };

  return (
    <aside className="sticky top-4 relative h-fit max-h-[calc(100vh-330px)] self-start overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b pb-3 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {txt.selectedNumbers}
        </h3>

        <p className="text-sm text-gray-500 dark:text-slate-300">
          {txt.enterContributionForSelectedNumbers}
        </p>
      </div>

      {selectedNumbers.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">
          {txt.noNumbersSelectedYet}
        </div>
      ) : (
        <>

          <div className="mt-4 mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">
              {quantity} {txt.selectedNumbers}
            </span>

            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              {txt.removeAll || txt.clear}
            </button>
          </div>
          <div className="my-4 max-h-[calc(100vh-560px)] space-y-3 overflow-y-auto pr-1">
            {selectedNumbers.map((num, index) => {
              const pool = targetsByNumber[num];
              const remaining = Number(pool?.remaining ?? 0);
              const value = amounts[num] || "";
              const amount = Number(value || 0);
              const amountError = getAmountError(amount, remaining);
              const invalid = Boolean(amountError);

              return (
                <div
                  key={`${num}-${index}`}
                  className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">
                      {num}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemove(num)}
                      disabled={disabled}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300"
                      title={txt.removeSelectedNumber}
                    >
                      {txt.removeSelectedNumber}
                    </button>
                  </div>

                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        {txt.remainingAmount}
                      </span>
                      <b className="rounded-full bg-white px-3 py-1 text-base font-black text-amber-900 shadow-sm dark:bg-slate-950/70 dark:text-amber-100 md:text-lg">
                        {remaining.toLocaleString()} {txt.birr}
                      </b>
                    </div>
                  </div>

                  <input
                    type="number"
                    disabled={disabled}
                    min={500}
                    step={500}
                    max={remaining || undefined}
                    value={value}
                    onChange={(e) => handleAmountChange(num, e.target.value)}
                    placeholder={txt.enterAmount}

                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 ${
                      invalid
                        ? "border-red-300 focus:ring-red-300 dark:border-red-700"
                        : "border-blue-200 focus:ring-blue-400 dark:border-slate-700"
                    }`}
                  />

                  {invalid && (
                    <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-300">
                      {amountError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-950 dark:bg-blue-950/60 dark:text-blue-100">
            <div className="flex justify-between gap-3">
              <span>{txt.quantity}</span>
              <b>{quantity}</b>
            </div>

            <div className="mt-2 flex justify-between gap-3 border-t border-blue-200 pt-2 text-base dark:border-blue-700">
              <span>{txt.totalContribution}</span>
              <b>
                {totalAmount.toLocaleString()} {txt.birr}
              </b>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {txt.clearSelectedNumbers}
            </button>

            <button
              type="button"
              onClick={handleProceed}
              disabled={disabled || hasInvalidAmount}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {txt.proceed}
            </button>
          </div>
        </>
      )}
      {disabled && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 rounded-2xl bg-white/75 backdrop-blur-sm dark:bg-slate-950/75">
          <div className="max-w-sm p-5 text-center bg-white border border-red-100 shadow-2xl rounded-2xl dark:border-red-900/50 dark:bg-slate-900">
            <div className="flex items-center justify-center w-12 h-12 mx-auto text-2xl bg-red-100 rounded-full dark:bg-red-950/60">
              🔒
            </div>
            <h3 className="mt-3 text-lg font-black text-gray-900 dark:text-white">
              {disabledTitle}
            </h3>
            <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-slate-300">
              {disabledMessage}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
