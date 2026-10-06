'use server';

import { createClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth';
import { isSystemAdmin } from '@/lib/constants/auth';
import { KpiCycle, KpiEvaluation, KpiTemplate } from '@/types/kpi';
import { calculateKpiScoreSummaries } from '@/lib/kpi/scoring';
import { sendAnonymousKpiEmail } from '@/lib/kpi/email';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role key is not configured');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Fetch all evaluation cycles
 */
export async function getKpiCycles(): Promise<{ success: boolean; data?: KpiCycle[]; error?: string }> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('kpi_cycles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data as KpiCycle[] };
  } catch (err: any) {
    console.error('getKpiCycles error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all KPI templates
 */
export async function getKpiTemplates(): Promise<{ success: boolean; data?: KpiTemplate[]; error?: string }> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('kpi_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data as KpiTemplate[] };
  } catch (err: any) {
    console.error('getKpiTemplates error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all evaluations for a specific cycle
 */
export async function getKpiEvaluations(cycleId: string): Promise<{
  success: boolean;
  data?: KpiEvaluation[];
  stats?: {
    total: number;
    pendingSelf: number;
    pendingSupervisor: number;
    completed: number;
    avgScore: number;
  };
  error?: string;
}> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('kpi_evaluations')
      .select(`
        *,
        personnel:personnel_id(*),
        cycle:cycle_id(*),
        template:template_id(*)
      `)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const evaluations = (data || []) as KpiEvaluation[];

    let totalScoreSum = 0;
    let completedCount = 0;
    let pendingSelfCount = 0;
    let pendingSupCount = 0;

    evaluations.forEach((e) => {
      if (e.status === 'pending_self') pendingSelfCount++;
      if (e.status === 'self_submitted') pendingSupCount++;
      if (e.status === 'completed') {
        completedCount++;
        totalScoreSum += e.final_score || 0;
      }
    });

    const avgScore = completedCount > 0 ? Number((totalScoreSum / completedCount).toFixed(2)) : 0;

    return {
      success: true,
      data: evaluations,
      stats: {
        total: evaluations.length,
        pendingSelf: pendingSelfCount,
        pendingSupervisor: pendingSupCount,
        completed: completedCount,
        avgScore,
      },
    };
  } catch (err: any) {
    console.error('getKpiEvaluations error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch a single evaluation detail with personnel, cycle, and template
 */
export async function getEvaluationDetail(evaluationId: string): Promise<{
  success: boolean;
  data?: KpiEvaluation;
  error?: string;
}> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('kpi_evaluations')
      .select(`
        *,
        personnel:personnel_id(*),
        cycle:cycle_id(*),
        template:template_id(*)
      `)
      .eq('id', evaluationId)
      .single();

    if (error) throw error;
    return { success: true, data: data as KpiEvaluation };
  } catch (err: any) {
    console.error('getEvaluationDetail error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Submit Self Evaluation (การประเมินตนเอง)
 */
export async function submitSelfEvaluation(
  evaluationId: string,
  payload: {
    self_scores: Record<string, number>;
    self_notes: Record<string, string>;
    self_overall_comment: string;
  }
): Promise<{ success: boolean; data?: KpiEvaluation; error?: string }> {
  try {
    const supabase = getAdminClient();

    // 1. Get current evaluation with template
    const { data: evaluation, error: fetchErr } = await supabase
      .from('kpi_evaluations')
      .select('*, template:template_id(*)')
      .eq('id', evaluationId)
      .single();

    if (fetchErr || !evaluation) throw new Error('ไม่พบข้อมูลการประเมิน');

    // 2. Compute self score based on template
    const draftEval: KpiEvaluation = {
      ...(evaluation as KpiEvaluation),
      self_scores: payload.self_scores,
      self_notes: payload.self_notes,
    };
    const { selfTotal } = calculateKpiScoreSummaries(draftEval);

    // 3. Update evaluation
    const { data: updated, error: updateErr } = await supabase
      .from('kpi_evaluations')
      .update({
        self_scores: payload.self_scores,
        self_notes: payload.self_notes,
        self_overall_comment: payload.self_overall_comment,
        self_total_score: selfTotal,
        self_submitted_at: new Date().toISOString(),
        status: evaluation.status === 'completed' ? 'completed' : 'self_submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', evaluationId)
      .select(`*, personnel:personnel_id(*), cycle:cycle_id(*), template:template_id(*)`)
      .single();

    if (updateErr) throw updateErr;

    return { success: true, data: updated as KpiEvaluation };
  } catch (err: any) {
    console.error('submitSelfEvaluation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Submit Supervisor Evaluation (การประเมินโดยหัวหน้างาน/ผู้บริหาร)
 */
export async function submitSupervisorEvaluation(
  evaluationId: string,
  payload: {
    supervisor_scores: Record<string, number>;
    supervisor_feedback: Record<string, string>;
    supervisor_overall_comment: string;
    supervisor_strengths: string;
    supervisor_improvements: string;
  }
): Promise<{ success: boolean; data?: KpiEvaluation; error?: string }> {
  try {
    const supabase = getAdminClient();
    const currentUser = await getServerUser();

    // 1. Get current evaluation with template
    const { data: evaluation, error: fetchErr } = await supabase
      .from('kpi_evaluations')
      .select('*, template:template_id(*)')
      .eq('id', evaluationId)
      .single();

    if (fetchErr || !evaluation) throw new Error('ไม่พบข้อมูลการประเมิน');

    // 2. Compute supervisor score and grade based on template
    const draftEval: KpiEvaluation = {
      ...(evaluation as KpiEvaluation),
      supervisor_scores: payload.supervisor_scores,
      supervisor_feedback: payload.supervisor_feedback,
    };
    const { supervisorTotal, finalGrade } = calculateKpiScoreSummaries(draftEval);

    // 3. Update evaluation
    const { data: updated, error: updateErr } = await supabase
      .from('kpi_evaluations')
      .update({
        supervisor_id: currentUser?.id || null,
        supervisor_scores: payload.supervisor_scores,
        supervisor_feedback: payload.supervisor_feedback,
        supervisor_overall_comment: payload.supervisor_overall_comment,
        supervisor_strengths: payload.supervisor_strengths,
        supervisor_improvements: payload.supervisor_improvements,
        supervisor_total_score: supervisorTotal,
        final_score: supervisorTotal,
        final_grade: finalGrade,
        supervisor_submitted_at: new Date().toISOString(),
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', evaluationId)
      .select(`*, personnel:personnel_id(*), cycle:cycle_id(*), template:template_id(*)`)
      .single();

    if (updateErr) throw updateErr;

    return { success: true, data: updated as KpiEvaluation };
  } catch (err: any) {
    console.error('submitSupervisorEvaluation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Dispatch Anonymous Result Email to Personnel (แบบไม่ระบุข้อมูลผู้ประเมิน)
 */
export async function dispatchEvaluationEmail(evaluationId: string): Promise<{
  success: boolean;
  mode?: 'smtp' | 'simulated';
  recipientEmail?: string;
  gmailComposeUrl?: string;
  error?: string;
}> {
  try {
    const supabase = getAdminClient();

    // 1. Fetch full evaluation
    const { data: evaluation, error: fetchErr } = await supabase
      .from('kpi_evaluations')
      .select(`
        *,
        personnel:personnel_id(*),
        cycle:cycle_id(*),
        template:template_id(*)
      `)
      .eq('id', evaluationId)
      .single();

    if (fetchErr || !evaluation) throw new Error('ไม่พบข้อมูลการประเมิน');

    // 2. Send email (anonymously)
    const result = await sendAnonymousKpiEmail(evaluation as KpiEvaluation);

    // 3. Update evaluation notification status
    await supabase
      .from('kpi_evaluations')
      .update({
        email_notified_at: new Date().toISOString(),
        email_notified_status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', evaluationId);

    return {
      success: true,
      mode: result.mode,
      recipientEmail: result.recipientEmail,
      gmailComposeUrl: result.gmailComposeUrl,
    };
  } catch (err: any) {
    console.error('dispatchEvaluationEmail error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Ensure all active personnel have evaluation records for a cycle
 */
export async function syncPersonnelForCycle(cycleId: string, templateId?: string): Promise<{
  success: boolean;
  insertedCount: number;
  error?: string;
}> {
  try {
    const supabase = getAdminClient();

    // Get active template if not provided
    let activeTemplateId = templateId;
    if (!activeTemplateId) {
      const { data: tmpl } = await supabase
        .from('kpi_templates')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();
      activeTemplateId = tmpl?.id;
    }

    // Get active personnel
    const { data: personnelList } = await supabase
      .from('personnel')
      .select('id')
      .eq('is_active', true);

    if (!personnelList || personnelList.length === 0) {
      return { success: true, insertedCount: 0 };
    }

    let inserted = 0;
    for (const p of personnelList) {
      const { error } = await supabase
        .from('kpi_evaluations')
        .insert([
          {
            cycle_id: cycleId,
            personnel_id: p.id,
            template_id: activeTemplateId || null,
            status: 'pending_self',
          },
        ])
        .select('id')
        .single();

      if (!error) inserted++;
    }

    return { success: true, insertedCount: inserted };
  } catch (err: any) {
    console.error('syncPersonnelForCycle error:', err);
    return { success: false, insertedCount: 0, error: err.message };
  }
}
