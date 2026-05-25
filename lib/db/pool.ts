import { sql } from './sql';

/**
 * Supabase/Postgres transaction adapter.
 *
 * This file intentionally DOES NOT import @neondatabase/serverless.
 *
 * It keeps the old `pool.connect()` API used by existing routes:
 *   const client = await pool.connect()
 *   await client.query('BEGIN')
 *   const result = await client.query('SELECT ... WHERE id = $1', [id])
 *   await client.query('COMMIT')
 *   client.release()
 *
 * Internally it uses postgres.js connected to Supabase Postgres through DATABASE_URL.
 */

type QueryResult<T = any> = {
  rows: T[];
  rowCount: number;
};

type PgLikeClient = {
  query: <T = any>(queryText: string, params?: any[]) => Promise<QueryResult<T>>;
  release: () => void;
};

function normalizeParams(params?: any[]) {
  return Array.isArray(params) ? params : [];
}

export const pool = {
  async connect(): Promise<PgLikeClient> {
    const reserved = await sql.reserve();

    let released = false;

    return {
      async query<T = any>(queryText: string, params?: any[]): Promise<QueryResult<T>> {
        if (released) {
          throw new Error('Database client has already been released.');
        }

        const trimmed = String(queryText || '').trim().toUpperCase();

        // postgres.js returns an array-like Result object.
        const result: any = await reserved.unsafe(queryText, normalizeParams(params));
        const rows = Array.isArray(result) ? result : [];

        // For INSERT/UPDATE/DELETE with RETURNING, rows.length is correct.
        // For commands without RETURNING, postgres.js may expose count.
        const rowCount =
          typeof result?.count === 'number'
            ? result.count
            : typeof result?.rowCount === 'number'
              ? result.rowCount
              : rows.length;

        return {
          rows,
          rowCount,
        };
      },

      release() {
        if (!released) {
          released = true;
          reserved.release();
        }
      },
    };
  },
};
