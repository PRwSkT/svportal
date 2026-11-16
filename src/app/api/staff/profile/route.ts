import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRealAuthUser } from '@/lib/auth';
import { isSystemAdmin } from '@/lib/constants/auth';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function PUT(request: Request) {
  try {
    const authUser = await getRealAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      personnel_id,
      phone,
      line_id,
      facebook_url,
      instagram_url,
      tiktok_url,
      linkedin_url,
      office_room,
      card_bio,
      email,
    } = body;

    const supabase = getAdminClient();
    const isAdmin = isSystemAdmin(authUser.email);

    // Determine target personnel ID
    let targetId = personnel_id;

    if (!targetId || !isAdmin) {
      // Find current user's personnel record
      const { data: appUserData } = await supabase
        .from('app_users')
        .select('personnel_id')
        .eq('id', authUser.id)
        .single();

      if (appUserData?.personnel_id) {
        targetId = appUserData.personnel_id;
      } else {
        const { data: pByUserId } = await supabase
          .from('personnel')
          .select('id')
          .eq('user_id', authUser.id)
          .single();
        if (pByUserId) {
          targetId = pByUserId.id;
        } else if (authUser.email) {
          const { data: pByEmail } = await supabase
            .from('personnel')
            .select('id')
            .ilike('email', authUser.email)
            .single();
          if (pByEmail) {
            targetId = pByEmail.id;
          }
        }
      }
    }

    if (!targetId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลบุคลากรที่ต้องการอัปเดต' },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, any> = {
      phone: phone !== undefined ? phone?.trim() : undefined,
      line_id: line_id !== undefined ? line_id?.trim() : undefined,
      facebook_url: facebook_url !== undefined ? facebook_url?.trim() : undefined,
      instagram_url: instagram_url !== undefined ? instagram_url?.trim() : undefined,
      tiktok_url: tiktok_url !== undefined ? tiktok_url?.trim() : undefined,
      linkedin_url: linkedin_url !== undefined ? linkedin_url?.trim() : undefined,
      office_room: office_room !== undefined ? office_room?.trim() : undefined,
      card_bio: card_bio !== undefined ? card_bio?.trim() : undefined,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(updatePayload).forEach(
      (key) => updatePayload[key] === undefined && delete updatePayload[key]
    );

    const { data: updated, error } = await supabase
      .from('personnel')
      .update(updatePayload)
      .eq('id', targetId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ personnel: updated, success: true });
  } catch (err: any) {
    console.error('Update personnel profile error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
