import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This will refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // Handle public route
  if (request.nextUrl.pathname.startsWith('/login')) {
    if (user) {
      const { data: role } = await supabase.rpc('get_user_role');
      return NextResponse.redirect(new URL(role === 'admin' ? '/dashboard' : '/pos/shop', request.url));
    }
    return response;
  }

  // Bypass auth for post-assistant and any public html files
  if (request.nextUrl.pathname.endsWith('.html')) {
    return response;
  }

  // Handle protected routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname === '/dashboard') {
    const { data: role, error } = await supabase.rpc('get_user_role');
    if (error || role !== 'admin') {
      return NextResponse.redirect(new URL('/pos/shop', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
