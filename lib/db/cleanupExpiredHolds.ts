import { sql } from "@/lib/db/sql";

/**
 * Cleanup expired payment holds without running the UPDATE on every GET request.
 *
 * Important:
 * - Amount calculations must still use:
 *   status = 'active' AND expires_at > NOW()
 * - This helper is only database housekeeping.
 * - It runs at most once per interval per server instance.
 */
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

let lastCleanupAt = 0;
let inFlightCleanup: Promise<void> | null = null;

export async function cleanupExpiredHoldsIfNeeded(
  intervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
) {
  const now = Date.now();

  if (now - lastCleanupAt < intervalMs) {
    return;
  }

  if (inFlightCleanup) {
    return inFlightCleanup;
  }

  lastCleanupAt = now;

  inFlightCleanup = (async () => {
    try {
      await sql`
        UPDATE payment_holds
        SET status = 'expired',
            updated_at = NOW()
        WHERE status = 'active'
          AND expires_at <= NOW()
      `;
    } catch (error) {
      // Do not break read routes if cleanup fails.
      // Expired holds are still ignored by expires_at > NOW() calculations.
      console.error("Expired holds cleanup failed:", error);
    } finally {
      inFlightCleanup = null;
    }
  })();

  return inFlightCleanup;
}

/**
 * Use this in write routes if you want cleanup to run immediately.
 * Example: before creating a new hold.
 */
export async function cleanupExpiredHoldsNow() {
  try {
    await sql`
      UPDATE payment_holds
      SET status = 'expired',
          updated_at = NOW()
      WHERE status = 'active'
        AND expires_at <= NOW()
    `;
  } catch (error) {
    console.error("Expired holds immediate cleanup failed:", error);
  }
}
