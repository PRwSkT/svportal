import { createBrowserClient } from '@supabase/ssr';

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufsqavndpjphowuacxfi.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmc3Fhdm5kcGpwaG93dWFjeGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTM4NzgsImV4cCI6MjA5NjY4OTg3OH0.fpaVZY8i7YQLRewcv3cuEZR_P9wNz1rWs5Q1UOk3Hz0'
    );
  }
  return supabaseClient;
}
