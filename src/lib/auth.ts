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

export async function requireAuth(requiredRole?: 'admin' | 'cashier') {
  const user = await getServerUser();
  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  // Hardcode fallback for admin
  if (user.email === 'admin@svportal.com') {
    if (requiredRole && requiredRole !== 'admin') {
      // Actually admin can do everything
    }
    return { user, role: 'admin', error: null };
  }

  const role = await getUserRole();
  if (requiredRole && role !== requiredRole) {
    return { error: 'Forbidden', status: 403 };
  }

  return { user, role, error: null };
}
