"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import ReceiptUploader from "@/components/ReceiptUploader";
import {
  broadcastNumbersUpdate,
  dispatchNumbersRefresh,
} from "@/lib/realtime/numbersLive";
import { useLang } from "@/hooks/useLang";
import { translations } from "@/lib/i18n/translations";
import { tm } from "@/lib/i18n/toastMessages";
import { translateApiError } from "@/lib/i18n/apiErrorMessages";

type PoolInfo = {
  number?: number;
  num?: number;
  target?: number;
  target_amount?: number;
  current?: number;
  current_amount?: number;
  remaining?: number;
  remaining_amount?: number;
  status?: string;
};

type Props = {
  selectedNumbers: number[];
  ticketPrice?: number;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  contributionAmounts?: Record<number, number> | Record<string, number>;
  amounts?: Record<number, number> | Record<string, number>;
  numberPools?:
    | PoolInfo[]
    | Record<string, PoolInfo>
    | Record<number, PoolInfo>;
  pools?: PoolInfo[] | Record<string, PoolInfo> | Record<number, PoolInfo>;
};

type PaymentDraft = {
  clientHoldKey: string;
  numbers: number[];
  amountMap: Record<number, number>;
  totalAmount: number;
  expiresAt: string;
};

const PAYMENT_DRAFT_STORAGE_KEY = "baruda_payment_draft";
const HOLD_STORAGE_KEY = "baruda_payment_hold_draft";

function makeClientHoldKey() {
  return `hold_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function t(txt: any, key: string, fallback: string) {
  return txt?.[key] || fallback;
}

function tf(
  txt: any,
  key: string,
  fallback: string,
  values: Record<string, string | number>,
) {
  const template = t(txt, key, fallback);
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

function normalizeAmountMap(
  input?: Record<number, number> | Record<string, number>,
) {
  const out: Record<number, number> = {};
  if (!input) return out;

  for (const [key, value] of Object.entries(input)) {
    const number = Number(key);
    const amount = Number(value);
    if (Number.isFinite(number) && Number.isFinite(amount) && amount > 0) {
      out[number] = amount;
    }
  }

  return out;
}

function readStoredAmounts() {
  if (typeof window === "undefined") return {} as Record<number, number>;

  for (const key of [
    "lottery_contribution_amounts",
    "pooled_contribution_amounts",
    "contributionAmounts",
    "selectedNumberAmounts",
    "baruda_selected_number_amounts",
  ]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const normalized = normalizeAmountMap(parsed);
      if (Object.keys(normalized).length) return normalized;
    } catch {
      // ignore
    }
  }

  return {} as Record<number, number>;
}

function normalizePools(
  input?: PoolInfo[] | Record<string, PoolInfo> | Record<number, PoolInfo>,
) {
  const out: Record<number, PoolInfo> = {};
  if (!input) return out;

  if (Array.isArray(input)) {
    for (const item of input) {
      const number = Number(item.number ?? item.num);
      if (Number.isFinite(number)) out[number] = item;
    }

    return out;
  }

  for (const [key, value] of Object.entries(input)) {
    const number = Number(key || value?.number || value?.num);
    if (Number.isFinite(number)) out[number] = value;
  }

  return out;
}


function readStoredActiveHold() {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(HOLD_STORAGE_KEY);
    if (!raw) return null;

    const hold = JSON.parse(raw);

    if (
      hold?.id &&
      hold?.expires_at &&
      new Date(hold.expires_at).getTime() > Date.now()
    ) {
      return hold;
    }
  } catch {
    // ignore invalid stored hold
  }

  return null;
}

function readStoredHoldForRelease() {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(HOLD_STORAGE_KEY);
    if (!raw) return null;

    const hold = JSON.parse(raw);

    // Release/cancel must not require expires_at > Date.now().
    // At timer expiry, expires_at is already passed, but the hold still
    // needs to be cancelled through DELETE /api/holds/:id.
    if (hold?.id) return hold;
  } catch {
    // ignore invalid stored hold
  }

  return null;
}


function draftFromActiveHold(hold: any): PaymentDraft | null {
  if (!hold?.id || !hold?.expires_at) return null;
  if (new Date(hold.expires_at).getTime() <= Date.now()) return null;

  const numberAmounts = normalizeAmountMap(
    hold.number_amounts || hold.numberAmounts || hold.amountMap || {},
  );

  const numbersFromHold = Array.isArray(hold.numbers)
    ? hold.numbers.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
    : [];

  const numbersFromAmounts = Object.keys(numberAmounts)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));

  const numbers = numbersFromHold.length ? numbersFromHold : numbersFromAmounts;

  const totalFromHold = Number(hold.total_amount || hold.totalAmount || 0);
  const totalFromAmounts = Object.values(numberAmounts).reduce(
    (sum: number, amount: any) => sum + Number(amount || 0),
    0,
  );

  const totalAmount = totalFromHold > 0 ? totalFromHold : totalFromAmounts;

  if (!numbers.length || totalAmount <= 0) return null;

  return {
    clientHoldKey: hold.client_hold_key || hold.clientHoldKey || makeClientHoldKey(),
    numbers,
    amountMap: numberAmounts,
    totalAmount,
    expiresAt: hold.expires_at,
  };
}


function readPaymentDraft() {
  if (typeof window === "undefined") return null;

  try {
    const storedHold = readStoredActiveHold();
    const raw = localStorage.getItem(PAYMENT_DRAFT_STORAGE_KEY);

    if (!raw) {
      const restoredDraft = draftFromActiveHold(storedHold);
      if (restoredDraft) {
        localStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(restoredDraft));
        return restoredDraft;
      }

      return null;
    }

    const draft = JSON.parse(raw) as PaymentDraft;

    if (
      !draft?.expiresAt ||
      new Date(draft.expiresAt).getTime() <= Date.now()
    ) {
      if (storedHold?.expires_at && draft?.numbers?.length && draft?.totalAmount) {
        const restoredDraft = {
          ...draft,
          expiresAt: storedHold.expires_at,
          clientHoldKey: storedHold.client_hold_key || draft.clientHoldKey,
        };

        localStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(restoredDraft));
        return restoredDraft;
      }

      localStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
      localStorage.removeItem(HOLD_STORAGE_KEY);
      localStorage.removeItem("baruda_payment_hold_id");
      return null;
    }

    if (storedHold?.expires_at && new Date(storedHold.expires_at).getTime() > Date.now()) {
      draft.expiresAt = storedHold.expires_at;
      draft.clientHoldKey = storedHold.client_hold_key || draft.clientHoldKey;
      localStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }

    if (!draft.numbers?.length || !draft.totalAmount) return null;

    return draft;
  } catch {
    return null;
  }
}


function normalizeReservationHoldResponse(
  data: any,
  fallbackClientHoldKey: string,
  numbers: number[],
  numberAmounts: Record<string, number>,
  totalAmount: number,
) {
  if (!data || typeof data !== "object") return null;

  const id = data.id ?? data.hold_id ?? data.holdId;
  const clientHoldKey =
    data.client_hold_key ?? data.clientHoldKey ?? data.client_hold ?? fallbackClientHoldKey;
  const expiresAt = data.expires_at ?? data.expiresAt ?? data.expiry ?? data.expired_at;

  if (!id || !clientHoldKey || !expiresAt) return null;

  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return null;

  return {
    ...data,
    id,
    client_hold_key: clientHoldKey,
    clientHoldKey,
    expires_at: expiresAt,
    expiresAt,
    numbers: Array.isArray(data.numbers) && data.numbers.length ? data.numbers : numbers,
    number_amounts: data.number_amounts ?? data.numberAmounts ?? numberAmounts,
    numberAmounts: data.numberAmounts ?? data.number_amounts ?? numberAmounts,
    total_amount: data.total_amount ?? data.totalAmount ?? totalAmount,
    totalAmount: data.totalAmount ?? data.total_amount ?? totalAmount,
  };
}

function makeAmountMapForNumbers(
  numbers: number[],
  amountMap: Record<number, number>,
  totalAmount: number,
) {
  const result: Record<string, number> = {};

  for (const number of numbers) {
    const amount = Number(amountMap[number] || 0);
    if (amount > 0) result[String(number)] = amount;
  }

  if (!Object.keys(result).length && totalAmount > 0 && numbers.length > 0) {
    const perNumber = Math.floor(totalAmount / numbers.length);
    for (const number of numbers) result[String(number)] = perNumber;
  }

  return result;
}

export default function SubmitNumberModal({
  selectedNumbers,
  ticketPrice = 0,
  open,
  onClose,
  onSubmitted,
  contributionAmounts,
  amounts,
  numberPools,
  pools,
}: Props) {
  const { lang } = useLang();
  const txt = translations[lang];

  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptKey, setReceiptKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [savedDraft, setSavedDraft] = useState<PaymentDraft | null>(() =>
    readPaymentDraft(),
  );
  const [reservationHold, setReservationHold] = useState<any>(() =>
    readStoredActiveHold(),
  );
  const [reservingHold, setReservingHold] = useState(false);
  const [reservationElapsedMs, setReservationElapsedMs] = useState(0);
  const holdReadyToastShownRef = useRef<string | null>(null);
  const reservingHoldRef = useRef(false);
  const closingModalRef = useRef(false);
  const holdExpiryHandledRef = useRef(false);


  useEffect(() => {
    if (!reservingHold) {
      setReservationElapsedMs(0);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setReservationElapsedMs(Date.now() - startedAt);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [reservingHold]);

    const lastReservationSignatureRef = useRef<string>("");
const amountMap = useMemo(() => {
    const fromProps = normalizeAmountMap(contributionAmounts || amounts);
    return Object.keys(fromProps).length ? fromProps : readStoredAmounts();
  }, [contributionAmounts, amounts, open]);

  const draftActive = Boolean(
    savedDraft?.expiresAt &&
    new Date(savedDraft.expiresAt).getTime() > Date.now(),
  );

  const holdActive = Boolean(
    reservationHold?.id &&
    reservationHold?.expires_at &&
    new Date(reservationHold.expires_at).getTime() > Date.now(),
  );

  const effectiveOpen = open || draftActive || holdActive;

  const activeNumbers = useMemo(() => {
    if (open && selectedNumbers.length) return selectedNumbers;
    if (draftActive && savedDraft?.numbers?.length) return savedDraft.numbers;

    const restoredDraft = draftFromActiveHold(reservationHold);
    if (restoredDraft?.numbers?.length) return restoredDraft.numbers;

    return selectedNumbers;
  }, [open, selectedNumbers, draftActive, savedDraft, reservationHold?.id, reservationHold?.expires_at]);

  const activeAmountMap = useMemo(() => {
    if (open) return amountMap;
    if (draftActive && savedDraft?.amountMap) return savedDraft.amountMap;

    const restoredDraft = draftFromActiveHold(reservationHold);
    if (restoredDraft?.amountMap && Object.keys(restoredDraft.amountMap).length) {
      return restoredDraft.amountMap;
    }

    return amountMap;
  }, [open, amountMap, draftActive, savedDraft, reservationHold?.id, reservationHold?.expires_at]);

  const poolMap = useMemo(
    () => normalizePools(numberPools || pools),
    [numberPools, pools],
  );

  const getRemainingForThisSubmitUser = (number: number) => {
    const pool = poolMap[number];
    const serverRemainingRaw = Number(
      pool?.remaining ?? pool?.remaining_amount ?? 0,
    );
    const serverRemaining = Number.isFinite(serverRemainingRaw)
      ? serverRemainingRaw
      : 0;
    const ownSelectedAmount = Number(activeAmountMap[number] || 0);

    /*
      Before hold creation, serverRemaining is the source of truth.
      After this modal creates an active hold, serverRemaining can be 0,
      but the same user should still be allowed to submit their selected amount.
      Use max, never addition, to avoid 9000 becoming 18000.
    */
    if (reservationHold?.id || activeClientHoldKey) {
      return Math.max(serverRemaining, ownSelectedAmount);
    }

    return serverRemaining;
  };

  const isPooled = activeNumbers.some(
    (number) => Number(activeAmountMap[number] || 0) > 0,
  );
  const quantity = activeNumbers.length;
  const totalAmount = isPooled
    ? activeNumbers.reduce(
        (sum, number) => sum + Number(activeAmountMap[number] || 0),
        0,
      )
    : Number(ticketPrice || 0) * quantity;

  const [clientHoldKey, setClientHoldKey] = useState(() => {
    const storedHold = readStoredActiveHold();
    const draft = readPaymentDraft();

    return storedHold?.client_hold_key || draft?.clientHoldKey || makeClientHoldKey();
  });

  const activeClientHoldKey =
    reservationHold?.client_hold_key || savedDraft?.clientHoldKey || clientHoldKey;


  useEffect(() => {
    if (open) {
      closingModalRef.current = false;
    }
  }, [open]);

  function showHoldReadyToast(hold: any) {
    const holdId = hold?.id ? String(hold.id) : "";
    if (!holdId) return;

    if (holdReadyToastShownRef.current === holdId) {
      return;
    }

    holdReadyToastShownRef.current = holdId;
    toast.success(tm(lang, "holdCreated"), { id: `hold-created-${holdId}` });
  }

  const holdAmountMap = useMemo(
    () => makeAmountMapForNumbers(activeNumbers, activeAmountMap, totalAmount),
    [activeNumbers, activeAmountMap, totalAmount],
  );

  const activeNumbersKey = useMemo(
    () => activeNumbers.join(","),
    [activeNumbers],
  );

  const holdAmountMapKey = useMemo(
    () => JSON.stringify(holdAmountMap),
    [holdAmountMap],
  );

  useEffect(() => {
    if (!open) return;

    closingModalRef.current = false;
    holdExpiryHandledRef.current = false;

    if (!selectedNumbers.length || totalAmount <= 0) {
      return;
    }

    const current = readPaymentDraft();
    const storedHold = readStoredActiveHold();

    const expiresAt =
      storedHold?.expires_at && new Date(storedHold.expires_at).getTime() > Date.now()
        ? storedHold.expires_at
        : current?.expiresAt && new Date(current.expiresAt).getTime() > Date.now()
          ? current.expiresAt
          : undefined;

    const key = storedHold?.client_hold_key || current?.clientHoldKey || clientHoldKey;
    setClientHoldKey(key);

    // Only persist the countdown draft when we have a real absolute expires_at
    // from an existing backend hold. This prevents refresh from resetting to 3:00.
    if (!expiresAt) {
      return;
    }

    const draft: PaymentDraft = {
      clientHoldKey: key,
      numbers: selectedNumbers,
      amountMap,
      totalAmount,
      expiresAt,
    };

    localStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    setSavedDraft(draft);
  }, [open, selectedNumbers, amountMap, totalAmount, clientHoldKey]);

  async function releaseActivePaymentHold() {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(HOLD_STORAGE_KEY);
      const hold = raw ? JSON.parse(raw) : null;

      if (hold?.id) {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/holds/${hold.id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          keepalive: true,
        });
        const data = await res.json().catch(() => ({}));
        const releasedNumbers = Array.isArray(data?.numbers)
          ? data.numbers
          : Array.isArray(hold?.numbers)
            ? hold.numbers
            : activeNumbers;

        dispatchNumbersRefresh({
          action: "hold_released",
          numbers: releasedNumbers,
          status: "available",
          holdId: hold.id,
          clientHoldKey: hold.client_hold_key || activeClientHoldKey,
        });

        broadcastNumbersUpdate({
          action: "hold_released",
          numbers: releasedNumbers,
          status: "available",
          holdId: hold.id,
          clientHoldKey: hold.client_hold_key || activeClientHoldKey,
          source: "submit-modal-release",
        });
      }
    } catch {
      // ignore release errors
    }

    localStorage.removeItem(HOLD_STORAGE_KEY);
    localStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
    localStorage.removeItem("baruda_payment_hold_id");
    setSavedDraft(null);
    setReservationHold(null);
    holdReadyToastShownRef.current = null;
    lastReservationSignatureRef.current = "";
    setClientHoldKey(makeClientHoldKey());
    setReceiptUrl("");
    setReceiptKey("");
  }

  function clearPaymentHoldUiState() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(HOLD_STORAGE_KEY);
      localStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
      localStorage.removeItem("baruda_payment_hold_id");
      localStorage.removeItem("lottery_selected_numbers");
      localStorage.removeItem("lottery_contribution_amounts");
      localStorage.removeItem("pooled_contribution_amounts");
    }

    setSavedDraft(null);
    setReservationHold(null);
    holdReadyToastShownRef.current = null;
    lastReservationSignatureRef.current = "";
    setClientHoldKey(makeClientHoldKey());
    setReceiptUrl("");
    setReceiptKey("");
    setReservingHold(false);
  }

  function handleHoldExpiredImmediate() {
    if (holdExpiryHandledRef.current) return;

    holdExpiryHandledRef.current = true;
    closingModalRef.current = true;

    const hold = reservationHold || readStoredHoldForRelease();
    const holdId =
      hold?.id ||
      (typeof window !== "undefined"
        ? localStorage.getItem("baruda_payment_hold_id")
        : null);

    // Timer expiry must end inside the ReceiptUploader modal:
    // 1. close the modal immediately
    // 2. clear only local hold/draft UI state
    // 3. call the same DELETE /api/holds/:id release API used by Cancel/X
    // Realtime will reflect the cache update after the backend cancels the hold.
    clearPaymentHoldUiState();
    setError("");
    onClose();

    if (!holdId) return;

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    void fetch(`/api/holds/${holdId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      keepalive: true,
    }).catch(() => {
      // Do not reopen or block the modal. Backend cleanup/realtime can recover.
    });
  }

  async function closeModal() {
    if (submitting || closingModalRef.current) return;
    closingModalRef.current = true;
    await releaseActivePaymentHold();
    setError("");
    onClose();
  }

  useEffect(() => {
    async function reserveSelectedAmountBeforeUpload() {
      if (!effectiveOpen) return;
      if (closingModalRef.current) return;
      if (holdExpiryHandledRef.current) return;
      if (reservingHoldRef.current) return;
      if (
        reservationHold?.id &&
        reservationHold?.expires_at &&
        new Date(reservationHold.expires_at).getTime() > Date.now()
      ) {
        return;
      }
      if (
        !activeNumbers.length ||
        totalAmount <= 0 ||
        !Object.keys(holdAmountMap).length ||
        !activeClientHoldKey
      ) {
        return;
      }

      const reservationSignature = JSON.stringify({
        effectiveOpen,
        activeClientHoldKey,
        activeNumbersKey,
        holdAmountMapKey,
        totalAmount,
      });

      if (lastReservationSignatureRef.current === reservationSignature) {
        return;
      }

      lastReservationSignatureRef.current = reservationSignature;
      reservingHoldRef.current = true;
      setReservingHold(true);
      setError("");

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30000);

      try {
        const res = await fetch("/api/holds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientHoldKey: activeClientHoldKey,
            numbers: activeNumbers,
            numberAmounts: holdAmountMap,
            totalAmount,
          }),
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const translated =
            translateApiError(data, lang) ||
            tm(lang, "submitFailed");
          throw new Error(translated);
        }

        const normalizedHold = normalizeReservationHoldResponse(
          data,
          activeClientHoldKey,
          activeNumbers,
          holdAmountMap,
          totalAmount,
        );

        if (!normalizedHold) {
          throw new Error(t(txt, "reservationInvalidHoldData", "Reservation succeeded, but the server returned invalid hold data."));
        }

        if (normalizedHold.client_hold_key !== activeClientHoldKey) {
          throw new Error(t(txt, "reservationHoldKeyMismatch", "Reservation succeeded, but the hold key did not match this request."));
        }

        // From here, success must win. Do not ignore this response because of
        // React effect cleanup/re-render. A valid 200 hold response is the source of truth.
        localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(normalizedHold));
        localStorage.setItem("baruda_payment_hold_id", String(normalizedHold.id));

        const nextDraftAmountMap = Object.fromEntries(
          Object.entries(holdAmountMap).map(([number, amount]) => [Number(number), Number(amount)]),
        ) as Record<number, number>;

        const nextDraft: PaymentDraft = {
          clientHoldKey: normalizedHold.client_hold_key,
          numbers: activeNumbers,
          amountMap: nextDraftAmountMap,
          totalAmount,
          expiresAt: normalizedHold.expires_at,
        };

        localStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
        setSavedDraft(nextDraft);
        setReservationHold(normalizedHold);
        setReservingHold(false);
        reservingHoldRef.current = false;
        showHoldReadyToast(normalizedHold);

        dispatchNumbersRefresh({
          action: "hold_created",
          numbers: activeNumbers,
          status: "pending",
          holdId: normalizedHold.id,
          clientHoldKey: normalizedHold.client_hold_key,
        });

        broadcastNumbersUpdate({
          action: "hold_created",
          numbers: activeNumbers,
          status: "pending",
          holdId: normalizedHold.id,
          clientHoldKey: normalizedHold.client_hold_key,
          source: "submit-modal-hold",
        });
      } catch (error: any) {
        const isAbort = error?.name === "AbortError";
        const msg = isAbort
          ? t(txt, "reservationTakingLong", "Reservation is taking longer than expected. Please try again.")
          : translateApiError(error, lang) || error?.message || tm(lang, "submitFailed");

        setError(msg);
        toast.error(msg);
        localStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
        localStorage.removeItem(HOLD_STORAGE_KEY);
        localStorage.removeItem("baruda_payment_hold_id");
        setSavedDraft(null);
        setReservationHold(null);
        setClientHoldKey(makeClientHoldKey());
        lastReservationSignatureRef.current = "";
        onClose();
      } finally {
        window.clearTimeout(timeoutId);
        reservingHoldRef.current = false;
        setReservingHold(false);
      }
    }

    reserveSelectedAmountBeforeUpload();

    // Do not use a local cancelled flag here. For this payment reservation step,
    // a successful /api/holds response must always be committed to state/storage.
    return undefined;
  }, [
    effectiveOpen,
    activeClientHoldKey,
    activeNumbersKey,
    holdAmountMapKey,
    totalAmount,
    lang,
    onClose,
    reservationHold?.id,
    reservationHold?.expires_at,
  ]);

  async function handleSubmit() {
    setError("");

    if (!activeNumbers.length) {
      const msg = t(
        txt,
        "selectAtLeastOneNumber",
        "Please select at least one number.",
      );
      setError(msg);
      toast.error(msg);
      return;
    }

    if (totalAmount <= 0) {
      const msg = t(txt, "invalidAmount", "Invalid amount.");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (isPooled) {
      for (const number of activeNumbers) {
        const amount = Number(activeAmountMap[number] || 0);
        const pool = poolMap[number];
        const remaining = getRemainingForThisSubmitUser(number);

        if (!Number.isFinite(amount) || amount <= 0) {
          const msg = tf(txt, "invalidAmountForNumber", "Invalid amount for number {number}.", { number });
          setError(msg);
          toast.error(msg);
          return;
        }

        if (Number.isFinite(remaining) && amount > remaining) {
          const msg = tf(txt, "amountExceedsRemainingForNumber", "Amount exceeds remaining for number {number}.", { number });
          setError(msg);
          toast.error(msg);
          return;
        }
      }
    }

    if (!receiptUrl) {
      const msg = tm(lang, "receiptRequired");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (receiptUrl.startsWith("data:image")) {
      const msg = tm(lang, "invalidReceipt");
      setError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    toast.loading(tm(lang, "submitLoading"), { id: "submit-number" });

    try {
      const token = localStorage.getItem("token");
      const submissions = activeNumbers.map((number) => ({
        number,
        amount: isPooled
          ? Number(activeAmountMap[number] || 0)
          : Number(ticketPrice || 0),
      }));

      const numberAmounts = Object.fromEntries(
        submissions.map((item) => [String(item.number), item.amount]),
      );

      const holdId =
        localStorage.getItem("baruda_payment_hold_id") || undefined;

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          submissions,
          totalAmount,
          numbers: activeNumbers,
          amounts: numberAmounts,
          receiptUrl,
          receiptKey,
          holdId: reservationHold?.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const details = [
          ...(data.taken || []),
          ...(data.locked || []),
          ...(data.closed || []),
        ];
        const rawError = data.error || tm(lang, "submitFailed");
        const translatedError =
          translateApiError(data, lang) ||
          translateApiError(rawError, lang) ||
          rawError;
        const msg = details.length
          ? `${translatedError}: ${details.join(", ")}`
          : translatedError;

        setError(msg);
        toast.error(msg, { id: "submit-number" });
        return;
      }

      toast.success(tm(lang, "submitSuccess"), { id: "submit-number" });

      setReceiptUrl("");
      setReceiptKey("");

      localStorage.removeItem("lottery_selected_numbers");
      localStorage.removeItem("lottery_contribution_amounts");
      localStorage.removeItem("pooled_contribution_amounts");
      localStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
      localStorage.removeItem(HOLD_STORAGE_KEY);
      localStorage.removeItem("baruda_payment_hold_id");

      setSavedDraft(null);
      setReservationHold(null);
      holdReadyToastShownRef.current = null;
      setClientHoldKey(makeClientHoldKey());

      dispatchNumbersRefresh({
        action: "submission_created",
        numbers: activeNumbers,
        status: "pending",
        holdId,
        clientHoldKey: activeClientHoldKey,
      });

      broadcastNumbersUpdate({
        action: "submission_created",
        numbers: activeNumbers,
        status: "pending",
        holdId,
        clientHoldKey: activeClientHoldKey,
        source: "submit-success",
      });

      onSubmitted?.();
      onClose();
    } catch (err: any) {
      console.error("Submit request failed:", err);
      const msg = err?.message || tm(lang, "networkError");
      setError(msg);
      toast.error(msg, { id: "submit-number" });
    } finally {
      setSubmitting(false);
    }
  }

  function copyButtonText() {
    if (lang === "am") return "ቅዳ";
    if (lang === "om") return "Garagalchi";
    return "Copy";
  }

  function copiedToastText() {
    if (lang === "am") return "ተቀድቷል";
    if (lang === "om") return "Garagalfameera";
    return "Copied";
  }

  function copyAccountAriaText() {
    if (lang === "am") return "የሂሳብ ቁጥር ቅዳ";
    if (lang === "om") return "Lakkoofsa herregaa garagalchi";
    return "Copy account number";
  }

  async function copyAccountNumber(accountNumber: string) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(accountNumber);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = accountNumber;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      toast.success(copiedToastText());
    } catch {
      toast.error(t(txt, "requestFailed", "Request failed"));
    }
  }

  if (!effectiveOpen) return null;

  const holdReady = Boolean(
    reservationHold?.id &&
    reservationHold?.client_hold_key === activeClientHoldKey &&
    reservationHold?.expires_at &&
    new Date(reservationHold.expires_at).getTime() > Date.now(),
  );

  const reserveTitle =
    lang === "am"
      ? "የተመረጠውን መጠን በመያዝ ላይ..."
      : lang === "om"
        ? "Hamma filatame qabachaa jira..."
        : "Reserving selected amount...";

  const reserveDescription =
    lang === "am"
      ? "እባክዎ ትንሽ ይጠብቁ። የደረሰኝ መስቀያው የሚከፈተው መጠኑ ከተያዘ በኋላ ነው።"
      : lang === "om"
        ? "Maaloo xiqqoo eegaa. Bakki nagahee ol-kaasuu erga hammi qabame booda ni banama."
        : "Please wait. The receipt upload form opens only after the amount is reserved.";

  const reserveLongDescription =
    lang === "am"
      ? "አሁንም ቁጥሮቹን በመያዝ ላይ ነው። ብዙ ተጠቃሚዎች ተመሳሳይ ቁጥር ከመረጡ ጥቂት ሰከንዶች ሊወስድ ይችላል።"
      : lang === "om"
        ? "Lakkoofsota kee ammallee qabachaa jirra. Yoo fayyadamtoonni hedduun lakkoofsa walfakkaataa filatan sekondii muraasa fudhachuu danda'a."
        : "Still reserving your numbers. This can take a few seconds if many users are selecting the same numbers.";

  const paymentAccounts = [
    {
      key: "cbe",
      label: t(txt, "cbe", "CBE"),
      number: "1000743554101",
      color: "#5A3A1A",
    },
    {
      key: "abyssinia",
      label: t(txt, "abyssinia", "Abyssinia"),
      number: "249579432",
      color: "#7C2D12",
    },
    {
      key: "telebirr",
      label: t(txt, "telebirr", "Telebirr"),
      number: "0935021863",
      color: "#00A651",
    },
    {
      key: "awash",
      label: t(txt, "awash", "Awash"),
      number: "013201731060100",
      color: "#1D4ED8",
    },
  ];

  if (!holdReady) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4">
        <div className="w-full max-w-md p-6 text-center bg-white shadow-2xl rounded-t-2xl dark:bg-slate-900 md:rounded-2xl">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
            {reserveTitle}
          </h2>
          <p className="mt-2 text-sm font-medium text-gray-600 dark:text-slate-300">
            {reservationElapsedMs >= 5000 ? reserveLongDescription : reserveDescription}
          </p>
          {error && (
            <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
          )}
          <button
            type="button"
            onClick={closeModal}
            disabled={reservingHold}
            className="px-5 py-2 mt-5 text-sm font-bold text-gray-700 border rounded-xl disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            {t(txt, "cancel", "Cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 md:rounded-2xl">
        <div className="flex items-start justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t(txt, "uploadReceipt", "Upload Receipt")}
            </h2>

            <p className="text-base font-semibold text-gray-700 dark:text-slate-300">
              {t(txt, "selectedNumbersColon", "Selected numbers:")}{" "}
              {activeNumbers.join(", ")}
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={submitting}
            className="px-3 py-1 text-sm font-semibold bg-gray-200 rounded-lg disabled:opacity-50 dark:bg-slate-700 dark:text-white"
          >
            ×
          </button>
        </div>

        <div className="p-4 mb-4 border border-blue-100 rounded-2xl bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/40">
          <h3 className="mb-3 text-sm font-bold text-blue-900 dark:text-blue-100">
            {t(txt, "paymentDetails", "Payment Details")}
          </h3>

          <div className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
            <div className="space-y-2">
              {paymentAccounts.map((account) => (
                <div
                  key={account.key}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-900/40"
                >
                  <span className="font-semibold">
                    <span
                      className="text-lg font-extrabold"
                      style={{ color: account.color }}
                    >
                      {account.label}
                    </span>
                  </span>

                  <div className="flex items-center gap-2 font-mono text-right">
                    <span
                      className="text-lg font-extrabold"
                      style={{ color: account.color }}
                    >
                      {account.number}
                    </span>

                    <button
                      type="button"
                      onClick={() => copyAccountNumber(account.number)}
                      className="px-2 py-1 text-xs font-bold text-blue-700 transition bg-white border border-blue-200 rounded-lg shadow-sm hover:bg-blue-100 active:scale-95 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700"
                      title={copyAccountAriaText()}
                      aria-label={`${copyAccountAriaText()} ${account.label}`}
                    >
                      {copyButtonText()}
                    </button>
                  </div>
                </div>
              ))}

              <div className="space-y-6 text-sm text-blue-900 dark:text-blue-100">
                <div className="flex items-center justify-center gap-2 font-mono">
                  <span className="text-lg font-extrabold text-center">
                    ካሳሁን ደስታ ቆርቾ
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-3 mt-3 space-y-2 border-t border-blue-200 dark:border-blue-800">
              {isPooled ? (
                <>
                  <div className="text-xs font-bold tracking-wide text-blue-700 uppercase dark:text-blue-200">
                    {t(txt, "contributionBreakdown", "Contribution Breakdown")}
                  </div>

                  <div className="pr-1 space-y-2 overflow-y-auto max-h-36">
                    {activeNumbers.map((number) => {
                      const amount = Number(activeAmountMap[number] || 0);
                      const pool = poolMap[number];
                      const remaining = getRemainingForThisSubmitUser(number);

                      return (
                        <div
                          key={number}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60"
                        >
                          <span className="font-bold">{number}</span>
                          <span className="font-bold text-right">
                            {amount.toLocaleString()} {t(txt, "birr", "Birr")}
                            {remaining > 0 && (
                              <span className="block text-[11px] font-medium text-blue-700 dark:text-blue-200">
                                {t(txt, "remainingAmount", "Remaining")}:{" "}
                                {remaining.toLocaleString()}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">
                      {t(txt, "ticketPrice", "Ticket Price")}
                    </span>
                    <span className="font-bold">
                      {Number(ticketPrice || 0).toLocaleString()}{" "}
                      {t(txt, "birr", "Birr")}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">
                      {t(txt, "quantity", "Quantity")}
                    </span>
                    <span className="font-bold">{quantity}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between gap-3 pt-2 text-base border-t border-blue-200 dark:border-blue-800">
                <span className="font-bold">
                  {t(txt, "totalAmount", "Total Amount")}
                </span>
                <span className="font-extrabold">
                  {totalAmount.toLocaleString()} {t(txt, "birr", "Birr")}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-blue-700 dark:text-blue-200">
            {t(
              txt,
              "afterPaymentUploadReceipt",
              "After payment, upload your receipt screenshot/image.",
            )}
          </p>
        </div>

        <ReceiptUploader
                  value={receiptUrl}
          clientHoldKey={activeClientHoldKey}
          initialPaymentHold={reservationHold}
          holdNumbers={activeNumbers}
          holdNumberAmounts={holdAmountMap}
          holdTotalAmount={totalAmount}
          onHoldExpired={handleHoldExpiredImmediate}
          onChange={(url, key, holdId) => {
            setReceiptUrl(url);
            setReceiptKey(key || "");
            if (holdId) localStorage.setItem("baruda_payment_hold_id", holdId);
          }}
        />

        {error && (
          <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={closeModal}
            disabled={submitting}
            className="flex-1 px-4 py-3 font-semibold text-gray-700 border rounded-xl disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            {t(txt, "cancel", "Cancel")}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              !receiptUrl ||
              !activeNumbers.length ||
              totalAmount <= 0
            }
            className="flex-1 px-4 py-3 font-semibold text-white bg-blue-600 rounded-xl disabled:opacity-50"
          >
            {submitting
              ? t(txt, "submitting", "Submitting...")
              : t(txt, "submit", "Submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
