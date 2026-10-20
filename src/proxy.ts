import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSystemAdmin } from '@/lib/constants/auth';

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https: blob: data:;
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' blob: data: https:;
    font-src 'self' data: https:;
    connect-src 'self' https: wss:;
    frame-src 'self' https:;
    worker-src 'self' blob:;
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
            request: {
              headers: requestHeaders,
            },
          });
          response.headers.set('Content-Security-Policy', cspHeader);
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

  // This will refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // Host-based routing for Parents Portal subdomain (parents.portal.somkidvittaya.ac.th)
  const hostname = (request.headers.get('host') || '').toLowerCase();
  const isParentsSubdomain = hostname.startsWith('parents.portal.');

  if (isParentsSubdomain) {
    if (request.nextUrl.pathname === '/manifest.json') {
      const urlClone = request.nextUrl.clone();
      urlClone.pathname = '/parents-manifest.json';
      return NextResponse.rewrite(urlClone, { request: { headers: requestHeaders } });
    }
    if (
      !request.nextUrl.pathname.startsWith('/parents') &&
      !request.nextUrl.pathname.startsWith('/api/') &&
      !request.nextUrl.pathname.startsWith('/_next') &&
      request.nextUrl.pathname !== '/sw.js' &&
      request.nextUrl.pathname !== '/parents-manifest.json'
    ) {
      const urlClone = request.nextUrl.clone();
      urlClone.pathname = `/parents${request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname}`;
      return NextResponse.rewrite(urlClone, { request: { headers: requestHeaders } });
    }
  }

  // Handle public route (root welcome page & login)
  if (request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/login')) {
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

  // Redirect legacy /website routes to the official school website to prevent confusion
  if (request.nextUrl.pathname.startsWith('/website')) {
    return NextResponse.redirect('https://somkidvittaya.ac.th', { status: 307 });
  }

  // Bypass auth for forms, webhooks/cron, auth callbacks, PWA sw & subscribe, and Parents Portal PWA routes
  if (
    request.nextUrl.pathname === '/sw.js' ||
    request.nextUrl.pathname === '/manifest.json' ||
    request.nextUrl.pathname === '/parents-manifest.json' ||
    request.nextUrl.pathname.startsWith('/parents') ||
    request.nextUrl.pathname.startsWith('/api/parents') ||
    request.nextUrl.pathname.startsWith('/api/pipeline') ||
    request.nextUrl.pathname.startsWith('/forms') ||
    request.nextUrl.pathname.startsWith('/api/forms') ||
    request.nextUrl.pathname.startsWith('/api/notifications/subscribe') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/api/auth') ||
    request.nextUrl.pathname.startsWith('/api/cron') ||
    request.nextUrl.pathname.startsWith('/api/webhook') ||
    request.nextUrl.pathname.startsWith('/post-assistant') ||
    request.nextUrl.pathname === '/api/admin/website/sync-post'
  ) {
    return response;
  }

  // Bypass auth and CSP for QR Generator
  if (request.nextUrl.pathname.startsWith('/qr-generator')) {
    response.headers.delete('Content-Security-Policy');
    return response;
  }

  // Bypass auth for screenshot preview when SV_PREVIEW_MODE is enabled
  if (process.env.SV_PREVIEW_MODE === 'true') {
    return response;
  }

  // Handle protected routes
  if (!user) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return redirectWithCookies(new URL('/login', request.url));
  }

  // Enforce Domain Restriction
  if (!user.email?.endsWith('@somkidvittaya.ac.th') && !isSystemAdmin(user.email)) {
    // If they bypass Google's hosted domain prompt, middleware will catch them
    // and send them back to login with an error query param
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 403 });
    }
    return redirectWithCookies(new URL('/login?error=Invalid_Domain', request.url));
  }

  // Protect admin, POS, and assigned-feature routes
  if (
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname === '/dashboard' ||
    request.nextUrl.pathname.startsWith('/api/admin') ||
    request.nextUrl.pathname.startsWith('/pos') ||
    request.nextUrl.pathname.startsWith('/api/pos') ||
    request.nextUrl.pathname.startsWith('/audio-remote')
  ) {
    if (isSystemAdmin(user?.email)) {
      return response;
    }

    // Retrieve user record from app_users
    const { data: appUserData } = await supabase.rpc('get_app_user_by_id', {
      target_user_id: user.id,
    });

    const userRole = appUserData?.role;
    // Admins and Executives have full access
    if (userRole === 'admin' || userRole === 'executive') {
      return response;
    }

    const assignedFeatures: string[] = appUserData?.assigned_features || [];
    const path = request.nextUrl.pathname;
    let requiredFeature: string | null = null;

    if (path === '/dashboard' || path.startsWith('/api/admin/dashboard')) {
      requiredFeature = 'dashboard';
    } else if (path.startsWith('/admin/students/pastoral')) {
      if (userRole === 'teacher' || userRole === 'academic staff' || assignedFeatures.includes('pastoral_care') || assignedFeatures.includes('admin_students')) {
        return response;
      }
      requiredFeature = 'pastoral_care';
    } else if (path.startsWith('/admin/students/nutrition') || path.startsWith('/api/admin/nutrition')) {
      if (userRole === 'teacher' || userRole === 'academic staff' || assignedFeatures.includes('student_nutrition') || assignedFeatures.includes('pastoral_care') || assignedFeatures.includes('admin_students')) {
        return response;
      }
      requiredFeature = 'student_nutrition';
    } else if (path.startsWith('/admin/students/attendance')) {
      if (userRole === 'teacher' || userRole === 'academic staff' || assignedFeatures.includes('student_attendance') || assignedFeatures.includes('admin_students')) {
        return response;
      }
      requiredFeature = 'student_attendance';
    } else if (path.startsWith('/admin/safety/pickup')) {
      if (userRole === 'teacher' || userRole === 'staff' || userRole === 'driver' || assignedFeatures.includes('pickup_dismissal') || assignedFeatures.includes('van_safety')) {
        return response;
      }
      requiredFeature = 'pickup_dismissal';
    } else if (path.startsWith('/admin/communications')) {
      if (userRole === 'teacher' || userRole === 'academic staff' || assignedFeatures.includes('parent_communications')) {
        return response;
      }
      requiredFeature = 'parent_communications';
    } else if (path.startsWith('/admin/students') || path.startsWith('/api/admin/students')) {
      if (userRole === 'teacher' || userRole === 'academic staff') {
        return response;
      }
      requiredFeature = 'admin_students';
    } else if (path.startsWith('/admin/subsidy/free15y')) {
      if (userRole === 'teacher' || userRole === 'academic staff' || assignedFeatures.includes('subsidy_free15y') || assignedFeatures.includes('pos_fees') || assignedFeatures.includes('admin_students')) {
        return response;
      }
      requiredFeature = 'subsidy_free15y';
    } else if (path.startsWith('/admin/safety/van')) {
      if (userRole === 'teacher' || userRole === 'staff' || assignedFeatures.includes('van_safety')) {
        return response;
      }
      requiredFeature = 'van_safety';
    } else if (path.startsWith('/admin/health/infirmary')) {
      if (userRole === 'teacher' || userRole === 'staff' || assignedFeatures.includes('school_infirmary')) {
        return response;
      }
      requiredFeature = 'school_infirmary';
    } else if (path.startsWith('/admin/governance')) {
      requiredFeature = 'esar_governance';
    } else if (path.startsWith('/admin/academic')) {
      if (userRole === 'teacher' || userRole === 'academic staff' || assignedFeatures.includes('admin_academic') || assignedFeatures.includes('academic_hub')) {
        return response;
      }
      requiredFeature = 'admin_academic';
    } else if (path.startsWith('/admin/notifications') || path.startsWith('/api/admin/notifications')) {
      requiredFeature = 'admin_notifications';
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
    } else if (path.startsWith('/admin/forms') || path.startsWith('/api/admin/forms')) {
      requiredFeature = 'admin_forms';
    } else if (path.startsWith('/admin/kpi') || path.startsWith('/api/admin/kpi')) {
      if (userRole === 'teacher' || userRole === 'staff' || assignedFeatures.includes('admin_kpi')) {
        return response;
      }
      requiredFeature = 'admin_kpi';
    } else if (path.startsWith('/audio-remote')) {
      requiredFeature = 'audio_remote';
    } else if (path.startsWith('/pos/fees') || path.startsWith('/api/pos/fees')) {
      if (userRole === 'cashier' || assignedFeatures.includes('pos_fees')) {
        return response;
      }
      requiredFeature = 'pos_fees';
    } else if (path.startsWith('/pos/shop') || path.startsWith('/api/pos/checkout') || path.startsWith('/api/pos/products')) {
      if (userRole === 'cashier' || assignedFeatures.includes('pos_shop')) {
        return response;
      }
      requiredFeature = 'pos_shop';
    } else if (path.startsWith('/pos/wallet') || path.startsWith('/api/pos/wallet')) {
      if (userRole === 'cashier' || assignedFeatures.includes('pos_wallet_topup')) {
        return response;
      }
      requiredFeature = 'pos_wallet_topup';
    } else if (path.startsWith('/pos')) {
      if (userRole === 'cashier' || assignedFeatures.some(f => f.startsWith('pos_'))) {
        return response;
      }
      requiredFeature = 'pos_shop';
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ttf|woff|woff2)$).*)',
  ],
};
