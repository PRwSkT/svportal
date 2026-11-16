import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearStaffSessionCookie, STAFF_SESSION_COOKIE } from '@/lib/auth/staff-session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  allCookies.forEach(cookie => {
    if (
      cookie.name.includes('supabase') ||
      cookie.name.startsWith('sb-') ||
      cookie.name === STAFF_SESSION_COOKIE
    ) {
      try {
        cookieStore.delete(cookie.name);
      } catch (e) {
        // ignore
      }
    }
  });

  const response = NextResponse.redirect(new URL('/login?logout=true', request.url));
  
  allCookies.forEach(cookie => {
    if (
      cookie.name.includes('supabase') ||
      cookie.name.startsWith('sb-') ||
      cookie.name === STAFF_SESSION_COOKIE
    ) {
      try {
        response.cookies.delete(cookie.name);
      } catch (e) {
        // ignore
      }
    }
  });

  clearStaffSessionCookie(response);

  return response;
}
