import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

/**
 * GET: Pre-flight inspection for Rollover & Promotion
 * Returns current term status, gradebook readiness, 0/ร/มส remediation queue, and student statistics.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth('admin', 'admin_students');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const academicYear = searchParams.get('academic_year') || '2568';
    const supabase = getAdminClient();

    // 1. Gradebooks Status for Term 1 / Full Year
    const { data: gradebooks } = await supabase
      .from('academic_gradebooks')
      .select('id, approval_status, term, class:academic_classes(name), course:academic_courses(name_th)')
      .order('created_at', { ascending: false });

    const totalGradebooks = gradebooks?.length || 0;
    const lockedGradebooks = gradebooks?.filter(g => g.approval_status === 'OFFICIALLY_LOCKED').length || 0;
    const pendingGradebooks = totalGradebooks - lockedGradebooks;

    // 2. Scan for 0 / ร / มส / ขส Remediation Queue
    const { data: problemGrades } = await supabase
      .from('academic_student_grades')
      .select(`
        id,
        student_id,
        final_grade,
        total_score,
        attendance_percent,
        is_incomplete,
        is_absent,
        student:students(id, name, grade, classroom),
        gradebook:academic_gradebooks(
          id,
          course:academic_courses(course_code, name_th),
          class:academic_classes(name)
        )
      `)
      .in('final_grade', ['0', 'ร', 'มส', 'ขส'])
      .order('student_id', { ascending: true });

    // 3. Active Students Demographics & E-students
    const { data: students } = await supabase
      .from('students')
      .select('id, name, grade, status')
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่']);

    const activeList = students || [];
    const normalCount = activeList.filter(s => !s.id.toUpperCase().startsWith('E')).length;
    const eStudentsCount = activeList.filter(s => s.id.toUpperCase().startsWith('E')).length;
    const p6GraduatingCount = activeList.filter(s => s.grade && s.grade.startsWith('ป.6')).length;
    const nurseryCount = activeList.filter(s => s.grade && (s.grade.includes('เนอสเซอรี่') || s.grade.includes('บริบาล') || s.grade.includes('เตรียม'))).length;

    return NextResponse.json({
      success: true,
      academic_year: academicYear,
      phase_a_term_rollover: {
        total_gradebooks: totalGradebooks,
        locked_gradebooks: lockedGradebooks,
        pending_gradebooks: pendingGradebooks,
        is_ready_for_term2: pendingGradebooks === 0,
        remediation_queue_count: problemGrades?.length || 0,
        remediation_queue: problemGrades || []
      },
      phase_b_year_promotion: {
        total_active_students: activeList.length,
        normal_students: normalCount,
        e_students: eStudentsCount,
        p6_graduating: p6GraduatingCount,
        nursery_count: nurseryCount
      }
    });
  } catch (error: any) {
    console.error('Promotion pre-flight error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: 2-Phase Rollover Engine
 * - action: 'term_rollover' (Phase A: ปิดภาคเรียนที่ 1 -> เปิดภาคเรียนที่ 2)
 * - action: 'year_promotion' (Phase B: เลื่อนชั้นสิ้นปีการศึกษา พร้อมบันทึกประวัติ ปพ.1 ย้อนหลัง)
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth('admin', 'admin_students');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getAdminClient();
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'year_promotion';
    const academicYear = body.academic_year || '2568';
    const retainedStudentIds: string[] = Array.isArray(body.retained_student_ids) ? body.retained_student_ids : [];

    // -------------------------------------------------------------------------
    // Phase A: End-of-Semester Rollover (ปิดภาคเรียนที่ 1 -> เปิดภาคเรียนที่ 2)
    // -------------------------------------------------------------------------
    if (action === 'term_rollover') {
      // 1. Audit Remediation Queue
      const { data: remedialGrades } = await supabase
        .from('academic_student_grades')
        .select('student_id, final_grade')
        .in('final_grade', ['0', 'ร', 'มส', 'ขส']);

      const remedialCount = remedialGrades?.length || 0;

      // 2. Update active term in academic_years if table exists
      try {
        await supabase
          .from('academic_years')
          .update({ is_active: false })
          .eq('term', '1');

        await supabase
          .from('academic_years')
          .upsert({
            year: academicYear,
            term: '2',
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'year,term' });
      } catch (e) {
        console.warn('academic_years term switch notice:', e);
      }

      return NextResponse.json({
        success: true,
        action: 'term_rollover',
        academic_year: academicYear,
        active_term: '2',
        remedial_count: remedialCount,
        message: `ปิดภาคเรียนที่ 1 และเปิดภาคเรียนที่ 2 เรียบร้อยแล้ว (พบนักเรียนในคิวซ่อมเสริม ${remedialCount} รายการ)`
      });
    }

    // -------------------------------------------------------------------------
    // Phase B: Year-End Promotion (เลื่อนชั้นสิ้นปีการศึกษา)
    // -------------------------------------------------------------------------
    if (action === 'year_promotion') {
      // 1. Fetch active students
      const { data: students, error: fetchErr } = await supabase
        .from('students')
        .select('*')
        .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่']);

      if (fetchErr) throw fetchErr;
      if (!students || students.length === 0) {
        return NextResponse.json({ message: 'ไม่มีนักเรียนที่กำลังศึกษาอยู่ให้เลื่อนชั้น', updated: 0 });
      }

      // 2. Fetch student GPA / attendance for academic snapshot
      const { data: allGrades } = await supabase
        .from('academic_student_grades')
        .select('student_id, final_grade, total_score, attendance_percent');

      const gradeStatsMap = new Map<string, { totalScore: number; count: number; avgAttendance: number }>();
      (allGrades || []).forEach(g => {
        const sid = g.student_id;
        const cur = gradeStatsMap.get(sid) || { totalScore: 0, count: 0, avgAttendance: 100 };
        cur.totalScore += Number(g.total_score) || 0;
        cur.count++;
        cur.avgAttendance = Number(g.attendance_percent) || cur.avgAttendance;
        gradeStatsMap.set(sid, cur);
      });

      // 3. Separate into normal and E-students
      const normalStudents = students.filter(s => !s.id.toUpperCase().startsWith('E'));
      const eStudents = students.filter(s => s.id.toUpperCase().startsWith('E'));

      // 4. Archive snapshot to student_academic_history
      const historySnapshots = normalStudents.map(student => {
        const stats = gradeStatsMap.get(student.id);
        const gpax = stats && stats.count > 0 ? Math.round((stats.totalScore / stats.count / 25) * 100) / 100 : null; // Approximate GPA on 4.0 scale
        const isRetained = retainedStudentIds.includes(student.id);
        const isGraduating = student.grade && student.grade.startsWith('ป.6');

        let status = 'PROMOTED';
        if (isRetained) status = 'RETAINED';
        else if (isGraduating) status = 'GRADUATED';

        return {
          student_id: student.id,
          academic_year: academicYear,
          grade_level: student.grade || 'ไม่ระบุ',
          classroom: student.classroom || (student.grade?.includes('/') ? student.grade.split('/')[1] : '1'),
          gpax,
          attendance_percent: stats?.avgAttendance ?? 100.0,
          promotion_status: status,
          remedial_required: false,
          archived_at: new Date().toISOString(),
          archived_by: 'ระบบเลื่อนชั้นอัตโนมัติ (Somkid Academic Engine)'
        };
      });

      try {
        await supabase
          .from('student_academic_history')
          .upsert(historySnapshots, { onConflict: 'student_id, academic_year' });
      } catch (histErr) {
        console.warn('Note on student_academic_history archive:', histErr);
      }

      // 5. Calculate new grade levels for Normal Students
      let graduatedCount = 0;
      let promotedCount = 0;
      let retainedCount = 0;

      const studentUpdates = normalStudents.map(student => {
        const isRetained = retainedStudentIds.includes(student.id);
        if (isRetained) {
          retainedCount++;
          return {
            id: student.id,
            grade: student.grade,
            status: student.status,
            updated_at: new Date().toISOString()
          };
        }

        let newGrade = student.grade;
        let newStatus = 'กำลังศึกษาอยู่';

        if (student.grade) {
          const raw = student.grade.trim();

          // Case 1: Nursery / Pre-Kindergarten -> Kindergarten 1
          if (raw.includes('เนอสเซอรี่') || raw.includes('บริบาล') || raw.includes('เตรียมอนุบาล')) {
            const roomMatch = raw.match(/\/(\d+)/);
            const room = roomMatch ? `/${roomMatch[1]}` : '/1';
            newGrade = `อ.1${room}`;
            promotedCount++;
          }
          // Case 2: Kindergarten and Primary (อ.1-3, ป.1-6)
          else {
            const gradeMatch = raw.match(/^(อ|ป)\.(\d)(?:\/(\d+))?$/);
            if (gradeMatch) {
              const type = gradeMatch[1];
              const level = parseInt(gradeMatch[2], 10);
              const room = gradeMatch[3] ? `/${gradeMatch[3]}` : '';

              if (type === 'อ') {
                if (level < 3) {
                  newGrade = `อ.${level + 1}${room}`;
                  promotedCount++;
                } else if (level === 3) {
                  newGrade = `ป.1${room}`;
                  promotedCount++;
                }
              } else if (type === 'ป') {
                if (level < 6) {
                  newGrade = `ป.${level + 1}${room}`;
                  promotedCount++;
                } else if (level === 6) {
                  newGrade = `ป.6${room}`;
                  newStatus = 'สำเร็จการศึกษา';
                  graduatedCount++;
                }
              }
            } else {
              promotedCount++;
            }
          }
        }

        return {
          id: student.id,
          grade: newGrade,
          status: newStatus,
          updated_at: new Date().toISOString()
        };
      });

      if (studentUpdates.length > 0) {
        const { error: updateErr } = await supabase
          .from('students')
          .upsert(studentUpdates, { onConflict: 'id' });

        if (updateErr) throw updateErr;
      }

      // 6. Process E-Students (Migrate temporary pre-registered IDs to official IDs)
      let migratedCount = 0;
      if (eStudents.length > 0) {
        const { data: maxIdData, error: maxIdErr } = await supabase.rpc('get_max_student_id');
        if (maxIdErr) throw maxIdErr;
        let currentMax = Number(maxIdData) || 0;

        for (const eStudent of eStudents) {
          currentMax++;
          const newId = currentMax.toString();

          const { error: migrateErr } = await supabase.rpc('migrate_student_id', {
            old_id: eStudent.id,
            new_id: newId
          });
          if (migrateErr) {
            console.error(`Failed to migrate student ${eStudent.id} to ${newId}:`, migrateErr);
            throw migrateErr;
          }
          migratedCount++;
        }
      }

      // 7. Advance active academic year in academic_years table
      const nextYear = (parseInt(academicYear, 10) + 1).toString();
      try {
        await supabase
          .from('academic_years')
          .upsert({
            year: nextYear,
            term: '1',
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'year,term' });
      } catch (yErr) {
        console.warn('Academic year increment notice:', yErr);
      }

      return NextResponse.json({
        success: true,
        action: 'year_promotion',
        previous_year: academicYear,
        new_year: nextYear,
        promoted_count: promotedCount,
        graduated_count: graduatedCount,
        retained_count: retainedCount,
        e_migrated_count: migratedCount,
        history_archived_count: historySnapshots.length,
        updated: normalStudents.length + eStudents.length,
        message: `เลื่อนชั้นประจำปีการศึกษาสำเร็จ: เลื่อนชั้น ${promotedCount} คน, สำเร็จการศึกษา ${graduatedCount} คน, ซ้ำชั้น ${retainedCount} คน, โอนย้ายรหัสชั่วคราว ${migratedCount} คน และจัดเก็บประวัติ ปพ.1 ย้อนหลัง ${historySnapshots.length} คน`
      });
    }

    return NextResponse.json({ error: 'Invalid action. Supported: term_rollover, year_promotion' }, { status: 400 });
  } catch (error: any) {
    console.error('Promotion error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
