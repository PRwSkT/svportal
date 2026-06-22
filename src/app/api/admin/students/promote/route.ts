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
      // Find max normal ID
      const { data: allIds } = await supabase.from('students').select('id');
      let maxNormal = 0;
      for (const { id } of allIds || []) {
        if (!id.toUpperCase().startsWith('E')) {
          const num = parseInt(id, 10);
          if (!isNaN(num) && num > maxNormal) {
            maxNormal = num;
          }
        }
      }

      for (const eStudent of eStudents) {
        maxNormal++;
        const newId = maxNormal.toString();
        
        const newStudent = {
          ...eStudent,
          id: newId,
          status: 'กำลังศึกษาอยู่', // Clean their status
          updated_at: new Date().toISOString()
        };

        // Insert new profile
        const { error: insertErr } = await supabase.from('students').insert(newStudent);
        if (insertErr) throw insertErr;

        // Re-assign foreign keys (Application-level migration)
        await supabase.from('student_addresses').update({ student_id: newId }).eq('student_id', eStudent.id);
        await supabase.from('student_parents').update({ student_id: newId }).eq('student_id', eStudent.id);
        await supabase.from('wallet_transactions').update({ student_id: newId }).eq('student_id', eStudent.id);
        
        // Delete old profile
        const { error: deleteErr } = await supabase.from('students').delete().eq('id', eStudent.id);
        if (deleteErr) console.error('Failed to delete old E-student', deleteErr);
      }
    }

    return NextResponse.json({ message: 'Success', updated: normalStudents.length + eStudents.length });

  } catch (error: any) {
    console.error('Promotion error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
