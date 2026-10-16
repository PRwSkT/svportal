import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing Supabase server environment variables');
  }

  const allCookies = cookieStore.getAll();
  const hasAuthCookie = allCookies.some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
  const isPreviewWithoutSession = process.env.SV_PREVIEW_MODE === 'true' && !hasAuthCookie;
  const effectiveKey = (isPreviewWithoutSession && process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : anonKey;

  return createServerClient(
    url,
    effectiveKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
