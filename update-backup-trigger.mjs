import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`
CREATE OR REPLACE FUNCTION create_system_backup_snapshot()
RETURNS trigger AS $$
DECLARE
  approved_data jsonb;
  winners_data jsonb;
  approved_count integer;
  winners_count_value integer;
BEGIN

  -- ONLY CLEAN APPROVED DATA
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', u.name,
    'phone', u.phone,
    'number', s.number,
    'status', s.status,
    'timestamp', s.submitted_at
  )), '[]'::jsonb)
  INTO approved_data
  FROM submissions s
  LEFT JOIN users u ON u.id = s.user_id
  WHERE s.status = 'approved';

  SELECT COUNT(*) INTO approved_count
  FROM submissions
  WHERE status = 'approved';

  -- WINNERS (keep simple)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', w.user_name,
    'phone', w.user_phone,
    'number', w.number,
    'round', w.draw_round,
    'timestamp', w.drawn_at
  )), '[]'::jsonb)
  INTO winners_data
  FROM winners w;

  SELECT COUNT(*) INTO winners_count_value
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
      'approvedSubmissions', approved_data,
      'winners', winners_data,
      'createdAt', NOW()
    ),
    0,
    approved_count,
    winners_count_value
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
`;

console.log("✅ Backup structure updated");
