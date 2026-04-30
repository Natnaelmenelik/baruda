export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { createAutomaticBackup } from '@/lib/backup/autoBackup';
import { requireUser } from '@/lib/auth/server';

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    const { number, receiptUrl, receiptKey } = await req.json();

    const selectedNumber = Number(number);

    if (!selectedNumber || selectedNumber < 1 || selectedNumber > 300) {
      await createAutomaticBackup('submit');

    return NextResponse.json({ error: 'Invalid number' }, { status: 400 });
    }

    if (!receiptUrl || typeof receiptUrl !== 'string') {
      return NextResponse.json(
        { error: 'Receipt upload is required' },
        { status: 400 }
      );
    }

    if (receiptUrl.startsWith('data:image')) {
      return NextResponse.json(
        { error: 'Base64 receipt is not allowed. Please upload using UploadThing.' },
        { status: 400 }
      );
    }

    const inserted = await sql`
      INSERT INTO submissions (
        user_id,
        number,
        receipt_url,
        receipt_key,
        contact_phone,
        status,
        submitted_at
      )
      VALUES (
        ${user.userId},
        ${selectedNumber},
        ${receiptUrl},
        ${receiptKey || null},
        ${user.phone},
        'pending',
        NOW()
      )
      ON CONFLICT DO NOTHING
      RETURNING id, number, receipt_url, receipt_key, status, submitted_at
    `;

    if (!inserted.length) {
      return NextResponse.json(
        { error: 'This number has already been selected by another user.' },
        { status: 409 }
      );
    }

    await sql`
      DELETE FROM number_locks
      WHERE number = ${selectedNumber}
      AND user_id = ${user.userId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Submission created successfully',
      submission: inserted[0],
    });
  } catch (error: any) {
    console.error('Submit error:', error);

    return NextResponse.json(
      { error: error.message || 'Submission failed' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
