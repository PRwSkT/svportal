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

    // 1. Fetch active students
    const { data: students, error: fetchErr } = await supabase
      .from('students')
      .select('id, grade')
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่']);

    if (fetchErr) throw fetchErr;
    if (!students || students.length === 0) {
      return NextResponse.json({ message: 'ไม่มีนักเรียนที่กำลังศึกษาอยู่ให้เลื่อนชั้น', updated: 0 });
    }

    // 2. Prepare bulk updates
    const updates = students.map((student) => {
      let newGrade = student.grade;
      let newStatus = 'กำลังศึกษาอยู่';

      if (student.grade) {
        // รองรับรูปแบบ อ.1, อ.1/1, ป.6, ป.6/2
        const gradeMatch = student.grade.match(/^(อ|ป)\.(\d)(?:\/(\d+))?$/);
        if (gradeMatch) {
          const type = gradeMatch[1]; // อ or ป
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

    // 3. Bulk upsert in Supabase
    // Supabase upsert works well for batch updates
    const { error: updateErr } = await supabase
      .from('students')
      .upsert(updates, { onConflict: 'id' });

    if (updateErr) throw updateErr;

    return NextResponse.json({ message: 'Success', updated: updates.length });

  } catch (error: any) {
    console.error('Promotion error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
