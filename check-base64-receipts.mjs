import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  SELECT id, number, LENGTH(receipt_url) AS receipt_size
  FROM submissions
  WHERE receipt_url LIKE 'data:image%'
  ORDER BY submitted_at DESC
`;

console.log('Base64 receipt rows:', rows.length);
console.table(rows);
