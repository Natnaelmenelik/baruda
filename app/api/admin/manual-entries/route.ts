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
  const rawItems = Array.isArray(input?.items)
    ? input.items
    : Array.isArray(input?.numbers)
      ? input.numbers
      : input?.number
        ? [{ number: input.number, amount: input.amount }]
        : [];

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
    message.includes("not available")
  ) {
    return 400;
  }

  return 500;
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 50;

    const rows = await sql`
      WITH item_data AS (
        SELECT
          si.submission_id,
          COALESCE(
            ARRAY_AGG(si.number ORDER BY si.created_at ASC, si.id ASC)
              FILTER (WHERE COALESCE(si.status, 'active') <> 'rejected'),
            ARRAY[]::int[]
          ) AS item_numbers,
          COALESCE(
            SUM(si.amount) FILTER (WHERE COALESCE(si.status, 'active') <> 'rejected'),
            0
          )::int AS item_total,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'number', si.number,
                'amount', si.amount,
                'status', COALESCE(si.status, 'active'),
                'rejected_at', si.rejected_at
              )
              ORDER BY si.created_at ASC, si.id ASC
            ),
            '[]'::json
          ) AS items
        FROM submission_items si
        GROUP BY si.submission_id
      )
      SELECT
        s.id::text AS id,
        COALESCE(s.user_name, 'Manual Client') AS user_name,
        COALESCE(s.user_phone, s.contact_phone, '') AS user_phone,
        COALESCE(s.contact_phone, s.user_phone, '') AS contact_phone,
        COALESCE(
          idata.item_numbers,
          s.numbers,
          CASE WHEN s.number IS NOT NULL THEN ARRAY[s.number]::int[] ELSE ARRAY[]::int[] END
        ) AS numbers,
        COALESCE(idata.items, '[]'::json) AS items,
        COALESCE(idata.item_total, s.total_amount, 0)::int AS total_amount,
        COALESCE(s.status, 'pending') AS status,
        COALESCE(s.submission_type, 'single') AS submission_type,
        s.number_amounts,
        s.approved_at,
        COALESCE(s.submitted_at, s.created_at) AS submitted_at,
        s.created_at
      FROM submissions s
      LEFT JOIN item_data idata ON idata.submission_id = s.id
      WHERE s.user_id IS NULL
        AND COALESCE(s.status, '') IN ('pending', 'approved')
        AND COALESCE(s.has_receipt, false) = false
        AND COALESCE(s.user_name, '') <> ''
      ORDER BY COALESCE(s.submitted_at, s.created_at) DESC
      LIMIT ${limit}
    `;

    return NextResponse.json(
      { entries: rows },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error: any) {
    const message = error?.message || "Failed to load manual entries";
    const status = errorStatus(message);

    if (status >= 500) {
      console.error("Manual entries GET error:", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const clientName = String(body.clientName ?? body.userName ?? body.name ?? "").trim();
    const clientPhone = normalizePhone(body.phone ?? body.userPhone ?? body.contactPhone);
    const items = normalizeItems(body);

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    if (clientName.length > 120) {
      return NextResponse.json({ error: "Client name is too long" }, { status: 400 });
    }

    if (!items.length) {
      return NextResponse.json({ error: "At least one valid number and amount is required" }, { status: 400 });
    }

    if (items.length > 20) {
      return NextResponse.json({ error: "You can close up to 20 numbers at once" }, { status: 400 });
    }

    const numbers = items.map((item) => item.number);
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const numberAmounts = Object.fromEntries(items.map((item) => [String(item.number), item.amount]));
    const submissionType = items.length > 1 ? "group" : "single";
    const firstNumber = items[0].number;
    const groupId = items.length > 1 ? crypto.randomUUID() : null;

    const result = await sql.begin(async (tx) => {
      const rows = await tx`
        SELECT
          number,
          COALESCE(target_amount, 0)::int AS target_amount,
          COALESCE(remaining_amount, 0)::int AS remaining_amount,
          COALESCE(status, 'open') AS status
        FROM number_status_summary_cache
        WHERE number = ANY(${numbers}::integer[])
        FOR UPDATE
      `;

      const byNumber = new Map<number, any>();
      for (const row of rows) {
        byNumber.set(Number(row.number), row);
      }

      const errors: string[] = [];

      for (const item of items) {
        const row = byNumber.get(item.number);

        if (!row) {
          errors.push(`Number ${item.number} is not available.`);
          continue;
        }

        const remaining = Number(row.remaining_amount || 0);
        const status = String(row.status || "open").toLowerCase();

        if (status === "sold" || status === "closed" || remaining <= 0) {
          errors.push(`Number ${item.number} is already closed.`);
          continue;
        }

        if (item.amount > remaining) {
          errors.push(`Number ${item.number} only has ${remaining} Birr remaining.`);
        }
      }

      if (errors.length) {
        return {
          validationError: true,
          message: errors.join(" "),
          details: errors,
        };
      }

      const inserted = await tx`
        INSERT INTO submissions (
          user_id,
          number,
          numbers,
          total_amount,
          ticket_price,
          receipt_url,
          receipt_key,
          has_receipt,
          contact_phone,
          user_phone,
          user_name,
          status,
          submission_type,
          submission_group_id,
          number_amounts,
          submitted_at,
          approved_at,
          created_at,
          updated_at
        )
        VALUES (
          ${null}::uuid,
          ${firstNumber},
          ${numbers}::integer[],
          ${totalAmount},
          ${totalAmount},
          ${""},
          ${""},
          false,
          ${clientPhone},
          ${clientPhone},
          ${clientName},
          'pending',
          ${submissionType},
          ${groupId},
          ${JSON.stringify(numberAmounts)}::jsonb,
          NOW(),
          NULL,
          NOW(),
          NOW()
        )
        RETURNING id::text, submission_group_id::text, approved_at, created_at
      `;

      const submissionId = Number(inserted[0].id);

      for (const item of items) {
        await tx`
          INSERT INTO submission_items (submission_id, number, amount, created_at)
          VALUES (${submissionId}, ${item.number}, ${item.amount}, NOW())
        `;
      }

      await tx`SELECT public.refresh_number_status_summary_cache_many(${numbers}::integer[])`;
      await tx`SELECT public.refresh_admin_stats_summary()`;

      return inserted[0];
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

    return NextResponse.json({
      ok: true,
      entry: {
        id: result.id,
        user_name: clientName,
        user_phone: clientPhone,
        contact_phone: clientPhone,
        numbers,
        items,
        total_amount: totalAmount,
        status: "pending",
        submission_type: submissionType,
        approved_at: result.approved_at,
        created_at: result.created_at,
      },
    });
  } catch (error: any) {
    const message = error?.message || "Failed to save manual client entry";
    const status = errorStatus(message);

    if (status >= 500) {
      console.error("Manual entries POST error:", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}
