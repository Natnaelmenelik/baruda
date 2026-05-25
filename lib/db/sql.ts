import postgres from 'postgres';

/**
 * Supabase Postgres server-side SQL client.
 *
 * IMPORTANT:
 * - Use DATABASE_URL from Supabase Database → Connection string → Transaction pooler.
 * - Do NOT use NEXT_PUBLIC_* keys for server SQL.
 * - This replaces the old Neon client completely.
 */

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Add your Supabase Postgres transaction pooler connection string to .env.local.'
  );
}

export const sql = postgres(databaseUrl, {
  ssl: 'require',
  max: Number(process.env.DATABASE_POOL_MAX || 5),
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
  transform: {
    undefined: null,
  },
});

export async function safeQuery<T = any>(
  queryFn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await Promise.race([
      queryFn(),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 5000)),
    ]);
  } catch (error) {
    console.error('Supabase database query failed:', error);
    return fallback;
  }
}

export async function closeSqlConnection() {
  await sql.end({ timeout: 5 });
}
