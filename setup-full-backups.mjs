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

console.log('✅ system_backups table ready');
