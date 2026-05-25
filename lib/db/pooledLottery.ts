import { sql } from '@/lib/db';

export async function ensurePooledLotterySchema(gridSize = 2000, targetAmount = Number(process.env.DEFAULT_NUMBER_TARGET || 5000)) {
  await sql`CREATE TABLE IF NOT EXISTS number_pools (
    number INTEGER PRIMARY KEY,
    target_amount INTEGER NOT NULL DEFAULT 5000,
    current_amount INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS submission_items (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0)
  )`;
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS number_amounts JSONB`;
  await sql`INSERT INTO number_pools (number, target_amount, current_amount, status)
    SELECT generate_series(1, ${gridSize}), ${targetAmount}, 0, 'open'
    ON CONFLICT (number) DO NOTHING`;
}

export async function getGridSize() {
  const rows = await sql`SELECT value FROM settings WHERE key='grid_size' LIMIT 1`;
  return Number(rows?.[0]?.value || process.env.DEFAULT_GRID_SIZE || 2000);
}
