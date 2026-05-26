import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminStatsRow = {
  total_users: number;
  total_submissions: number;
  pending_submissions: number;
  approved_submissions: number;
  rejected_submissions: number;
  total_revenue: number;
  pending_amount: number;
  total_numbers: number;
  sold_numbers: number;
  open_numbers: number;
  pending_numbers: number;
  updated_at: string;
};

const toNumber = (value: unknown) => Number(value || 0);

export async function GET() {
  try {
    const [row] = await sql<AdminStatsRow[]>`
      SELECT
        (SELECT COUNT(*)::int FROM public.users) AS total_users,
        (SELECT COUNT(*)::int FROM public.submissions) AS total_submissions,
        (SELECT COUNT(*)::int FROM public.submissions WHERE status = 'pending') AS pending_submissions,
        (SELECT COUNT(*)::int FROM public.submissions WHERE status = 'approved') AS approved_submissions,
        (SELECT COUNT(*)::int FROM public.submissions WHERE status = 'rejected') AS rejected_submissions,
        COALESCE((SELECT SUM(total_amount)::int FROM public.submissions WHERE status = 'approved'), 0) AS total_revenue,
        COALESCE((SELECT SUM(total_amount)::int FROM public.submissions WHERE status = 'pending'), 0) AS pending_amount,
        (SELECT COUNT(*)::int FROM public.number_status_summary_cache) AS total_numbers,
        (SELECT COUNT(*)::int FROM public.number_status_summary_cache WHERE status = 'sold') AS sold_numbers,
        (SELECT COUNT(*)::int FROM public.number_status_summary_cache WHERE status = 'open') AS open_numbers,
        (SELECT COUNT(*)::int FROM public.number_status_summary_cache WHERE status = 'pending') AS pending_numbers,
        NOW()::text AS updated_at
    `;

    const stats = row || {
      total_users: 0,
      total_submissions: 0,
      pending_submissions: 0,
      approved_submissions: 0,
      rejected_submissions: 0,
      total_revenue: 0,
      pending_amount: 0,
      total_numbers: 0,
      sold_numbers: 0,
      open_numbers: 0,
      pending_numbers: 0,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        // Keep original snake_case response for old code compatibility.
        ...stats,

        // Add camelCase aliases expected by dashboard components.
        totalUsers: toNumber(stats.total_users),
        totalSubmissions: toNumber(stats.total_submissions),
        pendingSubmissions: toNumber(stats.pending_submissions),
        approvedSubmissions: toNumber(stats.approved_submissions),
        rejectedSubmissions: toNumber(stats.rejected_submissions),

        revenue: toNumber(stats.total_revenue),
        totalRevenue: toNumber(stats.total_revenue),
        pendingAmount: toNumber(stats.pending_amount),

        totalNumbers: toNumber(stats.total_numbers),
        numbersSold: toNumber(stats.sold_numbers),
        soldNumbers: toNumber(stats.sold_numbers),
        numbersLeft: toNumber(stats.open_numbers),
        openNumbers: toNumber(stats.open_numbers),
        pendingNumbers: toNumber(stats.pending_numbers),
        pendingApprovals: toNumber(stats.pending_submissions),

        updatedAt: stats.updated_at,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error: any) {
    console.error("Live admin stats error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load admin stats" },
      { status: 500 },
    );
  }
}
