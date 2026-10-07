import { createClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase client with admin (service_role) privileges.
 * Strictly used in server-side API routes and Server Actions.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role key is not configured in server environment');
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
