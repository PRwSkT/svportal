import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPgPool } from '@/lib/db/netlify-bridge';

export const STAFF_SESSION_COOKIE = 'sv_staff_session';

export interface StaffSessionPayload {
  id: string;
  email: string;
  full_name: string;
  exp: number;
}

function getSessionSecret(): string {
  return (
    process.env.STAFF_SESSION_SECRET ||
    process.env.PARENT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'svportal-staff-session-hmac-secret-salt'
  );
}

/**
 * Signs a payload into an HMAC-SHA256 authenticated session token.
 */
export function signStaffSessionToken(payload: StaffSessionPayload): string {
  const secret = getSessionSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verifies and parses an HMAC-SHA256 staff session token.
 */
export function verifyStaffSessionToken(token: string): StaffSessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const secret = getSessionSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as StaffSessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the staff session cookie from next/headers cookies() or passed request/store.
 */
export async function getStaffSessionFromCookies(
  reqOrCookieStore?: any
): Promise<StaffSessionPayload | null> {
  let token: string | undefined;

  if (reqOrCookieStore) {
    if (typeof reqOrCookieStore.cookies?.get === 'function') {
      token = reqOrCookieStore.cookies.get(STAFF_SESSION_COOKIE)?.value;
    } else if (typeof reqOrCookieStore.get === 'function') {
      token = reqOrCookieStore.get(STAFF_SESSION_COOKIE)?.value;
    }
  }

  if (!token) {
    try {
      const { cookies } = await import('next/headers');
      const store = await cookies();
      token = store.get(STAFF_SESSION_COOKIE)?.value;
    } catch {
      // Not in next/headers context
    }
  }

  if (!token) return null;
  return verifyStaffSessionToken(token);
}

/**
 * Attaches the sv_staff_session HttpOnly cookie to a NextResponse or standard Response.
 */
export function attachStaffSessionCookie(
  res: NextResponse | Response,
  user: { id: string; email: string; full_name?: string }
): void {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const payload: StaffSessionPayload = {
    id: user.id,
    email: user.email,
    full_name: user.full_name || user.email.split('@')[0],
    exp,
  };
  const token = signStaffSessionToken(payload);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  };

  if (res instanceof NextResponse || ('cookies' in res && typeof (res as any).cookies?.set === 'function')) {
    (res as any).cookies.set(STAFF_SESSION_COOKIE, token, cookieOptions);
  } else {
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.headers.append(
      'Set-Cookie',
      `${STAFF_SESSION_COOKIE}=${token}; Path=/; Max-Age=${cookieOptions.maxAge}; HttpOnly; SameSite=Lax${secureFlag}`
    );
  }
}

/**
 * Clears the sv_staff_session cookie.
 */
export function clearStaffSessionCookie(res: NextResponse | Response): void {
  if (res instanceof NextResponse || ('cookies' in res && typeof (res as any).cookies?.set === 'function')) {
    (res as any).cookies.set(STAFF_SESSION_COOKIE, '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    });
  } else {
    res.headers.append(
      'Set-Cookie',
      `${STAFF_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
    );
  }
}

/**
 * Queries auth.users verifying password hash via pgcrypto crypt().
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
