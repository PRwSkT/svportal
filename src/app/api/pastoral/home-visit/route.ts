import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { 
  evaluateHomeVisitRisk, 
  synthesizeHomeVisitSummary, 
  validateThailandGPS 
} from '@/lib/pastoral/home-visit';
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

    const supabase = getAdminClient();

    // 1. Single student lookup
    if (studentId) {
      const { data: visit, error } = await supabase
        .from('student_home_visits')
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_year', academicYear)
        .eq('term', term)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const riskEval = visit ? evaluateHomeVisitRisk(visit.risk_issues || [], visit.economic_status || '') : null;

      return NextResponse.json({
        visit: visit || null,
        riskEval
      });
    }

    // 2. Class / Grade lookup
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

    let visitsQuery = supabase
      .from('student_home_visits')
      .select('*')
      .eq('academic_year', academicYear)
      .eq('term', term);

    if (studentIds.length > 0) {
      visitsQuery = visitsQuery.in('student_id', studentIds);
    } else {
      return NextResponse.json({
        students: [],
        visits: [],
        stats: { totalStudents: 0, completedVisits: 0, pendingVisits: 0, criticalRiskCount: 0, highRiskCount: 0 }
      });
    }

    const { data: visits, error: visitsError } = await visitsQuery;
    if (visitsError) {
      return NextResponse.json({ error: visitsError.message }, { status: 500 });
    }

    // Statistics
    let completedCount = 0;
    let criticalRiskCount = 0;
    let highRiskCount = 0;

    (visits || []).forEach(v => {
      if (v.status === 'COMPLETED') completedCount++;
      const r = evaluateHomeVisitRisk(v.risk_issues || [], v.economic_status || '');
      if (r.riskLevel === 'CRITICAL') criticalRiskCount++;
      else if (r.riskLevel === 'HIGH') highRiskCount++;
    });

    return NextResponse.json({
      students: students || [],
      visits: visits || [],
      stats: {
        totalStudents: students?.length || 0,
        completedVisits: completedCount,
        pendingVisits: (students?.length || 0) - completedCount,
        criticalRiskCount,
        highRiskCount
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
      student_name,
      academic_year = DEFAULT_ACADEMIC_YEAR,
      term = DEFAULT_TERM,
      visit_date = new Date().toISOString().split('T')[0],
      visitor_teacher_id,
      visitor_teacher_name,
      gps_lat,
      gps_lng,
      address_visited = '',
      living_environment = '',
      family_relationship = '',
      economic_status = '',
      risk_issues = [],
      audio_transcript = '',
      ai_summary = '',
      photos = [],
      guardian_met = '',
      guardian_signature_url = '',
      status = 'COMPLETED',
      generate_ai_summary = false
    } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });
    }

    // Optional GPS check
    if (gps_lat !== undefined && gps_lat !== null && gps_lat !== '' && gps_lng !== undefined && gps_lng !== null && gps_lng !== '') {
      const gpsCheck = validateThailandGPS(Number(gps_lat), Number(gps_lng));
      if (!gpsCheck.isValid) {
        console.warn('GPS Warning:', gpsCheck.message);
      }
    }

    // Auto-generate AI summary if empty or specifically requested
    let finalSummary = ai_summary;
    if (!finalSummary || generate_ai_summary) {
      finalSummary = synthesizeHomeVisitSummary({
        studentName: student_name || 'นักเรียน',
        guardianMet: guardian_met || 'ผู้ปกครอง',
        livingEnvironment: living_environment,
        familyRelationship: family_relationship,
        economicStatus: economic_status,
        riskIssues: risk_issues,
        rawNotesOrTranscript: audio_transcript
      });
    }

    const recordToUpsert = {
      student_id,
      academic_year: String(academic_year),
      term: String(term),
      visit_date,
      visitor_teacher_id: visitor_teacher_id || auth.user?.id || null,
      visitor_teacher_name: visitor_teacher_name || auth.user?.email || 'ครูประจำชั้น',
      gps_lat: gps_lat !== undefined && gps_lat !== null && gps_lat !== '' ? Number(gps_lat) : null,
      gps_lng: gps_lng !== undefined && gps_lng !== null && gps_lng !== '' ? Number(gps_lng) : null,
      address_visited,
      living_environment,
      family_relationship,
      economic_status,
      risk_issues: Array.isArray(risk_issues) ? risk_issues : [],
      audio_transcript,
      ai_summary: finalSummary,
      photos: Array.isArray(photos) ? photos : [],
      guardian_met,
      guardian_signature_url: guardian_signature_url || null,
      status: status === 'DRAFT' ? 'DRAFT' : 'COMPLETED',
      updated_at: new Date().toISOString()
    };

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('student_home_visits')
      .upsert(recordToUpsert, {
        onConflict: 'student_id,academic_year,term'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving home visit:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const riskEval = evaluateHomeVisitRisk(data.risk_issues || [], data.economic_status || '');

    return NextResponse.json({
      success: true,
      visit: data,
      riskEval
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
