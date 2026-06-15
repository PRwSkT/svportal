import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Create a supabase admin client with the service role key
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    // Check if the current user is an admin
    const supabase = await createClient();
    const { data: roleData, error: roleError } = await supabase.rpc('get_user_role');
    if (roleError || roleData !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { email, password, full_name, role } = await request.json();

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 });
    }

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
        is_active: true
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
    // Check if the current user is an admin
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: roleData, error: roleError } = await supabase.rpc('get_user_role');
    if (roleError || roleData !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { pathname } = new URL(request.url);
    // For PATCH /api/admin/users?id=xxx
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const { is_active } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    if (userId === user.id) {
        return NextResponse.json({ error: 'Cannot modify your own active status' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 });
    }

    // Update app_users
    const { error: updateError } = await supabaseAdmin
        .from('app_users')
        .update({ is_active })
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
