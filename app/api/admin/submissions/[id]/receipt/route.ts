export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';
import { createReceiptSignedUrl } from '@/lib/supabase/storage';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(req);

    const resolvedParams = await context.params;
    const rawId = String(resolvedParams.id || '').trim();

    if (!rawId) {
      return NextResponse.json(
        { success: false, error: 'Missing submission id' },
        { status: 400 },
      );
    }

    const decodedId = decodeURIComponent(rawId);

    /*
      Admin table can display grouped submissions.
      In that case the frontend may pass submission_group_id instead of numeric id.
      So we search by:
      1) id::text
      2) submission_group_id
      and return the first row that has a receipt.
    */
    const rows = await sql`
      SELECT
        id,
        submission_group_id,
        receipt_url,
        receipt_key
      FROM submissions
      WHERE
        id::text = ${decodedId}
        OR submission_group_id = ${decodedId}
      ORDER BY
        CASE
          WHEN receipt_key IS NOT NULL AND receipt_key <> '' THEN 0
          WHEN receipt_url IS NOT NULL AND receipt_url <> '' THEN 1
          ELSE 2
        END,
        submitted_at DESC,
        created_at DESC
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Submission not found',
          receivedId: decodedId,
        },
        { status: 404 },
      );
    }

    const row = rows[0];

    const receiptKey = String(row.receipt_key || '').replace(/^\/+/, '');
    const storedReceiptUrl = String(row.receipt_url || '');
    let receiptUrl = storedReceiptUrl;

    if (receiptKey) {
      try {
        receiptUrl = await createReceiptSignedUrl(receiptKey, 60 * 10);
      } catch (err) {
        console.error('Failed to create receipt signed URL:', err);
        receiptUrl = storedReceiptUrl;
      }
    }

    if (!receiptUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Receipt not found for this submission',
          submissionId: row.id,
          submissionGroupId: row.submission_group_id,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      receiptUrl,
      signedUrl: receiptUrl,
      url: receiptUrl,
      receiptKey,
      submissionId: row.id,
      submissionGroupId: row.submission_group_id,
    });
  } catch (error: any) {
    console.error('Admin receipt load error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load receipt',
      },
      {
        status:
          error.message === 'Forbidden'
            ? 403
            : error.message === 'Unauthorized'
              ? 401
              : 500,
      },
    );
  }
}
