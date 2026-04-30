import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

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
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;
console.log('✅ Trigger reverted to previous columns');
