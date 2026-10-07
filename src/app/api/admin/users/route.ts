import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

import { isSystemAdmin } from '@/lib/constants/auth';
import { requireAuth } from '@/lib/auth';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase Service Role configuration');
  }
  return createSupabaseClient(url, key);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSystemAdmin(user.email)) {
      const { data: role, error: roleError } = await supabase.rpc('get_user_role');
      if (roleError || role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Try to attach email if possible
    let emailMap = new Map<string, string>();
    try {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      if (authUsers && authUsers.users) {
        emailMap = new Map(authUsers.users.map(u => [u.id, u.email || '']));
        data.forEach((user: any) => {
          user.auth_users = { email: emailMap.get(user.id) };
        });
      }
    } catch (e) {
      // Ignore if fail
    }

    // Attach linked personnel profile
    let allPersonnel: any[] = [];
    try {
      const { data: personnelList } = await supabaseAdmin
        .from('personnel')
        .select('*')
        .order('sort_order', { ascending: true });

      if (personnelList && personnelList.length > 0) {
        allPersonnel = personnelList;
        const pById = new Map(personnelList.map(p => [p.id, p]));
        const pByUserId = new Map(personnelList.filter(p => p.user_id).map(p => [p.user_id, p]));
        const pByEmail = new Map(personnelList.filter(p => p.email).map(p => [(p.email || '').toLowerCase(), p]));

        data.forEach((user: any) => {
          const userEmail = (user.auth_users?.email || '').toLowerCase();
          const matchedP = (user.personnel_id && pById.get(user.personnel_id))
            || pByUserId.get(user.id)
            || (userEmail && pByEmail.get(userEmail))
            || null;

          user.personnel = matchedP;
          if (matchedP && !user.personnel_id) {
            user.personnel_id = matchedP.id;
          }
        });
      }
    } catch (e) {
      // Ignore if fail
    }
    
    return NextResponse.json({ users: data, all_personnel: allPersonnel });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Check if the current user is an admin
    if (process.env.NODE_ENV !== 'development') {
      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      const adminEmails = [
        'admin@somkidvittaya.ac.th',
        'peerawat@somkidvittaya.ac.th',
        'media@somkidvittaya.ac.th',
        'admin@svportal.com'
      ];
      const isHardcodedAdmin = user?.email && adminEmails.includes(user.email);
      if (!isHardcodedAdmin) {
        const { data: roleData, error: roleError } = await supabase.rpc('get_user_role');
        if (roleError || roleData !== 'admin') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
      }
    }

    const { email, password, full_name, role, assigned_features, personnel_id } = await request.json();

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // 1. Create the user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Insert into app_users
    if (authData.user) {
      const { error: insertError } = await supabaseAdmin.from('app_users').insert({
        id: authData.user.id,
        full_name,
        role,
        is_active: true,
        assigned_features: assigned_features || [],
        personnel_id: personnel_id || null
      });

      if (insertError) {
        // Rollback auth user creation
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json({ error: 'Failed to create user record: ' + insertError.message }, { status: 500 });
      }

      // If personnel_id was selected, link personnel record
      if (personnel_id) {
        await supabaseAdmin.from('personnel').update({
          user_id: authData.user.id,
          email: email
        }).eq('id', personnel_id);
      }
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    let user = null;
    
    // Check if the current user is an admin
    if (process.env.NODE_ENV !== 'development') {
      const supabase = await createClient();
      const { data: authData, error: userError } = await supabase.auth.getUser();
      user = authData?.user;
      
      if (userError || !user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const adminEmails = [
        'admin@somkidvittaya.ac.th',
        'peerawat@somkidvittaya.ac.th',
        'media@somkidvittaya.ac.th',
        'admin@svportal.com'
      ];
      const isHardcodedAdmin = user?.email && adminEmails.includes(user.email);
      if (!isHardcodedAdmin) {
        const { data: roleData, error: roleError } = await supabase.rpc('get_user_role');
        if (roleError || roleData !== 'admin') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
      }
    }

    const { pathname } = new URL(request.url);
    // For PATCH /api/admin/users?id=xxx
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const { is_active, assigned_features, role, full_name, personnel_id } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    if (userId === user?.id && is_active !== undefined) {
        return NextResponse.json({ error: 'Cannot modify your own active status' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    const updates: any = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (assigned_features !== undefined) updates.assigned_features = assigned_features;
    if (role !== undefined) updates.role = role;
    if (full_name !== undefined) updates.full_name = full_name;
    if (personnel_id !== undefined) updates.personnel_id = personnel_id || null;

    // Update app_users
    const { error: updateError } = await supabaseAdmin
        .from('app_users')
        .update(updates)
        .eq('id', userId);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Handle personnel linkage synchronization
    if (personnel_id !== undefined) {
      if (personnel_id) {
        // Link target personnel to this user
        await supabaseAdmin.from('personnel').update({ user_id: userId }).eq('id', personnel_id);
      } else {
        // Unlink any personnel tied to this user
        await supabaseAdmin.from('personnel').update({ user_id: null }).eq('user_id', userId);
      }
    }

    // Optionally ban or unban the user in auth.users only when is_active is explicitly provided
    if (is_active === false) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }); // Ban for 100 years
    } else if (is_active === true) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' }); // Unban
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 1-Click Sync Endpoint to re-verify and auto-link all personnel with auth users
export async function PUT() {
  try {
    const auth = await requireAuth('admin', 'admin_users');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getAdminClient();

    const { data: personnelList, error: pErr } = await supabaseAdmin.from('personnel').select('*');
    if (pErr) throw pErr;

    const { data: { users: authUsers }, error: aErr } = await supabaseAdmin.auth.admin.listUsers();
    if (aErr) throw aErr;

    let linkedCount = 0;

    for (const p of (personnelList || [])) {
      if (!p.email) continue;
      const targetEmail = p.email.toLowerCase().trim();
      const matchedAuth = authUsers.find(u => (u.email || '').toLowerCase().trim() === targetEmail);

      if (matchedAuth) {
        // Update personnel user_id
        if (p.user_id !== matchedAuth.id) {
          await supabaseAdmin.from('personnel').update({ user_id: matchedAuth.id }).eq('id', p.id);
        }
        // Update app_users
        await supabaseAdmin.from('app_users').update({
          personnel_id: p.id,
          full_name: p.name_th
        }).eq('id', matchedAuth.id);

        linkedCount++;
      }
    }

    return NextResponse.json({ success: true, count: linkedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
