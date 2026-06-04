"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/hooks/useLang";
import toast from "react-hot-toast";
import { translateApiError } from "@/lib/i18n/apiErrorMessages";

type NumberPoolRow = {
  number: number;
  target_amount?: number;
  target?: number;
  current_amount?: number;
  current?: number;
  remaining?: number;
  status?: string;
  submission_count?: number;
  total_submissions?: number;
  approved_count?: number;
};

type ApprovedUserNumbersRow = {
  user_name?: string;
  user_phone?: string;
  numbers?: number[];
  total_amount?: number;
  submission_count?: number;
  approved_item_count?: number;
  number_amounts?: { number?: number; amount?: number }[];
};

type NumberSubmissionRow = {
  id?: string;
  submission_id?: string;
  number?: number;
  amount?: number;
  status?: string;
  submitted_at?: string;
  receipt_url?: string;
  user_name?: string;
  user_phone?: string;
};

type ManualCloseLine = {
  number: string;
  amount: string;
};

type ManualEntryEditLine = {
  number: string;
  amount: string;
};

type ManualEntryRow = {
  id?: string;
  user_name?: string;
  user_phone?: string;
  contact_phone?: string;
  numbers?: number[];
  items?: {
    number?: number;
    amount?: number;
    status?: string;
    rejected_at?: string;
  }[];
  number_amounts?: Record<string, number> | null;
  total_amount?: number;
  status?: string;
  submission_type?: string;
  approved_at?: string;
  created_at?: string;
};

export default function AdminNumbersPanel() {
  const { t: txt, lang } = useLang();

  const [showManage, setShowManage] = useState(false);
  const [showSelections, setShowSelections] = useState(false);
  const [showNumberSubmissions, setShowNumberSubmissions] = useState(false);
  const [showEditTarget, setShowEditTarget] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const [numbers, setNumbers] = useState<NumberPoolRow[]>([]);
  const [selections, setSelections] = useState<NumberSubmissionRow[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUserNumbersRow[]>(
    [],
  );
  const [showApprovedUsers, setShowApprovedUsers] = useState(false);
  const [approvedNumberFilter, setApprovedNumberFilter] = useState("");
  const [approvedUsersPage, setApprovedUsersPage] = useState(1);
  const [approvedUsersTotal, setApprovedUsersTotal] = useState(0);
  const [approvedUsersTotalPages, setApprovedUsersTotalPages] = useState(1);
  const approvedUsersPageSize = 20;
  const [numberSubmissions, setNumberSubmissions] = useState<
    NumberSubmissionRow[]
  >([]);
  const [selectedNumber, setSelectedNumber] = useState<NumberPoolRow | null>(
    null,
  );
  const [targetInput, setTargetInput] = useState("");
  const [globalTargetInput, setGlobalTargetInput] = useState("");
  const [showGlobalTargetConfirm, setShowGlobalTargetConfirm] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showManualCloseModal, setShowManualCloseModal] = useState(false);
  const [manualClientName, setManualClientName] = useState("");
  const [manualClientPhone, setManualClientPhone] = useState("");
  const [manualCloseLines, setManualCloseLines] = useState<ManualCloseLine[]>([
    { number: "", amount: "" },
  ]);
  const [manualEntries, setManualEntries] = useState<ManualEntryRow[]>([]);
  const [manualEntriesLoading, setManualEntriesLoading] = useState(false);
  const [manualCloseSubmitting, setManualCloseSubmitting] = useState(false);
  const [selectedManualEntry, setSelectedManualEntry] =
    useState<ManualEntryRow | null>(null);
  const [manualEntryEditName, setManualEntryEditName] = useState("");
  const [manualEntryEditPhone, setManualEntryEditPhone] = useState("");
  const [manualEntryEditLines, setManualEntryEditLines] = useState<
    ManualEntryEditLine[]
  >([]);
  const [manualEntryEditSaving, setManualEntryEditSaving] = useState(false);
  const [dashboardMessageText, setDashboardMessageText] = useState("");
  const [dashboardMessageImages, setDashboardMessageImages] = useState<File[]>(
    [],
  );
  const [dashboardImagePreviews, setDashboardImagePreviews] = useState<
    string[]
  >([]);
  const [dashboardMessageImageFile, setDashboardMessageImageFile] =
    useState<File | null>(null);
  const [dashboardMessageImagePreview, setDashboardMessageImagePreview] =
    useState("");
  const [selectionReceiptImage, setSelectionReceiptImage] = useState<
    string | null
  >(null);
  const [preparedTelegramMessage, setPreparedTelegramMessage] = useState("");

  const [loadingType, setLoadingType] = useState<
    | "manage"
    | "selections"
    | "approvedUsers"
    | "view"
    | "close"
    | "unclose"
    | "target"
    | "copyAmounts"
    | "message"
    | null
  >(null);

  const label = (key: string, fallback: string) => {
    const value = (txt as any)?.[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };

  useEffect(() => {
    const openDashboardMessageModal = () => setShowMessageModal(true);
    window.addEventListener(
      "open-dashboard-message-modal",
      openDashboardMessageModal,
    );

    return () => {
      window.removeEventListener(
        "open-dashboard-message-modal",
        openDashboardMessageModal,
      );
    };
  }, []);

  useEffect(() => {
    void refreshPreparedTelegramMessage();
  }, []);

  useEffect(() => {
    if (!showApprovedUsers) return;

    const timer = window.setTimeout(() => {
      setApprovedUsersPage(1);
      loadApprovedUsers(1, approvedNumberFilter, false);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [approvedNumberFilter, showApprovedUsers]);

  const formatDate = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString(lang === "am" ? "am-ET" : "en-US");
  };

  const getTarget = (row: NumberPoolRow) =>
    Number(row.target_amount ?? row.target ?? 0);
  const getCurrent = (row: NumberPoolRow) =>
    Number(row.current_amount ?? row.current ?? 0);
  const getRemaining = (row: NumberPoolRow) => {
    const target = getTarget(row);
    const current = getCurrent(row);
    return Number(row.remaining ?? Math.max(target - current, 0));
  };
  const isClosed = (row: NumberPoolRow) => {
    const remaining = getRemaining(row);
    return (
      row.status === "sold" ||
      row.status === "closed" ||
      row.status === "taken" ||
      remaining <= 0
    );
  };

  async function readJson(res: Response) {
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detailsMessage = Array.isArray(data?.details)
        ? data.details
            .map((item: any) =>
              typeof item === "string"
                ? item
                : item?.message
                  ? String(item.message)
                  : "",
            )
            .filter(Boolean)
            .join(" ")
        : "";

      const errorCode = typeof data?.error === "string" ? data.error : "";
      const humanMessage =
        data?.message ||
        detailsMessage ||
        (errorCode && errorCode !== "manual_entry_validation_failed"
          ? errorCode
          : "") ||
        `Request failed: ${res.status}`;

      const error = new Error(humanMessage) as Error & {
        data?: any;
        code?: string;
      };
      error.data = data;
      error.code = errorCode;
      throw error;
    }

    return data;
  }

  async function loadNumbers() {
    try {
      // Refetch every time Manage Numbers is opened/clicked.
      setShowManage(true);
      setNumbers([]);
      setLoadingType("manage");

      const res = await fetch("/api/admin/numbers?t=" + Date.now(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await readJson(res);
      const loadedNumbers = Array.isArray(data) ? data : data?.numbers || [];
      setNumbers(loadedNumbers);
      setPreparedTelegramMessage(buildTelegramMessage(loadedNumbers));
      setGlobalTargetInput(
        String(
          loadedNumbers?.[0]?.target_amount || loadedNumbers?.[0]?.target || "",
        ),
      );
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          label("failedToLoadNumbers", "Failed to load numbers"),
      );
      setShowManage(false);
    } finally {
      setLoadingType(null);
    }
  }

  function buildTelegramMessage(rows: NumberPoolRow[]) {
    const remainingRows = rows
      .map((row: NumberPoolRow) => {
        const number = Number(row.number);
        const remaining = getRemaining(row);

        return { number, remaining };
      })
      .filter((row) => Number.isFinite(row.number) && row.remaining > 0)
      .sort((a, b) => a.number - b.number);

    if (!remainingRows.length) {
      return "";
    }

    const lines = remainingRows.map((row) => {
      const number = String(row.number).padEnd(10, " ");
      const remaining = row.remaining.toLocaleString();

      return `${number}${remaining}`;
    });

    return [
      "የቀረ የቁጥር መጠን",
      "",
      "ቁጥር      የቀረ መጠን",
      ...lines,
      "",
      "",
      "       የክፍያ መረጃ",
      "",
      "CBE (ንግድ ባንክ) - 1000743554101",
      "Abyssinia (አቢሲኒያ ባንክ) - 249579432",
      "Telebirr (ቴሌብር) - 0935021863",
      "Awash (አዋሽ ባንክ) - 013201731060100",
      "",
      "            ካሳሁን ደስታ ቆርቾ",
      "ከሌቦች እራሳችሁን ለመጠበቅ በእነዚህ ብቻ ተጠቀሙ",
    ].join("\n");
  }

  async function refreshPreparedTelegramMessage() {
    try {
      const res = await fetch("/api/admin/numbers?t=" + Date.now(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const data = await readJson(res);
      const rows: NumberPoolRow[] = Array.isArray(data)
        ? data
        : data?.numbers || [];

      setNumbers(rows);
      setPreparedTelegramMessage(buildTelegramMessage(rows));

      return rows;
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          err.message ||
          label("failedToLoadNumbers", "Failed to load numbers"),
      );
      return [];
    }
  }

  async function copyTextToClipboard(message: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message);
        return true;
      }
    } catch {
      // Use fallback below.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);

      return copied;
    } catch {
      return false;
    }
  }

  async function copyApprovedNumberAmountsForTelegram() {
    try {
      /*
        Important for iPhone Safari/PWA:
        Clipboard copy must happen immediately from the button tap.
        So we copy the already-prepared message instead of fetching first.
      */
      if (!preparedTelegramMessage) {
        setLoadingType("copyAmounts");
        const rows = await refreshPreparedTelegramMessage();
        setLoadingType(null);

        if (!rows.length) {
          toast.error(
            label(
              "noRemainingNumbersToCopy",
              "No numbers with remaining balance to copy",
            ),
          );
          return;
        }

        toast.error(
          label(
            "tapAgainToCopy",
            "Numbers prepared. Tap Copy Remaining Amounts again to copy.",
          ),
        );
        return;
      }

      const copied = await copyTextToClipboard(preparedTelegramMessage);

      if (copied) {
        toast.success(label("copiedForTelegram", "Copied for Telegram"));

        /*
          Refresh after copy so next tap uses fresh values,
          but do it after clipboard action so iPhone does not block the copy.
        */
        void refreshPreparedTelegramMessage();
      } else {
        toast.error(
          label("failedToCopy", "Copy failed. Please copy manually."),
        );
      }
    } catch (err: any) {
      setLoadingType(null);
      toast.error(
        translateApiError(err, lang) ||
          err.message ||
          label("failedToCopy", "Failed to copy"),
      );
    }
  }

  async function loadSelections() {
    try {
      // Refetch every time View Selections is opened/clicked.
      setShowSelections(true);
      setSelections([]);
      setLoadingType("selections");

      const res = await fetch("/api/admin/numbers/selections?t=" + Date.now(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await readJson(res);
      setSelections(Array.isArray(data) ? data : data?.selections || []);
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          label("failedToLoadSelections", "Failed to load selections"),
      );
      setShowSelections(false);
    } finally {
      setLoadingType(null);
    }
  }

  async function loadApprovedUsers(
    page = 1,
    filterValue = approvedNumberFilter,
    openModal = true,
  ) {
    try {
      setLoadingType("approvedUsers");

      const params = new URLSearchParams({
        t: String(Date.now()),
        page: String(page),
        limit: String(approvedUsersPageSize),
      });

      const cleanFilter = String(filterValue || "").trim();
      if (cleanFilter) {
        params.set("number", cleanFilter);
      }

      const res = await fetch(
        `/api/admin/numbers/approved-users?${params.toString()}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        },
      );
      const data = await readJson(res);
      const users = Array.isArray(data) ? data : data?.users || [];

      setApprovedUsers(users);
      setApprovedUsersPage(Number(data?.page || page || 1));
      setApprovedUsersTotal(Number(data?.total || users.length || 0));
      setApprovedUsersTotalPages(Number(data?.totalPages || 1));

      if (openModal) {
        setShowApprovedUsers(true);
      }
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          err.message ||
          label("failedToLoadApprovedUsers", "Failed to load approved users"),
      );
    } finally {
      setLoadingType(null);
    }
  }

  function openApprovedUsers() {
    setApprovedUsersPage(1);
    setShowApprovedUsers(true);
    loadApprovedUsers(1, approvedNumberFilter, true);
  }

  async function viewNumber(row: NumberPoolRow) {
    try {
      // Refetch this specific number's submissions every time the number is clicked.
      setSelectedNumber(row);
      setNumberSubmissions([]);
      setShowNumberSubmissions(true);
      setLoadingType("view");

      const res = await fetch(
        `/api/admin/numbers/${row.number}/submissions?t=${Date.now()}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        },
      );
      const data = await readJson(res);
      setNumberSubmissions(
        Array.isArray(data) ? data : data?.submissions || [],
      );
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          label("failedToLoadSubmissions", "Failed to load submissions"),
      );
      setShowNumberSubmissions(false);
    } finally {
      setLoadingType(null);
    }
  }

  function openEditTarget(row: NumberPoolRow) {
    setSelectedNumber(row);
    setTargetInput(String(getTarget(row) || ""));
    setShowEditTarget(true);
  }

  async function saveTarget() {
    if (!selectedNumber) return;
    const nextTarget = Number(targetInput);

    if (!Number.isFinite(nextTarget) || nextTarget <= 0) {
      toast.error(label("invalidTargetAmount", "Invalid target amount"));
      return;
    }

    try {
      setLoadingType("target");
      const res = await fetch(
        `/api/admin/numbers/${selectedNumber.number}/target`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetAmount: nextTarget,
            target_amount: nextTarget,
          }),
        },
      );
      await readJson(res);
      toast.success(label("numberTargetUpdated", "Number target updated"));
      setShowEditTarget(false);
      await loadNumbers();
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          label("failedToUpdateTarget", "Failed to update target"),
      );
    } finally {
      setLoadingType(null);
    }
  }

  async function closeNumber(row: NumberPoolRow) {
    try {
      setLoadingType("close");
      const res = await fetch(`/api/admin/numbers/${row.number}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      await readJson(res);
      toast.success(label("numberClosed", "Number closed"));
      setShowCloseConfirm(false);
      setSelectedNumber(null);
      await loadNumbers();
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          label("failedToCloseNumber", "Failed to close number"),
      );
    } finally {
      setLoadingType(null);
    }
  }

  async function uncloseNumber(row: NumberPoolRow) {
    try {
      setLoadingType("unclose");
      const res = await fetch(`/api/admin/numbers/${row.number}/unclose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      await readJson(res);
      toast.success(label("numberUnclosed", "Number reopened"));
      await loadNumbers();
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          label("failedToUncloseNumber", "Failed to reopen number"),
      );
    } finally {
      setLoadingType(null);
    }
  }

  async function saveGlobalTarget() {
    const nextTarget = Number(globalTargetInput);

    if (!Number.isFinite(nextTarget) || nextTarget <= 0) {
      toast.error(label("invalidTargetAmount", "Invalid target amount"));
      return;
    }

    try {
      setLoadingType("target");
      const res = await fetch("/api/admin/numbers/global-target", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAmount: nextTarget }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (Array.isArray(data.blocked) && data.blocked.length > 0) {
          throw new Error(
            label(
              "targetBelowApprovedWarning",
              "Some numbers already have approved contributions above this target.",
            ),
          );
        }
        throw new Error(
          data.error ||
            label(
              "failedToUpdateGlobalTarget",
              "Failed to update global target amount",
            ),
        );
      }

      toast.success(
        label("globalTargetUpdated", "Global target amount updated"),
      );
      setShowGlobalTargetConfirm(false);
      await loadNumbers();
    } catch (err: any) {
      toast.error(
        err.message ||
          label(
            "failedToUpdateGlobalTarget",
            "Failed to update global target amount",
          ),
      );
    } finally {
      setLoadingType(null);
    }
  }

  async function uploadDashboardMessageImageIfNeeded() {
    if (!dashboardMessageImageFile) return { imageKey: "", imageUrl: "" };

    const formData = new FormData();
    formData.append("file", dashboardMessageImageFile);

    const res = await fetch("/api/storage/upload-dashboard-message-image", {
      method: "POST",
      body: formData,
    });

    const data = await readJson(res);

    return {
      imageKey: String(data?.imageKey || data?.key || ""),
      imageUrl: String(data?.imageUrl || data?.url || data?.signedUrl || ""),
    };
  }

  async function compressDashboardImage(file: File): Promise<File> {
    const maxDimension = 1280;
    const quality = 0.78;

    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });

    const scale = Math.min(
      1,
      maxDimension / Math.max(image.width, image.height),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Failed to prepare image compression");

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Failed to compress image"));
        },
        "image/webp",
        quality,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, "") || "announcement-image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  }

  function resetDashboardMessageImages() {
    dashboardImagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setDashboardMessageImages([]);
    setDashboardImagePreviews([]);
  }

  function handleDashboardImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    const validFiles = files.filter((file) => file.type.startsWith("image/"));

    if (validFiles.length !== files.length) {
      toast.error(label("onlyImagesAllowed", "Only image files are allowed"));
    }

    const remaining = Math.max(0, 3 - dashboardMessageImages.length);
    const nextFiles = validFiles.slice(0, remaining);

    if (validFiles.length > remaining) {
      toast.error(label("maxDashboardImages", "You can upload up to 3 images"));
    }

    const previews = nextFiles.map((file) => URL.createObjectURL(file));
    setDashboardMessageImages((current) =>
      [...current, ...nextFiles].slice(0, 3),
    );
    setDashboardImagePreviews((current) =>
      [...current, ...previews].slice(0, 3),
    );
  }

  function removeDashboardImage(index: number) {
    setDashboardMessageImages((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setDashboardImagePreviews((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function uploadDashboardImages() {
    const uploadedImages: { url: string; key: string }[] = [];

    for (const image of dashboardMessageImages) {
      const compressed = await compressDashboardImage(image);
      const formData = new FormData();
      formData.append("file", compressed);

      const res = await fetch("/api/storage/upload-dashboard-message-image", {
        method: "POST",
        body: formData,
      });

      const data = await readJson(res);
      const uploaded = data?.image;

      if (!uploaded?.url || !uploaded?.key) {
        throw new Error(
          label(
            "failedToUploadDashboardImage",
            "Failed to upload announcement image",
          ),
        );
      }

      uploadedImages.push({ url: uploaded.url, key: uploaded.key });
    }

    return uploadedImages;
  }

  async function sendDashboardMessage() {
    const message = dashboardMessageText.trim();

    if (!message) {
      toast.error(
        label("dashboardMessageRequired", "Please write a message first"),
      );
      return;
    }

    if (message.length > 600) {
      toast.error(
        label(
          "dashboardMessageTooLong",
          "Message must be 600 characters or less",
        ),
      );
      return;
    }

    try {
      setLoadingType("message");
      const images = await uploadDashboardImages();

      const res = await fetch("/api/admin/dashboard-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, images }),
      });
      await readJson(res);
      toast.success(label("dashboardMessageSent", "Message sent to all users"));

      setDashboardMessageText("");
      resetDashboardMessageImages();
      setShowMessageModal(false);
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          err.message ||
          label("failedToSendDashboardMessage", "Failed to send message"),
      );
    } finally {
      setLoadingType(null);
    }
  }

  function resetManualCloseForm() {
    setManualClientName("");
    setManualClientPhone("");
    setManualCloseLines([{ number: "", amount: "" }]);
  }

  function updateManualCloseLine(
    index: number,
    field: keyof ManualCloseLine,
    value: string,
  ) {
    setManualCloseLines((previous) =>
      previous.map((line, currentIndex) =>
        currentIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  }

  function addManualCloseLine() {
    setManualCloseLines((previous) => [
      ...previous,
      { number: "", amount: "" },
    ]);
  }

  function removeManualCloseLine(index: number) {
    setManualCloseLines((previous) =>
      previous.length <= 1
        ? [{ number: "", amount: "" }]
        : previous.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function getManualCloseItems() {
    return manualCloseLines
      .map((line) => ({
        number: Number(line.number),
        amount: Number(line.amount),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.number) &&
          item.number > 0 &&
          Number.isFinite(item.amount) &&
          item.amount > 0,
      );
  }

  function getManualTotalAmount() {
    return getManualCloseItems().reduce((sum, item) => sum + item.amount, 0);
  }

  function getActiveManualEntryItems(entry: ManualEntryRow) {
    return (Array.isArray(entry.items) ? entry.items : []).filter(
      (item) => String(item?.status || "active").toLowerCase() !== "rejected",
    );
  }

  function getRejectedManualEntryItems(entry: ManualEntryRow) {
    return (Array.isArray(entry.items) ? entry.items : []).filter(
      (item) => String(item?.status || "active").toLowerCase() === "rejected",
    );
  }

  function getManualEntryNumbers(entry: ManualEntryRow) {
    if (Array.isArray(entry.numbers) && entry.numbers.length) {
      return entry.numbers.join(", ");
    }

    const activeItems = getActiveManualEntryItems(entry);
    if (activeItems.length) {
      return activeItems
        .map((item) => item.number)
        .filter((value) => value !== undefined && value !== null)
        .join(", ");
    }

    if (entry.number_amounts && typeof entry.number_amounts === "object") {
      return Object.keys(entry.number_amounts).join(", ");
    }

    return "-";
  }

  function getManualEntryAmountBreakdown(entry: ManualEntryRow) {
    const activeItems = getActiveManualEntryItems(entry);
    if (activeItems.length) {
      return activeItems
        .map(
          (item) =>
            `${item.number}: ${Number(item.amount || 0).toLocaleString()}`,
        )
        .join(" • ");
    }

    if (entry.number_amounts && typeof entry.number_amounts === "object") {
      return Object.entries(entry.number_amounts)
        .map(
          ([number, amount]) =>
            `${number}: ${Number(amount || 0).toLocaleString()}`,
        )
        .join(" • ");
    }

    return Number(entry.total_amount || 0).toLocaleString();
  }

  function getManualEntryEditLines(
    entry: ManualEntryRow,
  ): ManualEntryEditLine[] {
    const activeItems = getActiveManualEntryItems(entry);

    if (activeItems.length) {
      return activeItems
        .map((item) => ({
          number: String(item.number ?? ""),
          amount: String(item.amount ?? ""),
        }))
        .filter((item) => item.number && item.amount);
    }

    if (entry.number_amounts && typeof entry.number_amounts === "object") {
      return Object.entries(entry.number_amounts).map(([number, amount]) => ({
        number,
        amount: String(amount ?? ""),
      }));
    }

    return [];
  }

  function getManualEntryStatusLabel(entry: ManualEntryRow) {
    const status = String(entry.status || "pending").toLowerCase();

    if (status === "approved") return label("approved", "Approved");
    if (status === "rejected") return label("rejected", "Rejected");
    return label("pending", "Pending");
  }

  function getManualEntryStatusBadgeClass(entry: ManualEntryRow) {
    const status = String(entry.status || "pending").toLowerCase();

    if (status === "approved") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200";
    }

    if (status === "rejected") {
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-200";
    }

    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200";
  }

  function getManualEntryEditItems() {
    return manualEntryEditLines
      .map((line) => ({
        number: Number(line.number),
        amount: Number(line.amount),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.number) &&
          item.number > 0 &&
          Number.isFinite(item.amount) &&
          item.amount > 0,
      );
  }

  function getManualEntryEditTotalAmount() {
    return getManualEntryEditItems().reduce(
      (sum, item) => sum + item.amount,
      0,
    );
  }

  function openManualEntryDetails(entry: ManualEntryRow) {
    setSelectedManualEntry(entry);
    setManualEntryEditName(entry.user_name || "");
    setManualEntryEditPhone(entry.user_phone || entry.contact_phone || "");
    setManualEntryEditLines(getManualEntryEditLines(entry));
  }

  function closeManualEntryDetails() {
    if (manualEntryEditSaving) return;
    setSelectedManualEntry(null);
    setManualEntryEditName("");
    setManualEntryEditPhone("");
    setManualEntryEditLines([]);
  }

  function updateManualEntryEditLine(
    index: number,
    field: keyof ManualEntryEditLine,
    value: string,
  ) {
    setManualEntryEditLines((previous) =>
      previous.map((line, currentIndex) =>
        currentIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  }

  function removeManualEntryEditLine(index: number) {
    setManualEntryEditLines((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function addManualEntryEditLine() {
    setManualEntryEditLines((previous) => [
      ...previous,
      { number: "", amount: "" },
    ]);
  }

  async function saveManualEntryDetails() {
    if (!selectedManualEntry?.id) return;

    const clientName = manualEntryEditName.trim();
    const phone = manualEntryEditPhone.trim();
    const items = getManualEntryEditItems();

    if (!clientName) {
      toast.error(label("clientNameRequired", "Client name is required"));
      return;
    }

    try {
      setManualEntryEditSaving(true);
      const res = await fetch(
        `/api/admin/manual-entries/${selectedManualEntry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName,
            phone,
            status: selectedManualEntry?.status || "pending",
            items,
          }),
        },
      );
      const data = await readJson(res);

      toast.success(
        data?.deleted
          ? label("manualEntryDeleted", "Manual entry removed")
          : label("manualEntryUpdated", "Manual entry updated"),
      );

      await loadManualEntries(false);
      closeManualEntryDetails();
      if (showManage) {
        void loadNumbers();
      }
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          err.message ||
          label("failedToSaveManualEntry", "Failed to save manual entry"),
      );
    } finally {
      setManualEntryEditSaving(false);
    }
  }

  async function loadManualEntries(openModal = true) {
    try {
      if (openModal) setShowManualCloseModal(true);
      setManualEntriesLoading(true);

      const res = await fetch(`/api/admin/manual-entries?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await readJson(res);
      setManualEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          err.message ||
          label(
            "failedToLoadManualEntries",
            "Failed to load manually closed numbers",
          ),
      );
    } finally {
      setManualEntriesLoading(false);
    }
  }

  function openManualCloseModal() {
    setShowManualCloseModal(true);
    void loadManualEntries(false);
  }

  async function submitManualCloseNumbers() {
    const clientName = manualClientName.trim();
    const phone = manualClientPhone.trim();
    const items = getManualCloseItems();

    if (!clientName) {
      toast.error(label("clientNameRequired", "Client name is required"));
      return;
    }

    if (!items.length) {
      toast.error(
        label(
          "manualCloseNumberRequired",
          "Enter at least one valid number and amount",
        ),
      );
      return;
    }

    try {
      setManualCloseSubmitting(true);
      const res = await fetch("/api/admin/manual-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // body: JSON.stringify({ clientName, phone, status: selectedManualEntry.status || "pending", items }),
        body: JSON.stringify({ clientName, phone, status: "pending", items }),
      });
      const data = await readJson(res);

      toast.success(
        label("manualCloseSuccess", "Manual entry saved as pending"),
      );
      resetManualCloseForm();
      await loadManualEntries(false);
      if (showManage) {
        void loadNumbers();
      }
    } catch (err: any) {
      toast.error(
        translateApiError(err, lang) ||
          err.message ||
          label("manualCloseFailed", "Failed to close number for client"),
      );
    } finally {
      setManualCloseSubmitting(false);
    }
  }

  function getApprovedFilteredAmount(user: ApprovedUserNumbersRow) {
    const filter = approvedNumberFilter.trim();

    if (!filter) {
      return Number(user.total_amount || 0);
    }

    return (user.number_amounts || [])
      .filter((item) => String(item.number) === filter)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  const filteredApprovedUsers = approvedUsers;

  return (
    <>
      {/* <div className="flex flex-wrap items-center justify-center w-full gap-3 mb-6 md:justify-end"> */}
      <div className="flex flex-wrap items-center justify-center w-full gap-3 mx-auto mb-6 text-center">
        <button
          type="button"
          onClick={loadSelections}
          disabled={loadingType !== null}
          className="admin-number-btn admin-number-btn-blue px-4 py-2 text-sm font-semibold text-blue-700 transition bg-white border border-blue-200 shadow-sm rounded-xl hover:bg-blue-50 disabled:opacity-50 dark:bg-blue-600 dark:text-white dark:border-blue-500 dark:hover:bg-blue-500"
        >
          {loadingType === "selections"
            ? label("loading", "Loading...")
            : label("viewSelections", "View Selections")}
        </button>

        <button
          type="button"
          onClick={openApprovedUsers}
          disabled={loadingType !== null}
          className="admin-number-btn admin-number-btn-green px-4 py-2 text-sm font-semibold text-green-700 transition bg-white border border-green-200 shadow-sm rounded-xl hover:bg-green-50 disabled:opacity-50 dark:bg-green-600 dark:text-white dark:border-green-500 dark:hover:bg-green-500"
        >
          {loadingType === "approvedUsers"
            ? label("loading", "Loading...")
            : label("approvedUsers", "Approved Users")}
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            copyApprovedNumberAmountsForTelegram();
          }}
          disabled={loadingType !== null}
          className="admin-number-btn admin-number-btn-purple px-4 py-2 text-sm font-semibold text-purple-700 transition bg-white border border-purple-200 shadow-sm rounded-xl hover:bg-purple-50 disabled:opacity-50 dark:bg-purple-600 dark:text-white dark:border-purple-500 dark:hover:bg-purple-500"
        >
          {loadingType === "copyAmounts"
            ? label("copying", "Copying...")
            : label("copyTelegramNumberAmounts", "Copy Remaining Amounts")}
        </button>

        <button
          type="button"
          onClick={loadNumbers}
          disabled={loadingType !== null}
          className="admin-number-btn admin-number-btn-blue px-4 py-2 text-sm font-semibold text-blue-600 transition bg-white border border-blue-200 shadow-sm rounded-xl hover:bg-blue-50 disabled:opacity-50 dark:bg-blue-600 dark:text-white dark:border-blue-500 dark:hover:bg-blue-500"
        >
          {loadingType === "manage"
            ? label("loading", "Loading...")
            : label("manageNumbers", "Manage Numbers")}
        </button>

        <button
          type="button"
          onClick={openManualCloseModal}
          disabled={loadingType !== null || manualCloseSubmitting}
          className="admin-number-btn admin-number-btn-purple px-4 py-2 text-sm font-semibold text-purple-700 transition bg-white border border-purple-200 shadow-sm rounded-xl hover:bg-purple-50 disabled:opacity-50 dark:bg-purple-600 dark:text-white dark:border-purple-500 dark:hover:bg-purple-500"
        >
          {label("manualCloseNumbersForClient", "Close Numbers for Client")}
        </button>
      </div>

      {showMessageModal && (
        <Modal
          onClose={() => {
            setShowMessageModal(false);
            resetDashboardMessageImages();
            setDashboardMessageImageFile(null);
            setDashboardMessageImagePreview("");
          }}
          title={label("writeDashboardMessage", "Write a Message")}
          scrollable
        >
          <div className="space-y-4">
            <div className="p-4 text-sm border shadow-inner rounded-2xl border-amber-100 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 dark:from-amber-950/40 via-white dark:via-slate-900/60 to-orange-50 dark:to-orange-950/30 text-amber-900 dark:text-amber-100">
              <div className="font-extrabold">
                {label(
                  "messageVisibleFor24Hours",
                  "This message will be visible on every user dashboard for 24 hours.",
                )}
              </div>
              <div className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-200">
                {label(
                  "usersCanDismissMessage",
                  "If a user closes it, it will stay hidden for that user after reload.",
                )}
              </div>
            </div>

            <label className="block text-sm font-bold text-gray-800 dark:text-slate-100">
              {label("messageToUsers", "Message to users")}
            </label>

            <textarea
              value={dashboardMessageText}
              onChange={(e) => setDashboardMessageText(e.target.value)}
              rows={6}
              maxLength={600}
              placeholder={label(
                "dashboardMessagePlaceholder",
                "Write the announcement or instruction users should see...",
              )}
              className="w-full px-4 py-3 text-sm font-semibold text-gray-900 transition bg-white border outline-none resize-none dark:text-white dark:bg-slate-900 rounded-2xl border-amber-200 dark:border-amber-800/60 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            />

            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-800 dark:text-slate-100">
                {label("dashboardMessageImages", "Optional images")}
              </label>

              <input
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleDashboardImageChange}
                className="w-full px-4 py-3 text-sm font-semibold text-gray-900 bg-white border rounded-2xl border-amber-200 file:mr-4 file:rounded-xl file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-bold file:text-amber-800 hover:file:bg-amber-200 dark:border-amber-800/60 dark:bg-slate-900 dark:text-white"
              />

              <div className="text-xs font-bold text-gray-500 dark:text-slate-400">
                {label(
                  "dashboardMessageImageHelp",
                  "You can upload up to 3 JPG, PNG, or WebP images. Images are compressed before upload.",
                )}
              </div>

              {!!dashboardImagePreviews.length && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {dashboardImagePreviews.map((preview, index) => (
                    <div
                      key={preview}
                      className="overflow-hidden bg-white border border-amber-100 rounded-2xl dark:bg-slate-900 dark:border-amber-800/60"
                    >
                      <img
                        src={preview}
                        alt={`${label("dashboardMessageImagePreview", "Message image preview")} ${index + 1}`}
                        className="object-cover w-full h-40 bg-slate-50 dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => removeDashboardImage(index)}
                        className="w-full px-4 py-2 text-xs font-black text-red-700 transition bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-200"
                      >
                        {label("removeImage", "Remove image")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-slate-400">
              <span>
                {label("messageCharacterLimit", "Maximum 600 characters")}
              </span>
              <span>{dashboardMessageText.length}/600</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowMessageModal(false);
                  resetDashboardMessageImages();
                  setDashboardMessageImageFile(null);
                  setDashboardMessageImagePreview("");
                }}
                className="px-4 py-3 font-semibold text-gray-700 transition border border-gray-200 dark:text-slate-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                {label("cancel", "Cancel")}
              </button>

              <button
                type="button"
                onClick={sendDashboardMessage}
                disabled={loadingType === "message"}
                className="px-4 py-3 font-extrabold text-white transition shadow-lg rounded-xl bg-gradient-to-r from-amber-50 dark:from-amber-950/400 to-orange-600 shadow-orange-900/20 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
              >
                {loadingType === "message"
                  ? label("sending", "Sending...")
                  : label("sendMessage", "Send Message")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showManualCloseModal && (
        <Modal
          onClose={() => setShowManualCloseModal(false)}
          title={label(
            "manualCloseNumbersForClient",
            "Close Numbers for Client",
          )}
          wide
          scrollable
        >
          <div className="space-y-6">
            <section className="p-4 border border-purple-100 rounded-2xl bg-purple-50 dark:border-purple-800/60 dark:bg-purple-950/30">
              <div className="mb-4">
                <h3 className="text-base font-black text-purple-900 dark:text-purple-100">
                  {label("closeNumbersForClient", "Close number(s)")}
                </h3>
                <p className="mt-1 text-xs font-semibold text-purple-700 dark:text-purple-200">
                  {label(
                    "manualCloseHelp",
                    "Use this for clients who cannot register. The entry is saved as pending and uses the existing number logic.",
                  )}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-800 dark:text-slate-100">
                    {label("clientName", "Client Name")} *
                  </label>
                  <input
                    type="text"
                    value={manualClientName}
                    onChange={(event) =>
                      setManualClientName(event.target.value)
                    }
                    placeholder={label("clientNamePlaceholder", "Example: XYZ")}
                    className="w-full px-4 py-3 text-sm font-semibold text-gray-900 bg-white border border-purple-200 outline-none rounded-xl focus:ring-2 focus:ring-purple-500 dark:border-purple-800/60 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-800 dark:text-slate-100">
                    {label("phoneOptional", "Phone Number (optional)")}
                  </label>
                  <input
                    type="tel"
                    value={manualClientPhone}
                    onChange={(event) =>
                      setManualClientPhone(event.target.value)
                    }
                    placeholder="09111"
                    className="w-full px-4 py-3 text-sm font-semibold text-gray-900 bg-white border border-purple-200 outline-none rounded-xl focus:ring-2 focus:ring-purple-500 dark:border-purple-800/60 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-black uppercase tracking-wide text-purple-700 dark:text-purple-200">
                  <span>{label("number", "Number")}</span>
                  <span>{label("amount", "Amount")}</span>
                  <span className="sr-only">{label("remove", "Remove")}</span>
                </div>

                {manualCloseLines.map((line, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2"
                  >
                    <input
                      type="number"
                      min={1}
                      value={line.number}
                      onChange={(event) =>
                        updateManualCloseLine(
                          index,
                          "number",
                          event.target.value,
                        )
                      }
                      placeholder="25"
                      className="w-full px-3 py-2 text-sm font-bold text-gray-900 bg-white border border-purple-200 outline-none rounded-xl focus:ring-2 focus:ring-purple-500 dark:border-purple-800/60 dark:bg-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      min={1}
                      value={line.amount}
                      onChange={(event) =>
                        updateManualCloseLine(
                          index,
                          "amount",
                          event.target.value,
                        )
                      }
                      placeholder="5000"
                      className="w-full px-3 py-2 text-sm font-bold text-gray-900 bg-white border border-purple-200 outline-none rounded-xl focus:ring-2 focus:ring-purple-500 dark:border-purple-800/60 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeManualCloseLine(index)}
                      className="px-3 py-2 text-sm font-black text-red-700 transition bg-white border border-red-200 rounded-xl hover:bg-red-50 dark:border-red-800/60 dark:bg-slate-900 dark:text-red-200"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addManualCloseLine}
                  className="px-4 py-2 text-sm font-black text-purple-700 transition bg-white border border-purple-200 rounded-xl hover:bg-purple-100 dark:border-purple-800/60 dark:bg-slate-900 dark:text-purple-200"
                >
                  + {label("addNumber", "Add Number")}
                </button>
              </div>

              <div className="flex flex-col gap-3 p-3 mt-4 text-sm font-bold text-purple-900 bg-white rounded-xl dark:bg-slate-900/70 dark:text-purple-100 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {label("totalAmount", "Total Amount")}:{" "}
                  {getManualTotalAmount().toLocaleString()}{" "}
                  {label("birr", "Birr")}
                </span>
                <button
                  type="button"
                  onClick={submitManualCloseNumbers}
                  disabled={manualCloseSubmitting}
                  className="px-5 py-3 text-sm font-black text-white transition bg-purple-600 shadow-sm rounded-xl hover:bg-purple-700 disabled:opacity-50"
                >
                  {manualCloseSubmitting
                    ? label("saving", "Saving...")
                    : label(
                        "saveAsPendingAndCloseNumbers",
                        "Save as Pending & Close Numbers",
                      )}
                </button>
              </div>
            </section>

            <section className="p-4 bg-white border border-gray-200 rounded-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    {label("manuallyClosedNumbers", "Manually Closed Numbers")}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
                    {label(
                      "manualEntriesExistingSchema",
                      "Saved using pending submissions with no user account and no receipt.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadManualEntries(false)}
                  disabled={manualEntriesLoading}
                  className="px-4 py-2 text-xs font-black text-gray-700 transition border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {manualEntriesLoading
                    ? label("loading", "Loading...")
                    : label("refresh", "Refresh")}
                </button>
              </div>

              <div className="overflow-hidden border border-gray-200 rounded-xl dark:border-slate-700">
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="sticky top-0 z-10 text-xs font-black tracking-wide text-gray-500 uppercase bg-gray-50 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="p-3 text-left">
                          {label("client", "Client")}
                        </th>
                        <th className="p-3 text-left">
                          {label("phone", "Phone")}
                        </th>
                        <th className="p-3 text-left">
                          {label("numbers", "Numbers")}
                        </th>
                        <th className="p-3 text-left">
                          {label("amount", "Amount")}
                        </th>
                        <th className="p-3 text-left">
                          {label("status", "Status")}
                        </th>
                        <th className="p-3 text-left">
                          {label("submittedAt", "Submitted At")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {manualEntriesLoading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-6 font-bold text-center text-gray-500 dark:text-slate-400"
                          >
                            {label("loading", "Loading...")}
                          </td>
                        </tr>
                      ) : manualEntries.length ? (
                        manualEntries.map((entry) => (
                          <tr
                            key={
                              entry.id ||
                              `${entry.user_name}-${entry.created_at}`
                            }
                            role="button"
                            tabIndex={0}
                            onClick={() => openManualEntryDetails(entry)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openManualEntryDetails(entry);
                              }
                            }}
                            className="align-top transition cursor-pointer hover:bg-purple-50 dark:hover:bg-slate-800/80"
                            title={label(
                              "clickRowForDetails",
                              "Click to view and edit details",
                            )}
                          >
                            <td className="p-3 font-bold text-gray-900 dark:text-white">
                              {entry.user_name || "-"}
                            </td>
                            <td className="p-3 font-semibold text-gray-700 dark:text-slate-200">
                              {entry.user_phone || entry.contact_phone || "-"}
                            </td>
                            <td className="p-3 font-black text-purple-700 dark:text-purple-200">
                              {getManualEntryNumbers(entry)}
                            </td>
                            <td className="p-3">
                              <div className="font-black text-gray-900 dark:text-white">
                                {Number(
                                  entry.total_amount || 0,
                                ).toLocaleString()}{" "}
                                {label("birr", "Birr")}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
                                {getManualEntryAmountBreakdown(entry)}
                              </div>
                              {getRejectedManualEntryItems(entry).length >
                                0 && (
                                <div className="mt-1 text-xs font-black text-red-600 dark:text-red-300">
                                  {label("rejectedNumbers", "Rejected numbers")}
                                  :{" "}
                                  {getRejectedManualEntryItems(entry)
                                    .map(
                                      (item) =>
                                        `${item.number}: ${Number(item.amount || 0).toLocaleString()}`,
                                    )
                                    .join(" • ")}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getManualEntryStatusBadgeClass(entry)}`}
                              >
                                {getManualEntryStatusLabel(entry)}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-gray-600 dark:text-slate-300">
                              {formatDate(entry.created_at)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-6 font-bold text-center text-gray-500 dark:text-slate-400"
                          >
                            {label(
                              "noManualEntries",
                              "No manually closed numbers yet.",
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </Modal>
      )}

      {selectedManualEntry && (
        <Modal
          onClose={closeManualEntryDetails}
          title={label("manualEntryDetails", "Manual Entry Details")}
          wide
          scrollable
        >
          <div className="space-y-5">
            <section className="p-4 border border-purple-100 rounded-2xl bg-purple-50 dark:border-purple-800/60 dark:bg-purple-950/30">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-800 dark:text-slate-100">
                    {label("clientName", "Client Name")} *
                  </label>
                  <input
                    type="text"
                    value={manualEntryEditName}
                    onChange={(event) =>
                      setManualEntryEditName(event.target.value)
                    }
                    className="w-full px-4 py-3 text-sm font-semibold text-gray-900 bg-white border border-purple-200 outline-none rounded-xl focus:ring-2 focus:ring-purple-500 dark:border-purple-800/60 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-800 dark:text-slate-100">
                    {label("phoneOptional", "Phone Number (optional)")}
                  </label>
                  <input
                    type="tel"
                    value={manualEntryEditPhone}
                    onChange={(event) =>
                      setManualEntryEditPhone(event.target.value)
                    }
                    className="w-full px-4 py-3 text-sm font-semibold text-gray-900 bg-white border border-purple-200 outline-none rounded-xl focus:ring-2 focus:ring-purple-500 dark:border-purple-800/60 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-800 dark:text-slate-100">
                    {label("status", "Status")}
                  </label>
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm font-black ${getManualEntryStatusBadgeClass(selectedManualEntry)}`}
                  >
                    {getManualEntryStatusLabel(selectedManualEntry)}
                  </div>
                </div>
              </div>
            </section>

            <section className="p-4 bg-white border border-gray-200 rounded-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    {label("selectedNumbers", "Selected Numbers")}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
                    {label(
                      "manualEntryEditHelp",
                      "Edit an amount only if the extra amount is available, add another available number, or remove a number from this entry.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addManualEntryEditLine}
                  disabled={manualEntryEditSaving}
                  className="px-4 py-2 text-xs font-black text-purple-700 transition bg-white border border-purple-200 rounded-xl hover:bg-purple-50 disabled:opacity-50 dark:border-purple-800/60 dark:bg-slate-900 dark:text-purple-200 dark:hover:bg-purple-950/40"
                >
                  + {label("addNumber", "Add Number")}
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-slate-300">
                  <span>{label("number", "Number")}</span>
                  <span>{label("amount", "Amount")}</span>
                  <span className="sr-only">{label("remove", "Remove")}</span>
                </div>

                {manualEntryEditLines.length ? (
                  manualEntryEditLines.map((line, index) => (
                    <div
                      key={`${line.number}-${index}`}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2"
                    >
                      <input
                        type="number"
                        min={1}
                        value={line.number}
                        onChange={(event) =>
                          updateManualEntryEditLine(
                            index,
                            "number",
                            event.target.value,
                          )
                        }
                        className="w-full px-3 py-2 text-sm font-bold text-gray-900 bg-white border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <input
                        type="number"
                        min={1}
                        value={line.amount}
                        onChange={(event) =>
                          updateManualEntryEditLine(
                            index,
                            "amount",
                            event.target.value,
                          )
                        }
                        className="w-full px-3 py-2 text-sm font-bold text-gray-900 bg-white border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeManualEntryEditLine(index)}
                        className="px-3 py-2 text-sm font-black text-red-700 transition bg-white border border-red-200 rounded-xl hover:bg-red-50 dark:border-red-800/60 dark:bg-slate-900 dark:text-red-200"
                      >
                        {label("remove", "Remove")}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-sm font-bold text-center text-gray-500 border border-gray-300 border-dashed rounded-xl dark:border-slate-700 dark:text-slate-400">
                    {label(
                      "noNumbersLeft",
                      "No numbers left. Saving will remove this manual entry.",
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 p-3 mt-4 text-sm font-bold text-gray-900 rounded-xl bg-gray-50 dark:bg-slate-800/70 dark:text-white sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {label("totalAmount", "Total Amount")}:{" "}
                  {getManualEntryEditTotalAmount().toLocaleString()}{" "}
                  {label("birr", "Birr")}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={closeManualEntryDetails}
                    disabled={manualEntryEditSaving}
                    className="px-5 py-3 text-sm font-black text-gray-700 transition bg-white border border-gray-200 rounded-xl hover:bg-gray-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {label("cancel", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={saveManualEntryDetails}
                    disabled={manualEntryEditSaving}
                    className="px-5 py-3 text-sm font-black text-white transition bg-purple-600 shadow-sm rounded-xl hover:bg-purple-700 disabled:opacity-50"
                  >
                    {manualEntryEditSaving
                      ? label("saving", "Saving...")
                      : label("saveChanges", "Save Changes")}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </Modal>
      )}

      {showApprovedUsers && (
        <Modal
          onClose={() => setShowApprovedUsers(false)}
          title={label("approvedUsersNumbers", "Approved Users Numbers")}
          wide
        >
          <div className="mb-4 grid gap-3 rounded-xl bg-green-50 dark:bg-emerald-950/30 p-3 text-sm font-semibold text-green-800 dark:text-emerald-100 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <div className="mb-1">
                {label("approvedOnly", "Approved only")}
              </div>
              <label className="block mb-1 text-xs font-bold text-green-900 dark:text-emerald-100">
                {label("filterByNumber", "Filter by Number")}
              </label>
              <input
                type="number"
                min={1}
                value={approvedNumberFilter}
                onChange={(e) => setApprovedNumberFilter(e.target.value)}
                placeholder={label("showAllNumbers", "Show all numbers")}
                className="w-full px-4 py-2 text-sm font-semibold text-gray-900 bg-white border border-green-200 outline-none dark:text-white dark:bg-slate-900 dark:border-emerald-800/60 rounded-xl focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setApprovedNumberFilter("");
                setApprovedUsersPage(1);
              }}
              className="px-4 py-2 text-sm font-bold text-green-700 bg-white border border-green-200 dark:text-emerald-200 dark:bg-slate-900 dark:border-emerald-800/60 rounded-xl hover:bg-green-100 dark:bg-emerald-50 dark:bg-emerald-950/300/20"
            >
              {label("clearFilter", "Clear Filter")}
            </button>
          </div>

          <div className="mb-3 text-sm font-semibold text-gray-600 dark:text-slate-300">
            {label("matchingUsers", "Matching Users")}: {approvedUsersTotal}
          </div>

          <div className="max-h-[65vh] overflow-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 z-10 border-b bg-gray-50">
                <tr>
                  <th className="p-3 text-left">{label("user", "User")}</th>
                  <th className="p-3 text-left">{label("phone", "Phone")}</th>
                  <th className="p-3 text-left">
                    {label("selectedNumbers", "Selected Numbers")}
                  </th>
                  <th className="p-3 text-right">
                    {approvedNumberFilter.trim()
                      ? label(
                          "paidForFilteredNumber",
                          "Paid for filtered number",
                        )
                      : label("totalApprovedAmount", "Total Approved Amount")}
                  </th>
                  <th className="p-3 text-center">
                    {label("submissionCount", "Submissions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovedUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-gray-500 dark:text-slate-400"
                    >
                      {label("noData", "No data found")}
                    </td>
                  </tr>
                ) : (
                  filteredApprovedUsers.map((user, index) => (
                    <tr
                      key={`${user.user_phone || user.user_name || index}`}
                      className="border-b hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <td className="p-3 font-semibold text-gray-900 dark:text-white">
                        {user.user_name || "-"}
                      </td>
                      <td className="p-3 text-gray-700 dark:text-slate-200">
                        {user.user_phone || "-"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(user.numbers || []).map((num, i) => (
                            <span
                              key={`${num}-${i}`}
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                approvedNumberFilter.trim() &&
                                String(num) === approvedNumberFilter.trim()
                                  ? "bg-blue-600 text-white"
                                  : "bg-green-100 dark:bg-emerald-50 dark:bg-emerald-950/300/20 text-green-700 dark:text-emerald-200"
                              }`}
                            >
                              {num}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-right">
                        {Number(
                          getApprovedFilteredAmount(user) || 0,
                        ).toLocaleString()}{" "}
                        {label("birr", "Birr")}
                      </td>
                      <td className="p-3 text-center">
                        {Number(user.submission_count || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 p-3 mt-4 text-sm font-semibold text-gray-700 dark:text-slate-200 rounded-xl bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {label("page", "Page")} {approvedUsersPage} {label("of", "of")}{" "}
              {approvedUsersTotalPages}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  loadApprovedUsers(
                    Math.max(approvedUsersPage - 1, 1),
                    approvedNumberFilter,
                    false,
                  )
                }
                disabled={
                  loadingType === "approvedUsers" || approvedUsersPage <= 1
                }
                className="px-4 py-2 font-bold text-gray-700 transition bg-white border border-gray-200 dark:text-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-xl hover:bg-gray-100 disabled:opacity-50"
              >
                {label("previous", "Previous")}
              </button>

              <button
                type="button"
                onClick={() =>
                  loadApprovedUsers(
                    Math.min(approvedUsersPage + 1, approvedUsersTotalPages),
                    approvedNumberFilter,
                    false,
                  )
                }
                disabled={
                  loadingType === "approvedUsers" ||
                  approvedUsersPage >= approvedUsersTotalPages
                }
                className="px-4 py-2 font-bold text-gray-700 transition bg-white border border-gray-200 dark:text-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-xl hover:bg-gray-100 disabled:opacity-50"
              >
                {label("next", "Next")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showManage && (
        <Modal
          onClose={() => setShowManage(false)}
          title={label("manageNumbers", "Manage Numbers")}
          wide
        >
          <div className="p-4 mb-4 border border-blue-100 dark:border-blue-800/60 rounded-2xl bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <label className="block mb-1 text-sm font-bold text-gray-900 dark:text-white">
                  {label("globalTargetAmount", "Global Target Amount")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={globalTargetInput}
                  onChange={(e) => setGlobalTargetInput(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-semibold text-gray-900 bg-white border border-blue-200 outline-none dark:text-white dark:bg-slate-900 dark:border-blue-800/60 rounded-xl focus:ring-2 focus:ring-blue-500 dark:border-slate-700"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowGlobalTargetConfirm(true)}
                disabled={loadingType !== null}
                className="px-5 py-3 text-sm font-bold text-white bg-green-600 shadow-sm rounded-xl hover:bg-green-700 disabled:opacity-50"
              >
                {label("applyToAll", "Apply to All")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4">
            <SummaryCard
              label={label("totalSubmissions", "Total")}
              value={numbers.length}
            />
            <SummaryCard
              label={label("available", "Available")}
              value={numbers.filter((n) => !isClosed(n)).length}
            />
            <SummaryCard
              label={label("taken", "Taken")}
              value={numbers.filter((n) => isClosed(n)).length}
            />
            <SummaryCard
              label={label("poolSummary", "Pool Summary")}
              value={numbers
                .reduce((sum, n) => sum + getCurrent(n), 0)
                .toLocaleString()}
            />
          </div>

          <div className="overflow-hidden border rounded-xl">
            <div className="max-h-[58vh] overflow-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="sticky top-0 z-10 border-b bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">
                      {label("number", "Number")}
                    </th>
                    <th className="p-3 text-right">
                      {label("targetAmount", "Target")}
                    </th>
                    <th className="p-3 text-right">
                      {label("currentAmount", "Current")}
                    </th>
                    <th className="p-3 text-right">
                      {label("remainingAmount", "Remaining")}
                    </th>
                    <th className="p-3 text-center">
                      {label("totalSubmissions", "Submissions")}
                    </th>
                    <th className="p-3 text-center">
                      {label("approvedContributions", "Approved")}
                    </th>
                    <th className="p-3 text-center">
                      {label("status", "Status")}
                    </th>
                    <th className="p-3 text-right">
                      {label("actions", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {numbers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-gray-500 dark:text-slate-400"
                      >
                        {label("noData", "No data found")}
                      </td>
                    </tr>
                  ) : (
                    numbers.map((n) => {
                      const target = getTarget(n);
                      const current = getCurrent(n);
                      const remaining = getRemaining(n);
                      const closed = isClosed(n);
                      const percent =
                        target > 0
                          ? Math.min(Math.round((current / target) * 100), 100)
                          : 0;

                      return (
                        <tr
                          key={n.number}
                          className="border-b hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <td className="p-3 font-bold">{n.number}</td>
                          <td className="p-3 text-right">
                            {target.toLocaleString()}
                          </td>
                          <td className="p-3 text-right">
                            <div className="font-semibold">
                              {current.toLocaleString()}
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                              <div
                                className="h-1.5 rounded-full bg-blue-600"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            {remaining.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            {Number(
                              n.submission_count ?? n.total_submissions ?? 0,
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {Number(n.approved_count || 0)}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                                closed
                                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-200"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                              }`}
                            >
                              {closed
                                ? label("closed", "Closed")
                                : label("available", "Available")}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => viewNumber(n)}
                                className="inline-flex items-center justify-center rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:border-blue-700 hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
                              >
                                {label("view", "View")}
                              </button>

                              {!closed ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditTarget(n)}
                                    className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                                  >
                                    {label("editTarget", "Edit Target")}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNumber(n);
                                      setShowCloseConfirm(true);
                                    }}
                                    disabled={loadingType === "close"}
                                    className="inline-flex items-center justify-center rounded-lg border border-rose-600 bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:border-rose-700 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500 dark:bg-rose-600 dark:hover:border-rose-400 dark:hover:bg-rose-500"
                                  >
                                    {loadingType === "close"
                                      ? label("closing", "Closing...")
                                      : label("closeNumber", "Close")}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => uncloseNumber(n)}
                                  disabled={loadingType === "unclose"}
                                  className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/60"
                                >
                                  {loadingType === "unclose"
                                    ? label("reopening", "Reopening...")
                                    : label("uncloseNumber", "Unclose")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {showSelections && (
        <Modal
          onClose={() => setShowSelections(false)}
          title={label("viewSelections", "View Selections")}
          wide
        >
          {loadingType === "selections" ? (
            <div className="p-8 text-sm font-semibold text-center text-gray-500 dark:text-slate-400">
              {label("loading", "Loading...")}
            </div>
          ) : (
            <SelectionsTable
              rows={selections}
              label={label}
              formatDate={formatDate}
              onViewReceipt={setSelectionReceiptImage}
            />
          )}
        </Modal>
      )}

      {showNumberSubmissions && (
        <Modal
          onClose={() => setShowNumberSubmissions(false)}
          title={`${label("number", "Number")} ${selectedNumber?.number || ""} - ${label("submissions", "Submissions")}`}
          wide
        >
          {loadingType === "view" ? (
            <div className="p-8 text-sm font-semibold text-center text-gray-500 dark:text-slate-400">
              {label("loading", "Loading...")}
            </div>
          ) : (
            <SelectionsTable
              rows={numberSubmissions}
              label={label}
              formatDate={formatDate}
              onViewReceipt={setSelectionReceiptImage}
            />
          )}
        </Modal>
      )}

      {showGlobalTargetConfirm && (
        <Modal
          onClose={() => setShowGlobalTargetConfirm(false)}
          title={label(
            "confirmGlobalTargetTitle",
            "Apply target to all numbers?",
          )}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-300">
              {label(
                "confirmGlobalTargetMessage",
                "This will update the target amount for all numbers in the current grid.",
              )}
            </p>

            <div className="p-4 text-center text-blue-900 dark:text-blue-100 rounded-xl bg-blue-50 dark:bg-blue-950/30">
              <div className="text-sm font-semibold">
                {label("globalTargetAmount", "Global Target Amount")}
              </div>
              <div className="mt-1 text-2xl font-extrabold">
                {Number(globalTargetInput || 0).toLocaleString()}{" "}
                {label("birr", "Birr")}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowGlobalTargetConfirm(false)}
                className="px-4 py-3 font-semibold text-gray-700 border dark:text-slate-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                {label("cancel", "Cancel")}
              </button>

              <button
                type="button"
                onClick={saveGlobalTarget}
                disabled={loadingType === "target"}
                className="px-4 py-3 font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50"
              >
                {loadingType === "target"
                  ? label("loading", "Loading...")
                  : label("applyToAll", "Apply to All")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCloseConfirm && selectedNumber && (
        <Modal
          onClose={() => {
            setShowCloseConfirm(false);
            setSelectedNumber(null);
          }}
          title={`${label("closeNumber", "Close Number")} - ${label("number", "Number")} ${selectedNumber.number}`}
        >
          <div className="space-y-5">
            <div className="p-4 text-red-900 border border-red-100 rounded-2xl bg-red-50">
              <div className="text-lg font-extrabold">
                {label(
                  "confirmCloseNumberTitle",
                  "Are you sure you want to close this number?",
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-red-800">
                {label(
                  "confirmCloseNumberMessage",
                  "This number will be marked as taken/closed and users will not be able to submit payment for it.",
                )}
              </p>
            </div>

            <div className="p-4 text-center rounded-2xl bg-gray-50">
              <div className="text-sm font-semibold text-gray-500 dark:text-slate-400">
                {label("number", "Number")}
              </div>
              <div className="mt-1 text-4xl font-black text-gray-950 dark:text-white">
                {selectedNumber.number}
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-600 dark:text-slate-300">
                {label("remainingAmount", "Remaining Amount")}:{" "}
                {getRemaining(selectedNumber).toLocaleString()}{" "}
                {label("birr", "Birr")}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  setSelectedNumber(null);
                }}
                className="px-4 py-3 font-semibold text-gray-700 border dark:text-slate-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                {label("cancel", "Cancel")}
              </button>

              <button
                type="button"
                onClick={() => closeNumber(selectedNumber)}
                disabled={loadingType === "close"}
                className="px-4 py-3 font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {loadingType === "close"
                  ? label("loading", "Loading...")
                  : label("closeNumber", "Close Number")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectionReceiptImage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 dark:bg-black/80 p-4"
          onClick={() => setSelectionReceiptImage(null)}
        >
          <div
            className="relative w-full max-w-4xl p-5 bg-white shadow-2xl dark:bg-slate-900 rounded-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {label("paymentReceipt", "Payment Receipt")}
              </h2>
              <button
                type="button"
                onClick={() => setSelectionReceiptImage(null)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                {label("close", "Close")}
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto rounded-xl bg-gray-100 p-3">
              <img
                src={selectionReceiptImage}
                alt={label("paymentReceipt", "Payment Receipt")}
                className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {showEditTarget && selectedNumber && (
        <Modal
          onClose={() => setShowEditTarget(false)}
          title={`${label("editTarget", "Edit Target")} - ${label("number", "Number")} ${selectedNumber.number}`}
        >
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200">
              {label("targetAmount", "Target Amount")}
            </label>
            <input
              type="number"
              min={1}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-full px-4 py-3 border outline-none rounded-xl focus:ring-2 focus:ring-blue-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowEditTarget(false)}
                className="px-4 py-3 font-semibold text-gray-700 border dark:text-slate-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                {label("cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={saveTarget}
                disabled={loadingType === "target"}
                className="px-4 py-3 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingType === "target"
                  ? label("loading", "Loading...")
                  : label("save", "Save")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-3 text-center border rounded-xl bg-gray-50">
      <div className="text-lg font-extrabold text-gray-950 dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}

function SelectionsTable({
  rows,
  label,
  formatDate,
  onViewReceipt,
}: {
  rows: NumberSubmissionRow[];
  label: (key: string, fallback: string) => string;
  formatDate: (value?: string) => string;
  onViewReceipt: (url: string) => void;
}) {
  return (
    <div className="overflow-hidden border rounded-xl">
      <div className="max-h-[62vh] overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10 border-b bg-gray-50">
            <tr>
              <th className="p-3 text-left">{label("number", "Number")}</th>
              <th className="p-3 text-left">{label("user", "User")}</th>
              <th className="p-3 text-left">{label("phone", "Phone")}</th>
              <th className="p-3 text-right">{label("amount", "Amount")}</th>
              <th className="p-3 text-center">{label("status", "Status")}</th>
              <th className="p-3 text-left">
                {label("submitted", "Submitted")}
              </th>
              <th className="p-3 text-left">{label("receipt", "Receipt")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-gray-500 dark:text-slate-400"
                >
                  {label("noData", "No data found")}
                </td>
              </tr>
            ) : (
              rows.map((s, index) => (
                <tr
                  key={`${s.submission_id || s.id || index}-${s.number}-${index}`}
                  className="border-b hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  <td className="p-3 font-bold">{s.number || "-"}</td>
                  <td className="p-3">{s.user_name || "-"}</td>
                  <td className="p-3">{s.user_phone || "-"}</td>
                  <td className="p-3 text-right">
                    {Number(s.amount || 0).toLocaleString()}{" "}
                    {label("birr", "Birr")}
                  </td>
                  <td className="p-3 text-center">
                    {label(
                      String(s?.status || "-").toLowerCase(),
                      String(s?.status || "-"),
                    )}
                  </td>
                  <td className="p-3">{formatDate(s.submitted_at)}</td>
                  <td className="p-3">
                    {s.receipt_url ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(String(s.receipt_url))}
                        className="font-semibold text-blue-600 dark:text-blue-300 hover:underline"
                      >
                        {label("viewReceipt", "View Receipt")}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
  scrollable = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  scrollable?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 dark:bg-black/75 p-3 md:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-5xl" : "max-w-md"} ${scrollable ? "flex max-h-[88vh] flex-col overflow-hidden" : "max-h-[88vh] overflow-hidden"} rounded-2xl bg-white dark:bg-slate-900 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`${scrollable ? "shrink-0" : ""} flex items-center justify-between px-5 py-4 border-b`}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white md:text-xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-sm font-bold text-gray-700 bg-gray-200 rounded-lg dark:text-slate-200 hover:bg-gray-300"
          >
            ×
          </button>
        </div>
        <div
          className={
            scrollable
              ? "min-h-0 flex-1 overflow-y-auto p-5"
              : "p-5 overflow-auto"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
