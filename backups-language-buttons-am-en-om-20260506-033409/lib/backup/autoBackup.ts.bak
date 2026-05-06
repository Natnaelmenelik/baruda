import { sql } from '@/lib/db/sql';

export async function createAutomaticBackup(reason = 'auto') {
  try {
    console.log('BACKUP START:', reason);

    const approved = await sql`
      SELECT *
      FROM submissions
      WHERE status = 'approved'
    `;

    const winners = await sql`
      SELECT *
      FROM winners
    `;

    await sql`
      INSERT INTO system_backups (
        backup_name,
        backup_data,
        submissions_count,
        winners_count
      )
      VALUES (
        ${`backup_${reason}_${Date.now()}`},
        ${JSON.stringify({
          approved,
          winners,
          createdAt: new Date().toISOString()
        })}::jsonb,
        ${approved.length},
        ${winners.length}
      )
    `;

    console.log('BACKUP SAVED');
  } catch (err) {
    console.error('BACKUP FAILED:', err);
  }
}
