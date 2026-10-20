import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface LinkedStudentInfo {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  prefix: string;
  grade: string;
  classroom: string;
  relationship: string;
  wallet_balance: number;
}

interface GuardianAccountSummary {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  full_name: string;
  citizen_id: string | null;
  phone_number: string | null;
  email: string | null;
  relationship: string;
  children: LinkedStudentInfo[];
}

// Pre-defined demo guardians for quick access by school evaluators and parents
const FEATURED_DEMO_GUARDIAN_IDS = [
  '6bab93bc-1424-4a84-9daa-02a3676961ae', // คุณชาญณรงค์ บุญฤทธิ์ (อ.2/1 & ป.6/1)
  '9d7007d4-9422-4bad-a7d6-aab22fd37a23', // คุณธนายุต ศิริโชคธนพัฒน์ (อ.2/1)
  '03ec2046-c087-476f-93ac-eba8151a895c', // คุณสุรชัย อุ่นจิตต์ (ป.4/1 & ป.6/1)
  '53c06122-639d-47c3-a0ec-ca3efedeacd4', // คุณเฉลิมพล จันทร์ส่อง (ป.1/1 & ป.3/1)
  '15960b99-581b-4da2-a45a-c4846de50691', // คุณลานนา เฮียบ (ป.4/1 & ป.6/1)
  '59db5804-fe69-4792-a2ff-7e45741fd86c', // คุณธีระยุทธ บุปผาศรี (อ.1/1 & อ.3/1)
];

async function getGuardianWithChildren(guardianId: string): Promise<GuardianAccountSummary | null> {
  const supabase = getAdminClient();

  const { data: guardian, error: gErr } = await supabase
    .schema('family')
    .from('guardians')
    .select('*')
    .eq('id', guardianId)
    .maybeSingle();

  if (gErr || !guardian) return null;

  const { data: links } = await supabase
    .schema('family')
    .from('guardian_student_links')
    .select('*')
    .eq('guardian_id', guardianId);

  const studentIds = (links || []).map((l) => l.student_id);
  let children: LinkedStudentInfo[] = [];

  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('id, name, first_name, last_name, prefix, grade, classroom, wallet_balance')
      .in('id', studentIds);

    const linkMap = Object.fromEntries((links || []).map((l) => [l.student_id, l.relationship || 'ผู้ปกครอง']));

    children = (students || []).map((s) => ({
      id: s.id,
      name: s.name || `${s.prefix || ''} ${s.first_name || ''} ${s.last_name || ''}`.trim(),
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      prefix: s.prefix || '',
      grade: s.grade || '',
      classroom: s.classroom || '1',
      relationship: linkMap[s.id] || 'ผู้ปกครอง',
      wallet_balance: Number(s.wallet_balance || 0),
    }));
  }

  return {
    id: guardian.id,
    prefix: guardian.prefix || 'คุณ',
    first_name: guardian.first_name,
    last_name: guardian.last_name,
    full_name: `${guardian.prefix || 'คุณ'}${guardian.first_name} ${guardian.last_name}`.trim(),
    citizen_id: guardian.citizen_id,
    phone_number: guardian.phone_number,
    email: guardian.email,
    relationship: children[0]?.relationship || 'ผู้ปกครอง',
    children,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 1. Return demo guardians or search directory
    if (action === 'demo_list') {
      const q = searchParams.get('q')?.trim() || '';
      const supabase = getAdminClient();

      if (q) {
        const cleanQ = q.replace(/[^0-9a-zA-Z\u0E00-\u0E7F]/g, '');
        // Search in guardians by name or citizen_id or phone
        const { data: matchedGuardians } = await supabase
          .schema('family')
          .from('guardians')
          .select('id, prefix, first_name, last_name, citizen_id, phone_number')
          .or(`first_name.ilike.%${cleanQ}%,last_name.ilike.%${cleanQ}%,citizen_id.ilike.%${cleanQ}%,phone_number.ilike.%${cleanQ}%`)
          .limit(8);

        const results: GuardianAccountSummary[] = [];
        for (const g of matchedGuardians || []) {
          const detail = await getGuardianWithChildren(g.id);
          if (detail && detail.children.length > 0) {
            results.push(detail);
          }
        }
        return NextResponse.json({ ok: true, demoGuardians: results });
      }

      // Default featured demo list
      const results: GuardianAccountSummary[] = [];
      for (const gid of FEATURED_DEMO_GUARDIAN_IDS) {
        const detail = await getGuardianWithChildren(gid);
        if (detail) results.push(detail);
      }
      return NextResponse.json({ ok: true, demoGuardians: results });
    }

    // 2. Check current session
    const guardianId =
      request.cookies.get('sv_parent_session_guardian_id')?.value ||
      request.headers.get('x-guardian-id');

    if (!guardianId) {
      return NextResponse.json({
        ok: true,
        authenticated: false,
        guardian: null,
        children: [],
      });
    }

    const guardianInfo = await getGuardianWithChildren(guardianId);
    if (!guardianInfo) {
      const res = NextResponse.json({
        ok: true,
        authenticated: false,
        guardian: null,
        children: [],
      });
      res.cookies.delete('sv_parent_session_guardian_id');
      res.cookies.delete('sv_parent_session');
      return res;
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      guardian: guardianInfo,
      children: guardianInfo.children,
    });
  } catch (error) {
    console.error('Parent auth GET error:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'login';
    const supabase = getAdminClient();

    // 1. Logout
    if (action === 'logout') {
      const res = NextResponse.json({
        ok: true,
        authenticated: false,
        message: 'ออกจากระบบเรียบร้อยแล้ว (Signed out successfully)',
      });
      res.cookies.delete('sv_parent_session_guardian_id');
      res.cookies.delete('sv_parent_session');
      return res;
    }

    // 2. Demo Quick Login
    if (action === 'demo_login') {
      const guardianId = body.guardianId;
      if (!guardianId) {
        return NextResponse.json({ ok: false, error: 'กรุณาระบุรหัสผู้ปกครอง (Missing guardianId)' }, { status: 400 });
      }

      const guardianInfo = await getGuardianWithChildren(guardianId);
      if (!guardianInfo) {
        return NextResponse.json({ ok: false, error: 'ไม่พบข้อมูลผู้ปกครองนี้ในระบบ' }, { status: 404 });
      }

      const res = NextResponse.json({
        ok: true,
        authenticated: true,
        guardian: guardianInfo,
        children: guardianInfo.children,
        token: guardianInfo.id,
      });

      // Set cookie for 30 days
      res.cookies.set('sv_parent_session_guardian_id', guardianInfo.id, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      res.cookies.set('sv_parent_session', JSON.stringify({
        guardianId: guardianInfo.id,
        name: guardianInfo.full_name,
        citizenId: guardianInfo.citizen_id,
      }), {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });

      return res;
    }

    // 3. Regular Credential Login (Citizen ID / Phone Number + Student ID)
    const rawIdentifier = (body.identifier || '').trim();
    const rawStudentId = (body.studentId || '').trim();

    if (!rawIdentifier) {
      return NextResponse.json(
        { ok: false, error: 'กรุณากรอกเลขประจำตัวประชาชน (13 หลัก) หรือเบอร์โทรศัพท์ที่ลงทะเบียนไว้' },
        { status: 400 }
      );
    }

    const cleanIdentifier = rawIdentifier.replace(/[^0-9]/g, '');

    // Attempt to locate guardian
    let matchedGuardian: { id: string; citizen_id: string | null; phone_number: string | null } | null = null;

    // A. Match by 13-digit citizen ID
    if (cleanIdentifier.length === 13) {
      const { data: g } = await supabase
        .schema('family')
        .from('guardians')
        .select('id, citizen_id, phone_number')
        .eq('citizen_id', cleanIdentifier)
        .maybeSingle();
      if (g) matchedGuardian = g;
    }

    // B. Match by 9-10 digit phone number
    if (!matchedGuardian && cleanIdentifier.length >= 9 && cleanIdentifier.length <= 10) {
      const { data: g } = await supabase
        .schema('family')
        .from('guardians')
        .select('id, citizen_id, phone_number')
        .or(`phone_number.eq.${cleanIdentifier},phone_number.eq.${rawIdentifier}`)
        .maybeSingle();
      if (g) matchedGuardian = g;
    }

    // C. Fallback: general query if formatted differently
    if (!matchedGuardian) {
      const { data: gList } = await supabase
        .schema('family')
        .from('guardians')
        .select('id, citizen_id, phone_number')
        .or(`citizen_id.eq.${cleanIdentifier},citizen_id.eq.${rawIdentifier},phone_number.eq.${cleanIdentifier},phone_number.eq.${rawIdentifier}`)
        .limit(1);
      if (gList && gList.length > 0) matchedGuardian = gList[0];
    }

    // D. Friendly Fallback: what if user entered Student ID in the identifier field?
    if (!matchedGuardian && cleanIdentifier.length >= 3 && cleanIdentifier.length <= 6) {
      const { data: linkMatch } = await supabase
        .schema('family')
        .from('guardian_student_links')
        .select('guardian_id')
        .eq('student_id', cleanIdentifier)
        .limit(1);
      if (linkMatch && linkMatch.length > 0) {
        const { data: g } = await supabase
          .schema('family')
          .from('guardians')
          .select('id, citizen_id, phone_number')
          .eq('id', linkMatch[0].guardian_id)
          .maybeSingle();
        if (g) matchedGuardian = g;
      }
    }

    if (!matchedGuardian) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ไม่พบข้อมูลผู้ปกครองในระบบโรงเรียนสมคิดวิทยา กรุณาตรวจสอบเลขประจำตัวประชาชน 13 หลัก หรือเบอร์โทรศัพท์ที่เคยแจ้งไว้กับห้องธุรการ',
        },
        { status: 401 }
      );
    }

    // If student ID is also specified, verify that it actually belongs to this guardian's children
    if (rawStudentId) {
      const cleanStudentId = rawStudentId.replace(/[^0-9]/g, '');
      const { data: links } = await supabase
        .schema('family')
        .from('guardian_student_links')
        .select('student_id')
        .eq('guardian_id', matchedGuardian.id);

      const validStudentIds = (links || []).map((l) => l.student_id);
      const isMatch = validStudentIds.some(
        (sid) => sid === cleanStudentId || sid === rawStudentId
      );

      if (!isMatch && validStudentIds.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'รหัสประจำตัวนักเรียนไม่ตรงกับข้อมูลบุตรหลานที่เชื่อมโยงกับผู้ปกครองท่านนี้ กรุณาตรวจสอบรหัสนักเรียนอีกครั้ง',
          },
          { status: 401 }
        );
      }
    }

    const guardianInfo = await getGuardianWithChildren(matchedGuardian.id);
    if (!guardianInfo) {
      return NextResponse.json(
        { ok: false, error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ปกครอง' },
        { status: 500 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      guardian: guardianInfo,
      children: guardianInfo.children,
      token: guardianInfo.id,
    });

    // Set cookie for 30 days
    res.cookies.set('sv_parent_session_guardian_id', guardianInfo.id, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.cookies.set('sv_parent_session', JSON.stringify({
      guardianId: guardianInfo.id,
      name: guardianInfo.full_name,
      citizenId: guardianInfo.citizen_id,
    }), {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch (error) {
    console.error('Parent auth POST error:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
