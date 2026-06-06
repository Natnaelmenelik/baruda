import { sql } from "@/lib/db/sql";

type ExpiredHoldsCleanupResult = {
  expiredHoldCount: number;
  numbers: number[];
};

/**
 * Cleanup expired payment holds and refresh cache for the affected numbers.
 *
 * The frontend timer is only a UI timer. Browser DELETE requests can be missed
 * if a tab closes, refreshes, sleeps, or loses network. This backend cleanup makes
 * expires_at the source of truth for releasing held numbers.
 */
const DEFAULT_CLEANUP_INTERVAL_MS = 10_000;

let lastCleanupAt = 0;
let inFlightCleanup: Promise<ExpiredHoldsCleanupResult> | null = null;

function normalizeNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((number) => Number(number))
        .filter((number) => Number.isInteger(number) && number > 0),
    ),
  );
}

async function expireExpiredHoldsAndRefreshCache(): Promise<ExpiredHoldsCleanupResult> {
  const rows = await sql`
    WITH expired_holds AS (
      UPDATE payment_holds
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE status = 'active'
        AND expires_at <= NOW()
      RETURNING id
    ),
    affected_numbers AS (
      SELECT DISTINCT phi.number
      FROM payment_hold_items phi
      JOIN expired_holds eh ON eh.id = phi.hold_id
    )
    SELECT
      (SELECT COUNT(*)::int FROM expired_holds) AS expired_hold_count,
      COALESCE(array_agg(number ORDER BY number), '{}'::integer[]) AS numbers
    FROM affected_numbers
  `;

  const expiredHoldCount = Number(rows?.[0]?.expired_hold_count || 0);
  const numbers = normalizeNumbers(rows?.[0]?.numbers);

  if (numbers.length) {
    await sql`SELECT public.refresh_number_status_summary_cache_many(${numbers}::integer[])`;
  }

  return { expiredHoldCount, numbers };
}

export async function cleanupExpiredHoldsIfNeeded(
  intervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
): Promise<ExpiredHoldsCleanupResult> {
  const now = Date.now();

  if (now - lastCleanupAt < intervalMs) {
    return { expiredHoldCount: 0, numbers: [] };
  }

  if (inFlightCleanup) {
    return inFlightCleanup;
  }

  lastCleanupAt = now;

  inFlightCleanup = (async () => {
    try {
      return await expireExpiredHoldsAndRefreshCache();
    } catch (error) {
      // Do not break read routes if cleanup fails.
      console.error("Expired holds cleanup failed:", error);
      return { expiredHoldCount: 0, numbers: [] };
    } finally {
      inFlightCleanup = null;
    }
  })();

  return inFlightCleanup;
}

/**
 * Use this when correctness must be immediate, for example before returning user-side numbers.
 */
export async function cleanupExpiredHoldsNow(): Promise<ExpiredHoldsCleanupResult> {
  try {
    return await expireExpiredHoldsAndRefreshCache();
  } catch (error) {
    console.error("Expired holds immediate cleanup failed:", error);
    return { expiredHoldCount: 0, numbers: [] };
  }
}
