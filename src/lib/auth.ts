import { createClient } from './supabase/server';
import { isSystemAdmin } from './constants/auth';
import { AppUser } from '@/types';

export const MOCK_PREVIEW_USER = {
  id: '47d50deb-be67-4a2b-8518-0d62a229f942',
  email: 'admin@somkidvittaya.ac.th',
  user_metadata: { full_name: 'อาจารย์ผู้ดูแลระบบ (SV Admin)' }
};

export async function getServerUser() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return user;
    }
  } catch {
    // Ignore cookie read error and check preview mode fallback
  }

  if (process.env.SV_PREVIEW_MODE === 'true') {
    return MOCK_PREVIEW_USER as any;
  }

  return null;
}

export async function getUserRole(): Promise<'admin' | 'cashier' | string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_user_role');
    if (!error && data) return data as string;
  } catch {
    // Ignore RPC error and check preview mode fallback
  }

  if (process.env.SV_PREVIEW_MODE === 'true') {
    return 'admin';
  }

  return null;
}

export async function requireAuth(requiredRole?: 'admin' | 'cashier' | string, requiredFeature?: string) {
  const user = await getServerUser();
  if (!user) {
    return { error: 'Unauthorized', status: 401, user: null, role: null, appUser: null };
  }

  // Fallback for system administrators
  if (isSystemAdmin(user.email)) {
    const adminAppUser: AppUser = {
      id: user.id,
      full_name: user.user_metadata?.full_name || 'อาจารย์ผู้ดูแลระบบ (SV Admin)',
      role: 'admin',
      is_active: true,
      assigned_features: [],
      created_at: new Date().toISOString()
    };
    return { user, role: 'admin' as const, appUser: adminAppUser, error: null };
  }

  const supabase = await createClient();
  const { data: appUser } = await supabase.rpc('get_app_user_by_id', { target_user_id: user.id });
  
  const role = (appUser?.role || (await getUserRole())) as string;
  const assignedFeatures: string[] = (appUser?.assigned_features as string[]) || [];

  // Admin and Executive have full access to all features
  if (role === 'admin' || role === 'executive') {
    return { user, role, appUser: appUser as AppUser | null, error: null };
  }

  // If a specific feature is required and the user has it assigned, grant access
  if (requiredFeature && assignedFeatures.includes(requiredFeature)) {
    return { user, role, appUser: appUser as AppUser | null, error: null };
  }

  // Role hierarchy matching
  if (requiredRole) {
    if (role === requiredRole) {
      return { user, role, appUser: appUser as AppUser | null, error: null };
    }
    // Generic 'staff' requirement matches any school staff role
    if (requiredRole === 'staff' && ['teacher', 'academic staff', 'non-academic staff', 'cashier'].includes(role)) {
      return { user, role, appUser: appUser as AppUser | null, error: null };
    }
    // 'teacher' requirement also allows academic staff
    if (requiredRole === 'teacher' && role === 'academic staff') {
      return { user, role, appUser: appUser as AppUser | null, error: null };
    }
  }

  if (requiredRole || requiredFeature) {
    return { error: 'Forbidden', status: 403, user, role, appUser: appUser as AppUser | null };
  }

  return { user, role, appUser: appUser as AppUser | null, error: null };
}
