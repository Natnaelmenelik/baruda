import { sql } from '@/lib/db/sql';

type AutomaticBackupOptions = {
  reason?: string;
  data?: Record<string, unknown>;
};

/**
 * Creates a lightweight automatic backup record.
 *
 * This helper is intentionally safe:
 * - It never blocks the main admin action.
 * - If the backup table does not exist or insert fails, it only logs a warning.
 * - It matches the existing public.system_backups schema:
 *   backup_data jsonb, reason text.
 */
export async function createAutomaticBackup(
  reasonOrOptions?: string | AutomaticBackupOptions,
) {
  const reason =
    typeof reasonOrOptions === 'string'
      ? reasonOrOptions
      : reasonOrOptions?.reason || 'Automatic backup';

  const backupData =
    typeof reasonOrOptions === 'object' && reasonOrOptions?.data
      ? reasonOrOptions.data
      : {
          createdAt: new Date().toISOString(),
          reason,
        };

  try {
    await sql`
      INSERT INTO system_backups (backup_data, reason)
      VALUES (${JSON.stringify(backupData)}::jsonb, ${reason})
    `;

    return { success: true };
  } catch (error) {
    console.warn('createAutomaticBackup failed:', error);
    return { success: false, error };
  }
}
