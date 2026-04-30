import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS system_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_name TEXT NOT NULL,
    backup_data JSONB NOT NULL,
    users_count INTEGER DEFAULT 0,
    submissions_count INTEGER DEFAULT 0,
    winners_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )
`;

await sql`
  CREATE OR REPLACE FUNCTION create_system_backup_snapshot()
  RETURNS trigger AS $$
  DECLARE
    approved_data jsonb;
    winners_data jsonb;
    approved_count integer;
    winners_count_value integer;
  BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO approved_data
    FROM (
      SELECT 
        s.*,
        u.name AS user_name,
        u.phone AS user_phone,
        u.email AS user_email
      FROM submissions s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.status = 'approved'
      ORDER BY s.submitted_at DESC
    ) x;

    SELECT COUNT(*)
    INTO approved_count
    FROM submissions
    WHERE status = 'approved';

    SELECT COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
    INTO winners_data
    FROM (
      SELECT *
      FROM winners
      ORDER BY drawn_at DESC
    ) w;

    SELECT COUNT(*)
    INTO winners_count_value
    FROM winners;

    INSERT INTO system_backups (
      backup_name,
      backup_data,
      users_count,
      submissions_count,
      winners_count
    )
    VALUES (
      'auto_backup_' || EXTRACT(EPOCH FROM NOW())::text,
      jsonb_build_object(
        'createdAt', NOW(),
        'approvedSubmissions', approved_data,
        'winners', winners_data
      ),
      0,
      approved_count,
      winners_count_value
    );

    RETURN COALESCE(NEW, OLD);
  END;
  $$ LANGUAGE plpgsql;
`;

await sql`DROP TRIGGER IF EXISTS trg_backup_on_submission_change ON submissions`;
await sql`
  CREATE TRIGGER trg_backup_on_submission_change
  AFTER INSERT OR UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION create_system_backup_snapshot()
`;

await sql`DROP TRIGGER IF EXISTS trg_backup_on_winner_change ON winners`;
await sql`
  CREATE TRIGGER trg_backup_on_winner_change
  AFTER INSERT OR UPDATE ON winners
  FOR EACH ROW
  EXECUTE FUNCTION create_system_backup_snapshot()
`;

console.log('✅ DB-level automatic backup triggers created');
