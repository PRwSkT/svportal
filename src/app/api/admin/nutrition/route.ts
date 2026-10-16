import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { 
  evaluateStudentHealth, 
  aggregateNutritionBatch,
  calculateBMI,
  evaluateWeightForHeight,
  evaluateHeightForAge,
  evaluateWeightForAge,
  calculateAge,
} from '@/lib/pastoral/nutrition';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth('admin', 'student_nutrition');
    if (auth.error) {
      const fallbackAuth = await requireAuth('admin', 'admin_students');
      if (fallbackAuth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const { searchParams } = new URL(request.url);
    const grade = searchParams.get('grade') || 'all';
    const searchQuery = searchParams.get('q') || '';
    const statusFilter = searchParams.get('status') || 'กำลังศึกษาอยู่';

    const supabase = getAdminClient();

    let query = supabase
      .from('students')
      .select('*, student_addresses(*), student_parents(*)')
      .limit(10000);

    if (searchQuery) {
      const sanitized = searchQuery.replace(/[,()"]/g, '').trim();
      if (sanitized) {
        query = query.or(`id.ilike.%${sanitized}%,name.ilike.%${sanitized}%`);
      }
    }

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'กำลังศึกษาอยู่') {
        query = query.in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่', 'นักเรียนเก่าเข้าใหม่']);
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    if (grade && grade !== 'all') {
      const grades = grade.split(',').map(g => g.trim()).filter(Boolean);
      const orClauses = grades.flatMap(g => [`grade.eq.${g}`, `grade.ilike.${g}/%`]);
      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','));
      }
    }

    const { data: students, error } = await query;
    if (error) {
      console.error('Fetch nutrition students error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const studentList = students || [];

    // Sort students by Grade level then Student ID
    studentList.sort((a: any, b: any) => {
      const gradeA = a.grade || '';
      const gradeB = b.grade || '';
      const isAnubanA = gradeA.startsWith('อ.');
      const isAnubanB = gradeB.startsWith('อ.');
      if (isAnubanA && !isAnubanB) return -1;
      if (!isAnubanA && isAnubanB) return 1;
      if (gradeA !== gradeB) return gradeA.localeCompare(gradeB);

      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return (a.id || '').localeCompare(b.id || '');
    });

    // Run Department of Health Aggregate Assessment
    const summary = aggregateNutritionBatch(studentList);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    console.error('Nutrition API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth('admin', 'student_nutrition');
    if (auth.error) {
      const fallbackAuth = await requireAuth('admin', 'admin_students');
      if (fallbackAuth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const body = await request.json();
    const { 
      academicYear = '2568', 
      term = 1, 
      measurements = [] 
    } = body;

    if (!Array.isArray(measurements) || measurements.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการข้อมูลส่วนสูง-น้ำหนักที่ต้องการบันทึก' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Fetch existing students for gender and birth_date to calculate status
    const studentIds = measurements.map((m: any) => String(m.studentId).trim());
    const { data: existingStudents, error: fetchErr } = await supabase
      .from('students')
      .select('id, gender, birth_date')
      .in('id', studentIds);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const studentMap = new Map((existingStudents || []).map(s => [s.id, s]));

    const healthLogInserts: any[] = [];
    const studentUpdates: any[] = [];

    const now = new Date().toISOString();

    for (const item of measurements) {
      const sid = String(item.studentId).trim();
      const rawH = item.height !== null && item.height !== undefined && item.height !== '' ? parseFloat(String(item.height)) : null;
      const rawW = item.weight !== null && item.weight !== undefined && item.weight !== '' ? parseFloat(String(item.weight)) : null;

      const studentMeta = studentMap.get(sid);
      const gender = studentMeta?.gender || 'ชาย';
      const age = calculateAge(studentMeta?.birth_date);
      const bmiObj = calculateBMI(rawW, rawH);
      const wfh = evaluateWeightForHeight(gender, rawH, rawW);
      const hfa = evaluateHeightForAge(gender, age.totalMonths, rawH);
      const wfa = evaluateWeightForAge(gender, age.totalMonths, rawW);

      healthLogInserts.push({
        student_id: sid,
        academic_year: String(academicYear),
        term: Number(term),
        measurement_date: new Date().toISOString().split('T')[0],
        height: rawH,
        weight: rawW,
        bmi: bmiObj.bmi,
        weight_for_height: wfh.status,
        height_for_age: hfa.status,
        weight_for_age: wfa.status,
        recorded_by: (auth.user as any)?.email || 'admin',
        updated_at: now,
      });

      // Update student table directly with latest height and weight
      studentUpdates.push(
        supabase
          .from('students')
          .update({
            height: rawH,
            weight: rawW,
            updated_at: now,
          })
          .eq('id', sid)
      );
    }

    // 1. Upsert into student_health_logs
    const { error: upsertErr } = await supabase
      .from('student_health_logs')
      .upsert(healthLogInserts, { onConflict: 'student_id,academic_year,term' });

    if (upsertErr) {
      console.error('Health logs upsert error:', upsertErr);
      return NextResponse.json({ error: 'บันทึกประวัติสุขภาพไม่สำเร็จ: ' + upsertErr.message }, { status: 500 });
    }

    // 2. Execute updates on students table
    await Promise.all(studentUpdates);

    return NextResponse.json({
      success: true,
      message: `บันทึกข้อมูลส่วนสูง-น้ำหนักสำเร็จ ${measurements.length} รายการ`,
      count: measurements.length,
    });
  } catch (err: any) {
    console.error('Save nutrition error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
