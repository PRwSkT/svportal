import { createClient } from './supabase/server';

export async function getServerUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getUserRole(): Promise<'admin' | 'cashier' | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_user_role');
  if (error || !data) return null;
  return data as 'admin' | 'cashier';
}
