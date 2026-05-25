export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireUser } from '@/lib/auth/server';

type Contribution = { number: number; amount: number };
const SUBMIT_LIMIT = 6;

function parseMaybeJson(value: any) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeItems(body: any): Contribution[] {
  const submissions = parseMaybeJson(body?.submissions);
  const items = parseMaybeJson(body?.items);
  const contributions = parseMaybeJson(body?.contributions);
  const numbers = parseMaybeJson(body?.numbers ?? body?.selectedNumbers);
  const amounts = parseMaybeJson(body?.amounts ?? body?.numberAmounts ?? body?.number_amounts);

  if (Array.isArray(submissions)) return submissions;
  if (Array.isArray(items)) return items;
  if (Array.isArray(contributions)) return contributions;

  if (Array.isArray(numbers) && amounts && typeof amounts === 'object') {
    return numbers.map((n: any) => ({
      number: Number(n),
      amount: Number(amounts[String(n)] ?? amounts[n]),
    }));
  }

  return [];
}

async function ensureUserExists(user: any, body: any) {
  const userId = String(user.userId || user.id || '');
  if (!userId) throw new Error('Unauthorized');

  const name = String(user.name || body.userName || body.user_name || 'User').trim() || 'User';
  const phoneFromPayload = String(user.phone || body.contactPhone || body.contact_phone || '').trim();
  const phone = phoneFromPayload || `user-${userId}`;
  const email = user.email || body.email || null;
  const role = user.role === 'admin' || user.isAdmin ? 'admin' : 'user';

  await sql`
    INSERT INTO public.users (id, name, phone, email, role, is_admin, created_at, updated_at)
    VALUES (${userId}::uuid, ${name}, ${phone}, ${email}, ${role}, ${role === 'admin'}, NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET
      name = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name),
      email = COALESCE(EXCLUDED.email, public.users.email),
      role = COALESCE(EXCLUDED.role, public.users.role),
      is_admin = EXCLUDED.is_admin,
      updated_at = NOW()
  `;
}

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    const body = await req.json();
    const holdId = String(body.holdId || body.hold_id || '');
    const clientHoldKey = String(body.clientHoldKey || body.client_hold_key || '');
    const userId = String(user.userId || user.id || '');

    if (!userId) {
  
    try {
      await sql`SELECT public.refresh_admin_stats_summary()`;
    } catch (refreshError) {
      console.warn('refresh_admin_stats_summary failed:', refreshError);
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserExists(user, body);

    const submissionLimitRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM submissions
      WHERE user_id::text = ${userId}
        AND submitted_at >= NOW() - INTERVAL '12 hours'
    `;

    const submissionCount = Number(submissionLimitRows?.[0]?.count || 0);
    if (submissionCount >= SUBMIT_LIMIT) {
      return NextResponse.json(
        { error: 'You have reached the maximum submission limit of 6 receipts in 12 hours. Please try again later.' },
        { status: 429 },
      );
    }

    const items = normalizeItems(body)
      .map((item) => ({ number: Number(item.number), amount: Number(item.amount) }))
      .filter((item) => Number.isInteger(item.number) && item.number > 0 && Number.isFinite(item.amount) && item.amount > 0);

    if (!items.length) {
      return NextResponse.json({ error: 'Please enter at least one valid contribution amount.' }, { status: 400 });
    }

    await sql`
      UPDATE payment_holds
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'active' AND expires_at <= NOW()
    `;

    const numbers = items.map((item) => item.number);
    const remainingRows = await sql`
      SELECT
        selected_number.number,
        COALESCE(nss.remaining_amount, np.target_amount, 5000)::int AS remaining_amount
      FROM unnest(${numbers}::integer[]) AS selected_number(number)
      LEFT JOIN number_status_summary nss ON nss.number = selected_number.number
      LEFT JOIN number_pools np ON np.number = selected_number.number
    `;

    const remainingMap = new Map<number, number>();
    for (const row of remainingRows) {
      remainingMap.set(Number(row.number), Number(row.remaining_amount || 0));
    }

    /*
      The receipt modal creates a payment hold before final submit.
      That hold reduces number_status_summary.remaining_amount for everyone.
      For this same final submit, add back this request's own active hold amount.
    */
    const ownHoldAmountMap = new Map<number, number>();

    if (holdId) {
      const ownHoldRows = clientHoldKey
        ? await sql`
            SELECT phi.number, COALESCE(SUM(phi.amount), 0)::int AS amount
            FROM payment_holds ph
            JOIN payment_hold_items phi ON phi.hold_id = ph.id
            WHERE ph.id::text = ${holdId}
              AND ph.client_hold_key = ${clientHoldKey}
              AND ph.status = 'active'
              AND ph.expires_at > NOW()
            GROUP BY phi.number
          `
        : await sql`
            SELECT phi.number, COALESCE(SUM(phi.amount), 0)::int AS amount
            FROM payment_holds ph
            JOIN payment_hold_items phi ON phi.hold_id = ph.id
            WHERE ph.id::text = ${holdId}
              AND ph.status = 'active'
              AND ph.expires_at > NOW()
            GROUP BY phi.number
          `;

      for (const row of ownHoldRows) {
        ownHoldAmountMap.set(Number(row.number), Number(row.amount || 0));
      }
    }

    const errors: string[] = [];
    for (const item of items) {
      const serverRemaining = remainingMap.get(item.number) ?? 0;
      const ownHeldAmount = ownHoldAmountMap.get(item.number) ?? 0;
      const availableForThisSubmit = Math.max(serverRemaining, ownHeldAmount);

      if (item.amount > availableForThisSubmit) {
        errors.push(`Number ${item.number} only has ${availableForThisSubmit} Birr remaining.`);
      }
    }

    if (errors.length) {
      return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const numberAmounts = Object.fromEntries(items.map((item) => [String(item.number), item.amount]));
    const groupId = crypto.randomUUID();
    const firstNumber = items[0].number;
    const receiptUrl = body.receiptUrl || body.receipt_url || '';
    const receiptKey = body.receiptKey || body.receipt_key || '';
    const contactPhone = body.contactPhone || body.contact_phone || user.phone || '';
    const userName = user.name || body.userName || body.user_name || 'User';
    const userPhone = user.phone || body.contactPhone || body.contact_phone || '';

    const inserted = await sql`
      INSERT INTO submissions (
        user_id, number, numbers, total_amount, ticket_price,
        receipt_url, receipt_key, has_receipt, contact_phone, user_phone, user_name,
        status, submission_type, submission_group_id, number_amounts, submitted_at, created_at, updated_at
      )
      VALUES (
        ${userId}::uuid,
        ${firstNumber},
        ${items.map((item) => item.number)}::integer[],
        ${totalAmount},
        ${totalAmount},
        ${receiptUrl},
        ${receiptKey},
        ${Boolean(receiptUrl || receiptKey)},
        ${contactPhone},
        ${userPhone},
        ${userName},
        'pending',
        'group',
        ${groupId},
        ${JSON.stringify(numberAmounts)}::jsonb,
        NOW(), NOW(), NOW()
      )
      RETURNING id, submission_group_id
    `;

    const submissionId = inserted[0].id;

    for (const item of items) {
      await sql`
        INSERT INTO submission_items (submission_id, number, amount, created_at)
        VALUES (${submissionId}, ${item.number}, ${item.amount}, NOW())
      `;
    }

    if (holdId) {
      await sql`
        UPDATE payment_holds
        SET status = 'completed', updated_at = NOW()
        WHERE id::text = ${holdId}
          AND status = 'active'
      `;
    }

    try {
      await sql`SELECT public.refresh_admin_stats_summary()`;
    } catch (refreshError) {
      // Do not fail the user's successful submission if only the admin summary refresh fails.
      // Admin can still recover by calling the stats endpoint or running the refresh manually.
      console.warn('refresh_admin_stats_summary failed after submit:', refreshError);
    }

    return NextResponse.json({ success: true, id: submissionId, submissionGroupId: groupId, totalAmount });
  } catch (err: any) {
    console.error('Submit error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to submit contribution' },
      { status: err.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}
