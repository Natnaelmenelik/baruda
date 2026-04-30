import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/* 1. Delete duplicate rows, keeping the earliest backup per phone + number */
await sql`
  DELETE FROM approved_submission_backups a
  USING approved_submission_backups b
  WHERE a.phone = b.phone
  AND a.number = b.number
  AND a.id::text > b.id::text
`;

/* 2. Create unique index to prevent duplicates forever */
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS unique_approved_backup_phone_number
  ON approved_submission_backups(phone, number)
`;

/* 3. Update trigger to insert only once */
await sql`
CREATE OR REPLACE FUNCTION backup_approved_submission_columns()
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

console.log('✅ Existing duplicates cleaned and future duplicates blocked');
