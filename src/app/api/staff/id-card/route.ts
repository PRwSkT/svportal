import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRealAuthUser } from '@/lib/auth';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const authUser = await getRealAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetPersonnelId = searchParams.get('id');

    const supabase = getAdminClient();

    // If an ID is provided, fetch by ID
    if (targetPersonnelId) {
      const { data, error } = await supabase
        .from('personnel')
        .select('*')
        .eq('id', targetPersonnelId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Personnel not found' }, { status: 404 });
      }

      return NextResponse.json({ personnel: data });
    }

    // Otherwise, match the current logged-in user to their personnel record
    const userEmail = (authUser.email || '').toLowerCase();

    // 1. Check if user has an app_user record with personnel_id
    const { data: appUserData } = await supabase
      .from('app_users')
      .select('personnel_id, full_name, role')
      .eq('id', authUser.id)
      .single();

    if (appUserData?.personnel_id) {
      const { data: pById } = await supabase
        .from('personnel')
        .select('*')
        .eq('id', appUserData.personnel_id)
        .single();

      if (pById) {
        return NextResponse.json({ personnel: pById });
      }
    }

    // 2. Search personnel by user_id
    const { data: pByUserId } = await supabase
      .from('personnel')
      .select('*')
      .eq('user_id', authUser.id)
      .single();

    if (pByUserId) {
      return NextResponse.json({ personnel: pByUserId });
    }

    // 3. Search personnel by email
    if (userEmail) {
      const { data: pByEmail } = await supabase
        .from('personnel')
        .select('*')
        .ilike('email', userEmail)
        .single();

      if (pByEmail) {
        return NextResponse.json({ personnel: pByEmail });
      }
    }

    // 4. Fallback search by full_name
    if (appUserData?.full_name) {
      const { data: pByName } = await supabase
        .from('personnel')
        .select('*')
        .ilike('name_th', `%${appUserData.full_name}%`)
        .single();

      if (pByName) {
        return NextResponse.json({ personnel: pByName });
      }
    }

    // 5. If no record exists, generate a virtual personnel object from auth user
    const defaultNameEn = (appUserData?.full_name && /^[A-Za-z\s]+$/.test(appUserData.full_name)) 
      ? appUserData.full_name.trim().toUpperCase() 
      : (authUser.email?.split('@')[0]?.toUpperCase() || 'STAFF');

    const virtualPersonnel = {
      id: authUser.id,
      name_th: appUserData?.full_name || authUser.email?.split('@')[0] || 'บุคลากร',
      name_en: defaultNameEn,
      position_th: appUserData?.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'บุคลากรทางการศึกษา',
      position_en: appUserData?.role === 'admin' ? 'Administrator' : 'Academic Staff',
      category: appUserData?.role || 'staff',
      image_url: null, // Do not default to sample teacher; show placeholder if no photo
      email: authUser.email,
      is_active: true,
    };

    return NextResponse.json({ personnel: virtualPersonnel, isVirtual: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
