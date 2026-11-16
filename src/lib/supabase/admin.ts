import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { isNetlifyDbActive } from '@/lib/db/netlify-bridge';
import { createPgPostgrestClient } from '@/lib/db/pg-postgrest-adapter';

/**
 * Returns a Supabase client with admin (service_role) privileges.
 * Strictly used in server-side API routes and Server Actions.
 */
export function getAdminClient(): SupabaseClient<any, 'public', any> {
  if (isNetlifyDbActive()) {
    return createPgPostgrestClient() as any;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role key is not configured in server environment');
  }
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const getSupabaseAdmin = getAdminClient;
