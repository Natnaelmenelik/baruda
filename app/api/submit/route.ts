export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireUser } from '@/lib/auth/server';
import { getTicketPrice, getGridSize } from '@/lib/settings/lotterySettings';

function cleanNumbers(raw: any): number[] {
  return Array.from(
    new Set(
      (Array.isArray(raw) ? raw : [])
        .map((n: any) => Number(n))
        .filter((n: number) => Number.isInteger(n) && n > 0)
    )
  ).sort((a, b) => a - b) as number[];
}

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    const body = await req.json();

    const rawNumbers = Array.isArray(body.numbers)
      ? body.numbers
      : body.number
        ? [body.number]
        : [];

    const numbers = cleanNumbers(rawNumbers);
    const gridSize = await getGridSize();

    if (!numbers.length) {
      return NextResponse.json({ error: 'No numbers selected' }, { status: 400 });
    }

    if (numbers.some((n) => n < 1 || n > gridSize)) {
      return NextResponse.json(
        { error: `Invalid number selected. Numbers must be between 1 and ${gridSize}.` },
        { status: 400 }
      );
    }

    const receiptUrl = body.receiptUrl;
    const receiptKey = body.receiptKey || null;

    if (!receiptUrl || typeof receiptUrl !== 'string') {
      return NextResponse.json({ error: 'Receipt upload is required' }, { status: 400 });
    }

    if (receiptUrl.startsWith('data:image')) {
      return NextResponse.json(
        { error: 'Base64 receipt is not allowed. Please upload using UploadThing.' },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM number_locks
      WHERE expires_at < NOW()
    `;

    const lockedByMe = await sql`
      SELECT number
      FROM number_locks
      WHERE user_id::text = ${String(user.userId)}
      AND number = ANY(${numbers})
    `;

    const lockedSet = new Set(lockedByMe.map((r: any) => Number(r.number)));
    const missingLocks = numbers.filter((n) => !lockedSet.has(n));

    if (missingLocks.length) {
      return NextResponse.json(
        {
          error: 'Some numbers are not locked by you. Please select again.',
          missingLocks,
        },
        { status: 409 }
      );
    }

    const unavailable = await sql`
      SELECT number
      FROM submissions
      WHERE number = ANY(${numbers})
      AND status IN ('pending', 'approved')
    `;

    if (unavailable.length) {
      return NextResponse.json(
        {
          error: 'Some numbers are already pending or taken.',
          unavailableNumbers: unavailable.map((r: any) => Number(r.number)),
        },
        { status: 409 }
      );
    }

    const ticketPrice = await getTicketPrice();
    const totalAmount = ticketPrice * numbers.length;
    const submissionType = numbers.length > 1 ? 'group' : 'single';
    const submissionGroupId = numbers.length > 1 ? crypto.randomUUID() : null;

    const inserted: any[] = [];

    for (const num of numbers) {
      const rows = await sql`
        INSERT INTO submissions (
          user_id,
          number,
          receipt_url,
          receipt_key,
          contact_phone,
          status,
          submitted_at,
          ticket_price,
          total_amount,
          submission_type,
          submission_group_id
        )
        VALUES (
          ${user.userId},
          ${num},
          ${receiptUrl},
          ${receiptKey},
          ${user.phone},
          'pending',
          NOW(),
          ${ticketPrice},
          ${totalAmount},
          ${submissionType},
          ${submissionGroupId}
        )
        RETURNING *
      `;

      inserted.push(rows[0]);
    }

    await sql`
      DELETE FROM number_locks
      WHERE user_id::text = ${String(user.userId)}
      AND number = ANY(${numbers})
    `;

    return NextResponse.json({
      success: true,
      submission_type: submissionType,
      submission_group_id: submissionGroupId,
      numbers,
      ticketPrice,
      totalAmount,
      submissions: inserted,
    });
  } catch (error: any) {
    console.error('Submit error:', error);

    return NextResponse.json(
      { error: error.message || 'Submission failed' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
