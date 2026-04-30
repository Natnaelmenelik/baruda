import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing. Copy .env.local.example to .env.local and update it.');
const sql = neon(process.env.DATABASE_URL);
async function setup(){
 await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
 await sql`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), phone VARCHAR(20) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, name VARCHAR(100) NOT NULL, email VARCHAR(100), is_admin BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS submissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 1000), receipt_url TEXT NOT NULL, contact_phone VARCHAR(20), status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), submitted_at TIMESTAMP DEFAULT NOW(), approved_at TIMESTAMP, rejected_at TIMESTAMP)`;
 await sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_active_number ON submissions(number) WHERE status IN ('pending','approved')`;
 await sql`CREATE TABLE IF NOT EXISTS number_locks (number INTEGER PRIMARY KEY CHECK(number BETWEEN 1 AND 1000), user_id UUID REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) PRIMARY KEY, value VARCHAR(500) NOT NULL)`;
 await sql`CREATE TABLE IF NOT EXISTS winners (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), number INTEGER NOT NULL, user_id UUID REFERENCES users(id), user_name VARCHAR(100), user_phone VARCHAR(20), draw_round INTEGER DEFAULT 1, drawn_at TIMESTAMP DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), admin_id UUID REFERENCES users(id), action VARCHAR(100) NOT NULL, details JSONB, created_at TIMESTAMP DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS password_resets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, token TEXT UNIQUE NOT NULL, expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`;
 await sql`INSERT INTO settings(key,value) VALUES('ticket_price', ${process.env.DEFAULT_TICKET_PRICE || '40'}) ON CONFLICT(key) DO NOTHING`;
 console.log('✅ Fixed database created/verified.');
}
setup().catch((e)=>{console.error(e); process.exit(1);});
