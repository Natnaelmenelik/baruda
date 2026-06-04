// "use client";

// import { useEffect, useMemo, useState } from "react";
// import toast from "react-hot-toast";
// import { translations, Lang } from "@/lib/i18n/translations";
// import { translateApiError } from "@/lib/i18n/apiErrorMessages";

// type PoolRow = {
//   number: number;
//   target_amount: number;
//   current_amount: number;
//   remaining?: number;
//   status: string;
//   submission_count?: number;
//   approved_count?: number;
//   pending_count?: number;
// };

// type SelectionRow = {
//   number: number;
//   amount: number;
//   submission_id: string;
//   status: string;
//   total_amount: number;
//   receipt_url?: string;
//   submitted_at?: string;
//   user_name?: string;
//   user_phone?: string;
// };

// function Modal({
//   children,
//   onClose,
// }: {
//   children: React.ReactNode;
//   onClose: () => void;
// }) {
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
//       <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl dark:bg-slate-900">
//         <div className="max-h-[90vh] overflow-y-auto p-5 md:p-6">
//           <div className="flex justify-end mb-4">
//             <button
//               type="button"
//               onClick={onClose}
//               className="rounded-xl border px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
//             >
//               ✕
//             </button>
//           </div>
//           {children}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function ManageNumbersPanel({ lang }: { lang: Lang }) {
//   const txt = (translations[lang] || translations.am || translations.en) as Record<string, string>;
//   const [open, setOpen] = useState(false);
//   const [rows, setRows] = useState<PoolRow[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [selectionOpen, setSelectionOpen] = useState(false);
//   const [selectionRows, setSelectionRows] = useState<SelectionRow[]>([]);
//   const [selectionLoading, setSelectionLoading] = useState(false);
//   const [filter, setFilter] = useState("");
//   const [selectionReceiptImage, setSelectionReceiptImage] = useState<string | null>(null);

//   async function loadNumbers() {
//     try {
//       setLoading(true);
//       const res = await fetch(`/api/admin/numbers?t=${Date.now()}`, {
//         cache: "no-store",
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to load numbers");
//       setRows(Array.isArray(data) ? data : data.numbers || []);
//     } catch (e: any) {
//       toast.error(e.message || txt.noNumberData || "Failed to load numbers");
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function loadSelections(number?: number) {
//     try {
//       setSelectionOpen(true);
//       setSelectionLoading(true);
//       const url = number
//         ? `/api/admin/numbers/selections?number=${number}&t=${Date.now()}`
//         : `/api/admin/numbers/selections?t=${Date.now()}`;
//       const res = await fetch(url, { cache: "no-store" });
//       const data = await res.json();
//       if (!res.ok)
//         throw new Error(
//           data.error ||
//             txt.failedToLoadSelections ||
//             "Failed to load selections",
//         );
//       setSelectionRows(Array.isArray(data) ? data : []);
//     } catch (e: any) {
//       toast.error(
//         e.message || txt.failedToLoadSelections || "Failed to load selections",
//       );
//     } finally {
//       setSelectionLoading(false);
//     }
//   }

//   async function closeNumber(number: number) {
//     try {
//       const res = await fetch(`/api/admin/numbers/${number}/close`, {
//         method: "POST",
//       });
//       const data = await res.json().catch(() => ({}));
//       if (!res.ok) throw new Error(data.error || "Failed to close number");
//       toast.success(txt.numberClosed || "Number closed");
//       loadNumbers();
//     } catch (e: any) {
//       toast.error(e.message || "Failed to close number");
//     }
//   }

//   async function uncloseNumber(number: number) {
//     try {
//       const res = await fetch(`/api/admin/numbers/${number}/unclose`, {
//         method: "POST",
//       });
//       const data = await res.json().catch(() => ({}));
//       if (!res.ok) throw new Error(data.error || "Failed to reopen number");
//       toast.success(txt.numberUnclosed || "Number reopened");
//       loadNumbers();
//     } catch (e: any) {
//       toast.error(e.message || "Failed to reopen number");
//     }
//   }

//   async function editTarget(row: PoolRow) {
//     const next = window.prompt(
//       txt.targetAmount || "Target Amount",
//       String(row.target_amount || 0),
//     );
//     if (!next) return;
//     const amount = Number(next);
//     if (!Number.isFinite(amount) || amount <= 0) return;
//     try {
//       const res = await fetch(`/api/admin/numbers/${row.number}/target`, {
//         method: "PUT",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ target_amount: amount }),
//       });
//       const data = await res.json().catch(() => ({}));
//       if (!res.ok) throw new Error(data.error || "Failed to update target");
//       toast.success(txt.numberTargetUpdated || "Target updated");
//       loadNumbers();
//     } catch (e: any) {
//       toast.error(e.message || "Failed to update target");
//     }
//   }

//   useEffect(() => {
//     if (open) loadNumbers();
//   }, [open]);

//   const filteredRows = useMemo(() => {
//     const q = filter.trim();
//     if (!q) return rows;
//     return rows.filter((r) => String(r.number).includes(q));
//   }, [rows, filter]);

//   return (
//     <>
//       <div className="flex justify-end gap-2 mb-4">
//         <button
//           type="button"
//           onClick={() => loadSelections()}
//           className="px-4 py-2 text-sm font-semibold text-blue-700 bg-white border border-blue-200 shadow-sm rounded-xl hover:bg-blue-50 dark:text-blue-200 dark:bg-blue-950/30 dark:border-blue-800/60 dark:hover:bg-blue-950/50"
//         >
//           {txt.viewSelections || "View Selections"}
//         </button>
//         <button
//           type="button"
//           onClick={() => setOpen(true)}
//           className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 border border-blue-600 shadow-sm rounded-xl hover:bg-blue-700 dark:text-blue-100 dark:bg-blue-950/50 dark:border-blue-700/70 dark:hover:bg-blue-900/70"
//         >
//           {txt.manageNumbers || "Manage Numbers"}
//         </button>
//       </div>

//       {open && (
//         <Modal onClose={() => setOpen(false)}>
//           <div className="flex flex-col gap-3 mb-5 md:flex-row md:items-center md:justify-between">
//             <div>
//               <h2 className="text-xl font-bold text-gray-900 dark:text-white">
//                 {txt.numberManagement ||
//                   txt.manageNumbers ||
//                   "Number Management"}
//               </h2>
//               <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
//                 {txt.selectedNumbersByUsers ||
//                   "Selected numbers and pool status"}
//               </p>
//             </div>
//             <div className="flex justify-end gap-2">
//               <input
//                 value={filter}
//                 onChange={(e) => setFilter(e.target.value)}
//                 placeholder={txt.searchNumber || "Search number"}
//                 className="w-40 px-3 py-2 text-sm border outline-none rounded-xl focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
//               />
//               <button
//                 type="button"
//                 onClick={() => loadSelections()}
//                 className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 dark:text-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
//               >
//                 {txt.viewSelections || "View Selections"}
//               </button>
//             </div>
//           </div>

//           <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-xl">
//             <div className="overflow-x-auto">
//               <table className="w-full min-w-[980px] table-fixed text-sm">
//                 <thead className="text-xs text-gray-500 uppercase dark:text-slate-400 bg-gray-50 dark:bg-slate-800 dark:text-slate-300">
//                   <tr>
//                     <th className="w-24 px-4 py-3 text-left">
//                       {txt.number || "Number"}
//                     </th>
//                     <th className="px-4 py-3 text-right w-36">
//                       {txt.targetAmount || "Target"}
//                     </th>
//                     <th className="px-4 py-3 text-right w-36">
//                       {txt.currentAmount || "Current"}
//                     </th>
//                     <th className="px-4 py-3 text-right w-36">
//                       {txt.remainingAmount || "Remaining"}
//                     </th>
//                     <th className="px-4 py-3 text-center w-28">
//                       {txt.status || "Status"}
//                     </th>
//                     <th className="w-32 px-4 py-3 text-center">
//                       {txt.submissionsCount || "Submissions"}
//                     </th>
//                     <th className="px-4 py-3 text-right w-72">
//                       {txt.actions || "Actions"}
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
//                   {loading ? (
//                     <tr>
//                       <td
//                         colSpan={7}
//                         className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
//                       >
//                         {txt.loading || "Loading..."}
//                       </td>
//                     </tr>
//                   ) : filteredRows.length === 0 ? (
//                     <tr>
//                       <td
//                         colSpan={7}
//                         className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
//                       >
//                         {txt.noNumberData || "No number data available"}
//                       </td>
//                     </tr>
//                   ) : (
//                     filteredRows.map((row) => {
//                       const remaining =
//                         row.remaining ??
//                         Math.max(
//                           0,
//                           Number(row.target_amount || 0) -
//                             Number(row.current_amount || 0),
//                         );
//                       const closed = row.status === "closed" || remaining <= 0;
//                       return (
//                         <tr
//                           key={row.number}
//                           className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 dark:hover:bg-slate-800/70"
//                         >
//                           <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
//                             {row.number}
//                           </td>
//                           <td className="px-4 py-3 text-right tabular-nums">
//                             {Number(row.target_amount || 0).toLocaleString()}{" "}
//                             {txt.birr || "Birr"}
//                           </td>
//                           <td className="px-4 py-3 text-right tabular-nums">
//                             {Number(row.current_amount || 0).toLocaleString()}{" "}
//                             {txt.birr || "Birr"}
//                           </td>
//                           <td className="px-4 py-3 font-semibold text-right tabular-nums">
//                             {remaining.toLocaleString()} {txt.birr || "Birr"}
//                           </td>
//                           <td className="px-4 py-3 text-center">
//                             <span
//                               className={`rounded-full px-3 py-1 text-xs font-semibold ${closed ? "bg-green-100 dark:bg-emerald-50 dark:bg-emerald-950/300/20 text-green-700 dark:text-emerald-200" : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 ring-1 ring-gray-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"}`}
//                             >
//                               {closed
//                                 ? txt.taken || txt.closed || "Taken"
//                                 : txt.available || txt.open || "Available"}
//                             </span>
//                           </td>
//                           <td className="px-4 py-3 text-center tabular-nums">
//                             {Number(row.submission_count || 0)}
//                           </td>
//                           <td className="px-4 py-3">
//                             <div className="flex justify-end gap-2">
//                               <button
//                                 onClick={() => loadSelections(row.number)}
//                                 className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
//                               >
//                                 {txt.viewDetails || "View Details"}
//                               </button>
//                               {!closed ? (
//                                 <>
//                                   <button
//                                     onClick={() => editTarget(row)}
//                                     className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
//                                   >
//                                     {txt.editTarget || "Edit Target"}
//                                   </button>
//                                   <button
//                                     onClick={() => closeNumber(row.number)}
//                                     className="inline-flex items-center justify-center rounded-lg border border-rose-600 bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:border-rose-700 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500 dark:bg-rose-600 dark:hover:border-rose-400 dark:hover:bg-rose-500"
//                                   >
//                                     {txt.closeNumber || "Close"}
//                                   </button>
//                                 </>
//                               ) : (
//                                 <button
//                                   onClick={() => uncloseNumber(row.number)}
//                                   className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:border-amber-600 dark:hover:bg-amber-900/60"
//                                 >
//                                   {txt.uncloseNumber || "Unclose"}
//                                 </button>
//                               )}
//                             </div>
//                           </td>
//                         </tr>
//                       );
//                     })
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </Modal>
//       )}

//       {selectionOpen && (
//         <Modal onClose={() => setSelectionOpen(false)}>
//           <div className="flex items-center justify-between gap-3 mb-5">
//             <div>
//               <h2 className="text-xl font-bold text-gray-900 dark:text-white">
//                 {txt.selectedNumbersByUsers || "Selected Numbers by Users"}
//               </h2>
//               <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
//                 {txt.numberSelections || "Number selections"}
//               </p>
//             </div>
//           </div>

//           <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-xl">
//             <div className="overflow-x-auto">
//               <table className="w-full min-w-[850px] table-fixed text-sm">
//                 <thead className="text-xs text-gray-500 uppercase dark:text-slate-400 bg-gray-50 dark:bg-slate-800 dark:text-slate-300">
//                   <tr>
//                     <th className="w-24 px-4 py-3 text-left">
//                       {txt.number || "Number"}
//                     </th>
//                     <th className="w-48 px-4 py-3 text-left">
//                       {txt.user || txt.contributor || "User"}
//                     </th>
//                     <th className="w-40 px-4 py-3 text-left">
//                       {txt.phone || "Phone"}
//                     </th>
//                     <th className="px-4 py-3 text-right w-36">
//                       {txt.contributionAmount || "Amount"}
//                     </th>
//                     <th className="w-32 px-4 py-3 text-center">
//                       {txt.submissionStatus || txt.status || "Status"}
//                     </th>
//                     <th className="px-4 py-3 text-left w-44">
//                       {txt.submittedAt || "Submitted At"}
//                     </th>
//                     <th className="px-4 py-3 text-right w-28">
//                       {txt.receipt || "Receipt"}
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
//                   {selectionLoading ? (
//                     <tr>
//                       <td
//                         colSpan={7}
//                         className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
//                       >
//                         {txt.loadingSelections || txt.loading || "Loading..."}
//                       </td>
//                     </tr>
//                   ) : selectionRows.length === 0 ? (
//                     <tr>
//                       <td
//                         colSpan={7}
//                         className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
//                       >
//                         {txt.noSelectionsYet || "No selections yet"}
//                       </td>
//                     </tr>
//                   ) : (
//                     selectionRows.map((row, idx) => (
//                       <tr
//                         key={`${row.submission_id}-${row.number}-${idx}`}
//                         className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 dark:hover:bg-slate-800/70"
//                       >
//                         <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
//                           {row.number}
//                         </td>
//                         <td className="px-4 py-3 truncate">
//                           {row.user_name || "-"}
//                         </td>
//                         <td className="px-4 py-3 truncate">
//                           {row.user_phone || "-"}
//                         </td>
//                         <td className="px-4 py-3 font-semibold text-right tabular-nums">
//                           {Number(row.amount || 0).toLocaleString()}{" "}
//                           {txt.birr || "Birr"}
//                         </td>
//                         <td className="px-4 py-3 text-center">
//                           <span
//                             className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === "approved" ? "bg-green-100 dark:bg-emerald-50 dark:bg-emerald-950/300/20 text-green-700 dark:text-emerald-200" : row.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
//                           >
//                             {row.status === "approved"
//                               ? txt.approved || "Approved"
//                               : row.status === "pending"
//                                 ? txt.pending || "Pending"
//                                 : txt.rejected || "Rejected"}
//                           </span>
//                         </td>
//                         <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
//                           {row.submitted_at
//                             ? new Date(row.submitted_at).toLocaleString()
//                             : "-"}
//                         </td>
//                         <td className="px-4 py-3 text-right">
//                           {row.receipt_url ? (
//                             <button
//                               type="button"
//                               onClick={() => setSelectionReceiptImage(String(row.receipt_url))}
//                               className="text-sm font-semibold text-blue-600 dark:text-blue-300 hover:underline"
//                             >
//                               {txt.view || txt.receipt || "View"}
//                             </button>
//                           ) : (
//                             <span className="text-gray-400">-</span>
//                           )}
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </Modal>
//       )}

//       {selectionReceiptImage && (
//         <div
//           className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 dark:bg-black/80 p-4"
//           onClick={() => setSelectionReceiptImage(null)}
//         >
//           <div
//             className="relative w-full max-w-4xl p-5 bg-white shadow-2xl rounded-2xl dark:bg-slate-900"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
//               <h2 className="text-xl font-bold text-gray-900 dark:text-white">
//                 {txt.paymentReceipt || txt.receipt || "Payment Receipt"}
//               </h2>
//               <button
//                 type="button"
//                 onClick={() => setSelectionReceiptImage(null)}
//                 className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
//               >
//                 {txt.close || "Close"}
//               </button>
//             </div>

//             <div className="max-h-[75vh] overflow-auto rounded-xl bg-gray-100 p-3 dark:bg-slate-800">
//               <img
//                 src={selectionReceiptImage}
//                 alt={txt.paymentReceipt || txt.receipt || "Payment Receipt"}
//                 className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
//               />
//             </div>
//           </div>
//         </div>
//       )}

//     </>
//   );
// }
"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { translations, Lang } from "@/lib/i18n/translations";
import { translateApiError } from "@/lib/i18n/apiErrorMessages";

type PoolRow = {
  number: number;
  target_amount: number;
  current_amount: number;
  remaining?: number;
  status: string;
  submission_count?: number;
  approved_count?: number;
  pending_count?: number;
};

type SelectionRow = {
  number: number;
  amount: number;
  submission_id: string;
  status: string;
  total_amount: number;
  receipt_url?: string;
  submitted_at?: string;
  user_name?: string;
  user_phone?: string;
};

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl dark:bg-slate-900">
        <div className="max-h-[90vh] overflow-y-auto p-5 md:p-6">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ManageNumbersPanel({ lang }: { lang: Lang }) {
  const txt = (translations[lang] ||
    translations.am ||
    translations.en) as Record<string, string>;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectionRows, setSelectionRows] = useState<SelectionRow[]>([]);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectionReceiptImage, setSelectionReceiptImage] = useState<
    string | null
  >(null);

  async function loadNumbers() {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/numbers?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load numbers");
      setRows(Array.isArray(data) ? data : data.numbers || []);
    } catch (e: any) {
      toast.error(e.message || txt.noNumberData || "Failed to load numbers");
    } finally {
      setLoading(false);
    }
  }

  async function loadSelections(number?: number) {
    try {
      setSelectionOpen(true);
      setSelectionLoading(true);
      const url = number
        ? `/api/admin/numbers/selections?number=${number}&t=${Date.now()}`
        : `/api/admin/numbers/selections?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error ||
            txt.failedToLoadSelections ||
            "Failed to load selections",
        );
      setSelectionRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(
        e.message || txt.failedToLoadSelections || "Failed to load selections",
      );
    } finally {
      setSelectionLoading(false);
    }
  }

  async function closeNumber(number: number) {
    try {
      const res = await fetch(`/api/admin/numbers/${number}/close`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to close number");
      toast.success(txt.numberClosed || "Number closed");
      loadNumbers();
    } catch (e: any) {
      toast.error(e.message || "Failed to close number");
    }
  }

  async function uncloseNumber(number: number) {
    try {
      const res = await fetch(`/api/admin/numbers/${number}/unclose`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to reopen number");
      toast.success(txt.numberUnclosed || "Number reopened");
      loadNumbers();
    } catch (e: any) {
      toast.error(e.message || "Failed to reopen number");
    }
  }

  async function editTarget(row: PoolRow) {
    const next = window.prompt(
      txt.targetAmount || "Target Amount",
      String(row.target_amount || 0),
    );
    if (!next) return;
    const amount = Number(next);
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      const res = await fetch(`/api/admin/numbers/${row.number}/target`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_amount: amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update target");
      toast.success(txt.numberTargetUpdated || "Target updated");
      loadNumbers();
    } catch (e: any) {
      toast.error(e.message || "Failed to update target");
    }
  }

  useEffect(() => {
    if (open) loadNumbers();
  }, [open]);

  const filteredRows = useMemo(() => {
    const q = filter.trim();
    if (!q) return rows;
    return rows.filter((r) => String(r.number).includes(q));
  }, [rows, filter]);

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={() => loadSelections()}
          className="px-4 py-2 text-sm font-semibold text-blue-700 bg-white border border-blue-200 shadow-sm dark:text-blue-200 dark:bg-slate-900 dark:border-blue-800/60 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:bg-blue-950/30 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
        >
          {txt.viewSelections || "View Selections"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 shadow-sm rounded-xl hover:bg-blue-700"
        >
          {txt.manageNumbers || "Manage Numbers"}
        </button>
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 mb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {txt.numberManagement ||
                  txt.manageNumbers ||
                  "Number Management"}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                {txt.selectedNumbersByUsers ||
                  "Selected numbers and pool status"}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={txt.searchNumber || "Search number"}
                className="w-40 px-3 py-2 text-sm border outline-none rounded-xl focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="button"
                onClick={() => loadSelections()}
                className="px-4 py-2 text-sm font-semibold text-gray-700 border dark:text-slate-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 dark:border-slate-700"
              >
                {txt.viewSelections || "View Selections"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed text-sm">
                <thead className="text-xs text-gray-500 uppercase dark:text-slate-400 bg-gray-50 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="w-24 px-4 py-3 text-left">
                      {txt.number || "Number"}
                    </th>
                    <th className="px-4 py-3 text-right w-36">
                      {txt.targetAmount || "Target"}
                    </th>
                    <th className="px-4 py-3 text-right w-36">
                      {txt.currentAmount || "Current"}
                    </th>
                    <th className="px-4 py-3 text-right w-36">
                      {txt.remainingAmount || "Remaining"}
                    </th>
                    <th className="px-4 py-3 text-center w-28">
                      {txt.status || "Status"}
                    </th>
                    <th className="w-32 px-4 py-3 text-center">
                      {txt.submissionsCount || "Submissions"}
                    </th>
                    <th className="px-4 py-3 text-right w-72">
                      {txt.actions || "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
                      >
                        {txt.loading || "Loading..."}
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
                      >
                        {txt.noNumberData || "No number data available"}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const remaining =
                        row.remaining ??
                        Math.max(
                          0,
                          Number(row.target_amount || 0) -
                            Number(row.current_amount || 0),
                        );
                      const closed = row.status === "closed" || remaining <= 0;
                      return (
                        <tr
                          key={row.number}
                          className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 dark:hover:bg-slate-800/70"
                        >
                          <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                            {row.number}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {Number(row.target_amount || 0).toLocaleString()}{" "}
                            {txt.birr || "Birr"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {Number(row.current_amount || 0).toLocaleString()}{" "}
                            {txt.birr || "Birr"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-right tabular-nums">
                            {remaining.toLocaleString()} {txt.birr || "Birr"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${closed ? "bg-green-100 dark:bg-emerald-50 dark:bg-emerald-950/300/20 text-green-700 dark:text-emerald-200" : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 ring-1 ring-gray-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"}`}
                            >
                              {closed
                                ? txt.taken || txt.closed || "Taken"
                                : txt.available || txt.open || "Available"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums">
                            {Number(row.submission_count || 0)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => loadSelections(row.number)}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                {txt.viewDetails || "View Details"}
                              </button>
                              {!closed ? (
                                <>
                                  <button
                                    onClick={() => editTarget(row)}
                                    className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                                  >
                                    {txt.editTarget || "Edit Target"}
                                  </button>
                                  <button
                                    onClick={() => closeNumber(row.number)}
                                    className="inline-flex items-center justify-center rounded-lg border border-rose-600 bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:border-rose-700 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500 dark:bg-rose-600 dark:hover:border-rose-400 dark:hover:bg-rose-500"
                                  >
                                    {txt.closeNumber || "Close"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => uncloseNumber(row.number)}
                                  className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:border-amber-600 dark:hover:bg-amber-900/60"
                                >
                                  {txt.uncloseNumber || "Unclose"}
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

      {selectionOpen && (
        <Modal onClose={() => setSelectionOpen(false)}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {txt.selectedNumbersByUsers || "Selected Numbers by Users"}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                {txt.numberSelections || "Number selections"}
              </p>
            </div>
          </div>

          <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] table-fixed text-sm">
                <thead className="text-xs text-gray-500 uppercase dark:text-slate-400 bg-gray-50 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="w-24 px-4 py-3 text-left">
                      {txt.number || "Number"}
                    </th>
                    <th className="w-48 px-4 py-3 text-left">
                      {txt.user || txt.contributor || "User"}
                    </th>
                    <th className="w-40 px-4 py-3 text-left">
                      {txt.phone || "Phone"}
                    </th>
                    <th className="px-4 py-3 text-right w-36">
                      {txt.contributionAmount || "Amount"}
                    </th>
                    <th className="w-32 px-4 py-3 text-center">
                      {txt.submissionStatus || txt.status || "Status"}
                    </th>
                    <th className="px-4 py-3 text-left w-44">
                      {txt.submittedAt || "Submitted At"}
                    </th>
                    <th className="px-4 py-3 text-right w-28">
                      {txt.receipt || "Receipt"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {selectionLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
                      >
                        {txt.loadingSelections || txt.loading || "Loading..."}
                      </td>
                    </tr>
                  ) : selectionRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
                      >
                        {txt.noSelectionsYet || "No selections yet"}
                      </td>
                    </tr>
                  ) : (
                    selectionRows.map((row, idx) => (
                      <tr
                        key={`${row.submission_id}-${row.number}-${idx}`}
                        className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 dark:hover:bg-slate-800/70"
                      >
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                          {row.number}
                        </td>
                        <td className="px-4 py-3 truncate">
                          {row.user_name || "-"}
                        </td>
                        <td className="px-4 py-3 truncate">
                          {row.user_phone || "-"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-right tabular-nums">
                          {Number(row.amount || 0).toLocaleString()}{" "}
                          {txt.birr || "Birr"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === "approved" ? "bg-green-100 dark:bg-emerald-50 dark:bg-emerald-950/300/20 text-green-700 dark:text-emerald-200" : row.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                          >
                            {row.status === "approved"
                              ? txt.approved || "Approved"
                              : row.status === "pending"
                                ? txt.pending || "Pending"
                                : txt.rejected || "Rejected"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                          {row.submitted_at
                            ? new Date(row.submitted_at).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.receipt_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectionReceiptImage(
                                  String(row.receipt_url),
                                )
                              }
                              className="text-sm font-semibold text-blue-600 dark:text-blue-300 hover:underline"
                            >
                              {txt.view || txt.receipt || "View"}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
            className="relative w-full max-w-4xl p-5 bg-white shadow-2xl rounded-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {txt.paymentReceipt || txt.receipt || "Payment Receipt"}
              </h2>
              <button
                type="button"
                onClick={() => setSelectionReceiptImage(null)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                {txt.close || "Close"}
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto rounded-xl bg-gray-100 p-3 dark:bg-slate-800">
              <img
                src={selectionReceiptImage}
                alt={txt.paymentReceipt || txt.receipt || "Payment Receipt"}
                className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
