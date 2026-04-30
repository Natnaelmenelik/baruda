import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const phone = process.argv[2];

if (!phone) {
  console.log('Usage: node make-admin.mjs +251911371221');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const normalizedPhone = phone.startsWith('0')
  ? '+251' + phone.slice(1)
  : phone;

const localPhone = normalizedPhone.startsWith('+251')
  ? '0' + normalizedPhone.slice(4)
  : normalizedPhone;

const cols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'users'
`;

const colNames = cols.map((c) => c.column_name);

if (colNames.includes('is_admin')) {
  await sql`
    UPDATE users
    SET is_admin = true
    WHERE phone = ${normalizedPhone}
    OR phone = ${localPhone}
  `;
}

if (colNames.includes('role')) {
  await sql`
    UPDATE users
    SET role = 'admin'
    WHERE phone = ${normalizedPhone}
    OR phone = ${localPhone}
  `;
}

const rows = await sql`
  SELECT id, name, phone,
    ${colNames.includes('is_admin') ? sql`is_admin` : sql`NULL AS is_admin`},
    ${colNames.includes('role') ? sql`role` : sql`NULL AS role`}
  FROM users
  WHERE phone = ${normalizedPhone}
  OR phone = ${localPhone}
`;

console.log('✅ Admin account updated:');
console.table(rows);
