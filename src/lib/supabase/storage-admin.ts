import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a direct Supabase Storage-capable admin client using SUPABASE_SERVICE_ROLE_KEY.
 * Always targets Supabase Storage directly regardless of DB_PROVIDER, because
 * NetlifyBlobStorageAdapter does not implement createSignedUploadUrl().
 */
export function getSupabaseStorageAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase Storage configuration missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabasePublicObjectUrl(bucket: string, storagePath: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  const cleanPath = storagePath.replace(/^\/+/, '');
  return `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}
