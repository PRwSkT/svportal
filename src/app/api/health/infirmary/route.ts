import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { 
  detectOutbreakClusters, 
  checkMedicationAllergy, 
  evaluateBodyTemperature,
  InfirmaryVisitRecord,
  ContagiousDiseaseType
} from '@/lib/health/infirmary';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const grade = searchParams.get('grade');

    const supabase = getAdminClient();

    // Calculate start date for query
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 1. Fetch visits
    let query = supabase
      .from('school_infirmary_visits')
      .select('*, students(id, student_id, name, grade, classroom, allergies, medical_conditions)')
      .gte('visit_date', startDateStr)
      .order('visit_date', { ascending: false })
      .order('visit_time', { ascending: false });

    const { data: visits, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by grade if requested
    let enrichedVisits: InfirmaryVisitRecord[] = (visits || []).map((v: any) => {
      const student = v.students;
      return {
        id: v.id,
        studentId: v.student_id,
        studentName: student?.name || 'นักเรียน',
        grade: student?.grade,
        classroom: student?.classroom,
        visitDate: v.visit_date,
        visitTime: v.visit_time,
        symptoms: v.symptoms || [],
        temperatureCelsius: v.temperature_celsius !== null && v.temperature_celsius !== undefined ? Number(v.temperature_celsius) : undefined,
        treatmentGiven: v.treatment_given,
        medicationGiven: v.medication_given,
        diagnosedContagiousDisease: (v.diagnosed_contagious_disease || 'NONE') as ContagiousDiseaseType,
        restInBed: Boolean(v.rest_in_bed),
        timeLeft: v.time_left,
        nurseTeacherName: v.nurse_teacher_name,
        parentContacted: Boolean(v.parent_contacted),
        notes: v.notes
      };
    });

    if (grade && grade !== 'all') {
      enrichedVisits = enrichedVisits.filter(v => v.grade === grade || (v.grade && v.grade.startsWith(`${grade}/`)));
    }

    // 2. Run Outbreak Cluster Detection
    const outbreakAnalysis = detectOutbreakClusters(enrichedVisits);

    // 3. Stats
    let feverCount = 0;
    let contagiousCount = 0;
    let restInBedCount = 0;

    enrichedVisits.forEach(v => {
      if (v.temperatureCelsius && v.temperatureCelsius >= 37.5) feverCount++;
      if (v.diagnosedContagiousDisease !== 'NONE') contagiousCount++;
      if (v.restInBed) restInBedCount++;
    });

    return NextResponse.json({
      visits: enrichedVisits,
      outbreakAnalysis,
      stats: {
        totalVisits: enrichedVisits.length,
        feverCount,
        contagiousCount,
        restInBedCount
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
      visit_date = new Date().toISOString().split('T')[0],
      visit_time = new Date().toTimeString().slice(0, 5),
      symptoms = [],
      temperature_celsius,
      treatment_given = '',
      medication_given = '',
      diagnosed_contagious_disease = 'NONE',
      rest_in_bed = false,
      time_left,
      nurse_teacher_name,
      parent_contacted = false,
      notes = '',
      bypass_allergy_warning = false
    } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Check student allergy
    if (medication_given && !bypass_allergy_warning) {
      const { data: student } = await supabase
        .from('students')
        .select('allergies, medical_conditions')
        .eq('id', student_id)
        .maybeSingle();

      const knownAllergies: string[] = [];
      if (student?.allergies) knownAllergies.push(student.allergies);
      if (student?.medical_conditions) knownAllergies.push(student.medical_conditions);

      const allergyCheck = checkMedicationAllergy(medication_given, knownAllergies);
      if (!allergyCheck.isSafe) {
        return NextResponse.json({
          error: 'DRUG_ALLERGY_RISK',
          message: allergyCheck.warning,
          allergies: knownAllergies
        }, { status: 400 });
      }
    }

    const recordToInsert = {
      student_id,
      visit_date,
      visit_time,
      symptoms: Array.isArray(symptoms) ? symptoms : [],
      temperature_celsius: temperature_celsius ? Number(temperature_celsius) : null,
      treatment_given,
      medication_given,
      diagnosed_contagious_disease,
      rest_in_bed: Boolean(rest_in_bed),
      time_left: time_left || null,
      nurse_teacher_name: nurse_teacher_name || auth.user?.email || 'ครูพยาบาล',
      parent_contacted: Boolean(parent_contacted),
      notes
    };

    const { data, error } = await supabase
      .from('school_infirmary_visits')
      .insert(recordToInsert)
      .select()
      .single();

    if (error) {
      console.error('Error logging infirmary visit:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      visit: data
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const patchData: any = {};
    if (updates.symptoms !== undefined) patchData.symptoms = Array.isArray(updates.symptoms) ? updates.symptoms : [];
    if (updates.temperature_celsius !== undefined) patchData.temperature_celsius = updates.temperature_celsius ? Number(updates.temperature_celsius) : null;
    if (updates.treatment_given !== undefined) patchData.treatment_given = updates.treatment_given;
    if (updates.medication_given !== undefined) patchData.medication_given = updates.medication_given;
    if (updates.diagnosed_contagious_disease !== undefined) patchData.diagnosed_contagious_disease = updates.diagnosed_contagious_disease;
    if (updates.rest_in_bed !== undefined) patchData.rest_in_bed = Boolean(updates.rest_in_bed);
    if (updates.time_left !== undefined) patchData.time_left = updates.time_left || null;
    if (updates.parent_contacted !== undefined) patchData.parent_contacted = Boolean(updates.parent_contacted);
    if (updates.notes !== undefined) patchData.notes = updates.notes;

    const { data, error } = await supabase
      .from('school_infirmary_visits')
      .update(patchData)
      .eq('id', id)
      .select('*, students(id, student_id, name, grade, classroom, allergies, medical_conditions)')
      .single();

    if (error) {
      console.error('Error updating infirmary visit:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      visit: data,
      message: 'อัปเดตข้อมูลการเข้าห้องพยาบาลเรียบร้อยแล้ว'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('school_infirmary_visits')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting infirmary visit:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'ลบรายการเข้าห้องพยาบาลเรียบร้อยแล้ว'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
