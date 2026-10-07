import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { prepareResponsesForSummarization } from '@/lib/ai/pdpa-sanitizer';
import { summarizeResponsesWithNongFah } from '@/lib/ai/gemma';
import { getServerUser } from '@/lib/auth';
import { isSystemAdmin } from '@/lib/constants/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = await req.json();
    const formId = body?.formId?.trim();

    if (!formId) {
      return NextResponse.json({ success: false, error: 'ไม่พบรหัสแบบฟอร์ม (formId)' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Fetch Form Definition
    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลแบบฟอร์ม' }, { status: 404 });
    }

    // Authorization & IDOR Check: Admin, Owner, or Collaborator
    let isAdmin = isSystemAdmin(user.email);
    let currentPersonnelId: string | null = null;

    if (!isAdmin) {
      const { data: appUser } = await supabase
        .from('app_users')
        .select('role, personnel_id')
        .eq('id', user.id)
        .maybeSingle();

      if (appUser?.role === 'admin' || appUser?.role === 'executive') {
        isAdmin = true;
      }
      currentPersonnelId = appUser?.personnel_id || null;
    }

    if (!currentPersonnelId && user.email) {
      const { data: pData } = await supabase
        .from('personnel')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      currentPersonnelId = pData?.id || null;
    }

    const isOwner = Boolean(
      (form.created_by && form.created_by === user.id) ||
      (currentPersonnelId && form.created_by === currentPersonnelId)
    );
    const collabs: string[] = form.collaborator_ids || [];
    const isCollab = Boolean(
      (user.id && collabs.includes(user.id)) ||
      (currentPersonnelId && collabs.includes(currentPersonnelId))
    );

    if (!isAdmin && !isOwner && !isCollab) {
      return NextResponse.json({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลของแบบฟอร์มนี้' }, { status: 403 });
    }

    // 2. Fetch Form Fields
    const { data: fields, error: fieldsErr } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('sort_order', { ascending: true });

    if (fieldsErr) {
      return NextResponse.json({ success: false, error: 'ไม่สามารถโหลดฟิลด์ของแบบฟอร์มได้' }, { status: 500 });
    }

    // 3. Fetch Form Responses
    const { data: responses, error: respErr } = await supabase
      .from('form_responses')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });

    if (respErr) {
      return NextResponse.json({ success: false, error: 'ไม่สามารถโหลดข้อมูลคำตอบได้' }, { status: 500 });
    }

    const allResponses = responses || [];
    if (allResponses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ยังไม่มีผู้ส่งข้อมูลตอบกลับในแบบฟอร์มนี้ จึงยังไม่สามารถวิเคราะห์ผลสรุปได้',
      });
    }

    // 4. Pass through PDPA Zero-PII Sanitizer & Statistical Aggregator
    const sanitizedPayload = prepareResponsesForSummarization(form, fields || [], allResponses);

    // 5. Invoke Gemma via Nong Fah Summarizer
    const summaryResult = await summarizeResponsesWithNongFah(sanitizedPayload);

    // 6. Enrich Nong Fah's Student-Specific Insights with Real Database Data (Safe Server-side Join)
    const rawStudentInsights = summaryResult.studentSpecificInsights || [];
    const extractedStudentIds = Array.from(
      new Set(
        rawStudentInsights
          .map((item) => String(item.student_id).replace(/^SID:?/i, '').trim())
          .filter(Boolean)
      )
    );

    if (extractedStudentIds.length > 0) {
      const { data: dbStudents } = await supabase
        .from('students')
        .select('id, name, grade, status, height, weight, disability, student_parents(phone_number, relationship)')
        .in('id', extractedStudentIds);

      const studentMap = new Map((dbStudents || []).map((s) => [s.id, s]));

      summaryResult.studentSpecificInsights = rawStudentInsights.map((item) => {
        const cleanId = String(item.student_id).replace(/^SID:?/i, '').trim();
        const student = studentMap.get(cleanId);
        return {
          ...item,
          student_id: cleanId,
          student_profile: student
            ? {
                id: student.id,
                name: student.name,
                grade: student.grade,
                status: student.status,
                current_height: student.height,
                current_weight: student.weight,
                current_disability: student.disability,
                parent_phone: student.student_parents?.[0]?.phone_number || null,
              }
            : null,
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: summaryResult,
      totalResponses: allResponses.length,
    });
  } catch (err: any) {
    console.error('Nong Fah Summarization error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์สรุปผลข้อมูล' },
      { status: 500 }
    );
  }
}
