export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const inputNumbers = Array.isArray(body.numbers) ? body.numbers : [];

    const numbers: number[] = inputNumbers
      .map((n: any) => Number(n))
      .filter((n: number) => Number.isInteger(n) && n > 0);

    const uniqueNumbers: number[] = Array.from(new Set<number>(numbers));

    if (uniqueNumbers.length > 8) {
      return NextResponse.json(
        { error: 'You can enter up to 8 numbers only.' },
        { status: 400 }
      );
    }

    let approvedRows: any[] = [];

    if (uniqueNumbers.length > 0) {
      approvedRows = await sql`
        SELECT
          s.id AS submission_id,
          s.number,
          s.user_id,
          u.name AS user_name,
          COALESCE(s.contact_phone, u.phone) AS user_phone
        FROM submissions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'approved'
        AND s.number = ANY(${uniqueNumbers}::int[])
      `;

      const approvedNumbers: number[] = approvedRows.map((r: any) => Number(r.number));
      const missing = uniqueNumbers.filter((n) => !approvedNumbers.includes(n));

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `These numbers are not approved or do not exist: ${missing.join(', ')}`,
            missing,
          },
          { status: 400 }
        );
      }
    } else {
      approvedRows = await sql`
        SELECT
          s.id AS submission_id,
          s.number,
          s.user_id,
          u.name AS user_name,
          COALESCE(s.contact_phone, u.phone) AS user_phone
        FROM submissions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'approved'
      `;
    }

    if (!approvedRows.length) {
      return NextResponse.json(
        { error: 'No approved numbers found for winner draw.' },
        { status: 400 }
      );
    }

    const randomIndex = Math.floor(Math.random() * approvedRows.length);
    const winner = approvedRows[randomIndex];

    const latestRound = await sql`
      SELECT COALESCE(MAX(draw_round), 0) + 1 AS next_round
      FROM winners
    `;

    const drawRound = Number(latestRound[0]?.next_round || 1);

    const inserted = await sql`
      INSERT INTO winners (
        number,
        user_id,
        user_name,
        user_phone,
        draw_round,
        drawn_at
      )
      VALUES (
        ${winner.number},
        ${winner.user_id},
        ${winner.user_name},
        ${winner.user_phone},
        ${drawRound},
        NOW()
      )
      RETURNING
        id,
        number,
        user_id,
        user_name,
        user_phone,
        draw_round,
        drawn_at
    `;

    return NextResponse.json({
      success: true,
      winner: inserted[0],
      candidates: uniqueNumbers.length > 0 ? uniqueNumbers : 'all approved numbers',
    });
  } catch (error: any) {
    console.error('Pick winner error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to pick winner' },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
              ? 403
              : 500,
      }
    );
  }
}
