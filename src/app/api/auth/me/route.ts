import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js';
import { isSystemAdmin } from '@/lib/constants/auth';
import { AppUser } from '@/types';
import { isNetlifyDbActive } from '@/lib/db/netlify-bridge';
import { createPgPostgrestClient } from '@/lib/db/pg-postgrest-adapter';
import { getStaffSessionFromCookies } from '@/lib/auth/staff-session';

export const dynamic = 'force-dynamic';

function getServiceRoleClient(): SupabaseClient {
  if (isNetlifyDbActive()) {
    return createPgPostgrestClient() as unknown as SupabaseClient;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase service role configuration');
  }
  return createAdminClient(url, key);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser();
    let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = sbUser
      ? {
          id: sbUser.id,
          email: sbUser.email,
          user_metadata: sbUser.user_metadata as Record<string, unknown>,
        }
      : null;
    let userError = sbError;

    if (!user) {
      const session = await getStaffSessionFromCookies();
      if (session) {
        user = {
          id: session.id,
          email: session.email,
          user_metadata: { full_name: session.full_name },
        };
        userError = null;
      }
    }

    if (userError || !user) {
      if (process.env.NODE_ENV === 'development' && process.env.SV_PREVIEW_MODE === 'true') {
        const mockUser = {
          id: '47d50deb-be67-4a2b-8518-0d62a229f942',
          email: 'admin@somkidvittaya.ac.th',
          user_metadata: { full_name: 'อาจารย์ผู้ดูแลระบบ (SV Admin)' }
        };
        return NextResponse.json({
          user: mockUser,
          appUser: {
            id: mockUser.id,
            full_name: 'อาจารย์ผู้ดูแลระบบ (SV Admin)',
            role: 'admin',
            is_active: true,
            assigned_features: [],
            created_at: new Date().toISOString()
          },
          role: 'admin',
          isSystemAdmin: true
        });
      }
      return NextResponse.json({ user: null, appUser: null, role: null }, { status: 401 });
    }

    const isSysAdmin = isSystemAdmin(user.email);

    // 1. Try to fetch user record using get_app_user_by_id RPC
    let appUser: AppUser | null = null;
    const { data: rpcData } = await supabase.rpc('get_app_user_by_id', {
      target_user_id: user.id
    });
    if (rpcData) {
      appUser = rpcData as AppUser;
    }

    // 2. Fallback: query with service role client to guarantee it never fails due to RLS
    if (!appUser) {
      try {
        const adminClient = getServiceRoleClient();
        const { data: adminData } = await adminClient
          .from('app_users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (adminData) {
          appUser = adminData as AppUser;
        }
      } catch {
        // ignore missing admin client
      }
    }

    // 3. If user is in auth.users but has no app_users row yet (e.g. fresh Google login)
    if (!appUser && user.email) {
      try {
        const adminClient = getServiceRoleClient();
        const rawFullName = user.user_metadata?.full_name;
        const newFullName = (typeof rawFullName === 'string' && rawFullName) || user.email.split('@')[0];
        const newRole = isSysAdmin ? 'admin' : 'teacher';
        const { data: insertedData } = await adminClient
          .from('app_users')
          .insert({
            id: user.id,
            full_name: newFullName,
            role: newRole,
            is_active: true,
            assigned_features: isSysAdmin ? [
              'dashboard', 'pos_fees', 'admin_reports', 'pos_shop', 'admin_products', 
              'pos_wallet_topup', 'admin_wallet_students', 'admin_students', 'admin_users', 
              'admin_attendance', 'admin_website', 'post_assistant', 'audio_remote', 
              'qr_generator', 'settings', 
              'academic_hub', 'academic_gradebook', 'academic_early_years', 
              'academic_exams', 'academic_timetable', 'academic_opec', 'admin_academic'
            ] : []
          })
          .select()
          .single();
        if (insertedData) {
          appUser = insertedData as AppUser;
        }
      } catch {
        // ignore missing admin client
      }
    }

    const role = isSysAdmin ? 'admin' : (appUser?.role || 'staff');

    return NextResponse.json({
      user,
      appUser,
      role,
      isSystemAdmin: isSysAdmin
    });
  } catch (err: unknown) {
    console.error('Error in /api/auth/me:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
