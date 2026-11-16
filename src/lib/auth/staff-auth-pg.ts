import { getPgPool } from '@/lib/db/netlify-bridge';

/**
 * Queries auth.users verifying password hash via pgcrypto crypt().
 * Dedicated Node.js runtime utility for PostgreSQL password verification.
 */
export async function authenticateStaffWithPg(
  email: string,
  password: string
): Promise<{ id: string; email: string; full_name: string } | null> {
  const pool = getPgPool();
  if (!pool) {
    throw new Error('Database pool not available for staff authentication');
  }

  const cleanEmail = email.trim().toLowerCase();

  let rows: any[] = [];
  try {
    const res = await pool.query(
      `SELECT id, email, raw_user_meta_data
       FROM auth.users
       WHERE lower(email) = lower($1)
         AND encrypted_password = crypt($2, encrypted_password)
       LIMIT 1`,
      [cleanEmail, password]
    );
    rows = res.rows;
  } catch {
    // If crypt is in extensions or public schema
    try {
      const res = await pool.query(
        `SELECT id, email, raw_user_meta_data
         FROM auth.users
         WHERE lower(email) = lower($1)
           AND (
             encrypted_password = extensions.crypt($2, encrypted_password)
             OR encrypted_password = public.crypt($2, encrypted_password)
           )
         LIMIT 1`,
        [cleanEmail, password]
      );
      rows = res.rows;
    } catch (innerErr) {
      console.error('Error during authenticateStaffWithPg query:', innerErr);
      return null;
    }
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  const user = rows[0];
  let fullName = user.raw_user_meta_data?.full_name || user.email.split('@')[0];

  try {
    const appRes = await pool.query(
      `SELECT full_name FROM public.app_users WHERE id = $1 LIMIT 1`,
      [user.id]
    );
    if (appRes.rows.length > 0 && appRes.rows[0].full_name) {
      fullName = appRes.rows[0].full_name;
    }
  } catch {
    // ignore
  }

  return {
    id: user.id,
    email: user.email,
    full_name: fullName,
  };
}
