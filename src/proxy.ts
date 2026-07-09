import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
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
      // Allow logged-in users to access login page if their domain is wrong, so they can sign out or switch accounts.
      if (user.email?.endsWith('@somkidvittaya.ac.th') || user.email === 'admin@svportal.com') {
        let { data: role } = await supabase.rpc('get_user_role');
        if (user.email === 'admin@svportal.com') role = 'admin';
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    return response;
  }

  // Bypass auth for post-assistant, auth callbacks, and any public html files
  if (
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.endsWith('.html') ||
    request.nextUrl.pathname.includes('post-assistant')
  ) {
    return response;
  }

  // Handle protected routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Enforce Domain Restriction
  if (!user.email?.endsWith('@somkidvittaya.ac.th') && user.email !== 'admin@svportal.com') {
    // If they bypass Google's hosted domain prompt, middleware will catch them
    // and send them back to login with an error query param
    return NextResponse.redirect(new URL('/login?error=Invalid_Domain', request.url));
  }

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname === '/dashboard') {
    let { data: role, error } = await supabase.rpc('get_user_role');
    
    // HARDCODE FALLBACK FOR SYSTEM ADMIN
    if (user?.email === 'admin@svportal.com') {
      role = 'admin';
      error = null;
    }

    if (error || role !== 'admin') {
      const debugUrl = new URL('/pos/shop', request.url);
      debugUrl.searchParams.set('debug_err', error ? error.message : 'none');
      debugUrl.searchParams.set('debug_role', String(role));
      return NextResponse.redirect(debugUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|html|ttf|woff|woff2)$).*)',
  ],
};
