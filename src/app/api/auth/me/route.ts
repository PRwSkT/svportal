import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isSystemAdmin } from '@/lib/constants/auth';
import { AppUser } from '@/types';

export const dynamic = 'force-dynamic';

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
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
      const adminClient = getServiceRoleClient();
      if (adminClient) {
        const { data: adminData } = await adminClient
          .from('app_users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (adminData) {
          appUser = adminData as AppUser;
        }
      }
    }

    // 3. If user is in auth.users but has no app_users row yet (e.g. fresh Google login)
    if (!appUser && user.email) {
      const adminClient = getServiceRoleClient();
      if (adminClient) {
        const newFullName = user.user_metadata?.full_name || user.email.split('@')[0];
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
              'qr_generator', 'settings', 'academic_todo'
            ] : []
          })
          .select()
          .single();
        if (insertedData) {
          appUser = insertedData as AppUser;
        }
      }
    }

    const role = isSysAdmin ? 'admin' : (appUser?.role || 'staff');

    return NextResponse.json({
      user,
      appUser,
      role,
      isSystemAdmin: isSysAdmin
    });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
