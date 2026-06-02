import { NextResponse } from "next/server";
import { sql } from "@/lib/db/sql";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ManualEntryItem = {
  number: number;
  amount: number;
};

function normalizeItems(input: any): ManualEntryItem[] {
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const merged = new Map<number, number>();

  for (const raw of rawItems) {
    const number = Number(raw?.number ?? raw?.num);
    const amount = Number(raw?.amount ?? raw?.value);

    if (!Number.isInteger(number) || number <= 0) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    merged.set(number, (merged.get(number) || 0) + Math.floor(amount));
  }

  return Array.from(merged.entries())
    .map(([number, amount]) => ({ number, amount }))
    .sort((a, b) => a.number - b.number);
}

function normalizePhone(value: any) {
  return String(value || "").trim().slice(0, 40);
}

function errorStatus(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  if (
    message.includes("required") ||
    message.includes("Invalid") ||
    message.includes("remaining") ||
    message.includes("sold") ||
    message.includes("closed") ||
    message.includes("not available") ||
    message.includes("not found")
  ) {
    return 400;
  }

  return 500;
}

async function getParams(context: { params: Promise<{ id: string }> | { id: string } }) {
  return await Promise.resolve(context.params as any);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    await requireAdmin(req);

    const { id } = await getParams(context);
    const submissionId = Number(id);

    if (!Number.isInteger(submissionId) || submissionId <= 0) {
      return NextResponse.json({ error: "Invalid manual entry id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedStatusRaw = String(body.status || "").toLowerCase();
    const requestedStatus = requestedStatusRaw === "approved" ? "approved" : requestedStatusRaw === "rejected" ? "rejected" : "pending";
    const clientName = String(body.clientName ?? body.userName ?? body.name ?? "").trim();
    const clientPhone = normalizePhone(body.phone ?? body.userPhone ?? body.contactPhone);
    const items = normalizeItems(body);

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    if (clientName.length > 120) {
      return NextResponse.json({ error: "Client name is too long" }, { status: 400 });
    }

    if (items.length > 20) {
      return NextResponse.json({ error: "You can close up to 20 numbers at once" }, { status: 400 });
    }

    const result = await sql.begin(async (tx) => {
      const submissionRows = await tx`
        SELECT id, status, user_id, has_receipt, COALESCE(user_name, '') AS user_name
        FROM submissions
        WHERE id = ${submissionId}
          AND user_id IS NULL
          AND COALESCE(has_receipt, false) = false
          AND COALESCE(user_name, '') <> ''
          AND COALESCE(status, '') IN ('pending', 'approved', 'rejected')
        FOR UPDATE
      `;

      if (!submissionRows.length) {
        return { validationError: true, message: "Manual entry not found" };
      }

      const oldRows = await tx`
        SELECT number, amount, COALESCE(status, 'active') AS status
        FROM submission_items
        WHERE submission_id = ${submissionId}
        ORDER BY number ASC, id ASC
        FOR UPDATE
      `;

      const oldActiveAmountByNumber = new Map<number, number>();
      const oldNumbers = new Set<number>();

      for (const row of oldRows) {
        const number = Number(row.number);
        const amount = Number(row.amount || 0);
        oldNumbers.add(number);
        if (String(row.status || "active") !== "rejected") {
          oldActiveAmountByNumber.set(number, (oldActiveAmountByNumber.get(number) || 0) + amount);
        }
      }

      const newNumbers = items.map((item) => item.number);
      const newNumberSet = new Set(newNumbers);
      const affectedNumbers = Array.from(new Set([...Array.from(oldNumbers), ...newNumbers])).sort((a, b) => a - b);

      if (items.length) {
        const cacheRows = await tx`
          SELECT number, COALESCE(remaining_amount, 0)::int AS remaining_amount, COALESCE(status, 'open') AS status
          FROM number_status_summary_cache
          WHERE number = ANY(${newNumbers}::integer[])
          FOR UPDATE
        `;

        const cacheByNumber = new Map<number, any>();
        for (const row of cacheRows) {
          cacheByNumber.set(Number(row.number), row);
        }

        const errors: string[] = [];

        for (const item of items) {
          const row = cacheByNumber.get(item.number);
          if (!row) {
            errors.push(`Number ${item.number} is not available.`);
            continue;
          }

          const oldActiveAmount = oldActiveAmountByNumber.get(item.number) || 0;
          const availableForThisEntry = Number(row.remaining_amount || 0) + oldActiveAmount;
          const status = String(row.status || "open").toLowerCase();

          if ((status === "sold" || status === "closed") && oldActiveAmount <= 0) {
            errors.push(`Number ${item.number} is already closed.`);
            continue;
          }

          if (item.amount > availableForThisEntry) {
            errors.push(`Number ${item.number} only has ${availableForThisEntry} Birr remaining.`);
          }
        }

        if (errors.length) {
          return { validationError: true, message: errors.join(" "), details: errors };
        }
      }

      // Removed numbers are NOT deleted anymore. They are marked as rejected for item-level history.
      await tx`
        UPDATE submission_items
        SET status = 'rejected',
            rejected_at = COALESCE(rejected_at, NOW()),
            rejected_reason = COALESCE(rejected_reason, 'Removed by admin from manual entry')
        WHERE submission_id = ${submissionId}
          AND NOT (number = ANY(${newNumbers}::integer[]))
          AND COALESCE(status, 'active') <> 'rejected'
      `;

      for (const item of items) {
        const existing = await tx`
          SELECT id
          FROM submission_items
          WHERE submission_id = ${submissionId}
            AND number = ${item.number}
          ORDER BY id ASC
          LIMIT 1
        `;

        if (existing.length) {
          await tx`
            UPDATE submission_items
            SET amount = ${item.amount},
                status = 'active',
                rejected_at = NULL,
                rejected_reason = NULL
            WHERE id = ${existing[0].id}
          `;
        } else {
          await tx`
            INSERT INTO submission_items (submission_id, number, amount, status, created_at)
            VALUES (${submissionId}, ${item.number}, ${item.amount}, 'active', NOW())
          `;
        }
      }

      // If duplicate rows somehow exist for the same active number, reject extras after the first row.
      await tx`
        WITH ranked AS (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY submission_id, number ORDER BY id ASC) AS rn
          FROM submission_items
          WHERE submission_id = ${submissionId}
            AND number = ANY(${newNumbers}::integer[])
            AND COALESCE(status, 'active') <> 'rejected'
        )
        UPDATE submission_items si
        SET status = 'rejected',
            rejected_at = COALESCE(si.rejected_at, NOW()),
            rejected_reason = COALESCE(si.rejected_reason, 'Duplicate item rejected automatically')
        FROM ranked r
        WHERE si.id = r.id
          AND r.rn > 1
      `;

      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
      const numberAmounts = Object.fromEntries(items.map((item) => [String(item.number), item.amount]));
      const submissionType = items.length > 1 ? "group" : "single";
      const firstNumber = items[0]?.number ?? null;
      const currentStatus = String(submissionRows[0]?.status || "pending").toLowerCase();
      const activeStatus = items.length
        ? currentStatus === "approved"
          ? "approved"
          : "pending"
        : "rejected";

      const updatedRows = await tx`
        UPDATE submissions
        SET number = ${firstNumber},
            numbers = ${newNumbers}::integer[],
            total_amount = ${totalAmount},
            ticket_price = ${totalAmount},
            contact_phone = ${clientPhone},
            user_phone = ${clientPhone},
            user_name = ${clientName},
            status = ${activeStatus},
            submission_type = ${submissionType},
            number_amounts = ${JSON.stringify(numberAmounts)}::jsonb,
            approved_at = CASE
              WHEN ${activeStatus} = 'approved' THEN COALESCE(approved_at, NOW())
              ELSE NULL
            END,
            rejected_at = CASE WHEN ${activeStatus} = 'rejected' THEN NOW() ELSE NULL END,
            updated_at = NOW()
        WHERE id = ${submissionId}
        RETURNING id::text, status, created_at, submitted_at, updated_at
      `;

      if (affectedNumbers.length) {
        await tx`SELECT public.refresh_number_status_summary_cache_many(${affectedNumbers}::integer[])`;
      }
      await tx`SELECT public.refresh_admin_stats_summary()`;

      const itemRows = await tx`
        SELECT number, amount, COALESCE(status, 'active') AS status, rejected_at
        FROM submission_items
        WHERE submission_id = ${submissionId}
        ORDER BY created_at ASC, id ASC
      `;

      return {
        entry: updatedRows[0],
        affectedNumbers,
        items: itemRows,
        totalAmount,
        numberAmounts,
        submissionType,
      };
    });

    if ((result as any)?.validationError) {
      return NextResponse.json(
        {
          error: "manual_entry_validation_failed",
          message: (result as any).message,
          details: (result as any).details || [],
        },
        { status: 400 },
      );
    }

    const entry = (result as any).entry;
    return NextResponse.json({
      ok: true,
      entry: {
        id: entry.id,
        status: entry.status,
        items: (result as any).items || [],
        total_amount: (result as any).totalAmount || 0,
        number_amounts: (result as any).numberAmounts || {},
        submission_type: (result as any).submissionType || "single",
        updated_at: entry.updated_at,
      },
      affectedNumbers: (result as any).affectedNumbers || [],
    });
  } catch (error: any) {
    const message = error?.message || "Failed to save manual entry";
    const status = errorStatus(message);

    if (status >= 500) {
      console.error("Manual entry PATCH error:", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}
