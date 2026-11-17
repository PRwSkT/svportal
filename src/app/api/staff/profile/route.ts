import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRealAuthUser } from '@/lib/auth';
import { isSystemAdmin } from '@/lib/constants/auth';
import { getAutoCardValidity } from '@/lib/staff-card/utils';

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
      // Auto-create personnel record for logged-in user if missing
      const { data: appUserData } = await supabase
        .from('app_users')
        .select('full_name, role')
        .eq('id', authUser.id)
        .single();

      const defaultNameEn = body.name_en?.trim()?.toUpperCase() || 
        (appUserData?.full_name && /^[A-Za-z\s]+$/.test(appUserData.full_name) 
          ? appUserData.full_name.trim().toUpperCase() 
          : (authUser.email?.split('@')[0]?.toUpperCase() || 'STAFF'));

      const autoValidity = getAutoCardValidity({ is_active: true });

      const newPersonnel = {
        user_id: authUser.id,
        name_th: appUserData?.full_name || authUser.email?.split('@')[0] || 'บุคลากร',
        name_en: defaultNameEn,
        position_th: appUserData?.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'บุคลากรทางการศึกษา',
        position_en: appUserData?.role === 'admin' ? 'Administrator' : 'Academic Staff',
        category: appUserData?.role || 'staff',
        email: authUser.email,
        phone: phone !== undefined ? phone?.trim() : null,
        line_id: line_id !== undefined ? line_id?.trim() : null,
        facebook_url: facebook_url !== undefined ? facebook_url?.trim() : null,
        instagram_url: instagram_url !== undefined ? instagram_url?.trim() : null,
        tiktok_url: tiktok_url !== undefined ? tiktok_url?.trim() : null,
        linkedin_url: linkedin_url !== undefined ? linkedin_url?.trim() : null,
        office_room: office_room !== undefined ? office_room?.trim() : null,
        card_bio: card_bio !== undefined ? card_bio?.trim() : null,
        education_history: body.education_history !== undefined ? body.education_history?.trim() : null,
        experience_history: body.experience_history !== undefined ? body.experience_history?.trim() : null,
        academic_year: autoValidity.academicYear,
        card_issue_date: autoValidity.issueDate,
        card_expire_date: autoValidity.expireDate,
        image_url: body.image_url !== undefined ? (body.image_url?.trim() || null) : null,
        is_active: true,
      };

      const { data: created, error: createErr } = await supabase
        .from('personnel')
        .insert(newPersonnel)
        .select()
        .single();

      if (createErr) throw createErr;

      // Link back to app_users
      await supabase
        .from('app_users')
        .update({ personnel_id: created.id })
        .eq('id', authUser.id);

      return NextResponse.json({ personnel: created, success: true });
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
      education_history: body.education_history !== undefined ? body.education_history?.trim() : undefined,
      experience_history: body.experience_history !== undefined ? body.experience_history?.trim() : undefined,
      name_en: body.name_en !== undefined ? body.name_en?.trim()?.toUpperCase() : undefined,
      image_url: body.image_url !== undefined ? (body.image_url?.trim() || null) : undefined,
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
