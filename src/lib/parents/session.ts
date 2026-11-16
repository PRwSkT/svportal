import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const PARENT_COOKIE_NAME = 'sv_parent_session_guardian_id';
export const LEGACY_PARENT_COOKIE_NAME = 'sv_parent_session';

function getSessionSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXTAUTH_SECRET || 'svportal-parent-session-hmac-secret-salt';
  return secret;
}

/**
 * Creates an HMAC-SHA256 signature for a given payload string.
 */
function createSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Signs a guardian ID into a cryptographically tamper-proof session token.
 * Format: guardianId.timestamp.signature
 */
export function signParentSessionToken(guardianId: string): string {
  if (!guardianId) return '';
  const timestamp = Date.now().toString();
  const secret = getSessionSecret();
  const payload = `${guardianId}.${timestamp}`;
  const signature = createSignature(payload, secret);
  return `${payload}.${signature}`;
}

/**
 * Verifies a parent session token using timing-safe comparison.
 * Returns the authenticated guardian ID if valid, or null if tampered/invalid.
 */
export function verifyParentSessionToken(token?: string | null): string | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  const secret = getSessionSecret();

  // New format: guardianId.timestamp.signature
  if (parts.length === 3) {
    const [guardianId, timestamp, signature] = parts;
    const payload = `${guardianId}.${timestamp}`;
    const expectedSignature = createSignature(payload, secret);

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      // 30-day token lifetime validity
      const age = Date.now() - parseInt(timestamp, 10);
      if (age >= 0 && age < 30 * 24 * 60 * 60 * 1000) {
        return guardianId;
      }
    }
    return null;
  }

  // 2-part format fallback: guardianId.signature
  if (parts.length === 2) {
    const [guardianId, signature] = parts;
    const expectedSignature = createSignature(guardianId, secret);

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return guardianId;
    }
    return null;
  }

  return null;
}

/**
 * Extracts and cryptographically verifies the guardian ID from request cookies or Authorization header.
 * Explicitly ignores untrusted client headers (e.g. x-guardian-id).
 */
export function getAuthenticatedGuardianId(request: NextRequest): string | null {
  // 1. Check signed cookie
  const cookieVal = request.cookies.get(PARENT_COOKIE_NAME)?.value;
  if (cookieVal) {
    const verifiedId = verifyParentSessionToken(cookieVal);
    if (verifiedId) return verifiedId;
  }

  // 2. Check Authorization header (Bearer <signed_token>)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    const verifiedBearer = verifyParentSessionToken(bearerToken);
    if (verifiedBearer) return verifiedBearer;
  }

  return null;
}

/**
 * Attaches verified HMAC signed session cookies to the response.
 */
export function attachParentSessionCookies(
  response: NextResponse,
  guardianId: string,
  metadata?: Record<string, unknown>
): void {
  const token = signParentSessionToken(guardianId);
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 30 * 24 * 60 * 60; // 30 days

  response.cookies.set(PARENT_COOKIE_NAME, token, {
    path: '/',
    maxAge,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  });

  // Client-readable metadata cookie
  response.cookies.set(
    LEGACY_PARENT_COOKIE_NAME,
    JSON.stringify({
      guardianId,
      ...(metadata || {}),
    }),
    {
      path: '/',
      maxAge,
      httpOnly: false,
      sameSite: 'lax',
      secure: isProd,
    }
  );
}

/**
 * Clears parent session cookies on sign out.
 */
export function clearParentSessionCookies(response: NextResponse): void {
  response.cookies.set(PARENT_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(LEGACY_PARENT_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
  });
}
