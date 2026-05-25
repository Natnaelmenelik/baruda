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

  if (!id || id === "approve") return "";
  return id;
}

function normalizeFallbackItems(submission: any): ContributionItem[] {
  if (submission?.number_amounts && typeof submission.number_amounts === "object") {
    return Object.entries(submission.number_amounts)
      .map(([number, amount]) => ({
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

    const totalAmount = Number(submission.total_amount || 0);
    const perNumber =
      totalAmount > 0
        ? Math.floor(totalAmount / Math.max(numbers.length, 1))
        : Number(submission.ticket_price || 0);

    return numbers
      .map((number: number) => ({ number, amount: perNumber }))
      .filter((item: { number: number; amount: number }) => item.amount > 0);
  }

  if (submission?.number) {
    const amount = Number(submission.total_amount || submission.ticket_price || 0);
    if (Number.isFinite(amount) && amount > 0) {
      return [{ number: Number(submission.number), amount }];
    }
  }

  return [];
}

function mergeItems(items: ContributionItem[]) {
  const merged = new Map<number, number>();

  for (const item of items) {
    merged.set(item.number, (merged.get(item.number) || 0) + item.amount);
  }

  return Array.from(merged.entries())
    .map(([number, amount]) => ({ number, amount }))
    .sort((a, b) => a.number - b.number);
}

function apiStatusFromError(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  if (message.toLowerCase().includes("not found")) return 404;

  if (
    message.includes("already") ||
    message.includes("closed") ||
    message.includes("remaining") ||
    message.includes("No valid contribution") ||
    message.includes("Missing submission id")
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

    /*
      Do not use id::text OR for every request.
      If id is numeric, use submissions.id.
      If id is UUID/text, use submission_group_id.
      This keeps index use cleaner.
    */
    const numericId = /^\d+$/.test(id) ? Number(id) : null;

    const submissionResult =
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
              LIMIT 1
              FOR UPDATE
            `,
            [id],
          );

    if (submissionResult.rowCount === 0) {
      throw new Error("Submission not found");
    }

    const submission = submissionResult.rows[0];

    if (submission.status === "approved") {
      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Already approved",
        approvedSubmissionId: Number(submission.id),
        submissionRef: id,
        newStatus: "approved",
        affectedNumbers: [],
      });
    }

    if (submission.status !== "pending") {
      throw new Error(`Submission is already ${submission.status}`);
    }

    const itemResult = await client.query(
      `
        SELECT number, amount
        FROM submission_items
        WHERE submission_id = $1
        ORDER BY number ASC
      `,
      [submission.id],
    );

    let items: ContributionItem[] = itemResult.rows
      .map((item: any) => ({
        number: Number(item.number),
        amount: Number(item.amount),
      }))
      .filter(
        (item: ContributionItem) =>
          Number.isInteger(item.number) &&
          item.number > 0 &&
          Number.isFinite(item.amount) &&
          item.amount > 0,
      );

    if (!items.length) {
      items = normalizeFallbackItems(submission);
    }

    items = mergeItems(items);

    if (!items.length) {
      throw new Error("No valid contribution items found");
    }

    const affectedNumbers = items.map((item) => item.number);

    /*
      Ensure cache rows exist for affected numbers only.
    */
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

    const cacheResult = await client.query(
      `
        SELECT
          number,
          target_amount,
          approved_amount,
          pending_amount,
          hold_amount,
          remaining_amount,
          status
        FROM number_status_summary_cache
        WHERE number = ANY($1::int[])
        ORDER BY number ASC
        FOR UPDATE
      `,
      [affectedNumbers],
    );

    if (cacheResult.rowCount !== affectedNumbers.length) {
      throw new Error("Some number summary cache rows are missing");
    }

    const cacheByNumber = new Map<number, any>();

    for (const row of cacheResult.rows) {
      cacheByNumber.set(Number(row.number), row);
    }

    for (const item of items) {
      const cache = cacheByNumber.get(item.number);

      if (!cache) {
        throw new Error(`Number ${item.number} summary cache missing`);
      }

      /*
        Pending submission amount is already part of pending_amount.
        Approve moves pending -> approved, so this approval can use:
        current remaining + this pending amount.
      */
      const availableForThisApproval = Number(cache.remaining_amount || 0) + item.amount;

      if (item.amount > availableForThisApproval) {
        throw new Error(
          `Number ${item.number} only has ${availableForThisApproval} Birr remaining`,
        );
      }
    }

    const updateSubmission = await client.query(
      `
        UPDATE submissions
        SET
          status = 'approved',
          is_seen_by_user = FALSE,
          approved_at = NOW(),
          rejected_at = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND status = 'pending'
        RETURNING id
      `,
      [submission.id],
    );

    if (updateSubmission.rowCount !== 1) {
      throw new Error("Submission could not be approved");
    }

    const values: any[] = [];
    const placeholders: string[] = [];

    items.forEach((item, index) => {
      const base = index * 2 + 1;
      placeholders.push(`($${base}::int, $${base + 1}::int)`);
      values.push(item.number, item.amount);
    });

    /*
      Affected numbers only:
      pending -> approved.
      No full number recalculation.
    */
    await client.query(
      `
        WITH item_updates(number, amount) AS (
          VALUES ${placeholders.join(", ")}
        )
        UPDATE number_status_summary_cache cache
        SET
          approved_amount = cache.approved_amount + item_updates.amount,
          sold_amount = cache.sold_amount + item_updates.amount,
          pending_amount = GREATEST(cache.pending_amount - item_updates.amount, 0),
          remaining_amount = GREATEST(
            cache.target_amount
              - (cache.approved_amount + item_updates.amount)
              - GREATEST(cache.pending_amount - item_updates.amount, 0)
              - cache.hold_amount,
            0
          ),
          status = CASE
            WHEN cache.approved_amount + item_updates.amount >= cache.target_amount THEN 'sold'
            WHEN GREATEST(cache.pending_amount - item_updates.amount, 0) > 0 OR cache.hold_amount > 0 THEN 'pending'
            ELSE 'open'
          END,
          updated_at = NOW()
        FROM item_updates
        WHERE cache.number = item_updates.number
      `,
      values,
    );

    /*
      Keep legacy number_pools in sync for existing reads.
      Affected numbers only.
    */
    await client.query(
      `
        WITH item_updates(number, amount) AS (
          VALUES ${placeholders.join(", ")}
        )
        UPDATE number_pools np
        SET
          current_amount = np.current_amount + item_updates.amount,
          status = CASE
            WHEN np.current_amount + item_updates.amount >= np.target_amount THEN 'sold'
            ELSE 'open'
          END,
          updated_at = NOW()
        FROM item_updates
        WHERE np.number = item_updates.number
      `,
      values,
    );

    await client.query(
      `
        DELETE FROM number_locks
        WHERE number = ANY($1::int[])
      `,
      [affectedNumbers],
    );

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const soldDeltaResult = await client.query(
      `
        SELECT COUNT(*)::int AS sold_delta
        FROM number_status_summary_cache
        WHERE number = ANY($1::int[])
          AND status = 'sold'
      `,
      [affectedNumbers],
    );

    const soldDelta = Number(soldDeltaResult.rows?.[0]?.sold_delta || 0);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      approvedSubmissionId: Number(submission.id),
      submissionRef: id,
      newStatus: "approved",
      totalAmount,
      soldDelta,
      leftDelta: -soldDelta,
      affectedNumbers,
    });
  } catch (err: any) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Approve rollback error:", rollbackError);
      }
    }

    console.error("Approve error:", err);
    const message = err?.message || "Failed to approve";

    return NextResponse.json(
      { error: message },
      { status: apiStatusFromError(message) },
    );
  } finally {
    if (client) client.release();
  }
}
