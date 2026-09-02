import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Instantiation moved inside route handlers to avoid build errors when env vars are missing

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Try to attach email if possible
    try {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      if (authUsers && authUsers.users) {
        const emailMap = new Map(authUsers.users.map(u => [u.id, u.email]));
        data.forEach((user: any) => {
          user.auth_users = { email: emailMap.get(user.id) };
        });
      }
    } catch (e) {
      // Ignore if fail
    }
    
    return NextResponse.json({ users: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Check if the current user is an admin
    if (process.env.NODE_ENV !== 'development') {
      const supabase = await createClient();
      const { data: roleData, error: roleError } = await supabase.rpc('get_user_role');
      if (roleError || roleData !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const { email, password, full_name, role, assigned_features } = await request.json();

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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
        assigned_features: assigned_features || []
      });

      if (insertError) {
        // Rollback auth user creation
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
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

      const { data: roleData, error: roleError } = await supabase.rpc('get_user_role');
      if (roleError || roleData !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const { pathname } = new URL(request.url);
    // For PATCH /api/admin/users?id=xxx
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const { is_active, assigned_features } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    if (userId === user?.id && is_active !== undefined) {
        return NextResponse.json({ error: 'Cannot modify your own active status' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const updates: any = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (assigned_features !== undefined) updates.assigned_features = assigned_features;

    // Update app_users
    const { error: updateError } = await supabaseAdmin
        .from('app_users')
        .update(updates)
        .eq('id', userId);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Optionally ban the user in auth.users
    if (is_active === false) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }); // Ban for 100 years
    } else {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' }); // Unban
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
