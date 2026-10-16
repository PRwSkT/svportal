import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { findBestTeacherSubstitute } from '@/lib/academic/timetable-engine';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    let query = supabase
      .from('academic_substitutions')
      .select(`
        *,
        class:academic_classes(name, grade_level),
        course:academic_courses(course_code, name_th, subject_group),
        original_teacher:personnel!academic_substitutions_original_teacher_id_fkey(name_th),
        substitute_teacher:personnel!academic_substitutions_substitute_teacher_id_fkey(name_th)
      `)
      .order('date', { ascending: false })
      .order('period_number', { ascending: true });

    if (date) query = query.eq('date', date);

    const { data: substitutions, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, substitutions: substitutions || [] });
  } catch (error: any) {
    console.error('Error fetching substitutions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();

    const {
      date, // YYYY-MM-DD
      original_teacher_id,
      reason = 'ลาป่วย/ลากิจ',
      assigned_by = 'น้องฟ้า AI วิชาการ'
    } = body;

    if (!date || !original_teacher_id) {
      return NextResponse.json({
        success: false,
        error: 'กรุณาระบุวันที่และครูที่ต้องการลา'
      }, { status: 400 });
    }

    // Determine day of week from date: Sunday=0, Monday=1, ... Friday=5
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 1 = Monday, 5 = Friday

    if (dayOfWeek < 1 || dayOfWeek > 5) {
      return NextResponse.json({
        success: false,
        error: 'วันที่ระบุไม่ใช่วันทำการเรียนการสอน (จันทร์ - ศุกร์)'
      }, { status: 400 });
    }

    // 1. Fetch original teacher's scheduled slots on that day
    const { data: teacherSlots, error: slotError } = await supabase
      .from('academic_timetables')
      .select(`
        *,
        class:academic_classes(id, name, grade_level),
        course:academic_courses(id, name_th, subject_group, grade_level)
      `)
      .eq('teacher_id', original_teacher_id)
      .eq('day_of_week', dayOfWeek);

    if (slotError) throw slotError;

    if (!teacherSlots || teacherSlots.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'ครูท่านนี้ไม่มีตารางสอนในวันที่ระบุ',
        substitutions: []
      });
    }

    // 2. Fetch all active teachers, competencies, all timetables, and recent substitutions
    const { data: allTeachers } = await supabase
      .from('personnel')
      .select('id, name_th')
      .eq('is_active', true);

    const { data: allCompetencies } = await supabase
      .from('academic_teacher_competencies')
      .select('*')
      .eq('is_active', true);

    const { data: allTimetables } = await supabase
      .from('academic_timetables')
      .select('*');

    const { data: recentSubs } = await supabase
      .from('academic_substitutions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    // 3. For each affected period, run 5-Tier Smart Matching
    const proposedSubstitutions: any[] = [];

    for (const slot of teacherSlots) {
      const match = findBestTeacherSubstitute({
        dayOfWeek,
        periodNumber: slot.period_number,
        classId: slot.class_id,
        courseId: slot.course_id,
        courseSubjectGroup: slot.course?.subject_group || 'ทั่วไป',
        courseGradeLevel: slot.course?.grade_level || slot.class?.grade_level || 'P1',
        originalTeacherId: original_teacher_id,
        allTeachers: allTeachers || [],
        timetables: allTimetables || [],
        competencies: allCompetencies || [],
        recentSubstitutions: recentSubs || []
      });

      // Save to academic_substitutions
      const subRecord = {
        date,
        period_number: slot.period_number,
        class_id: slot.class_id,
        course_id: slot.course_id,
        original_teacher_id,
        substitute_teacher_id: match.teacherId || null,
        reason,
        status: match.teacherId ? 'PROPOSED' : 'REJECTED',
        assigned_by,
        matching_criteria: `${match.tier}: ${match.reason}`,
        worksheet_info: match.readyToTeachWorksheet
      };

      const { data: inserted, error: insErr } = await supabase
        .from('academic_substitutions')
        .insert(subRecord)
        .select(`
          *,
          class:academic_classes(name),
          course:academic_courses(name_th),
          substitute_teacher:personnel!academic_substitutions_substitute_teacher_id_fkey(name_th, user_id)
        `)
        .single();

      if (!insErr && inserted) {
        proposedSubstitutions.push(inserted);

        // Notify substitute teacher
        if (inserted.substitute_teacher_id) {
          const { notifySubstituteAssigned } = await import('@/lib/academic/notifications');
          notifySubstituteAssigned({
            substituteUserId: (inserted.substitute_teacher as any)?.user_id || null,
            substituteTeacherName: (inserted.substitute_teacher as any)?.name_th || 'คุณครู',
            periodNumber: slot.period_number,
            className: (inserted.class as any)?.name || '',
            courseName: (inserted.course as any)?.name_th || '',
            date,
            worksheetInfo: match.readyToTeachWorksheet
          }).catch(e => console.error('Sub notification error:', e));
        }
      }
    }

    return NextResponse.json({
      success: true,
      substitutions_count: proposedSubstitutions.length,
      substitutions: proposedSubstitutions,
      message: `น้องฟ้า AI จัดครูสอนแทนสำเร็จ ${proposedSubstitutions.length} คาบ ด้วยอัลกอริทึม 5 ลำดับขั้น`
    });
  } catch (error: any) {
    console.error('Error assigning substitutions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
