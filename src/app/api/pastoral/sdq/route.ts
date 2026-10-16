import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { 
  calculateSDQ, 
  compareTriangulatedSDQ, 
  EvaluatorType, 
  SDQEvaluationResult 
} from '@/lib/pastoral/sdq';
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_TERM } from '@/lib/constants/school';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const grade = searchParams.get('grade');
    const academicYear = searchParams.get('academicYear') || DEFAULT_ACADEMIC_YEAR;
    const term = searchParams.get('term') || DEFAULT_TERM;
    const triangulate = searchParams.get('triangulate') === 'true';

    const supabase = getAdminClient();

    // 1. If querying for a specific student
    if (studentId) {
      const { data: evaluations, error } = await supabase
        .from('student_sdq_evaluations')
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_year', academicYear)
        .eq('term', term);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // If triangulation requested
      let triangulation = null;
      if (triangulate && evaluations) {
        const teacherEval = evaluations.find(e => e.evaluator_type === 'teacher');
        const parentEval = evaluations.find(e => e.evaluator_type === 'parent');
        const studentEval = evaluations.find(e => e.evaluator_type === 'student');

        const tRes = teacherEval ? calculateSDQ(teacherEval.answers, 'teacher') : null;
        const pRes = parentEval ? calculateSDQ(parentEval.answers, 'parent') : null;
        const sRes = studentEval ? calculateSDQ(studentEval.answers, 'student') : null;

        triangulation = compareTriangulatedSDQ(tRes, pRes, sRes);
      }

      return NextResponse.json({
        evaluations: evaluations || [],
        triangulation
      });
    }

    // 2. Querying by Grade / Class
    let studentsQuery = supabase
      .from('students')
      .select('id, student_id, name, grade, classroom, status')
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่', 'นักเรียนเก่าเข้าใหม่']);

    if (grade && grade !== 'all') {
      studentsQuery = studentsQuery.or(`grade.eq.${grade},grade.ilike.${grade}/%`);
    }

    const { data: students, error: studentsError } = await studentsQuery;
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    const studentIds = (students || []).map(s => s.id);

    // Fetch all evaluations for these students
    let evalQuery = supabase
      .from('student_sdq_evaluations')
      .select('*')
      .eq('academic_year', academicYear)
      .eq('term', term);

    if (studentIds.length > 0) {
      evalQuery = evalQuery.in('student_id', studentIds);
    } else {
      return NextResponse.json({
        students: [],
        evaluations: [],
        stats: { totalStudents: 0, evaluatedStudents: 0, normalCount: 0, borderlineCount: 0, abnormalCount: 0 }
      });
    }

    const { data: evaluations, error: evalError } = await evalQuery;
    if (evalError) {
      return NextResponse.json({ error: evalError.message }, { status: 500 });
    }

    // Aggregate statistics per student (prefer teacher evaluation, fallback to parent/student)
    let normalCount = 0;
    let borderlineCount = 0;
    let abnormalCount = 0;
    const evalByStudent = new Map<string, any>();

    (evaluations || []).forEach(e => {
      const existing = evalByStudent.get(e.student_id);
      if (!existing || e.evaluator_type === 'teacher') {
        evalByStudent.set(e.student_id, e);
      }
    });

    evalByStudent.forEach(e => {
      if (e.total_status === 'abnormal') abnormalCount++;
      else if (e.total_status === 'borderline') borderlineCount++;
      else normalCount++;
    });

    return NextResponse.json({
      students: students || [],
      evaluations: evaluations || [],
      stats: {
        totalStudents: students?.length || 0,
        evaluatedStudents: evalByStudent.size,
        normalCount,
        borderlineCount,
        abnormalCount
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      student_id,
      evaluator_type,
      evaluator_name,
      evaluator_id,
      academic_year = DEFAULT_ACADEMIC_YEAR,
      term = DEFAULT_TERM,
      answers = {},
      notes = ''
    } = body;

    if (!student_id || !evaluator_type) {
      return NextResponse.json({ error: 'Missing student_id or evaluator_type' }, { status: 400 });
    }

    if (!['teacher', 'parent', 'student'].includes(evaluator_type)) {
      return NextResponse.json({ error: 'Invalid evaluator_type' }, { status: 400 });
    }

    // Auto-calculate scores & statuses using SDQ engine
    const result: SDQEvaluationResult = calculateSDQ(answers, evaluator_type as EvaluatorType);

    const recordToUpsert = {
      student_id,
      evaluator_type,
      evaluator_name: evaluator_name || auth.user?.email || 'ครูประจำชั้น',
      evaluator_id: evaluator_id || auth.user?.id || null,
      academic_year: String(academic_year),
      term: String(term),
      answers,
      emotional_score: result.emotional.score,
      conduct_score: result.conduct.score,
      hyperactivity_score: result.hyperactivity.score,
      peer_score: result.peer.score,
      prosocial_score: result.prosocial.score,
      total_difficulties_score: result.totalDifficulties.score,
      emotional_status: result.emotional.status,
      conduct_status: result.conduct.status,
      hyperactivity_status: result.hyperactivity.status,
      peer_status: result.peer.status,
      prosocial_status: result.prosocial.status,
      total_status: result.totalDifficulties.status,
      notes: notes || result.summaryRecommendation,
      updated_at: new Date().toISOString()
    };

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('student_sdq_evaluations')
      .upsert(recordToUpsert, {
        onConflict: 'student_id,evaluator_type,academic_year,term'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving SDQ evaluation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      evaluation: data,
      calculated: result
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
