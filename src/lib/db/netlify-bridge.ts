import { Pool, type PoolClient } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __svportal_pg_pool: Pool | undefined;
}

/**
 * Returns YYYY-MM-DD formatted date in Asia/Bangkok timezone (UTC+7).
 */
export function getBangkokDateString(date?: Date): string {
  const d = date || new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    const bangkokTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return bangkokTime.toISOString().slice(0, 10);
  }
}

/**
 * Returns true if Netlify Database mode should be used instead of Supabase.
 */
export function isNetlifyDbActive(): boolean {
  if (process.env.DB_PROVIDER === 'netlify') {
    return true;
  }
  const hasNetlifyOrPgUrl = Boolean(
    process.env.NETLIFY_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL
  );
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && hasNetlifyOrPgUrl) {
    return true;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getConnectionString } = require('@netlify/database');
      if (getConnectionString()) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Retrieves or lazily creates a singleton pg.Pool cached on globalThis.
 * Falls back to null if no connection string is present in environment.
 */
export function getPgPool(): Pool | null {
  if (globalThis.__svportal_pg_pool) {
    return globalThis.__svportal_pg_pool;
  }

  let connectionString =
    process.env.NETLIFY_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL;

  if (!connectionString) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getConnectionString } = require('@netlify/database');
      connectionString = getConnectionString();
    } catch {
      // ignore
    }
  }

  if (!connectionString) {
    return null;
  }

  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('sslmode=disable');

  globalThis.__svportal_pg_pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  return globalThis.__svportal_pg_pool;
}

/**
 * Executes a parameterized SQL query against the Postgres pool.
 */
export async function queryPg<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPgPool();
  if (!pool) {
    throw new Error('Database connection URL not configured (NETLIFY_DB_URL / DATABASE_URL missing)');
  }
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

/**
 * Runs a transactional callback within BEGIN / COMMIT / ROLLBACK blocks.
 */
export async function withPgTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPgPool();
  if (!pool) {
    throw new Error('Database connection URL not configured (NETLIFY_DB_URL / DATABASE_URL missing)');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
