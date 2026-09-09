import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSystemAdmin } from '@/lib/constants/auth';

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic' https:;
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' blob: data: https:;
    font-src 'self' data: https:;
    connect-src 'self' https: wss:;
    frame-src 'self' https:;
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Content-Security-Policy', cspHeader);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(
    url,
    anonKey,
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

  function redirectWithCookies(targetUrl: URL): NextResponse {
    const redirectResponse = NextResponse.redirect(targetUrl);
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  // DEV MODE BYPASS
  if (process.env.NODE_ENV === 'development') {
    return response;
  }

  // This will refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // Handle public route
  if (request.nextUrl.pathname.startsWith('/login')) {
    if (request.nextUrl.searchParams.get('logout') === 'true') {
      return response;
    }
    if (user) {
      // Allow logged-in users to access login page if their domain is wrong, so they can sign out or switch accounts.
      if (user.email?.endsWith('@somkidvittaya.ac.th') || isSystemAdmin(user.email)) {
        return redirectWithCookies(new URL('/home', request.url));
      }
    }
    return response;
  }

  // Bypass auth for the root page (welcome menu), public website, webhooks/cron, auth callbacks
  if (
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/website') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/api/auth/logout') ||
    request.nextUrl.pathname.startsWith('/api/cron') ||
    request.nextUrl.pathname.startsWith('/api/webhook') ||
    (request.nextUrl.pathname.endsWith('.html') && !request.nextUrl.pathname.includes('audio-remote.html')) ||
    request.nextUrl.pathname.includes('post-assistant') ||
    request.nextUrl.pathname.startsWith('/qr-generator')
  ) {
    return response;
  }

  // Handle protected routes
  if (!user) {
    return redirectWithCookies(new URL('/login', request.url));
  }

  // Enforce Domain Restriction
  if (!user.email?.endsWith('@somkidvittaya.ac.th') && !isSystemAdmin(user.email)) {
    // If they bypass Google's hosted domain prompt, middleware will catch them
    // and send them back to login with an error query param
    return redirectWithCookies(new URL('/login?error=Invalid_Domain', request.url));
  }

  // Protect admin and assigned-feature routes
  if (
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname === '/dashboard' ||
    request.nextUrl.pathname.startsWith('/api/admin')
  ) {
    if (isSystemAdmin(user?.email)) {
      return response;
    }

    // Retrieve user record from app_users
    const { data: appUserData } = await supabase.rpc('get_app_user_by_id', {
      target_user_id: user.id,
    });

    const userRole = appUserData?.role;
    if (userRole === 'admin') {
      return response;
    }

    const assignedFeatures: string[] = appUserData?.assigned_features || [];
    const path = request.nextUrl.pathname;
    let requiredFeature: string | null = null;

    if (path === '/dashboard' || path.startsWith('/api/admin/dashboard')) {
      requiredFeature = 'dashboard';
    } else if (path.startsWith('/admin/students') || path.startsWith('/api/admin/students')) {
      requiredFeature = 'admin_students';
    } else if (path.startsWith('/admin/reports') || path.startsWith('/api/admin/reports')) {
      requiredFeature = 'admin_reports';
    } else if (path.startsWith('/admin/products') || path.startsWith('/api/admin/products')) {
      requiredFeature = 'admin_products';
    } else if (path.startsWith('/admin/wallet') || path.startsWith('/api/admin/wallet')) {
      requiredFeature = 'admin_wallet_students';
    } else if (path.startsWith('/admin/website') || path.startsWith('/api/admin/website')) {
      requiredFeature = 'admin_website';
    } else if (path.startsWith('/admin/attendance') || path.startsWith('/api/admin/attendance')) {
      requiredFeature = 'admin_attendance';
    } else if (path.startsWith('/admin/fees') || path.startsWith('/api/admin/fees')) {
      if (assignedFeatures.includes('pos_fees') || assignedFeatures.includes('admin_reports')) {
        return response;
      }
      requiredFeature = 'pos_fees';
    } else if (path.startsWith('/admin/users') || path.startsWith('/api/admin/users')) {
      requiredFeature = 'admin_users';
    }

    if (requiredFeature && assignedFeatures.includes(requiredFeature)) {
      return response;
    }

    // Unauthorized - redirect to /home or return 403 for API
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return redirectWithCookies(new URL('/home', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|html|ttf|woff|woff2)$).*)',
  ],
};
