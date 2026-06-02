export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { requireAdmin } from "@/lib/auth/server";

type RouteContext = {
  params?:
    | { id?: string }
    | Promise<{ id?: string }>;
};

type ContributionItem = {
  submissionId: number;
  number: number;
  amount: number;
};

async function getSubmissionId(req: Request, context: RouteContext) {
  const resolvedParams = await Promise.resolve(context?.params || {});
  const url = new URL(req.url);

  const paramsId = String(resolvedParams?.id || "").trim();
  const queryId = String(
    url.searchParams.get("id") || url.searchParams.get("submissionId") || "",
  ).trim();

  const pathParts = url.pathname.split("/").filter(Boolean);
  const pathId = decodeURIComponent(String(pathParts[pathParts.length - 1] || "")).trim();

  const id = paramsId || queryId || pathId;

  if (!id || id === "reject") return "";
  return id;
}

function normalizeFallbackItems(submission: any): ContributionItem[] {
  const submissionId = Number(submission?.id);
  if (!Number.isInteger(submissionId) || submissionId <= 0) return [];

  if (submission?.number_amounts && typeof submission.number_amounts === "object") {
    return Object.entries(submission.number_amounts)
      .map(([number, amount]) => ({
        submissionId,
        number: Number(number),
        amount: Number(amount),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.number) &&
          item.number > 0 &&
          Number.isFinite(item.amount) &&
          item.amount > 0,
      );
  }

  if (Array.isArray(submission?.numbers) && submission.numbers.length) {
    const numbers = submission.numbers
      .map((value: any) => Number(value))
      .filter((value: number) => Number.isInteger(value) && value > 0);

    if (!numbers.length) return [];

    const totalAmount = Number(submission.total_amount || 0);
    const perNumber =
      totalAmount > 0
        ? Math.floor(totalAmount / numbers.length)
        : Number(submission.ticket_price || 0);

    return numbers
      .map((number: number) => ({
        submissionId,
        number,
        amount: perNumber,
      }))
      .filter((item: { number: number; amount: number }) => item.amount > 0);
  }

  if (submission?.number) {
    const amount = Number(submission.total_amount || submission.ticket_price || 0);

    if (Number.isFinite(amount) && amount > 0) {
      return [
        {
          submissionId,
          number: Number(submission.number),
          amount,
        },
      ];
    }
  }

  return [];
}

function apiStatusFromError(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  if (message.toLowerCase().includes("not found")) return 404;

  if (
    message.includes("approved") ||
    message.includes("rejected") ||
    message.includes("pending") ||
    message.includes("Missing submission id") ||
    message.includes("No valid contribution")
  ) {
    return 400;
  }

  return 500;
}

export async function POST(req: Request, context: RouteContext) {
  let client: Awaited<ReturnType<typeof pool.connect>> | null = null;

  try {
    await requireAdmin(req);

    const id = await getSubmissionId(req, context);

    if (!id) {
      return NextResponse.json({ error: "Missing submission id" }, { status: 400 });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const numericId = /^\d+$/.test(id) ? Number(id) : null;

    const submissionsResult =
      numericId !== null
        ? await client.query(
            `
              SELECT *
              FROM submissions
              WHERE id = $1
              LIMIT 1
              FOR UPDATE
            `,
            [numericId],
          )
        : await client.query(
            `
              SELECT *
              FROM submissions
              WHERE submission_group_id = $1
              ORDER BY created_at ASC NULLS LAST, id ASC
              FOR UPDATE
            `,
            [id],
          );

    if (submissionsResult.rowCount === 0) {
      throw new Error("Submission not found");
    }

    const submissions = submissionsResult.rows;
    const submissionIds = submissions.map((row: any) => Number(row.id));

    const approvedRows = submissions.filter((row: any) => row.status === "approved");
    if (approvedRows.length) {
      throw new Error(
        "Approved submissions cannot be rejected directly. Return them to pending first if needed.",
      );
    }

    const alreadyRejected = submissions.every((row: any) => row.status === "rejected");
    if (alreadyRejected) {
      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Already rejected",
        updated: 0,
        submissionRef: id,
        newStatus: "rejected",
        affectedNumbers: [],
      });
    }

    const invalidRows = submissions.filter((row: any) => row.status !== "pending");
    if (invalidRows.length) {
      throw new Error(`Submission is already ${invalidRows[0].status}`);
    }

    const itemResult = await client.query(
      `
        SELECT submission_id, number, amount
        FROM submission_items
        WHERE submission_id = ANY($1::int[])
          AND COALESCE(status, 'active') <> 'rejected'
        ORDER BY number ASC
      `,
      [submissionIds],
    );

    let items: ContributionItem[] = itemResult.rows
      .map((item: any) => ({
        submissionId: Number(item.submission_id),
        number: Number(item.number),
        amount: Number(item.amount),
      }))
      .filter(
        (item: ContributionItem) =>
          Number.isInteger(item.submissionId) &&
          item.submissionId > 0 &&
          Number.isInteger(item.number) &&
          item.number > 0 &&
          Number.isFinite(item.amount) &&
          item.amount > 0,
      );

    if (!items.length) {
      items = submissions.flatMap(normalizeFallbackItems);
    }

    if (!items.length) {
      throw new Error("No valid contribution items found");
    }

    const amountByNumber = new Map<number, number>();

    for (const item of items) {
      amountByNumber.set(item.number, (amountByNumber.get(item.number) || 0) + item.amount);
    }

    const affectedNumbers = Array.from(amountByNumber.keys()).sort((a, b) => a - b);

    await client.query(
      `
        INSERT INTO number_status_summary_cache (
          number,
          target_amount,
          approved_amount,
          pending_amount,
          hold_amount,
          sold_amount,
          remaining_amount,
          status,
          updated_at
        )
        SELECT
          np.number,
          np.target_amount,
          np.current_amount,
          0,
          0,
          np.current_amount,
          GREATEST(np.target_amount - np.current_amount, 0),
          CASE
            WHEN np.current_amount >= np.target_amount THEN 'sold'
            ELSE np.status::text
          END,
          NOW()
        FROM number_pools np
        WHERE np.number = ANY($1::int[])
        ON CONFLICT (number) DO NOTHING
      `,
      [affectedNumbers],
    );

    await client.query(
      `
        SELECT number
        FROM number_status_summary_cache
        WHERE number = ANY($1::int[])
        ORDER BY number ASC
        FOR UPDATE
      `,
      [affectedNumbers],
    );

    const updateResult = await client.query(
      `
        UPDATE submissions
        SET
          status = 'rejected',
          rejected_at = NOW(),
          approved_at = NULL,
          is_seen_by_user = FALSE,
          updated_at = NOW()
        WHERE id = ANY($1::int[])
          AND status = 'pending'
        RETURNING id
      `,
      [submissionIds],
    );

    /*
      Status changed from pending -> rejected above.
      Do NOT manually decrement cache here. Recalculate affected numbers from
      submission_items/submissions so manual entries and rejected item rows stay accurate.
    */
    await client.query(
      `SELECT public.refresh_number_status_summary_cache_many($1::integer[])`,
      [affectedNumbers],
    );

    const totalAmount = Array.from(amountByNumber.values()).reduce(
      (sum, amount) => sum + Number(amount || 0),
      0,
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      updated: updateResult.rowCount,
      rejectedSubmissionIds: updateResult.rows.map((row: any) => Number(row.id)),
      submissionRef: id,
      newStatus: "rejected",
      totalAmount,
      soldDelta: 0,
      leftDelta: 0,
      affectedNumbers,
    });
  } catch (err: any) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Reject rollback error:", rollbackError);
      }
    }

    console.error("Reject error:", err);
    const message = err?.message || "Failed to reject";

    return NextResponse.json(
      { error: message },
      { status: apiStatusFromError(message) },
    );
  } finally {
    if (client) client.release();
  }
}
