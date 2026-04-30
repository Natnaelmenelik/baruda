import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS receipt_key TEXT
`;

console.log('✅ receipt_key column ready');
