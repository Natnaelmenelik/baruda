import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/* Drop triggers first */
await sql`DROP TRIGGER IF EXISTS trg_backup_approved_submission_row ON submissions`;
await sql`DROP TRIGGER IF EXISTS trg_backup_approved_submission_columns ON submissions`;
await sql`DROP TRIGGER IF EXISTS trg_backup_approved_submission_final ON submissions`;
await sql`DROP TRIGGER IF EXISTS trg_backup_on_submission_change ON submissions`;
await sql`DROP TRIGGER IF EXISTS trg_backup_on_winner_change ON winners`;

/* Drop old functions */
await sql`DROP FUNCTION IF EXISTS backup_approved_submission_row()`;
await sql`DROP FUNCTION IF EXISTS backup_approved_submission_columns()`;
await sql`DROP FUNCTION IF EXISTS backup_approved_submission_final()`;
await sql`DROP FUNCTION IF EXISTS create_system_backup_snapshot()`;

/* Clean existing duplicates, keeping oldest */
await sql`
  DELETE FROM approved_submission_backups a
  USING approved_submission_backups b
  WHERE a.phone = b.phone
  AND a.number = b.number
  AND a.backup_created_at > b.backup_created_at
`;

/* Ensure unique protection */
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS unique_approved_backup_phone_number
  ON approved_submission_backups(phone, number)
`;

/* Create one safe trigger function */
await sql`
CREATE OR REPLACE FUNCTION backup_approved_submission_final()
RETURNS trigger AS $$
DECLARE
  user_name_value TEXT;
  user_phone_value TEXT;
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
  THEN
    SELECT name, phone
    INTO user_name_value, user_phone_value
    FROM users
    WHERE id = NEW.user_id;

    INSERT INTO approved_submission_backups (
      name,
      phone,
      number,
      status,
      timestamp
    )
    VALUES (
      user_name_value,
      user_phone_value,
      NEW.number,
      'approved',
      COALESCE(NEW.submitted_at, NOW())
    )
    ON CONFLICT (phone, number) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

/* Attach only one trigger */
await sql`
  CREATE TRIGGER trg_backup_approved_submission_final
  AFTER INSERT OR UPDATE ON submissions
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION backup_approved_submission_final()
`;

console.log('✅ Backup triggers fixed. Only one safe approved-submission trigger remains.');
