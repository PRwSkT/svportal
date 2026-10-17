import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { analyzeStudentSyncOpportunities } from '@/lib/forms/database-sync';
import { parseThaiAddress } from '@/lib/forms/data-cleansing';
import { getServerUser } from '@/lib/auth';
import { isSystemAdmin } from '@/lib/constants/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

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

    // Check permissions
    let isAdmin = isSystemAdmin(user.email);
    let currentPersonnelId: string | null = null;
    if (!isAdmin) {
      const { data: appUser } = await supabase
        .from('app_users')
        .select('role, personnel_id')
        .eq('id', user.id)
        .maybeSingle();
      if (appUser?.role === 'admin' || appUser?.role === 'executive') isAdmin = true;
      currentPersonnelId = appUser?.personnel_id || null;
    }
    if (!currentPersonnelId && user.email) {
      const { data: pData } = await supabase.from('personnel').select('id').eq('email', user.email).maybeSingle();
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
    const fields = fieldsRes.data || [];
    const responses = respRes.data || [];

    // 2. Fetch all school students and parents for intelligent multi-tier matching
    const { data: dbStudents, error: studentsErr } = await supabase
      .from('students')
      .select('*, student_parents(*)')
      .order('id', { ascending: true });

    if (studentsErr) throw studentsErr;

    // 3. Analyze Sync Opportunities
    const syncItems = analyzeStudentSyncOpportunities(form, fields, responses, dbStudents || []);

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
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const isSysAdmin = isSystemAdmin(user.email);
    let canSync = isSysAdmin;
    const supabase = getAdminClient();

    if (!canSync) {
      const { data: appUser } = await supabase
        .from('app_users')
        .select('role, assigned_features')
        .eq('id', user.id)
        .maybeSingle();

      const features: string[] = appUser?.assigned_features || [];
      if (appUser?.role === 'admin' || features.includes('admin_forms') || features.includes('admin_students')) {
        canSync = true;
      }
    }

    if (!canSync) {
      return NextResponse.json({ success: false, error: 'คุณไม่มีสิทธิ์ในการซิงค์ข้อมูลนักเรียน' }, { status: 403 });
    }

    const body = await req.json();
    const { action, responseId, studentId, updates, newStudentPayload, batchItems } = body;

    // Helper: Execute single student update
    const applySingleStudentUpdate = async (
      sId: string,
      sUpdates: Record<string, any>,
      rId?: string
    ) => {
      const studentUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (sUpdates.allergies !== undefined) {
        studentUpdates.allergies = sUpdates.allergies ? String(sUpdates.allergies).trim() : null;
      }
      if (sUpdates.medical_conditions !== undefined) {
        studentUpdates.medical_conditions = sUpdates.medical_conditions
          ? String(sUpdates.medical_conditions).trim()
          : null;
      }
      if (sUpdates.birth_date !== undefined) {
        studentUpdates.birth_date = sUpdates.birth_date || null;
      }
      if (sUpdates.citizen_id !== undefined) {
        studentUpdates.citizen_id = sUpdates.citizen_id ? String(sUpdates.citizen_id).replace(/\D/g, '') : null;
      }
      if (sUpdates.gender !== undefined) {
        studentUpdates.gender = sUpdates.gender ? String(sUpdates.gender).trim() : null;
      }
      if (sUpdates.height !== undefined) {
        const h = Number(String(sUpdates.height).replace(/[^\d.]/g, ''));
        studentUpdates.height = isNaN(h) ? null : h;
      }
      if (sUpdates.weight !== undefined) {
        const w = Number(String(sUpdates.weight).replace(/[^\d.]/g, ''));
        studentUpdates.weight = isNaN(w) ? null : w;
      }
      if (sUpdates.disability !== undefined) {
        studentUpdates.disability = String(sUpdates.disability).trim();
      }
      if (sUpdates.religion !== undefined) {
        studentUpdates.religion = String(sUpdates.religion).trim();
      }
      if (sUpdates.grade !== undefined) {
        studentUpdates.grade = String(sUpdates.grade).trim();
      }
      if (sUpdates.classroom !== undefined) {
        studentUpdates.classroom = String(sUpdates.classroom).trim();
      }
      if (sUpdates.nickname !== undefined) {
        studentUpdates.nickname = sUpdates.nickname ? String(sUpdates.nickname).trim() : null;
      }
      if (sUpdates.name_en !== undefined) {
        studentUpdates.name_en = sUpdates.name_en ? String(sUpdates.name_en).trim() : null;
      }
      if (sUpdates.blood_group !== undefined) {
        studentUpdates.blood_group = sUpdates.blood_group ? String(sUpdates.blood_group).trim().toUpperCase() : null;
      }
      if (sUpdates.ethnicity !== undefined) {
        studentUpdates.ethnicity = sUpdates.ethnicity ? String(sUpdates.ethnicity).trim() : null;
      }
      if (sUpdates.current_address !== undefined || sUpdates.address !== undefined) {
        studentUpdates.current_address = sUpdates.current_address || sUpdates.address || null;
      }
      if (sUpdates.line_id !== undefined) {
        studentUpdates.line_id = sUpdates.line_id ? String(sUpdates.line_id).trim() : null;
      }

      // Execute Student Update
      const { error: updateErr } = await supabase
        .from('students')
        .update(studentUpdates)
        .eq('id', sId);

      if (updateErr) throw updateErr;

      // Upsert Student Addresses
      if (sUpdates.address_parsed || sUpdates.address || sUpdates.current_address) {
        const addr = sUpdates.address_parsed || parseThaiAddress(sUpdates.address || sUpdates.current_address);
        if (addr) {
          const { data: existingAddr } = await supabase
            .from('student_addresses')
            .select('id')
            .eq('student_id', sId)
            .limit(1);

          const addrData: any = {
            student_id: sId,
            house_number: addr.house_number || null,
            moo: addr.moo || null,
            soi: addr.soi || null,
            road: addr.road || null,
            sub_district: addr.sub_district || null,
            district: addr.district || null,
            province: addr.province || null,
            zip_code: addr.zip_code || null,
            updated_at: new Date().toISOString(),
          };

          if (existingAddr && existingAddr.length > 0) {
            await supabase.from('student_addresses').update(addrData).eq('id', existingAddr[0].id);
          } else {
            await supabase.from('student_addresses').insert(addrData);
          }
        }
      }

      // Upsert Student Parents (Relationship, Names, Phone, Line ID)
      const pUpdates = sUpdates.parentUpdates || {};
      const parentPhone = sUpdates.parent_phone || pUpdates.phone_number;
      const parentName = sUpdates.parent_name || (pUpdates.first_name ? `${pUpdates.first_name} ${pUpdates.last_name || ''}` : '');
      const parentRel = sUpdates.parent_relation || pUpdates.relationship || 'ผู้ปกครอง';
      const parentLine = sUpdates.parent_line || pUpdates.line_id;

      if (parentPhone || parentName || parentLine) {
        const cleanPhone = parentPhone ? String(parentPhone).replace(/\D/g, '').trim() : null;
        const nameParts = parentName ? String(parentName).trim().split(' ').filter(Boolean) : [];
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(' ') || null;

        const { data: existingParents } = await supabase
          .from('student_parents')
          .select('id')
          .eq('student_id', sId)
          .limit(1);

        const parentPayload: any = {
          updated_at: new Date().toISOString(),
        };
        if (cleanPhone) parentPayload.phone_number = cleanPhone;
        if (firstName) parentPayload.first_name = firstName;
        if (lastName) parentPayload.last_name = lastName;
        if (parentRel) parentPayload.relationship = parentRel;
        if (parentLine) parentPayload.line_id = parentLine;

        if (existingParents && existingParents.length > 0) {
          await supabase
            .from('student_parents')
            .update(parentPayload)
            .eq('id', existingParents[0].id);
        } else {
          await supabase.from('student_parents').insert({
            student_id: sId,
            relationship: parentRel || 'ผู้ปกครอง',
            first_name: firstName || 'ผู้ปกครอง',
            last_name: lastName || '',
            phone_number: cleanPhone || '',
            line_id: parentLine || null,
          });
        }
      }

      // Mark Response as Synced
      if (rId) {
        const { data: curResp } = await supabase
          .from('form_responses')
          .select('answers')
          .eq('id', rId)
          .single();

        if (curResp) {
          const updatedAnswers = {
            ...(curResp.answers || {}),
            _db_synced_at: new Date().toISOString(),
          };
          await supabase
            .from('form_responses')
            .update({ answers: updatedAnswers })
            .eq('id', rId);
        }
      }
    };

    // 1. Single Update
    if (action === 'sync_update') {
      if (!studentId || !updates) {
        return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
      }

      await applySingleStudentUpdate(studentId, updates, responseId);

      return NextResponse.json({
        success: true,
        message: `อัปเดตข้อมูลนักเรียนรหัส ${studentId} เข้าฐานข้อมูลเรียบร้อยแล้ว`,
      });
    }

    // 2. Batch Update (Multi-student atomic sync)
    if (action === 'sync_batch') {
      const itemsToSync: any[] = Array.isArray(batchItems) ? batchItems : [];
      if (itemsToSync.length === 0) {
        return NextResponse.json({ success: false, error: 'ไม่มีรายการที่ต้องซิงค์' }, { status: 400 });
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const item of itemsToSync) {
        try {
          if (item.syncType === 'update_existing' && item.studentId) {
            await applySingleStudentUpdate(item.studentId, item.updates || {}, item.responseId);
            successCount++;
          } else if (item.syncType === 'create_new' && item.newStudentPayload) {
            const { data: nextId, error: idErr } = await supabase.rpc('get_next_student_id', {
              p_type: 'normal',
            });
            if (idErr || !nextId) throw new Error(idErr?.message || 'ไม่สามารถสร้างรหัสนักเรียนใหม่');

            const insertData = {
              id: String(nextId),
              name: item.newStudentPayload.name.trim(),
              grade: item.newStudentPayload.grade || 'อ.1/1',
              citizen_id: item.newStudentPayload.citizen_id || null,
              gender: item.newStudentPayload.gender || null,
              birth_date: item.newStudentPayload.birth_date || null,
              allergies: item.newStudentPayload.allergies || null,
              medical_conditions: item.newStudentPayload.medical_conditions || null,
              status: item.newStudentPayload.status || 'นักเรียนเข้าใหม่',
              wallet_balance: 0,
            };

            await supabase.from('students').insert([insertData]);

            if (item.newStudentPayload.parent_phone) {
              await supabase.from('student_parents').insert({
                student_id: String(nextId),
                relationship: 'ผู้ปกครอง',
                phone_number: item.newStudentPayload.parent_phone,
              });
            }

            if (item.responseId) {
              const { data: curResp } = await supabase
                .from('form_responses')
                .select('answers')
                .eq('id', item.responseId)
                .single();

              if (curResp) {
                await supabase
                  .from('form_responses')
                  .update({
                    answers: {
                      ...(curResp.answers || {}),
                      _db_synced_at: new Date().toISOString(),
                      _created_student_id: String(nextId),
                    },
                  })
                  .eq('id', item.responseId);
              }
            }

            successCount++;
          }
        } catch (itemErr: any) {
          console.error('Batch sync error on item:', item.responseId, itemErr);
          errors.push(itemErr?.message || 'เกิดข้อผิดพลาดกับรายการ');
        }
      }

      return NextResponse.json({
        success: true,
        count: successCount,
        message: `อัปเดตและซิงค์ข้อมูลนักเรียนเข้าฐานข้อมูลสำเร็จทั้งหมด ${successCount} รายการ`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // 3. Create New Student from Admission Form
    if (action === 'sync_create_student') {
      if (!newStudentPayload || !newStudentPayload.name) {
        return NextResponse.json({ success: false, error: 'ข้อมูลนักเรียนใหม่ไม่ครบถ้วน' }, { status: 400 });
      }

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
        allergies: newStudentPayload.allergies || null,
        medical_conditions: newStudentPayload.medical_conditions || null,
        status: newStudentPayload.status || 'นักเรียนเข้าใหม่',
        wallet_balance: 0,
      };

      const { data: created, error: insertErr } = await supabase
        .from('students')
        .insert([insertData])
        .select()
        .single();

      if (insertErr) throw insertErr;

      if (newStudentPayload.parent_phone) {
        await supabase.from('student_parents').insert({
          student_id: String(nextId),
          relationship: 'ผู้ปกครอง',
          phone_number: String(newStudentPayload.parent_phone).replace(/\D/g, ''),
        });
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
