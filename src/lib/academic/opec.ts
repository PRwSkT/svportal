/**
 * OPEC (สช.) Dual-Layer Transformation Engine
 * รองรับการแปลงข้อมูลจากระบบทำงานจริงของโรงเรียน สู่รูปแบบมาตรฐานของระบบ REGIS สช.
 */

import { getAdminClient } from '@/lib/supabase/admin';

export interface OpecExportRow {
  studentCode: string;          // รหัสนักเรียน (4-5 หลัก)
  citizenId: string;            // เลขประจำตัวประชาชน 13 หลัก
  studentName: string;          // ชื่อ-สกุล
  opecRoomName: string;         // ห้องเรียน สช. (เช่น 'ป.3' รวมจาก ป.3/1 และ ป.3/2)
  opecCourseCode: string;       // รหัสวิชา สช. (เช่น 'ค13101')
  courseName: string;           // ชื่อวิชา
  totalScore: number;           // คะแนนรวม 100
  finalGrade: string;           // เกรด 8 ระดับ (0-4)
  teacherName: string;          // ชื่อครูผู้มีวิทยฐานะตามทะเบียน สช.
}

/**
 * ดึงและแปลงข้อมูลผลการเรียนสำหรับส่งระบบ REGIS สช.
 * - รวมห้องย่อย (ป.3/1 + ป.3/2) เข้าสู่ห้องเดียวของ สช.
 * - ตัดวิชา MEP ที่ไม่ส่ง สช. ออกโดยอัตโนมัติ (เช่น Mathematics)
 * - แปลงชื่อครูผู้สอนจริง เป็นครูที่มีชื่อตามทะเบียน สช.
 */
export async function generateOpecRegisExportData(params: {
  academicYear: string;
  department?: string;
  gradeLevel?: string; // เช่น 'P3'
  customClient?: any;
}): Promise<{
  rows: OpecExportRow[];
  summary: {
    totalStudents: number;
    totalCourses: number;
    excludedMepCourses: string[];
    consolidatedRooms: string[];
  };
}> {
  const supabase = params.customClient || getAdminClient();
  const { academicYear, gradeLevel } = params;

  // 1. ดึงรายวิชาที่กำหนดให้ส่ง สช. (is_reported_to_opec = true)
  let courseQuery = supabase
    .from('academic_courses')
    .select('*')
    .eq('academic_year', academicYear)
    .eq('is_reported_to_opec', true);

  if (gradeLevel) courseQuery = courseQuery.eq('grade_level', gradeLevel);

  const { data: opecCourses, error: courseError } = await courseQuery;
  if (courseError) throw courseError;

  // ดึงวิชาที่ถูกคัดออกเพื่อรายงาน summary
  const { data: excludedCourses } = await supabase
    .from('academic_courses')
    .select('name_th, course_code')
    .eq('academic_year', academicYear)
    .eq('is_reported_to_opec', false);

  const excludedNames = ((excludedCourses || []) as any[]).map((c: any) => `${c.name_th} (${c.course_code})`);

  // 2. ดึงห้องเรียนและครูผู้มีวิทยฐานะตาม สช.
  let classQuery = supabase
    .from('academic_classes')
    .select(`
      id,
      name,
      opec_room_name,
      opec_homeroom_teacher:personnel!academic_classes_opec_homeroom_teacher_id_fkey(name_th)
    `)
    .eq('academic_year', academicYear);

  if (gradeLevel) classQuery = classQuery.eq('grade_level', gradeLevel);

  const { data: classes, error: classError } = await classQuery;
  if (classError) throw classError;

  const classList = (classes || []) as any[];
  const classMap = new Map<string, any>(classList.map((c: any) => [c.id, c]));
  const consolidatedRoomsSet = new Set<string>();
  classList.forEach((c: any) => consolidatedRoomsSet.add(`${c.name} -> ${c.opec_room_name}`));

  // 3. ดึง Gradebooks ที่ตรงกับวิชาของ สช.
  const courseList = (opecCourses || []) as any[];
  const courseIds = courseList.map((c: any) => c.id);
  if (courseIds.length === 0) {
    return {
      rows: [],
      summary: {
        totalStudents: 0,
        totalCourses: 0,
        excludedMepCourses: excludedNames,
        consolidatedRooms: Array.from(consolidatedRoomsSet)
      }
    };
  }

  const { data: gradebooks, error: gbError } = await supabase
    .from('academic_gradebooks')
    .select(`
      id,
      class_id,
      course_id,
      actual_teacher:personnel!academic_gradebooks_actual_teacher_id_fkey(name_th),
      opec_teacher:personnel!academic_gradebooks_opec_teacher_id_fkey(name_th)
    `)
    .in('course_id', courseIds);

  if (gbError) throw gbError;

  const courseMap = new Map<string, any>(courseList.map((c: any) => [c.id, c]));
  const gbList = (gradebooks || []) as any[];
  const gradebookIds = gbList.map((g: any) => g.id);

  if (gradebookIds.length === 0) {
    return {
      rows: [],
      summary: {
        totalStudents: 0,
        totalCourses: opecCourses.length,
        excludedMepCourses: excludedNames,
        consolidatedRooms: Array.from(consolidatedRoomsSet)
      }
    };
  }

  // 4. ดึงคะแนนนักเรียนรายบุคคลพร้อมข้อมูลบัตรประชาชนจากตาราง students
  const { data: studentGrades, error: sgError } = await supabase
    .from('academic_student_grades')
    .select(`
      gradebook_id,
      student_id,
      total_score,
      final_grade,
      student:students(id, name, citizen_id)
    `)
    .in('gradebook_id', gradebookIds);

  if (sgError) throw sgError;

  const exportRows: OpecExportRow[] = [];
  const studentSet = new Set<string>();

  const gbMap = new Map<string, any>(gbList.map((g: any) => [g.id, g]));

  for (const sg of ((studentGrades || []) as any[])) {
    const gb = gbMap.get(sg.gradebook_id);
    if (!gb) continue;

    const course = courseMap.get(gb.course_id);
    const cls = classMap.get(gb.class_id);
    if (!course || !cls) continue;

    const student = sg.student as any;
    studentSet.add(sg.student_id);

    // เลือกว่าจะใช้ชื่อครูตามวิทยฐานะ สช. หรือ fallback เป็นครูผู้สอนจริง
    const officialTeacherName = gb.opec_teacher?.name_th || gb.actual_teacher?.name_th || 'ไม่ระบุ';

    exportRows.push({
      studentCode: sg.student_id,
      citizenId: student?.citizen_id || '',
      studentName: student?.name || '',
      opecRoomName: cls.opec_room_name, // e.g. รวม ป.3/1 และ ป.3/2 เป็น 'ป.3'
      opecCourseCode: course.opec_course_code || course.course_code,
      courseName: course.name_th,
      totalScore: sg.total_score,
      finalGrade: sg.final_grade || '0',
      teacherName: officialTeacherName
    });
  }

  // เรียงลำดับตาม: รหัสห้อง สช. -> รหัสวิชา -> เลขบัตรประชาชน
  exportRows.sort((a, b) => {
    if (a.opecRoomName !== b.opecRoomName) return a.opecRoomName.localeCompare(b.opecRoomName);
    if (a.opecCourseCode !== b.opecCourseCode) return a.opecCourseCode.localeCompare(b.opecCourseCode);
    return a.studentCode.localeCompare(b.studentCode);
  });

  return {
    rows: exportRows,
    summary: {
      totalStudents: studentSet.size,
      totalCourses: opecCourses.length,
      excludedMepCourses: excludedNames,
      consolidatedRooms: Array.from(consolidatedRoomsSet)
    }
  };
}

export function generateOpecCsv(rows: OpecExportRow[]): string {
  const headers = [
    'รหัสนักเรียน',
    'เลขประจำตัวประชาชน',
    'ชื่อ-สกุล',
    'ห้องเรียน (สช.)',
    'รหัสวิชา (สช.)',
    'ชื่อวิชา',
    'คะแนนรวม',
    'ผลการเรียน',
    'ครูผู้สอนตามทะเบียน สช.'
  ];

  const csvRows = rows.map(r => [
    r.studentCode,
    r.citizenId,
    r.studentName,
    r.opecRoomName,
    r.opecCourseCode,
    r.courseName,
    r.totalScore,
    r.finalGrade,
    r.teacherName
  ]);

  const BOM = '\uFEFF';
  const csvContent = [
    headers.join(','),
    ...csvRows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return BOM + csvContent;
}

