import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/server';
import { getAdminClient } from './supabase/admin';
import { isSystemAdmin } from './constants/auth';
import { AppUser } from '@/types';
import { getStaffSessionFromCookies } from './auth/staff-session';

export interface ServerAuthUser {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; [key: string]: unknown };
  app_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
}

export const MOCK_PREVIEW_USER: ServerAuthUser = {
  id: '47d50deb-be67-4a2b-8518-0d62a229f942',
  email: 'admin@somkidvittaya.ac.th',
  user_metadata: { full_name: 'อาจารย์ผู้ดูแลระบบ (SV Admin)' }
};

function toServerAuthUser(u: User): ServerAuthUser {
  return {
    id: u.id,
    email: u.email,
    user_metadata: (u.user_metadata as ServerAuthUser['user_metadata']) || {},
    app_metadata: (u.app_metadata as Record<string, unknown>) || {},
    aud: u.aud,
    created_at: u.created_at,
  };
}

export async function getServerUser(): Promise<ServerAuthUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return toServerAuthUser(user);
    }
  } catch {
    // Ignore cookie read error and check staff session fallback
  }

  try {
    const session = await getStaffSessionFromCookies();
    if (session) {
      return {
        id: session.id,
        email: session.email,
        user_metadata: { full_name: session.full_name },
        app_metadata: {},
        aud: 'authenticated',
        created_at: '',
      };
    }
  } catch {
    // ignore
  }

  if (process.env.NODE_ENV === 'development' && process.env.SV_PREVIEW_MODE === 'true') {
    return MOCK_PREVIEW_USER;
  }

  return null;
}

/**
 * Returns the authenticated user strictly from session cookies.
 * NEVER falls back to MOCK_PREVIEW_USER.
 * Essential for public forms, guest submissions, and any flow where visitors must not inherit mock admin identity.
 */
export async function getRealAuthUser(): Promise<ServerAuthUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return toServerAuthUser(user);
    }
  } catch {
    // Ignore cookie read error
  }

  try {
    const session = await getStaffSessionFromCookies();
    if (session) {
      return {
        id: session.id,
        email: session.email,
        user_metadata: { full_name: session.full_name },
        app_metadata: {},
        aud: 'authenticated',
        created_at: '',
      };
    }
  } catch {
    // ignore
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

  if (process.env.NODE_ENV === 'development' && process.env.SV_PREVIEW_MODE === 'true') {
    return 'admin';
  }

  return null;
}

export async function requireAuth(
  requiredRole?: 'admin' | 'cashier' | string,
  requiredFeature?: string | string[]
) {
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
  const { data: rpcAppUser } = await supabase.rpc('get_app_user_by_id', { target_user_id: user.id });
  let appUser = rpcAppUser as AppUser | null;

  // Fallback for sv_staff_session-authenticated users who do not carry a Supabase JWT cookie
  if (!appUser) {
    try {
      const adminClient = getAdminClient();
      const { data: adminAppUser } = await adminClient
        .from('app_users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (adminAppUser) {
        appUser = adminAppUser as AppUser;
      }
    } catch {
      // Ignore admin fallback error
    }
  }

  // Enforce active staff check
  if (appUser && appUser.is_active === false) {
    return {
      error: 'Forbidden',
      status: 403,
      user,
      role: appUser.role || null,
      appUser,
    };
  }

  const role = (appUser?.role || (await getUserRole())) as string;
  const assignedFeatures: string[] = Array.isArray(appUser?.assigned_features)
    ? (appUser.assigned_features as string[])
    : [];

  // Admin and Executive have full access to all features
  if (role === 'admin' || role === 'executive') {
    return { user, role, appUser, error: null };
  }

  // If specific feature(s) are required and the user has any of them assigned, grant access
  if (requiredFeature) {
    const requiredList = Array.isArray(requiredFeature) ? requiredFeature : [requiredFeature];
    if (requiredList.some((feat) => assignedFeatures.includes(feat))) {
      return { user, role, appUser, error: null };
    }
  }

  // Role hierarchy matching
  if (requiredRole) {
    if (role === requiredRole) {
      return { user, role, appUser, error: null };
    }
    // Generic 'staff' requirement matches any school staff role
    if (requiredRole === 'staff' && ['teacher', 'academic staff', 'non-academic staff', 'cashier'].includes(role)) {
      return { user, role, appUser, error: null };
    }
    // 'teacher' requirement also allows academic staff
    if (requiredRole === 'teacher' && role === 'academic staff') {
      return { user, role, appUser, error: null };
    }
  }

  if (requiredRole || requiredFeature) {
    return { error: 'Forbidden', status: 403, user, role, appUser };
  }

  return { user, role, appUser, error: null };
}
