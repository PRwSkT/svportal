import { createClient } from './supabase/server';
import { isSystemAdmin } from './constants/auth';
import { AppUser } from '@/types';

export async function getServerUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getUserRole(): Promise<'admin' | 'cashier' | string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_user_role');
  if (error || !data) return null;
  return data as string;
}

export async function requireAuth(requiredRole?: 'admin' | 'cashier' | string, requiredFeature?: string) {
  const user = await getServerUser();
  if (!user) {
    return { error: 'Unauthorized', status: 401, user: null, role: null, appUser: null };
  }

  // Fallback for system administrators
  if (isSystemAdmin(user.email)) {
    return { user, role: 'admin' as const, appUser: null, error: null };
  }

  const supabase = await createClient();
  const { data: appUser } = await supabase.rpc('get_app_user_by_id', { target_user_id: user.id });
  
  const role = (appUser?.role || (await getUserRole())) as string;
  const assignedFeatures: string[] = (appUser?.assigned_features as string[]) || [];

  // Admin has full access to all features
  if (role === 'admin') {
    return { user, role, appUser: appUser as AppUser | null, error: null };
  }

  // If a specific feature is required and the user has it assigned, grant access
  if (requiredFeature && assignedFeatures.includes(requiredFeature)) {
    return { user, role, appUser: appUser as AppUser | null, error: null };
  }

  // If a required role is specified and does not match
  if (requiredRole && role !== requiredRole) {
    return { error: 'Forbidden', status: 403, user, role, appUser: appUser as AppUser | null };
  }

  return { user, role, appUser: appUser as AppUser | null, error: null };
}
