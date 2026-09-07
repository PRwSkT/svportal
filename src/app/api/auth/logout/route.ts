import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  allCookies.forEach(cookie => {
    if (cookie.name.includes('supabase') || cookie.name.startsWith('sb-')) {
      try {
        cookieStore.delete(cookie.name);
      } catch (e) {
        // ignore
      }
    }
  });

  const response = NextResponse.redirect(new URL('/login?logout=true', request.url));
  
  allCookies.forEach(cookie => {
    if (cookie.name.includes('supabase') || cookie.name.startsWith('sb-')) {
      try {
        response.cookies.delete(cookie.name);
      } catch (e) {
        // ignore
      }
    }
  });

  return response;
}
