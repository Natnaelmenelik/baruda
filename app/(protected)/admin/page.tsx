"use client";

import PickWinnerModal from "@/components/PickWinnerModal";

import ThemeToggle from "@/components/ThemeToggle";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  useSubmissions,
  useStats,
  useApproveSubmission,
  useRejectSubmission,
  useClearAllSubmissions,
  useDrawWinner,
} from "@/hooks/useAdmin";
import { fetchReceipt, fetchWinners } from "@/lib/api/admin";
import { useLang } from "@/hooks/useLang";
import { tm } from "@/lib/i18n/toastMessages";
import { logoutClientSession } from "@/lib/auth/client";
import AdminSettingsPanel from "@/components/AdminSettingsPanel";
import AdminNumbersPanel from "@/components/AdminNumbersPanel";
import LanguageButtons from "@/components/LanguageButtons";
import { translateApiError } from "@/lib/i18n/apiErrorMessages";

export default function AdminPage() {
  const router = useRouter();
  const { t: txt, lang, setLang } = useLang();

  const user =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("user") || "{}")
      : {};
  const displayName =
    user?.name ||
    user?.fullName ||
    user?.full_name ||
    user?.username ||
    user?.phone ||
    "Admin";

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  const [processingSubmissionId, setProcessingSubmissionId] = useState<
    string | null
  >(null);
  const [processingType, setProcessingType] = useState<
    "approve" | "reject" | null
  >(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(
    null,
  );
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPickWinnerModal, setShowPickWinnerModal] = useState(false);
  const [winners, setWinners] = useState<any[]>([]);
  const [winnersLoading, setWinnersLoading] = useState(false);

  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [submissionSearchInput, setSubmissionSearchInput] = useState("");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionPage, setSubmissionPage] = useState(1);
  const submissionLimit = 20;


  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSubmissionSearch(submissionSearchInput.trim());
      setSubmissionPage(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [submissionSearchInput]);
  const {
    data: submissionsResponse = {
      submissions: [],
      page: 1,
      limit: submissionLimit,
      total: 0,
      totalPages: 1,
      status: submissionStatusFilter,
      search: submissionSearch,
    },
    isLoading: submissionsLoading,
    refetch: refetchSubmissions,
  } = useSubmissions({
    page: submissionPage,
    limit: submissionLimit,
    status: submissionStatusFilter,
    search: submissionSearch,
  });
  const { data: stats = {}, isLoading: statsLoading, refetch: refetchStats } = useStats();
  const { mutate: approve } = useApproveSubmission();
  const { mutate: reject } = useRejectSubmission();
  const { mutate: clearAll, isPending: clearing } = useClearAllSubmissions();

  const getSubmissionNumbers = (sub: any) => {
    const itemSource =
      Array.isArray(sub.items) && sub.items.length > 0
        ? sub.items
        : Array.isArray(sub.submission_items) && sub.submission_items.length > 0
          ? sub.submission_items
          : [];

    if (itemSource.length > 0) {
      return itemSource
        .map((item: any) => Number(item.number))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    }

    if (Array.isArray(sub.numbers) && sub.numbers.length > 0) {
      return sub.numbers
        .map(Number)
        .filter((n: number) => Number.isFinite(n) && n > 0);
    }

    if (sub.number_amounts && typeof sub.number_amounts === "object") {
      return Object.keys(sub.number_amounts)
        .map(Number)
        .filter((n: number) => Number.isFinite(n) && n > 0);
    }

    if (sub.number) {
      return [Number(sub.number)];
    }

    return [];
  };

  const formatSubmissionNumbers = (sub: any) => {
    const numbers = getSubmissionNumbers(sub);
    return numbers.length ? numbers.join(", ") : "-";
  };

  const groupAdminSubmissions = (items: any[]) => {
    const grouped = new Map<string, any>();

    for (const sub of items) {
      const numbers = getSubmissionNumbers(sub);

      const receiptIdentity = sub.receipt_key || sub.receipt_url || "";

      const submittedMinute = sub.submitted_at
        ? new Date(sub.submitted_at).toISOString().slice(0, 16)
        : "";

      const userIdentity =
        sub.user_id ||
        sub.user_phone ||
        sub.contact_phone ||
        sub.user_name ||
        "unknown";

      const key =
        sub.submission_type === "group" && sub.submission_group_id
          ? `group-${sub.submission_group_id}`
          : receiptIdentity
            ? `receipt-${userIdentity}-${receiptIdentity}`
            : sub.status === "pending" && submittedMinute
              ? `pending-time-${userIdentity}-${submittedMinute}`
              : `single-${sub.id}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          ...sub,
          id: sub.submission_group_id || sub.id,
          numbers,
          quantity: numbers.length,
        });
      } else {
        const existing = grouped.get(key);

        const mergedNumbers = Array.from(
          new Set([...(existing.numbers || []), ...numbers]),
        ).sort((a: any, b: any) => Number(b) - Number(a));

        grouped.set(key, {
          ...existing,
          numbers: mergedNumbers,
          quantity: mergedNumbers.length,
          receipt_url: existing.receipt_url || sub.receipt_url,
          receipt_key: existing.receipt_key || sub.receipt_key,
          has_receipt:
            existing.has_receipt ||
            sub.has_receipt ||
            !!existing.receipt_url ||
            !!sub.receipt_url,
          status:
            existing.status === "pending" || sub.status === "pending"
              ? "pending"
              : existing.status === "approved" || sub.status === "approved"
                ? "approved"
                : existing.status === "rejected" || sub.status === "rejected"
                  ? "rejected"
                  : sub.status || existing.status,
          submitted_at: existing.submitted_at || sub.submitted_at,
        });
      }
    }

    return Array.from(grouped.values());
  };

  const submissions = Array.isArray((submissionsResponse as any)?.submissions)
    ? (submissionsResponse as any).submissions
    : Array.isArray(submissionsResponse)
      ? submissionsResponse
      : [];

  const safeSubmissions = groupAdminSubmissions(submissions);
  const submissionTotal = Number((submissionsResponse as any)?.total || safeSubmissions.length || 0);
  const submissionTotalPages = Math.max(1, Number((submissionsResponse as any)?.totalPages || 1));
  const currentSubmissionPage = Math.min(
    submissionPage,
    submissionTotalPages,
  );

  const statusLabel = (status: string) =>
    status === "approved"
      ? txt.approved
      : status === "rejected"
        ? txt.rejected
        : txt.pending;

  async function refreshAdminDataAfterClear() {
    await Promise.allSettled([
      refetchStats?.(),
      refetchSubmissions?.(),
    ]);
  }

  const handleLogout = () => {
    logoutClientSession("/login");
  };

  const handleApprove = (id: string) => {
    setProcessingSubmissionId(id);
    setProcessingType("approve");
    approve(id, {
      onSuccess: () => toast.success(tm(lang, "approveSuccess")),
      onError: (err: any) =>
        toast.error(translateApiError(err, lang) || tm(lang, "approveFailed")),
      onSettled: () => {
        setProcessingSubmissionId(null);
        
      setProcessingType(null);
      },
    });
  };

  const handleReject = (id: string) => {
    setProcessingSubmissionId(id);
    setProcessingType("reject");
    reject(id, {
      onSuccess: () => toast.success(tm(lang, "rejectSuccess")),
      onError: (err: any) =>
        toast.error(translateApiError(err, lang) || tm(lang, "rejectFailed")),
      onSettled: () => {
        setProcessingSubmissionId(null);
        
      setProcessingType(null);
      },
    });
  };

  const handleViewReceipt = async (sub: any) => {
    try {
      setReceiptLoadingId(sub.id);

      // Always ask the backend for a fresh signed URL.
      // Do not open sub.receipt_url directly because it may be an expired Supabase signed URL.
      const data = await fetchReceipt(sub.id);
      const freshUrl = data?.receiptUrl || data?.signedUrl || data?.url || sub?.receipt_url || "";

      if (!freshUrl) {
        toast.error(tm(lang, "receiptLoadFailed"));
        return;
      }

      setSelectedImage(freshUrl);
    } catch (err: any) {
      toast.error(translateApiError(err, lang) || tm(lang, "receiptLoadFailed"));
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const handleOpenWinners = async () => {
    try {
      // Refetch winners every time the Previous Winners modal is opened.
      setShowWinnersModal(true);
      setWinners([]);
      setWinnersLoading(true);
      const data = await fetchWinners();
      setWinners(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(translateApiError(err, lang) || txt.failedToLoadWinners);
    } finally {
      setWinnersLoading(false);
    }
  };

  const confirmClearAll = () => {
    clearAll(undefined, {
      onSuccess: async () => {
        setShowClearModal(false);
        await refreshAdminDataAfterClear();
        toast.success(tm(lang, "clearSuccess"));
      
        

      },
      onError: (err: any) =>
        toast.error(translateApiError(err, lang) || tm(lang, "clearFailed")),
    });
  };

  if (submissionsLoading || statsLoading)
    return <div className="p-8 text-center">{txt.loading}</div>;

  return (
    <div className="min-h-screen p-4 bg-gray-100 md:p-6">
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{txt.adminPanel}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {txt.welcome}, {displayName} 👋
          </p>
        </div>
        <div className="flex flex-wrap justify-center w-full gap-2 md:w-auto md:justify-end">
          <LanguageButtons lang={lang} setLang={setLang} />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-dashboard-message-modal"))}
            className="px-4 py-2 font-semibold text-amber-900 dark:text-amber-100 transition rounded bg-gradient-to-r from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200"
          >
            {((txt as any).writeDashboardMessage || "Write a Message")}
          </button>
          <button
            onClick={() => setShowPickWinnerModal(true)}
            className="px-4 py-2 text-white bg-purple-600 rounded disabled:opacity-50"
          >
            {txt.pickWinner}
          </button>
          {/* Previous Winners button hidden/commented out by request
          <button
            onClick={handleOpenWinners}
            className="px-4 py-2 text-white bg-blue-600 rounded"
          >
            {txt.previousWinners}
          </button>
          */}
          <button
            onClick={() => setShowClearModal(true)}
            disabled={clearing}
            className="px-4 py-2 text-white bg-red-600 rounded disabled:opacity-50"
          >
            {txt.clearAll}
          </button>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="px-4 py-2 text-white bg-gray-700 rounded"
          >
            {txt.logout}
          </button>
        </div>
      </div>

      <AdminSettingsPanel />
<AdminNumbersPanel />

      <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-5">
        <StatCard title={txt.users} value={stats.totalUsers || 0} />
        <StatCard title={txt.sold} value={stats.numbersSold || 0} />
        <StatCard title={txt.pending} value={stats.pendingNumbers ?? stats.pendingApprovals ?? 0} />
        <StatCard
          title={txt.revenue}
          value={`${Number(stats.revenue || 0).toLocaleString()} Birr`}
        />
        <StatCard title={txt.left} value={stats.numbersLeft || 0} />
      </div>

      <div className="overflow-hidden bg-white dark:bg-slate-900 shadow rounded-xl">
        <div className="flex flex-col gap-4 p-4 border-b lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold">{txt.submissions}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {txt.total}: {submissionTotal}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {(["pending", "all", "approved", "rejected"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setSubmissionStatusFilter(status);
                    setSubmissionPage(1);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    submissionStatusFilter === status
                      ? "bg-blue-600 text-white shadow"
                      : "bg-gray-100 text-gray-700 dark:text-slate-200 hover:bg-gray-200"
                  }`}
                >
                  {status === "all"
                    ? txt.all
                    : statusLabel(status)}
                </button>
              ))}
            </div>

            <input
              value={submissionSearchInput}
              onChange={(e) => setSubmissionSearchInput(e.target.value)}
              placeholder={(txt as any).searchSubmissions || "Search name, phone, number..."}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-64"
            />
          </div>
        </div>

        {safeSubmissions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">
            {txt.noSubmissions}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="p-3 text-left">{txt.user}</th>
                  <th className="p-3 text-left">{txt.phone}</th>
                  <th className="p-3 text-left">{txt.numbers}</th>
                  <th className="p-3 text-left">{txt.amount}</th>
                  <th className="p-3 text-left">{txt.receipt}</th>
                  <th className="p-3 text-left">{txt.status}</th>
                  <th className="p-3 text-left">{txt.submitted}</th>
                  <th className="p-3 text-left">{txt.action}</th>
                </tr>
              </thead>
              <tbody>
                {safeSubmissions.map((sub: any) => {
                  const nums = Array.isArray(sub.numbers)
                    ? sub.numbers
                    : [sub.number].filter(Boolean);
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => setSelectedSubmission(sub)}
                      className="border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <td className="p-3">{sub.user_name || txt.unknown}</td>
                      <td className="p-3">
                        {sub.user_phone || sub.contact_phone || "-"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap max-w-sm gap-1">
                          {nums.map((n: any, index: number) => (
                            <span
                              key={`${n}-${index}`}
                              className={`rounded-full px-2 py-1 text-xs font-bold ${sub.status === "approved" ? "bg-green-100 dark:bg-emerald-50 dark:bg-emerald-950/300/20 text-green-700 dark:text-emerald-200" : sub.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        <div>
                          <b>
                            {Number(sub.total_amount || 0).toLocaleString()}{" "}
                            Birr
                          </b>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {txt.ticket}:{" "}
                          {Number(sub.ticket_price || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-3">
                        {sub.has_receipt || sub.receipt_url ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewReceipt(sub);
                            }}
                            disabled={receiptLoadingId === sub.id}
                            className="px-3 py-1 text-sm text-white bg-blue-600 rounded disabled:opacity-50"
                          >
                            {receiptLoadingId === sub.id
                              ? txt.loading
                              : txt.viewReceipt}
                          </button>
                        ) : (
                          <span className="text-gray-400">{txt.noReceipt}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${sub.status === "approved" ? "bg-green-100 dark:bg-emerald-50 dark:bg-emerald-950/300/20 text-green-700 dark:text-emerald-200" : sub.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                        >
                          {statusLabel(sub.status)}
                        </span>
                      </td>
                      <td className="p-3 text-sm">
                        {sub.submitted_at
                          ? new Date(sub.submitted_at).toLocaleString(
                              lang === "am" ? "am-ET" : "en-US",
                            )
                          : "-"}
                      </td>
                      <td className="p-3">
                        {sub.status === "pending" ? (
                          <div className="flex flex-wrap justify-center w-full gap-2 md:w-auto md:justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(sub.id);
                              }}
                              disabled={processingSubmissionId === sub.id}
                              className="px-3 py-1 text-sm text-white bg-green-600 rounded disabled:opacity-50"
                            >
                              {processingSubmissionId === sub.id &&
                              processingType === "approve"
                                ? txt.approving
                                : txt.approve}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReject(sub.id);
                              }}
                              disabled={processingSubmissionId === sub.id}
                              className="px-3 py-1 text-sm text-white bg-red-600 rounded disabled:opacity-50"
                            >
                              {processingSubmissionId === sub.id &&
                              processingType === "reject"
                                ? txt.rejecting
                                : txt.reject}
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">
                            {txt.processed}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t p-4 text-sm text-gray-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {((txt as any).page || "Page")} {currentSubmissionPage} / {submissionTotalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubmissionPage((p) => Math.max(1, p - 1))}
              disabled={currentSubmissionPage <= 1}
              className="rounded-lg border px-3 py-2 font-semibold text-gray-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {((txt as any).previous || "Previous")}
            </button>
            <button
              type="button"
              onClick={() =>
                setSubmissionPage((p) => Math.min(submissionTotalPages, p + 1))
              }
              disabled={currentSubmissionPage >= submissionTotalPages}
              className="rounded-lg border px-3 py-2 font-semibold text-gray-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {((txt as any).next || "Next")}
            </button>
          </div>
        </div>
      </div>

            {selectedSubmission && (
        <Modal onClose={() => setSelectedSubmission(null)} wide>
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white dark:text-white">
                {txt.submissionDetails || "Submission Details"}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 dark:text-slate-300">
                {txt.clickRowDetails ||
                  "Review receipt, user information, and contribution breakdown."}
              </p>
            </div>

            <div className="grid gap-4 rounded-xl bg-gray-50 p-4 text-sm dark:bg-slate-800 md:grid-cols-2">
              <div className="space-y-2">
                <InfoLine
                  label={txt.user}
                  value={
                    selectedSubmission.user_name ||
                    selectedSubmission.user ||
                    txt.unknown ||
                    "-"
                  }
                />
                <InfoLine
                  label={txt.phone}
                  value={
                    selectedSubmission.user_phone ||
                    selectedSubmission.contact_phone ||
                    "-"
                  }
                />
                <InfoLine
                  label={txt.status}
                  value={
                    statusLabel
                      ? statusLabel(selectedSubmission.status)
                      : selectedSubmission.status
                  }
                />
              </div>

              <div className="space-y-2">
                <InfoLine
                  label={txt.submitted}
                  value={
                    selectedSubmission.submitted_at
                      ? new Date(selectedSubmission.submitted_at).toLocaleString(
                          lang === "am" ? "am-ET" : "en-US",
                        )
                      : "-"
                  }
                />
                <InfoLine
                  label={txt.amount}
                  value={`${Number(
                    selectedSubmission.total_amount || 0,
                  ).toLocaleString()} ${txt.birr}`}
                />
                <InfoLine
                  label={txt.receipt}
                  value={
                    selectedSubmission.receipt_url
                      ? txt.available || "Available"
                      : txt.noReceipt || "-"
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border p-4 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-bold text-gray-900 dark:text-white dark:text-white">
                  {txt.contributionBreakdown || txt.numbers}
                </h3>
                <span className="text-xs font-semibold text-gray-400">
                  {txt.total}: {Number(selectedSubmission.total_amount || 0).toLocaleString()} {txt.birr}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {(Array.isArray(selectedSubmission.items) &&
                selectedSubmission.items.length
                  ? selectedSubmission.items
                  : Array.isArray(selectedSubmission.submission_items) &&
                      selectedSubmission.submission_items.length
                    ? selectedSubmission.submission_items
                    : Array.isArray(selectedSubmission.numbers)
                      ? selectedSubmission.numbers.map((n: any) => ({
                          number: n,
                          amount:
                            selectedSubmission.number_amounts?.[n] ||
                            selectedSubmission.ticket_price ||
                            0,
                        }))
                      : selectedSubmission.number
                        ? [
                            {
                              number: selectedSubmission.number,
                              amount:
                                selectedSubmission.total_amount ||
                                selectedSubmission.ticket_price ||
                                0,
                            },
                          ]
                        : []
                ).map((item: any, index: number) => (
                  <div
                    key={`${item.number}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm dark:bg-blue-950/50"
                  >
                    <span className="font-bold text-blue-700 dark:text-blue-200 dark:text-blue-200">
                      {item.number}
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-slate-100 dark:text-slate-100">
                      {Number(item.amount || 0).toLocaleString()} {txt.birr}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {txt.close}
              </button>

              {selectedSubmission.receipt_url && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleViewReceipt(selectedSubmission);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {txt.viewReceipt}
                </button>
              )}

              {selectedSubmission.status === "pending" && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(selectedSubmission.id);
                      setSelectedSubmission(null);
                    }}
                    className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    {txt.reject}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(selectedSubmission.id);
                      setSelectedSubmission(null);
                    }}
                    className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    {txt.approve}
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showLogoutModal && (
        <Modal onClose={() => setShowLogoutModal(false)}>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {txt.logoutConfirmTitle}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            {txt.adminLogoutConfirmMessage}
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 px-4 py-3 font-semibold text-gray-700 dark:text-slate-200 border rounded-xl"
            >
              {txt.cancel}
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 px-4 py-3 font-semibold text-white bg-red-600 rounded-xl"
            >
              {txt.logout}
            </button>
          </div>
        </Modal>
      )}
      {showClearModal && (
        <Modal onClose={() => setShowClearModal(false)}>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {txt.clearAllSubmissionsTitle}
          </h2>
          <p className="mt-3 text-sm text-gray-600 dark:text-slate-300">
            {txt.clearAllSubmissionsMessage}
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowClearModal(false)}
              disabled={clearing}
              className="flex-1 px-4 py-3 font-semibold text-gray-700 dark:text-slate-200 border rounded-xl disabled:opacity-50"
            >
              {txt.cancel}
            </button>
            <button
              onClick={confirmClearAll}
              disabled={clearing}
              className="flex-1 px-4 py-3 font-semibold text-white bg-red-600 rounded-xl disabled:opacity-50"
            >
              {clearing ? txt.clearing : txt.yesClearAll}
            </button>
          </div>
        </Modal>
      )}

      {showWinnersModal && (
        <Modal onClose={() => setShowWinnersModal(false)} wide>
          <div className="flex items-center justify-between pb-3 mb-4 border-b">
            <h2 className="text-xl font-bold">{txt.previousWinners}</h2>
            <button
              onClick={() => setShowWinnersModal(false)}
              className="px-3 py-1 text-sm font-semibold bg-gray-200 rounded-lg"
            >
              ×
            </button>
          </div>
          {winnersLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              {txt.loadingWinners}
            </div>
          ) : winners.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              {txt.noPreviousWinners}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">{txt.numbers}</th>
                    <th className="p-3 text-left">{txt.winner}</th>
                    <th className="p-3 text-left">{txt.phone}</th>
                    <th className="p-3 text-left">{txt.round}</th>
                    <th className="p-3 text-left">{txt.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {winners.map((w: any) => (
                    <tr key={w.id} className="border-b hover:bg-gray-50 dark:hover:bg-slate-800">
                      <td className="p-3 font-bold">{w.number}</td>
                      <td className="p-3">{w.user_name || txt.unknown}</td>
                      <td className="p-3">{w.user_phone || "-"}</td>
                      <td className="p-3">
                        {txt.round} {w.draw_round || 1}
                      </td>
                      <td className="p-3">
                        {w.drawn_at
                          ? new Date(w.drawn_at).toLocaleString(
                              lang === "am" ? "am-ET" : "en-US",
                            )
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 dark:bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative w-full max-w-4xl p-5 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {txt.paymentReceipt}
              </h2>
              <button
                onClick={() => setSelectedImage(null)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg"
              >
                {txt.close}
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl bg-gray-100 p-3">
              <img
                src={selectedImage}
                alt={txt.paymentReceiptAlt}
                className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
      <PickWinnerModal
        open={showPickWinnerModal}
        onClose={() => setShowPickWinnerModal(false)}
        onPicked={() => {}}
        lang={lang}
      />
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-slate-700 pb-1.5 last:border-b-0 dark:border-slate-700">
      <span className="text-gray-500 dark:text-slate-400 dark:text-slate-400">{label}</span>
      <b className="text-right text-gray-900 dark:text-white dark:text-white">{value}</b>
    </div>
  );
}

function Modal({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 dark:bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-sm"} rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="p-5 text-center bg-white dark:bg-slate-900 shadow rounded-xl">
      <div className="text-3xl font-extrabold text-gray-950 dark:text-white">{value}</div>
      <div className="mt-1 text-base font-medium text-gray-500 dark:text-slate-400">{title}</div>
    </div>
  );
}
