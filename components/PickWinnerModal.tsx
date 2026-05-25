"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { translations } from "@/lib/i18n/translations";

type Props = {
  open: boolean;
  onClose: () => void;
  onPicked?: () => void;
  lang?: "en" | "am" | "om";
};

export default function PickWinnerModal({
  open,
  onClose,
  onPicked,
  lang = "en",
}: Props) {
  const txt = translations[lang] || translations.en;

  const [firstNumber, setFirstNumber] = useState("");
  const [secondNumber, setSecondNumber] = useState("");
  const [thirdNumber, setThirdNumber] = useState("");
  const [publishing, setPublishing] = useState(false);

  if (!open) return null;

  const label = (key: string, fallback: string) => {
    const value = (txt as any)?.[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };

  const validate = () => {
    const first = Number(firstNumber);
    const second = Number(secondNumber);
    const third = Number(thirdNumber);

    if (!Number.isInteger(first) || first <= 0) {
      toast.error(label("enterFirstWinner", "Enter the 1st winner number"));
      return null;
    }

    if (!Number.isInteger(second) || second <= 0) {
      toast.error(label("enterSecondWinner", "Enter the 2nd winner number"));
      return null;
    }

    if (!Number.isInteger(third) || third <= 0) {
      toast.error(label("enterThirdWinner", "Enter the 3rd winner number"));
      return null;
    }

    return { first, second, third };
  };

  async function publishWinners() {
    const winners = validate();
    if (!winners) return;

    try {
      setPublishing(true);

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const res = await fetch("/api/admin/winner-announcement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firstNumber: winners.first,
          secondNumber: winners.second,
          thirdNumber: winners.third,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || label("failedToPublishWinners", "Failed to publish winners"));
      }

      toast.success(label("winnersPublished", "Winners published for 24 hours"));

      setFirstNumber("");
      setSecondNumber("");
      setThirdNumber("");

      onPicked?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || label("failedToPublishWinners", "Failed to publish winners"));
    } finally {
      setPublishing(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-blue-100 bg-white px-4 py-4 text-center text-3xl font-black text-blue-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-2xl font-black text-gray-950">
              {label("publishWinners", "Publish Winners")}
            </h2>
            <p className="mt-1 text-sm font-medium text-gray-500">
              {label(
                "publishWinnersHelp",
                "Enter the 1st, 2nd, and 3rd winner numbers. They will be shown for 24 hours.",
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-3 py-1 text-sm font-black text-gray-700 hover:bg-gray-200"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-black text-gray-700">
              {label("firstWinner", "1st Winner")}
            </label>
            <input
              type="number"
              min={1}
              value={firstNumber}
              onChange={(event) => setFirstNumber(event.target.value)}
              placeholder="1"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-gray-700">
              {label("secondWinner", "2nd Winner")}
            </label>
            <input
              type="number"
              min={1}
              value={secondNumber}
              onChange={(event) => setSecondNumber(event.target.value)}
              placeholder="2"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-gray-700">
              {label("thirdWinner", "3rd Winner")}
            </label>
            <input
              type="number"
              min={1}
              value={thirdNumber}
              onChange={(event) => setThirdNumber(event.target.value)}
              placeholder="3"
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="rounded-2xl border px-4 py-3 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {label("cancel", "Cancel")}
          </button>

          <button
            type="button"
            onClick={publishWinners}
            disabled={publishing}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-700 disabled:opacity-50"
          >
            {publishing
              ? label("publishing", "Publishing...")
              : label("pickWinner", "Pick Winner")}
          </button>
        </div>
      </div>
    </div>
  );
}
