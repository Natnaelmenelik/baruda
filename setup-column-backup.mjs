import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS approved_submission_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    phone TEXT,
    selected_number INTEGER,
    status TEXT DEFAULT 'approved',
    approved_timestamp TIMESTAMP,
    backup_created_at TIMESTAMP DEFAULT NOW()
  )
`;

await sql`
  CREATE OR REPLACE FUNCTION backup_approved_submission_columns()
  RETURNS trigger AS $$
  DECLARE
    user_name_value TEXT;
    user_phone_value TEXT;
  BEGIN
    IF NEW.status = 'approved' THEN
      SELECT name, phone
      INTO user_name_value, user_phone_value
      FROM users
      WHERE id = NEW.user_id;

      INSERT INTO approved_submission_backups (
        name,
        phone,
        selected_number,
        status,
        approved_timestamp
      )
      VALUES (
        user_name_value,
        user_phone_value,
        NEW.number,
        'approved',
        COALESCE(NEW.approved_at, NEW.submitted_at, NOW())
      );
    END IF;

    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

await sql`DROP TRIGGER IF EXISTS trg_backup_approved_submission_columns ON submissions`;

await sql`
  CREATE TRIGGER trg_backup_approved_submission_columns
  AFTER INSERT OR UPDATE ON submissions
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION backup_approved_submission_columns()
`;

console.log('✅ Column-based backup ready');
