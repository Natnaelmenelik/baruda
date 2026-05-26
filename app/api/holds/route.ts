import { NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseMaybeJson(value: any) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeNumbers(body: any): number[] {
  const rawInput = body.numbers ?? body.selectedNumbers ?? body.selected_numbers ?? [];
  const raw = parseMaybeJson(rawInput);
  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw
        .map((n: any) => Number(n))
        .filter((n: number) => Number.isInteger(n) && n > 0),
    ),
  );
}

function normalizeNumberAmounts(body: any): Record<string, number> {
  const rawInput = body.numberAmounts ?? body.number_amounts ?? body.amountMap ?? body.amounts ?? {};
  const raw = parseMaybeJson(rawInput);
  const result: Record<string, number> = {};

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const number = Number(item?.number ?? item?.key);
      const amount = Number(item?.amount ?? item?.value);
      if (Number.isInteger(number) && number > 0 && Number.isFinite(amount) && amount > 0) {
        result[String(number)] = amount;
      }
    }
  } else if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      const number = Number(key);
      const amount = Number(value);
      if (Number.isInteger(number) && number > 0 && Number.isFinite(amount) && amount > 0) {
        result[String(number)] = amount;
      }
    }
  }

  return result;
}

function buildAmountMap(numbers: number[], body: any) {
  const amountMap = normalizeNumberAmounts(body);
  let totalAmount = Number(body.totalAmount ?? body.total_amount ?? 0);

  if (!Object.keys(amountMap).length && totalAmount > 0) {
    const perNumber = Math.floor(totalAmount / Math.max(numbers.length, 1));
    for (const number of numbers) {
      if (perNumber > 0) amountMap[String(number)] = perNumber;
    }
  }

  if (!totalAmount || totalAmount <= 0) {
    totalAmount = Object.values(amountMap).reduce((sum, amount) => sum + Number(amount || 0), 0);
  }

  return { amountMap, totalAmount };
}

export async function POST(req: Request) {
  const client = await pool.connect();

  try {
    const body = await req.json().catch(() => ({}));
    const numbers = normalizeNumbers(body);

    if (!numbers.length) {
      return NextResponse.json({ error: "No numbers selected" }, { status: 400 });
    }

    const { amountMap, totalAmount } = buildAmountMap(numbers, body);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Object.keys(amountMap).length) {
      return NextResponse.json({ error: "Invalid hold amount" }, { status: 400 });
    }

    for (const number of numbers) {
      const amount = Number(amountMap[String(number)] || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: `Missing amount for number ${number}` }, { status: 400 });
      }
    }

    const clientHoldKey =
      typeof body.clientHoldKey === "string" && body.clientHoldKey.trim()
        ? body.clientHoldKey.trim()
        : typeof body.client_hold_key === "string" && body.client_hold_key.trim()
          ? body.client_hold_key.trim()
          : `hold_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    await client.query("BEGIN");

    const sortedNumbers = [...numbers].sort((a, b) => a - b);
    for (const number of sortedNumbers) {
      await client.query("SELECT pg_advisory_xact_lock($1)", [number]);
    }

    await client.query('SELECT public.expire_payment_holds_for_numbers($1::integer[])', [numbers]);

    const existingRows = await client.query(
      `
      SELECT
        ph.id,
        ph.client_hold_key,
        ph.numbers,
        ph.total_amount,
        ph.status,
        ph.expires_at,
        ph.created_at,
        ph.updated_at,
        COALESCE(jsonb_object_agg(phi.number::text, phi.amount) FILTER (WHERE phi.id IS NOT NULL), '{}'::jsonb) AS number_amounts
      FROM payment_holds ph
      LEFT JOIN payment_hold_items phi ON phi.hold_id = ph.id
      WHERE ph.client_hold_key = $1
        AND ph.status = 'active'
        AND ph.expires_at > NOW()
      GROUP BY ph.id
      LIMIT 1
      `,
      [clientHoldKey],
    );

    const existingHold = existingRows.rows?.[0] || null;
    if (existingHold) {
      await client.query(
        'SELECT public.refresh_number_status_summary_cache_many($1::integer[])',
        [numbers],
      );

      await client.query("COMMIT");
    return NextResponse.json(existingHold, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    const remainingRows = await client.query(
      `
      SELECT
        selected_number.number,
        COALESCE(nssc.remaining_amount, np.target_amount, 5000)::int AS remaining_amount
      FROM unnest($1::integer[]) AS selected_number(number)
      LEFT JOIN number_status_summary_cache nssc ON nssc.number = selected_number.number
      LEFT JOIN number_pools np ON np.number = selected_number.number
      `,
      [numbers],
    );

    const blocked: Array<{ number: number; requested_amount: number; remaining_amount: number }> = [];
    for (const row of remainingRows.rows) {
      const number = Number(row.number);
      const remaining = Number(row.remaining_amount || 0);
      const requested = Number(amountMap[String(number)] || 0);
      if (requested > remaining) {
        blocked.push({ number, requested_amount: requested, remaining_amount: remaining });
      }
    }

    if (blocked.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Amount exceeds remaining balance", blocked }, { status: 409 });
    }

    const holdRows = await client.query(
      `
      INSERT INTO payment_holds (
        contact_phone, client_hold_key, numbers, number_amounts, total_amount,
        status, expires_at, created_at, updated_at
      )
      VALUES ($1, $2, $3::integer[], '{}'::jsonb, $4, 'active', NOW() + INTERVAL '3 minutes', NOW(), NOW())
      ON CONFLICT (client_hold_key)
      DO UPDATE SET
        contact_phone = EXCLUDED.contact_phone,
        numbers = EXCLUDED.numbers,
        number_amounts = '{}'::jsonb,
        total_amount = EXCLUDED.total_amount,
        status = 'active',
        expires_at = NOW() + INTERVAL '3 minutes',
        updated_at = NOW()
      RETURNING id, client_hold_key, numbers, total_amount, status, expires_at, created_at, updated_at
      `,
      [body.contactPhone || body.contact_phone || null, clientHoldKey, numbers, totalAmount],
    );

    const hold = holdRows.rows[0];

    await client.query("DELETE FROM payment_hold_items WHERE hold_id = $1", [hold.id]);

    for (const number of numbers) {
      await client.query(
        `
        INSERT INTO payment_hold_items (hold_id, number, amount, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (hold_id, number)
        DO UPDATE SET amount = EXCLUDED.amount
        `,
        [hold.id, number, Number(amountMap[String(number)])],
      );
    }

    

    await client.query(
      'SELECT public.refresh_number_status_summary_cache_many($1::integer[])',
      [numbers],
    );
await client.query("COMMIT");

    return NextResponse.json(
      { ...hold, number_amounts: amountMap },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("Create payment hold error:", error);
    return NextResponse.json({ error: error?.message || "Failed to create payment hold" }, { status: 500 });
  } finally {
    client.release();
  }
}
