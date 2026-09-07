import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    // 1. Fetch active students (need all fields to clone E-students)
    const { data: students, error: fetchErr } = await supabase
      .from('students')
      .select('*')
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่']);

    if (fetchErr) throw fetchErr;
    if (!students || students.length === 0) {
      return NextResponse.json({ message: 'ไม่มีนักเรียนที่กำลังศึกษาอยู่ให้เลื่อนชั้น', updated: 0 });
    }

    // 2. Separate into normal and E-students
    const normalStudents = students.filter(s => !s.id.toUpperCase().startsWith('E'));
    const eStudents = students.filter(s => s.id.toUpperCase().startsWith('E'));

    // 3. Process Normal Students (Grade Promotion)
    if (normalStudents.length > 0) {
      const updates = normalStudents.map((student) => {
        let newGrade = student.grade;
        let newStatus = 'กำลังศึกษาอยู่';

        if (student.grade) {
          const gradeMatch = student.grade.match(/^(อ|ป)\.(\d)(?:\/(\d+))?$/);
          if (gradeMatch) {
            const type = gradeMatch[1];
            const level = parseInt(gradeMatch[2], 10);
            const room = gradeMatch[3] ? `/${gradeMatch[3]}` : '';

            if (type === 'อ') {
              if (level < 3) {
                newGrade = `อ.${level + 1}${room}`;
              } else if (level === 3) {
                newGrade = `ป.1${room}`;
              }
            } else if (type === 'ป') {
              if (level < 6) {
                newGrade = `ป.${level + 1}${room}`;
              } else if (level === 6) {
                newStatus = 'สำเร็จการศึกษา';
              }
            }
          }
        }

        return {
          id: student.id,
          grade: newGrade,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: updateErr } = await supabase
        .from('students')
        .upsert(updates, { onConflict: 'id' });

      if (updateErr) throw updateErr;
    }

    // 4. Process E-Students (Convert to Normal ID, no grade change)
    if (eStudents.length > 0) {
      const { data: maxIdData, error: maxIdErr } = await supabase.rpc('get_max_student_id');
      if (maxIdErr) throw maxIdErr;
      let currentMax = Number(maxIdData) || 0;

      for (const eStudent of eStudents) {
        currentMax++;
        const newId = currentMax.toString();

        const { error: migrateErr } = await supabase.rpc('migrate_student_id', {
          old_id: eStudent.id,
          new_id: newId,
        });
        if (migrateErr) {
          console.error(`Failed to migrate student ${eStudent.id} to ${newId}:`, migrateErr);
          throw migrateErr;
        }
      }
    }

    return NextResponse.json({ message: 'Success', updated: normalStudents.length + eStudents.length });

  } catch (error: any) {
    console.error('Promotion error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
