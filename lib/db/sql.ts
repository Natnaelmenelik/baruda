import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchConnectionCache = true;

const databaseUrl = process.env.DATABASE_URL!;

const rawSql = neon(databaseUrl);

export async function safeQuery<T = any>(
  queryFn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await Promise.race([
      queryFn(),

      new Promise<T>((resolve) =>
        setTimeout(() => resolve(fallback), 3000)
      ),
    ]);
  } catch (error) {
    console.error('Database timeout:', error);
    return fallback;
  }
}

export const sql = rawSql;
