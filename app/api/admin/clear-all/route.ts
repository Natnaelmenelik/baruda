export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { requireAdmin } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const RECEIPTS_BUCKET =
  process.env.SUPABASE_RECEIPTS_BUCKET ||
  process.env.RECEIPTS_BUCKET ||
  "receipts";

type StorageCleanupResult = {
  bucket: string;
  dbKeysFound: number;
  listedFilesFound: number;
  attempted: number;
  deleted: number;
  failed: number;
  errors: string[];
  attemptedKeys: string[];
};

function uniqueCleanKeys(keys: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      keys
        .map((key) => String(key || "").trim())
        .filter(Boolean)
        .map((key) => normalizeReceiptKey(key))
        .filter(Boolean),
    ),
  );
}

function normalizeReceiptKey(rawKey: string) {
  let key = String(rawKey || "").trim();
  if (!key) return "";

  try {
    // If a full URL is accidentally stored, extract pathname.
    if (key.startsWith("http://") || key.startsWith("https://")) {
      const parsed = new URL(key);
      key = decodeURIComponent(parsed.pathname || "");
    }
  } catch {}

  key = key
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/receipts\//, "")
    .replace(/^storage\/v1\/object\/sign\/receipts\//, "")
    .replace(/^object\/public\/receipts\//, "")
    .replace(/^object\/sign\/receipts\//, "")
    .replace(/^receipts\//, "")
    .replace(/^reciepts\//, "")
    .replace(/^\/+/, "");

  return key;
}

function fallbackKeyFromUrl(url: string | null | undefined) {
  return normalizeReceiptKey(String(url || ""));
}

async function listAllStorageFiles(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  prefix = "",
): Promise<string[]> {
  const allFiles: string[] = [];

  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(error.message || `Failed to list bucket ${bucket}`);
  }

  for (const item of data || []) {
    const name = item.name;
    const fullPath = prefix ? `${prefix}/${name}` : name;

    /*
      Supabase Storage list items may represent folders with id = null.
      Files normally have id / metadata.
    */
    const isFolder =
      !item.id &&
      !item.updated_at &&
      (!item.metadata || Object.keys(item.metadata || {}).length === 0);

    if (isFolder) {
      const nested = await listAllStorageFiles(supabase, bucket, fullPath);
      allFiles.push(...nested);
    } else {
      allFiles.push(fullPath);
    }
  }

  return allFiles;
}

async function removeStorageFilesInBatches(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  keys: string[],
) {
  const errors: string[] = [];
  let deleted = 0;
  let failed = 0;

  const uniqueKeys = Array.from(new Set(keys.map(normalizeReceiptKey).filter(Boolean)));

  for (let i = 0; i < uniqueKeys.length; i += 100) {
    const batch = uniqueKeys.slice(i, i + 100);

    const { data, error } = await supabase.storage.from(bucket).remove(batch);

    if (error) {
      failed += batch.length;
      errors.push(error.message || "Unknown storage remove error");
      console.warn("Receipt storage remove batch failed:", { batch, error });
      continue;
    }

    /*
      Supabase remove may return data for removed objects.
      If it returns empty but no error, treat the request as successful.
    */
    deleted += Array.isArray(data) && data.length ? data.length : batch.length;
  }

  return {
    attempted: uniqueKeys.length,
    deleted,
    failed,
    errors,
    attemptedKeys: uniqueKeys,
  };
}

async function deleteReceiptStorageFiles(
  dbReceiptKeys: string[],
): Promise<StorageCleanupResult> {
  const supabase = createSupabaseAdminClient();

  const dbKeys = uniqueCleanKeys(dbReceiptKeys);
  let listedFiles: string[] = [];
  const errors: string[] = [];

  try {
    /*
      Comprehensive cleanup:
      1. delete DB-known receipt keys
      2. list the whole receipts bucket recursively
      3. delete everything found in the bucket
      This handles old records with wrong receipt_key paths.
    */
    listedFiles = await listAllStorageFiles(supabase, RECEIPTS_BUCKET);
  } catch (error: any) {
    const message = error?.message || "Failed to list receipts bucket";
    console.warn("Receipt bucket list failed:", message);
    errors.push(message);
  }

  const allKeys = Array.from(new Set([...dbKeys, ...listedFiles].map(normalizeReceiptKey).filter(Boolean)));

  console.log("Deleting receipt files:", {
    bucket: RECEIPTS_BUCKET,
    dbKeysFound: dbKeys.length,
    listedFilesFound: listedFiles.length,
    attempted: allKeys.length,
    keys: allKeys,
  });

  const removeResult = await removeStorageFilesInBatches(
    supabase,
    RECEIPTS_BUCKET,
    allKeys,
  );

  console.log("Receipt delete result:", removeResult);

  return {
    bucket: RECEIPTS_BUCKET,
    dbKeysFound: dbKeys.length,
    listedFilesFound: listedFiles.length,
    attempted: removeResult.attempted,
    deleted: removeResult.deleted,
    failed: removeResult.failed,
    errors: [...errors, ...removeResult.errors],
    attemptedKeys: removeResult.attemptedKeys,
  };
}

export async function POST(req: Request) {
  let client: Awaited<ReturnType<typeof pool.connect>> | null = null;

  try {
    await requireAdmin(req);

    client = await pool.connect();

    /*
      Collect receipt paths before deleting DB rows.
      Even if these are wrong/empty, storage cleanup also lists the whole bucket.
    */
    const receiptRows = await client.query(`
      SELECT receipt_url, receipt_key
      FROM submissions
      WHERE (receipt_key IS NOT NULL AND receipt_key <> '')
         OR (receipt_url IS NOT NULL AND receipt_url <> '')
    `);

    const dbReceiptKeys = receiptRows.rows.flatMap((row: any) => [
      row.receipt_key,
      fallbackKeyFromUrl(row.receipt_url),
    ]);

    /*
      Best effort storage cleanup.
      If it fails, DB clear still continues and response reports errors.
    */
    const storageCleanup = await deleteReceiptStorageFiles(dbReceiptKeys);

    await client.query("BEGIN");

    await client.query(`DELETE FROM number_locks`);

    await client.query(`
      UPDATE payment_holds
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE status = 'active'
    `);

    await client.query(`DELETE FROM payment_hold_items`);

    await client.query(`DELETE FROM submission_items`);

    await client.query(`DELETE FROM submissions`);

    await client.query(`
      UPDATE number_pools
      SET current_amount = 0,
          status = 'open',
          updated_at = NOW()
    `);

    await client.query(`
      UPDATE number_status_summary_cache
      SET approved_amount = 0,
          pending_amount = 0,
          hold_amount = 0,
          sold_amount = 0,
          remaining_amount = target_amount,
          status = 'open',
          updated_at = NOW()
    `);

    await client.query(`
      UPDATE number_status_summary
      SET approved_amount = 0,
          pending_amount = 0,
          hold_amount = 0,
          remaining_amount = target_amount,
          status = 'open',
          updated_at = NOW()
    `);

    await client.query(`
      UPDATE admin_stats_summary
      SET total_submissions = 0,
          pending_submissions = 0,
          approved_submissions = 0,
          rejected_submissions = 0,
          total_revenue = 0,
          pending_amount = 0,
          sold_numbers = 0,
          open_numbers = total_numbers,
          pending_numbers = 0,
          updated_at = NOW()
      WHERE id = 1
    `);

    await client.query(`
      UPDATE submission_stats_summary
      SET total_submissions = 0,
          pending_submissions = 0,
          approved_submissions = 0,
          rejected_submissions = 0,
          total_approved_amount = 0,
          total_pending_amount = 0,
          total_rejected_amount = 0,
          today_submissions = 0,
          today_approved_amount = 0,
          updated_at = NOW()
      WHERE id = 1
    `);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Round cleared successfully",
      receiptStorageCleanup: storageCleanup,
    });
  } catch (error: any) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    console.error("Clear & Start New Round failed:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to clear round" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
