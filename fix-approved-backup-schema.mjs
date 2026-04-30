import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/* Add missing columns only if they don't exist */
await sql`
ALTER TABLE approved_submission_backups
ADD COLUMN IF NOT EXISTS selected_number INTEGER
`;

await sql`
ALTER TABLE approved_submission_backups
ADD COLUMN IF NOT EXISTS approved_timestamp TIMESTAMP
`;

await sql`
ALTER TABLE approved_submission_backups
ADD COLUMN IF NOT EXISTS backup_created_at TIMESTAMP DEFAULT NOW()
`;

/* Rebuild trigger function */
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
      COALESCE(NEW.submitted_at, NOW())
    );

  END IF;

  RETURN NEW;

END;
$$ LANGUAGE plpgsql;
`;

console.log("✅ Backup schema fixed");
