import { createBrowserClient } from '@supabase/ssr';

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('Missing Supabase client environment variables');
    }
    supabaseClient = createBrowserClient(url, anonKey);
  }
  return supabaseClient;
}
