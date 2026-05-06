export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';
import { utapi } from '@/lib/uploadthing/utapi';

function fallbackKeyFromUrl(url: string | null | undefined) {
  if (!url || url.startsWith('data:image')) return null;

  try {
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const receiptRows = await sql`
      SELECT receipt_url, receipt_key
      FROM submissions
      WHERE (receipt_url IS NOT NULL AND receipt_url <> '')
      OR (receipt_key IS NOT NULL AND receipt_key <> '')
    `;

    const fileKeys = Array.from(
      new Set(
        receiptRows
          .map((row: any) => row.receipt_key || fallbackKeyFromUrl(row.receipt_url))
          .filter(Boolean)
      )
    ) as string[];

    let deletedFiles = 0;
    let uploadThingDeleteFailed = false;

    if (fileKeys.length > 0) {
      try {
        await utapi.deleteFiles(fileKeys);
        deletedFiles = fileKeys.length;
      } catch (uploadError) {
        uploadThingDeleteFailed = true;
        console.error('UploadThing delete error:', uploadError);
      }
    }

    await sql`DELETE FROM number_locks`;
    await sql`DELETE FROM submissions`;

    /* Delete system backups when submissions are cleared */
    await sql`DELETE FROM system_backups`;

    return NextResponse.json({
      success: true,
      message: 'Submissions, locks, receipt files, and backups cleared',
      deletedFiles,
      uploadThingDeleteFailed,
    });
  } catch (error: any) {
    console.error('Clear all error:', error);

    return NextResponse.json(
      { error: error.message || 'Clear failed' },
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
