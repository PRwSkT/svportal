import { NextResponse } from 'next/server';

export const STAFF_SESSION_COOKIE = 'sv_staff_session';

export interface StaffSessionPayload {
  id: string;
  email: string;
  full_name: string;
  exp: number;
}

interface CookieReaderLike {
  cookies?: { get?: (name: string) => { value?: string } | undefined };
  get?: (name: string) => { value?: string } | undefined;
}

interface CookieWritableResponse {
  cookies?: {
    set: (name: string, value: string, options: Record<string, unknown>) => void;
  };
}

function getSessionSecret(): string {
  const configured =
    process.env.STAFF_SESSION_SECRET ||
    process.env.PARENT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing STAFF_SESSION_SECRET in production environment');
    }
    return 'svportal-staff-session-hmac-secret-salt';
  }
  return configured;
}

function toBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(base64Url: string): Uint8Array<ArrayBuffer> {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Signs a payload into an HMAC-SHA256 authenticated session token using standard Web Crypto API.
 */
export async function signStaffSessionToken(payload: StaffSessionPayload): Promise<string> {
  const enc = new TextEncoder();
  const secret = getSessionSecret();
  const data = toBase64Url(enc.encode(JSON.stringify(payload)));

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const signature = toBase64Url(new Uint8Array(sigBuffer));
  return `${data}.${signature}`;
}

/**
 * Verifies and parses an HMAC-SHA256 staff session token using standard Web Crypto API.
 * Safe for Edge Runtime, Node.js, and Deno.
 */
export async function verifyStaffSessionToken(token: string): Promise<StaffSessionPayload | null> {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  if (!data || !signature) return null;

  try {
    const enc = new TextEncoder();
    const secret = getSessionSecret();

    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = fromBase64Url(signature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      enc.encode(data)
    );

    if (!isValid) return null;

    const dec = new TextDecoder();
    const payload = JSON.parse(dec.decode(fromBase64Url(data))) as StaffSessionPayload;
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
  reqOrCookieStore?: CookieReaderLike
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
  return await verifyStaffSessionToken(token);
}

/**
 * Attaches the sv_staff_session HttpOnly cookie to a NextResponse or standard Response.
 */
export async function attachStaffSessionCookie(
  res: NextResponse | Response,
  user: { id: string; email: string; full_name?: string }
): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const payload: StaffSessionPayload = {
    id: user.id,
    email: user.email,
    full_name: user.full_name || user.email.split('@')[0],
    exp,
  };
  const token = await signStaffSessionToken(payload);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  };

  const cookieTarget = res as NextResponse & CookieWritableResponse;
  if (res instanceof NextResponse || typeof cookieTarget.cookies?.set === 'function') {
    cookieTarget.cookies?.set(STAFF_SESSION_COOKIE, token, cookieOptions);
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
  const cookieTarget = res as NextResponse & CookieWritableResponse;
  if (res instanceof NextResponse || typeof cookieTarget.cookies?.set === 'function') {
    cookieTarget.cookies?.set(STAFF_SESSION_COOKIE, '', {
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
