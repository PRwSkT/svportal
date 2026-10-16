import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { detectCollisions } from '@/lib/academic/timetable-engine';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const academicYear = searchParams.get('academic_year') || '2568';
    const term = searchParams.get('term') || '1';
    const classId = searchParams.get('class_id');
    const teacherId = searchParams.get('teacher_id');

    let query = supabase
      .from('academic_timetables')
      .select(`
        *,
        class:academic_classes(id, name, grade_level),
        course:academic_courses(id, course_code, name_th, subject_group),
        teacher:personnel!academic_timetables_teacher_id_fkey(id, name_th, position_th)
      `)
      .eq('academic_year', academicYear)
      .eq('term', term)
      .order('day_of_week', { ascending: true })
      .order('period_number', { ascending: true });

    if (classId) query = query.eq('class_id', classId);
    if (teacherId) query = query.eq('teacher_id', teacherId);

    const { data: slots, error } = await query;
    if (error) throw error;

    // Detect any collisions
    const collisions = detectCollisions(slots || []);

    return NextResponse.json({
      success: true,
      slots: slots || [],
      collisions,
      has_collisions: collisions.length > 0
    });
  } catch (error: any) {
    console.error('Error fetching timetable slots:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();

    const {
      academic_year = '2568',
      term = '1',
      class_id,
      course_id,
      teacher_id,
      day_of_week,
      period_number,
      room_name
    } = body;

    if (!class_id || !course_id || !teacher_id || !day_of_week || !period_number) {
      return NextResponse.json({
        success: false,
        error: 'กรุณาระบุข้อมูลคาบสอนให้ครบถ้วน (ห้องเรียน, รายวิชา, ครูผู้สอน, วัน, คาบ)'
      }, { status: 400 });
    }

    const dNum = Number(day_of_week);
    const pNum = Number(period_number);

    // Fetch existing slots for collision pre-check
    const { data: existingSlots } = await supabase
      .from('academic_timetables')
      .select('*')
      .eq('academic_year', academic_year)
      .eq('term', term);

    // Check if there is already a slot for this exact class, day, and period
    const existingInSameSlot = (existingSlots || []).find(
      s => s.class_id === class_id && s.day_of_week === dNum && s.period_number === pNum
    );

    // Filter out the existing slot in this position for collision checking
    const otherSlots = (existingSlots || []).filter(
      s => !(s.class_id === class_id && s.day_of_week === dNum && s.period_number === pNum)
    );

    const candidateSlot = {
      id: existingInSameSlot ? existingInSameSlot.id : 'candidate',
      academic_year,
      term,
      class_id,
      course_id,
      teacher_id,
      day_of_week: dNum,
      period_number: pNum,
      room_name: room_name || null,
      created_at: new Date().toISOString()
    };

    const collisions = detectCollisions([...otherSlots, candidateSlot]);

    if (collisions.length > 0) {
      const col = collisions[0];
      return NextResponse.json({
        success: false,
        error: `ไม่สามารถบันทึกได้: ${col.description}`,
        collision: col
      }, { status: 400 });
    }

    let savedSlot;
    if (existingInSameSlot) {
      // Update existing slot
      const { data: updated, error: updateError } = await supabase
        .from('academic_timetables')
        .update({
          course_id,
          teacher_id,
          room_name: room_name || null
        })
        .eq('id', existingInSameSlot.id)
        .select()
        .single();

      if (updateError) throw updateError;
      savedSlot = updated;
    } else {
      // Insert new slot
      const { data: inserted, error: insertError } = await supabase
        .from('academic_timetables')
        .insert({
          academic_year,
          term,
          class_id,
          course_id,
          teacher_id,
          day_of_week: dNum,
          period_number: pNum,
          room_name: room_name || null
        })
        .select()
        .single();

      if (insertError) throw insertError;
      savedSlot = inserted;
    }

    return NextResponse.json({
      success: true,
      slot: savedSlot,
      message: 'บันทึกคาบสอนลงตารางเรียบร้อยแล้ว (ตรวจพบ 0 ข้อขัดแย้ง)'
    });
  } catch (error: any) {
    console.error('Error saving timetable slot:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();
    const { action } = body;

    // ACTION 1: SWAP TWO SLOTS
    if (action === 'swap') {
      const { slot_id_1, slot_id_2, target_day, target_period, class_id, academic_year = '2568', term = '1' } = body;

      // Case A: Swapping two existing slots
      if (slot_id_1 && slot_id_2) {
        const { data: slots, error: fetchErr } = await supabase
          .from('academic_timetables')
          .select('*')
          .in('id', [slot_id_1, slot_id_2]);

        if (fetchErr || !slots || slots.length !== 2) {
          return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลคาบเรียนทั้งสองรายการ' }, { status: 404 });
        }

        const s1 = slots.find(s => s.id === slot_id_1)!;
        const s2 = slots.find(s => s.id === slot_id_2)!;

        // Fetch all other slots in the term to verify collision
        const { data: allSlots } = await supabase
          .from('academic_timetables')
          .select('*')
          .eq('academic_year', academic_year)
          .eq('term', term)
          .not('id', 'in', `(${slot_id_1},${slot_id_2})`);

        // Candidate 1 moves to s2 position, Candidate 2 moves to s1 position
        const testSlot1 = { ...s1, day_of_week: s2.day_of_week, period_number: s2.period_number };
        const testSlot2 = { ...s2, day_of_week: s1.day_of_week, period_number: s1.period_number };

        const testCollisions = detectCollisions([...(allSlots || []), testSlot1, testSlot2]);
        if (testCollisions.length > 0) {
          return NextResponse.json({
            success: false,
            error: `ไม่สามารถสลับคาบได้: ${testCollisions[0].description}`,
            collision: testCollisions[0]
          }, { status: 400 });
        }

        // Perform swap: If in the same class, swapping course, teacher, room avoids day/period unique constraint collision
        if (s1.class_id === s2.class_id) {
          await supabase.from('academic_timetables').update({
            course_id: s2.course_id,
            teacher_id: s2.teacher_id,
            room_name: s2.room_name
          }).eq('id', s1.id);

          await supabase.from('academic_timetables').update({
            course_id: s1.course_id,
            teacher_id: s1.teacher_id,
            room_name: s1.room_name
          }).eq('id', s2.id);
        } else {
          // Different classes: swap day and period using a temporary placeholder
          await supabase.from('academic_timetables').update({
            day_of_week: 99,
            period_number: 99
          }).eq('id', s1.id);

          await supabase.from('academic_timetables').update({
            day_of_week: s1.day_of_week,
            period_number: s1.period_number
          }).eq('id', s2.id);

          await supabase.from('academic_timetables').update({
            day_of_week: s2.day_of_week,
            period_number: s2.period_number
          }).eq('id', s1.id);
        }

        return NextResponse.json({
          success: true,
          message: 'สลับคาบเรียนสำเร็จเรียบร้อยแล้ว'
        });
      }

      // Case B: Moving an existing slot to an empty target day/period
      if (slot_id_1 && target_day && target_period) {
        const { data: s1, error: fetchErr } = await supabase
          .from('academic_timetables')
          .select('*')
          .eq('id', slot_id_1)
          .single();

        if (fetchErr || !s1) {
          return NextResponse.json({ success: false, error: 'ไม่พบคาบเรียนต้นทาง' }, { status: 404 });
        }

        const tDay = Number(target_day);
        const tPeriod = Number(target_period);

        // Fetch all other slots
        const { data: allSlots } = await supabase
          .from('academic_timetables')
          .select('*')
          .eq('academic_year', academic_year)
          .eq('term', term)
          .neq('id', slot_id_1);

        // Check if destination is already occupied by this class
        const targetSlot = (allSlots || []).find(
          s => s.class_id === s1.class_id && s.day_of_week === tDay && s.period_number === tPeriod
        );
        if (targetSlot) {
          return NextResponse.json({
            success: false,
            error: `คาบปลายทาง (วัน${tDay} คาบ${tPeriod}) ไม่ว่าง มีวิชาอยู่แล้ว กรุณาเลือกสลับคาบแทน`
          }, { status: 400 });
        }

        const candidateSlot = { ...s1, day_of_week: tDay, period_number: tPeriod };
        const testCollisions = detectCollisions([...(allSlots || []), candidateSlot]);
        if (testCollisions.length > 0) {
          return NextResponse.json({
            success: false,
            error: `ไม่สามารถย้ายคาบได้: ${testCollisions[0].description}`,
            collision: testCollisions[0]
          }, { status: 400 });
        }

        const { error: moveErr } = await supabase
          .from('academic_timetables')
          .update({
            day_of_week: tDay,
            period_number: tPeriod
          })
          .eq('id', slot_id_1);

        if (moveErr) throw moveErr;

        return NextResponse.json({
          success: true,
          message: 'ย้ายคาบเรียนไปยังคาบว่างสำเร็จ'
        });
      }

      return NextResponse.json({ success: false, error: 'ข้อมูลสำหรับสลับหรือย้ายคาบไม่ครบถ้วน' }, { status: 400 });
    }

    // ACTION 2: UPDATE SLOT DETAILS (Course, Teacher, Room)
    if (action === 'update' || !action) {
      const { slot_id, course_id, teacher_id, room_name } = body;
      if (!slot_id || !course_id || !teacher_id) {
        return NextResponse.json({ success: false, error: 'กรุณาระบุ slot_id, course_id และ teacher_id' }, { status: 400 });
      }

      const { data: currentSlot, error: fetchErr } = await supabase
        .from('academic_timetables')
        .select('*')
        .eq('id', slot_id)
        .single();

      if (fetchErr || !currentSlot) {
        return NextResponse.json({ success: false, error: 'ไม่พบคาบเรียนที่ต้องการแก้ไข' }, { status: 404 });
      }

      // Check collision
      const { data: allSlots } = await supabase
        .from('academic_timetables')
        .select('*')
        .eq('academic_year', currentSlot.academic_year)
        .eq('term', currentSlot.term)
        .neq('id', slot_id);

      const candidateSlot = {
        ...currentSlot,
        course_id,
        teacher_id,
        room_name: room_name || null
      };

      const collisions = detectCollisions([...(allSlots || []), candidateSlot]);
      if (collisions.length > 0) {
        return NextResponse.json({
          success: false,
          error: `ไม่สามารถปรับเปลี่ยนได้: ${collisions[0].description}`,
          collision: collisions[0]
        }, { status: 400 });
      }

      const { data: updated, error: updateErr } = await supabase
        .from('academic_timetables')
        .update({
          course_id,
          teacher_id,
          room_name: room_name || null
        })
        .eq('id', slot_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return NextResponse.json({
        success: true,
        slot: updated,
        message: 'ปรับปรุงรายละเอียดคาบเรียนเรียบร้อยแล้ว'
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating timetable slot:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch (e) {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุรหัสคาบเรียน (id)' }, { status: 400 });
    }

    const { error } = await supabase
      .from('academic_timetables')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'ลบคาบเรียนออกจากตารางเรียบร้อยแล้ว (ปรับเป็นคาบว่าง)'
    });
  } catch (error: any) {
    console.error('Error deleting timetable slot:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
