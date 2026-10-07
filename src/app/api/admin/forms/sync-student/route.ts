import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { analyzeStudentSyncOpportunities } from '@/lib/forms/database-sync';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const formId = searchParams.get('formId');

    if (!formId) {
      return NextResponse.json({ success: false, error: 'ไม่พบ formId' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Load Form & Fields
    const [formRes, fieldsRes, respRes] = await Promise.all([
      supabase.from('forms').select('*').eq('id', formId).single(),
      supabase.from('form_fields').select('*').eq('form_id', formId).order('sort_order', { ascending: true }),
      supabase.from('form_responses').select('*').eq('form_id', formId).order('submitted_at', { ascending: false }),
    ]);

    if (formRes.error || !formRes.data) {
      return NextResponse.json({ success: false, error: 'ไม่พบแบบฟอร์ม' }, { status: 404 });
    }

    const form = formRes.data;
    const fields = fieldsRes.data || [];
    const responses = respRes.data || [];

    // 2. Fetch existing students referenced in responses
    const studentIds: string[] = [];
    for (const r of responses) {
      const answers = r.answers || {};
      for (const val of Object.values(answers)) {
        if (typeof val === 'string' && /^\d{4,5}$/.test(val.trim())) {
          studentIds.push(val.trim());
        }
      }
    }

    const uniqueIds = Array.from(new Set(studentIds));
    const existingStudentsMap = new Map<string, any>();

    if (uniqueIds.length > 0) {
      const { data: dbStudents } = await supabase
        .from('students')
        .select('*, student_parents(*)')
        .in('id', uniqueIds);

      for (const s of dbStudents || []) {
        existingStudentsMap.set(s.id, s);
      }
    }

    // 3. Analyze Sync Opportunities
    const syncItems = analyzeStudentSyncOpportunities(form, fields, responses, existingStudentsMap);

    return NextResponse.json({
      success: true,
      data: syncItems,
      totalPending: syncItems.filter((i) => !i.isAlreadySynced).length,
    });
  } catch (err: any) {
    console.error('Error fetching student sync opportunities:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูลซิงค์' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, responseId, studentId, updates, newStudentPayload } = body;

    const supabase = getAdminClient();

    // 1. Update Existing Student
    if (action === 'sync_update') {
      if (!studentId || !updates) {
        return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
      }

      const studentUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.height !== undefined) {
        const h = Number(String(updates.height).replace(/[^\d.]/g, ''));
        studentUpdates.height = isNaN(h) ? null : h;
      }
      if (updates.weight !== undefined) {
        const w = Number(String(updates.weight).replace(/[^\d.]/g, ''));
        studentUpdates.weight = isNaN(w) ? null : w;
      }
      if (updates.disability !== undefined) {
        studentUpdates.disability = String(updates.disability).trim();
      }
      if (updates.religion !== undefined) {
        studentUpdates.religion = String(updates.religion).trim();
      }

      // Execute Student Update
      const { error: updateErr } = await supabase
        .from('students')
        .update(studentUpdates)
        .eq('id', studentId);

      if (updateErr) throw updateErr;

      // Update Parent Phone if provided
      if (updates.parent_phone) {
        const cleanPhone = String(updates.parent_phone).replace(/[-\s]/g, '').trim();
        const { data: existingParents } = await supabase
          .from('student_parents')
          .select('id')
          .eq('student_id', studentId)
          .limit(1);

        if (existingParents && existingParents.length > 0) {
          await supabase
            .from('student_parents')
            .update({ phone_number: cleanPhone, updated_at: new Date().toISOString() })
            .eq('id', existingParents[0].id);
        } else {
          await supabase.from('student_parents').insert({
            student_id: studentId,
            relationship: 'ผู้ปกครอง',
            phone_number: cleanPhone,
          });
        }
      }

      // Mark Response as Synced
      if (responseId) {
        const { data: curResp } = await supabase
          .from('form_responses')
          .select('answers')
          .eq('id', responseId)
          .single();

        if (curResp) {
          const updatedAnswers = {
            ...(curResp.answers || {}),
            _db_synced_at: new Date().toISOString(),
          };
          await supabase
            .from('form_responses')
            .update({ answers: updatedAnswers })
            .eq('id', responseId);
        }
      }

      return NextResponse.json({
        success: true,
        message: `อัปเดตข้อมูลนักเรียนรหัส ${studentId} เรียบร้อยแล้ว`,
      });
    }

    // 2. Create New Student from Admission Form
    if (action === 'sync_create_student') {
      if (!newStudentPayload || !newStudentPayload.name) {
        return NextResponse.json({ success: false, error: 'ข้อมูลนักเรียนใหม่ไม่ครบถ้วน' }, { status: 400 });
      }

      // Generate next student ID via RPC
      const { data: nextId, error: idErr } = await supabase.rpc('get_next_student_id', {
        p_type: 'normal',
      });

      if (idErr || !nextId) {
        throw new Error(idErr?.message || 'ไม่สามารถสร้างรหัสนักเรียนใหม่ได้');
      }

      const insertData = {
        id: String(nextId),
        name: newStudentPayload.name.trim(),
        grade: newStudentPayload.grade || 'อ.1/1',
        citizen_id: newStudentPayload.citizen_id || null,
        gender: newStudentPayload.gender || null,
        birth_date: newStudentPayload.birth_date || null,
        status: newStudentPayload.status || 'นักเรียนเข้าใหม่',
        wallet_balance: 0,
      };

      const { data: created, error: insertErr } = await supabase
        .from('students')
        .insert([insertData])
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Mark Response as Synced
      if (responseId) {
        const { data: curResp } = await supabase
          .from('form_responses')
          .select('answers')
          .eq('id', responseId)
          .single();

        if (curResp) {
          const updatedAnswers = {
            ...(curResp.answers || {}),
            _db_synced_at: new Date().toISOString(),
            _created_student_id: String(nextId),
          };
          await supabase
            .from('form_responses')
            .update({ answers: updatedAnswers })
            .eq('id', responseId);
        }
      }

      return NextResponse.json({
        success: true,
        message: `สร้างทะเบียนนักเรียนใหม่สำเร็จ รหัสประจำตัว: ${nextId}`,
        createdStudent: created,
      });
    }

    return NextResponse.json({ success: false, error: 'ไม่พบคำสั่งที่ระบุ' }, { status: 400 });
  } catch (err: any) {
    console.error('Error executing student sync:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลกับฐานข้อมูล' },
      { status: 500 }
    );
  }
}
