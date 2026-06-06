"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import NumberGrid from "@/components/NumberGrid";
import WinnerAnnouncement from "@/components/WinnerAnnouncement";
import ThemeToggle from "@/components/ThemeToggle";
import MyPurchasesModal from "@/components/MyPurchasesModal";
import { useMySubmissions } from "@/hooks/useLottery";
import { useLang } from "@/hooks/useLang";
import { tm } from "@/lib/i18n/toastMessages";
import { logoutClientSession } from "@/lib/auth/client";
import LanguageButtons from "@/components/LanguageButtons";
import NumberStatusLegend from "@/components/NumberStatusLegend";
import NumberAmountsModal from "@/components/NumberAmountsModal";
import { translations } from "@/lib/i18n/translations";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type DashboardMessageImage = {
  url: string;
  key?: string;
};

type DashboardMessage = {
  id: string;
  text: string;
  createdAt?: string | null;
  expiresAt?: string | null;
  imageUrl?: string | null;
  imageKey?: string | null;
  images?: DashboardMessageImage[];
};

type WinnerAnnouncementData = {
  id: string;
  first_number: number;
  second_number: number;
  third_number: number;
  expires_at: string;
  created_at: string;
};

function getCurrentUser() {
  if (typeof window === "undefined") return {} as any;

  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {} as any;
  }
}

function getCurrentUserId() {
  const user = getCurrentUser();
  return user?.id ? String(user.id) : null;
}

function dashboardMessageDismissKey(id: string) {
  return `dashboard-message-dismissed:${id}`;
}

function isDashboardMessageDismissed(id: string) {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(dashboardMessageDismissKey(id)) === "1";
}

function normalizeDashboardMessageImages(value: any): DashboardMessageImage[] {
  const images: DashboardMessageImage[] = [];

  if (Array.isArray(value?.images)) {
    for (const image of value.images) {
      const url = String(
        image?.url || image?.imageUrl || image?.image_url || "",
      ).trim();
      const key = String(
        image?.key || image?.imageKey || image?.image_key || "",
      ).trim();

      if (url) {
        images.push(key ? { url, key } : { url });
      }

      if (images.length >= 3) break;
    }
  }

  const legacyUrl = String(value?.imageUrl || value?.image_url || "").trim();
  const legacyKey = String(value?.imageKey || value?.image_key || "").trim();

  if (!images.length && legacyUrl) {
    images.push(
      legacyKey ? { url: legacyUrl, key: legacyKey } : { url: legacyUrl },
    );
  }

  return images;
}

function normalizeDashboardMessageFromValue(
  value: any,
): DashboardMessage | null {
  if (!value) return null;

  // Admin panel may save dashboard_message as plain text.
  // Older code expected JSON with { message, expiresAt }, which made realtime message updates disappear.
  if (typeof value === "string") {
    const raw = value.trim();

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const text = String(parsed.message || parsed.text || "").trim();
        const expiresAt = String(
          parsed.expiresAt || parsed.expires_at || "",
        ).trim();

        if (!text) return null;

        if (expiresAt) {
          const expiresMs = new Date(expiresAt).getTime();
          if (Number.isFinite(expiresMs) && expiresMs <= Date.now())
            return null;
        }

        return {
          id: String(parsed.id || expiresAt || text),
          text,
          createdAt: parsed.createdAt || parsed.created_at || null,
          expiresAt: expiresAt || null,
          imageUrl: parsed.imageUrl || parsed.image_url || null,
          imageKey: parsed.imageKey || parsed.image_key || null,
          images: normalizeDashboardMessageImages(parsed),
        };
      }
    } catch {
      // Plain string message.
      return {
        id: `dashboard-message:${raw}`,
        text: raw,
        createdAt: null,
        expiresAt: null,
        imageUrl: null,
        imageKey: null,
        images: [],
      };
    }

    return {
      id: `dashboard-message:${raw}`,
      text: raw,
      createdAt: null,
      expiresAt: null,
    };
  }

  const text = String(value.message || value.text || "").trim();
  if (!text) return null;

  const expiresAt = String(value.expiresAt || value.expires_at || "").trim();

  if (expiresAt) {
    const expiresMs = new Date(expiresAt).getTime();
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) return null;
  }

  return {
    id: String(value.id || expiresAt || text),
    text,
    createdAt: value.createdAt || value.created_at || null,
    expiresAt: expiresAt || null,
    imageUrl: value.imageUrl || value.image_url || null,
    imageKey: value.imageKey || value.image_key || null,
    images: normalizeDashboardMessageImages(value),
  };
}

function normalizeDashboardMessage(message: any): DashboardMessage | null {
  if (!message) return null;

  const text = String(message.text || message.message || "").trim();
  if (!text) return null;

  if (message.expiresAt) {
    const expiresMs = new Date(message.expiresAt).getTime();
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) return null;
  }

  return {
    id: String(message.id || message.expiresAt || Date.now()),
    text,
    createdAt: message.createdAt || null,
    expiresAt: message.expiresAt || null,
    imageUrl: message.imageUrl || message.image_url || null,
    imageKey: message.imageKey || message.image_key || null,
    images: normalizeDashboardMessageImages(message),
  };
}

function normalizeWinnerAnnouncement(row: any): WinnerAnnouncementData | null {
  if (!row?.id) return null;

  if (row.expires_at) {
    const expiresMs = new Date(row.expires_at).getTime();
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) return null;
  }

  return {
    id: String(row.id),
    first_number: Number(row.first_number),
    second_number: Number(row.second_number),
    third_number: Number(row.third_number),
    expires_at: String(row.expires_at || ""),
    created_at: String(row.created_at || ""),
  };
}

export default function DashboardPage() {
  const didLoadAnnouncementsRef = useRef(false);

  const router = useRouter();
  const { data: subs = [] } = useMySubmissions();
  const { t, lang, setLang } = useLang();
  const txt: any = translations[lang] || translations.en;
  const [approvalNotifications, setApprovalNotifications] = useState<any[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNumberAmounts, setShowNumberAmounts] = useState(false);
  const [showPurchasesModal, setShowPurchasesModal] = useState(false);
  const [winningAmount, setWinningAmount] = useState<number | null>(null);
  const [dashboardMessage, setDashboardMessage] =
    useState<DashboardMessage | null>(null);
  const [activeAnnouncementImage, setActiveAnnouncementImage] = useState<
    string | null
  >(null);
  const [winnerAnnouncement, setWinnerAnnouncement] =
    useState<WinnerAnnouncementData | null>(null);

  const label = (key: string, fallback: string) => {
    const value = (txt as any)?.[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };

  function formatWinningAmount(value: number | null) {
    if (value === null) return "";
    return `${Number(value || 0).toLocaleString()} ብር`;
  }

  function applyWinningAmountSettings(value: any) {
    const amount = Number(
      value?.winningAmount ??
        value?.winning_amount ??
        value?.new?.winning_amount,
    );
    if (Number.isFinite(amount) && amount > 0) {
      setWinningAmount(amount);
    }
  }

  const user = getCurrentUser();
  const displayName = user?.name || user?.full_name || "User";

  function applyDashboardMessage(message: any) {
    const next = normalizeDashboardMessage(message);
    if (!next?.id) {
      setDashboardMessage(null);
      return;
    }

    if (isDashboardMessageDismissed(String(next.id))) {
      setDashboardMessage(null);
      return;
    }

    setDashboardMessage(next);
  }

  function closeDashboardMessage() {
    if (dashboardMessage?.id && typeof window !== "undefined") {
      localStorage.setItem(
        dashboardMessageDismissKey(String(dashboardMessage.id)),
        "1",
      );
    }
    setDashboardMessage(null);
  }

  function formatApprovedNumbers(item: any) {
    if (Array.isArray(item?.numbers) && item.numbers.length) {
      return item.numbers.join(", ");
    }
    if (item?.number_amounts && typeof item.number_amounts === "object") {
      return Object.keys(item.number_amounts).join(", ");
    }
    return item?.number ? String(item.number) : "-";
  }

  function normalizeApprovedNotificationFromSubmission(row: any) {
    if (!row) return null;

    const numberAmounts =
      row.number_amounts && typeof row.number_amounts === "object"
        ? row.number_amounts
        : {};

    const numbers =
      Array.isArray(row.numbers) && row.numbers.length
        ? row.numbers
            .map((n: any) => Number(n))
            .filter((n: number) => Number.isFinite(n))
        : Object.keys(numberAmounts).length
          ? Object.keys(numberAmounts)
              .map((n) => Number(n))
              .filter((n) => Number.isFinite(n))
          : row.number
            ? [Number(row.number)]
            : [];

    return {
      ...row,
      id: row.id,
      submission_group_id: row.submission_group_id,
      status: row.status,
      numbers,
      number_amounts: numberAmounts,
      total_amount: row.total_amount || row.ticket_price || 0,
      approved_at: row.approved_at,
      created_at: row.created_at,
      message: "Your selected number has been approved.",
    };
  }

  async function refreshApprovedNotificationFallback() {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    try {
      const res = await fetch("/api/dashboard/announcements", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      if (Array.isArray(data?.approvedNumberMessages)) {
        setApprovalNotifications(data.approvedNumberMessages);
      } else if (data?.approvedNumberMessage) {
        setApprovalNotifications([data.approvedNumberMessage]);
      }

      if (data?.dashboardMessage) {
        applyDashboardMessage(data.dashboardMessage);
      }

      if (data?.winnerAnnouncement) {
        setWinnerAnnouncement(
          normalizeWinnerAnnouncement(data.winnerAnnouncement),
        );
      }
    } catch {
      // Realtime already delivered the important status; fallback details are optional.
    }
  }
  async function loadDashboardAnnouncementsOnce() {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    try {
      const res = await fetch("/api/dashboard/announcements", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      applyDashboardMessage(data?.dashboardMessage || null);
      setWinnerAnnouncement(
        normalizeWinnerAnnouncement(data?.winnerAnnouncement),
      );
      if (Array.isArray(data?.approvedNumberMessages)) {
        setApprovalNotifications(data.approvedNumberMessages);
      } else {
        setApprovalNotifications(
          data?.approvedNumberMessage ? [data.approvedNumberMessage] : [],
        );
      }
    } catch {
      // The dashboard still works without optional announcement data.
    }
  }

  async function refreshAnnouncementsTogether() {
    await loadDashboardAnnouncementsOnce();
  }

  async function markApprovalNotificationsRead() {
    const ids = approvalNotifications.map((item) => item.id).filter(Boolean);
    const previous = approvalNotifications;
    setApprovalNotifications([]);
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    try {
      const res = await fetch("/api/user/notifications/read", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        setApprovalNotifications(previous);
      }
    } catch {
      setApprovalNotifications(previous);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWinningAmount() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          applyWinningAmountSettings(data);
        }
      } catch {
        // Keep fallback amount.
      }
    }

    void loadWinningAmount();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("dashboard-winning-amount-settings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lottery_settings_cache",
          filter: "id=eq.1",
        },
        (payload) => {
          applyWinningAmountSettings(payload);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (didLoadAnnouncementsRef.current) return;
    didLoadAnnouncementsRef.current = true;

    void loadDashboardAnnouncementsOnce();

    const supabase = getSupabaseBrowserClient();
    const userId = getCurrentUserId();

    const globalChannel = supabase
      .channel("dashboard-announcements-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "settings",
          filter: "key=eq.dashboard_message",
        },
        () => {
          void refreshAnnouncementsTogether();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "winner_announcements",
        },
        () => {
          void refreshAnnouncementsTogether();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "Dashboard realtime is not connected. Falling back to focus refresh.",
          );
        }
      });

    const userChannel = userId
      ? supabase
          .channel(`dashboard-submissions-user-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "submissions",
              filter: `user_id=eq.${userId}`,
            },
            () => {
              void refreshApprovedNotificationFallback();
            },
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.warn(
                "User notification realtime is not connected. Falling back to focus refresh.",
              );
            }
          })
      : null;

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void loadDashboardAnnouncementsOnce();
      }
    };

    return () => {
      supabase.removeChannel(globalChannel);
      if (userChannel) supabase.removeChannel(userChannel);
    };
  }, []);

  function logout() {
    logoutClientSession("/login");
  }

  return (
    <div className="min-h-screen p-4 pb-20 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t.dashboard}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {lang === "am"
                ? `ሰላም፣ ${displayName} 👋`
                : lang === "om"
                  ? `Baga nagaan dhufte, ${displayName} 👋`
                  : `Welcome, ${displayName} 👋`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageButtons lang={lang} setLang={setLang} />
            <button
              type="button"
              onClick={() => setShowNumberAmounts(true)}
              className="px-4 py-2 text-sm font-semibold text-blue-700 transition bg-white border border-blue-200 shadow-sm dark:text-blue-200 dark:bg-slate-900 dark:border-blue-800/60 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:bg-blue-950/30"
            >
              {label("numberAmounts", "Number Amounts")}
            </button>
            <button
              type="button"
              onClick={() => setShowPurchasesModal(true)}
              className="px-4 py-2 text-sm font-semibold text-green-700 transition bg-white border border-green-200 shadow-sm dark:text-emerald-200 dark:bg-slate-900 dark:border-emerald-800/60 rounded-xl hover:bg-green-50 dark:hover:bg-emerald-950/40 dark:bg-emerald-950/30"
            >
              {t.myPurchases}
            </button>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="px-4 py-2 text-sm font-semibold text-white transition bg-red-600 shadow-sm rounded-xl hover:bg-red-700"
            >
              {t.logout}
            </button>
          </div>
        </div>

        {dashboardMessage && (
          <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 p-[1px] shadow-xl shadow-blue-900/10">
            <div className="p-4 bg-white rounded-3xl dark:bg-slate-900/95 backdrop-blur md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-1 gap-3">
                  <div className="flex items-center justify-center text-xl text-white shadow-lg h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 shadow-blue-900/20">
                    ✦
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-300">
                      {label("dashboardMessageTitle", "Announcement")}
                    </div>
                    <p className="mt-2 text-xl font-semibold leading-7 text-gray-800 whitespace-pre-wrap dark:text-slate-100 md:text-2xl">
                      {dashboardMessage.text}
                    </p>

                    {!!dashboardMessage.images?.length && (
                      <div className="grid grid-cols-2 gap-3 mt-4 sm:gap-4 lg:grid-cols-4">
                        {dashboardMessage.images.map((image, index) => (
                          <button
                            key={`${image.url}-${index}`}
                            type="button"
                            onClick={() =>
                              setActiveAnnouncementImage(image.url)
                            }
                            className="group relative h-36 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 sm:h-44 lg:h-48"
                          >
                            <img
                              src={image.url}
                              alt={`Announcement image ${index + 1}`}
                              className="object-cover w-full h-full transition duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 transition bg-black/0 group-hover:bg-black/10" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDashboardMessage}
                  className="self-end px-4 py-2 text-xs font-black text-indigo-700 transition border border-indigo-100 rounded-full bg-indigo-50 hover:bg-indigo-100 md:self-start"
                >
                  {label("close", "Close")}
                </button>
              </div>
            </div>
          </section>
        )}

        {activeAnnouncementImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setActiveAnnouncementImage(null)}
              className="absolute px-4 py-2 text-sm font-black bg-white rounded-full shadow-lg right-4 top-4 text-slate-900 hover:bg-slate-100"
            >
              ✕ {label("close", "Close")}
            </button>
            <img
              src={activeAnnouncementImage}
              alt="Announcement"
              className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        )}

        <WinnerAnnouncement announcement={winnerAnnouncement} />

        {approvalNotifications.length > 0 && (
          <section className="p-4 border shadow-md rounded-2xl border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 dark:from-emerald-950/40 via-white dark:via-slate-900/60 to-emerald-100">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="px-6 py-4 bg-white shadow-inner rounded-2xl dark:bg-slate-900/80 ring-1 ring-emerald-100">
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-200 md:text-4xl">
                  {label("approvalGoodLuck", "Good luck!")}
                </div>
              </div>
              <div className="grid w-full max-w-2xl gap-2">
                {approvalNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 text-left bg-white border shadow-sm rounded-xl border-emerald-100 dark:border-emerald-800/60 dark:bg-slate-900/90 dark:bg-slate-900/85"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-sm font-black text-emerald-950 dark:text-emerald-50">
                        {label("numbers", "Numbers")}
                      </span>
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200">
                        {label("approved", "Approved")}
                      </span>
                    </div>
                    <div className="text-lg font-black text-gray-950 dark:text-white">
                      {formatApprovedNumbers(item)}
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs">
                      <span className="font-bold text-emerald-800 dark:text-emerald-100">
                        {label("amount", "Amount")}
                      </span>
                      <span className="font-extrabold text-emerald-950 dark:text-emerald-50">
                        {Number(
                          item.total_amount || item.ticket_price || 0,
                        ).toLocaleString()}{" "}
                        {label("birr", "Birr")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={markApprovalNotificationsRead}
                className="px-5 py-2 text-xs font-black text-white transition shadow-md rounded-xl bg-emerald-600 shadow-emerald-700/20 hover:bg-emerald-700"
              >
                {label("gotIt", "Got it")}
              </button>
            </div>
          </section>
        )}

        <section className="overflow-hidden border border-pink-100 shadow-xl rounded-3xl bg-gradient-to-b from-white via-pink-50 to-rose-50">
          <div className="flex flex-col gap-3 p-3 sm:p-4 md:p-4 lg:p-5">
            <div className="flex items-center justify-center">
              <img
                src="/images/barudaa-dashboard-nobg.png"
                alt={t.prizeCar}
                className="mx-auto w-full max-w-5xl object-contain drop-shadow-xl max-h-[220px] sm:max-h-[260px] md:max-h-[320px] lg:max-h-[420px]"
              />
            </div>
            <div className="w-full max-w-5xl p-3 mx-auto text-center bg-white border border-pink-100 shadow-md rounded-3xl dark:bg-slate-900/90 dark:bg-slate-900/85 shadow-pink-900/5 backdrop-blur sm:p-4 md:p-4 lg:p-5">
              <p className="max-w-4xl mx-auto text-lg font-black leading-snug tracking-tight text-rose-700 sm:text-xl md:text-2xl md:leading-snug lg:text-3xl lg:leading-snug">
                የአንጋፋውና ስመጥር የሆነው የባሩዳ ዶት ኮም ቤተሰብ ጨዋታ ይወዳደሩ ተሸላሚ ይሁኑ
              </p>
              {winningAmount !== null && (
                <p className="max-w-4xl mx-auto my-4 text-xl font-black leading-tight tracking-tight text-blue-700 dark:text-blue-200 sm:text-2xl md:text-3xl md:leading-tight lg:text-4xl lg:leading-tight">
                  {formatWinningAmount(winningAmount)}
                </p>
              )}
              <a
                href="https://t.me/barudaloto"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Barudalo Telegram group"
                className="mt-2 inline-flex items-center justify-center rounded-full bg-rose-100 px-4 py-1.5 text-base font-black text-rose-800 shadow-sm transition hover:bg-rose-200 hover:text-rose-900 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-rose-200 sm:text-lg md:mt-3 md:px-5 md:py-2 md:text-xl lg:text-2xl"
              >
                @Barudalo
              </a>
            </div>
          </div>
        </section>

        <section>
          <NumberStatusLegend lang={lang} />
          <NumberGrid />
        </section>
      </div>

      <NumberAmountsModal
        open={showNumberAmounts}
        onClose={() => setShowNumberAmounts(false)}
        lang={lang}
      />
      <MyPurchasesModal
        open={showPurchasesModal}
        onClose={() => setShowPurchasesModal(false)}
        subs={subs}
        lang={lang}
        title={t.myPurchases}
      />

      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 dark:bg-black/75 p-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="w-full max-w-sm p-6 bg-white shadow-2xl dark:bg-slate-900 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t.logoutConfirmTitle}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              {t.userLogoutConfirmMessage}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-3 font-semibold text-gray-700 border dark:text-slate-200 rounded-xl"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex-1 px-4 py-3 font-semibold text-white bg-red-600 rounded-xl"
              >
                {t.logout}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
