'use server';

import { createClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth';
import { isSystemAdmin } from '@/lib/constants/auth';
import { KpiCycle, KpiEvaluation, KpiTemplate, KpiQuarter, KpiEvaluatorReview, KpiUserContext } from '@/types/kpi';
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
 * Shared helper to accurately resolve user role, admin/executive status, and personnel ID
 */
async function resolveUserContext(supabase: any): Promise<KpiUserContext & { currentUser: any }> {
  try {
    const currentUser = await getServerUser();
    let isAdmin = false;
    let isExecutive = false;
    let currentPersonnelId: string | null = null;

    if (currentUser) {
      if (isSystemAdmin(currentUser.email)) {
        isAdmin = true;
      }

      const { data: appUser } = await supabase
        .from('app_users')
        .select('role, personnel_id')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (appUser) {
        if (appUser.role === 'admin') {
          isAdmin = true;
        } else if (appUser.role === 'executive') {
          isExecutive = true;
        }
        if (appUser.personnel_id) {
          currentPersonnelId = appUser.personnel_id;
        }
      }

      if (currentUser.email) {
        const { data: pData } = await supabase
          .from('personnel')
          .select('id, category')
          .eq('email', currentUser.email)
          .maybeSingle();

        if (pData) {
          if (!currentPersonnelId) currentPersonnelId = pData.id;
          if (pData.category === 'executive') {
            isExecutive = true;
          } else if (pData.category === 'admin') {
            isAdmin = true;
          }
        }
      }
    }

    const canViewAll = isAdmin || isExecutive;

    return {
      userId: currentUser?.id || null,
      personnelId: currentPersonnelId,
      isAdmin,
      isExecutive,
      canViewAll,
      currentUser,
    };
  } catch (err) {
    console.error('resolveUserContext error:', err);
    return {
      userId: null,
      personnelId: null,
      isAdmin: false,
      isExecutive: false,
      canViewAll: false,
      currentUser: null,
    };
  }
}

/**
 * Fetch all evaluation cycles
 */
export async function getKpiCycles(): Promise<{ success: boolean; data?: KpiCycle[]; error?: string }> {
  try {
    const user = await getServerUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('kpi_cycles')
      .select('*')
      .order('academic_year', { ascending: false })
      .order('quarter', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data as KpiCycle[] };
  } catch (err: any) {
    console.error('getKpiCycles error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create a new Quarterly Evaluation Cycle
 */
export async function createQuarterlyCycle(payload: {
  title: string;
  academic_year: string;
  semester: string;
  quarter: KpiQuarter;
  start_date?: string;
  end_date?: string;
}): Promise<{ success: boolean; data?: KpiCycle; error?: string }> {
  try {
    const supabase = getAdminClient();
    const currentUserContext = await resolveUserContext(supabase);
    if (!currentUserContext.canViewAll) {
      return { success: false, error: 'คุณไม่มีสิทธิ์สร้างรอบการประเมิน (เฉพาะผู้บริหารและผู้ดูแลระบบ)' };
    }

    const { data, error } = await supabase
      .from('kpi_cycles')
      .insert([
        {
          title: payload.title,
          academic_year: payload.academic_year,
          semester: payload.semester,
          quarter: payload.quarter,
          start_date: payload.start_date || null,
          end_date: payload.end_date || null,
          status: 'active',
        },
      ])
      .select('*')
      .single();

    if (error) throw error;

    // Automatically sync active personnel for this new cycle
    await syncPersonnelForCycle(data.id);

    return { success: true, data: data as KpiCycle };
  } catch (err: any) {
    console.error('createQuarterlyCycle error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all KPI templates
 */
export async function getKpiTemplates(): Promise<{ success: boolean; data?: KpiTemplate[]; error?: string }> {
  try {
    const user = await getServerUser();
    if (!user) return { success: false, error: 'Unauthorized' };

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
 * Fetch all active personnel candidates for evaluator dropdown
 */
export async function getEvaluatorCandidates(): Promise<{
  success: boolean;
  data?: {
    id: string;
    name_th: string;
    name_en?: string;
    position_th: string;
    category?: string;
    email: string | null;
    image_url?: string | null;
  }[];
  error?: string;
}> {
  try {
    const supabase = getAdminClient();
    const currentUserContext = await resolveUserContext(supabase);
    if (!currentUserContext.canViewAll) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('personnel')
      .select('id, name_th, name_en, position_th, category, email, image_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('getEvaluatorCandidates error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all evaluations for a specific cycle with user role awareness and multi-evaluators
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
  currentUserContext?: KpiUserContext;
  error?: string;
}> {
  try {
    const supabase = getAdminClient();
    const currentUserContext = await resolveUserContext(supabase);

    // 1. Fetch raw evaluations
    const { data, error } = await supabase
      .from('kpi_evaluations')
      .select(`
        *,
        personnel:personnel_id(*),
        assigned_evaluator:assigned_evaluator_id(*),
        cycle:cycle_id(*),
        template:template_id(*)
      `)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rawEvaluations = data || [];
    const evalIds = rawEvaluations.map((e) => e.id);

    // 2. Fetch all personnel to map assigned_evaluator_ids
    const { data: allPersonnel } = await supabase
      .from('personnel')
      .select('id, name_th, name_en, position_th, category, email, image_url')
      .eq('is_active', true);

    const personnelMap = new Map((allPersonnel || []).map((p) => [p.id, p]));

    // 3. Fetch all reviews for these evaluations
    const reviewsByEval: Record<string, any[]> = {};
    if (evalIds.length > 0) {
      const { data: revData } = await supabase
        .from('kpi_evaluator_reviews')
        .select(`*, evaluator:evaluator_id(id, name_th, name_en, position_th, category, email, image_url)`)
        .in('evaluation_id', evalIds);

      (revData || []).forEach((r) => {
        if (!reviewsByEval[r.evaluation_id]) reviewsByEval[r.evaluation_id] = [];
        reviewsByEval[r.evaluation_id].push(r);
      });
    }

    // 4. Construct enriched evaluations
    const evaluations: KpiEvaluation[] = rawEvaluations.map((e) => {
      const ids: string[] =
        e.assigned_evaluator_ids && e.assigned_evaluator_ids.length > 0
          ? e.assigned_evaluator_ids
          : e.assigned_evaluator_id
          ? [e.assigned_evaluator_id]
          : [];

      const assigned_evaluators = ids
        .map((id) => personnelMap.get(id))
        .filter(Boolean) as any[];

      const evalReviews = reviewsByEval[e.id] || [];

      return {
        ...e,
        assigned_evaluator_ids: ids,
        assigned_evaluators,
        reviews: evalReviews,
      };
    });

    // 5. Apply Permission-based Filtering:
    // Executives and Admins see EVERYONE (canViewAll = true).
    // All other personnel see ONLY:
    //  - Their own evaluation (self)
    //  - OR evaluations where they are an assigned evaluator (supervisor)
    const visibleEvaluations = currentUserContext.canViewAll
      ? evaluations
      : evaluations.filter((e) => {
          const p = e.personnel;
          const isSelf = Boolean(
            (currentUserContext.personnelId && e.personnel_id === currentUserContext.personnelId) ||
            (currentUserContext.userId && p?.user_id === currentUserContext.userId) ||
            (currentUserContext.currentUser?.email && p?.email && p.email.toLowerCase() === currentUserContext.currentUser.email.toLowerCase())
          );

          const isAssignedEvaluator = Boolean(
            currentUserContext.personnelId &&
            (e.assigned_evaluator_ids?.includes(currentUserContext.personnelId) ||
             e.assigned_evaluator_id === currentUserContext.personnelId)
          );

          return isSelf || isAssignedEvaluator;
        });

    let totalScoreSum = 0;
    let completedCount = 0;
    let pendingSelfCount = 0;
    let pendingSupCount = 0;

    visibleEvaluations.forEach((e) => {
      if (e.status === 'pending_self') pendingSelfCount++;
      if (e.status === 'self_submitted') pendingSupCount++;
      if (e.status === 'completed') {
        completedCount++;
        totalScoreSum += e.final_score || 0;
      }
    });

    const avgScore = completedCount > 0 ? Number((totalScoreSum / completedCount).toFixed(2)) : 0;

    // Anonymize evaluator identities for non-admins to ensure strict anonymity for peer & committee evaluations
    const sanitizedEvaluations = currentUserContext.canViewAll
      ? visibleEvaluations
      : visibleEvaluations.map((e) => {
          const isSelf = Boolean(
            (currentUserContext.personnelId && e.personnel_id === currentUserContext.personnelId) ||
            (currentUserContext.userId && e.personnel?.user_id === currentUserContext.userId) ||
            (currentUserContext.currentUser?.email &&
              e.personnel?.email &&
              e.personnel.email.toLowerCase() === currentUserContext.currentUser.email.toLowerCase())
          );

          if (isSelf) {
            // Evaluatee MUST NOT see who was assigned to evaluate them
            return {
              ...e,
              assigned_evaluators: [],
              assigned_evaluator_id: null,
              assigned_evaluator_ids: [],
              reviews: (e.reviews || []).map((r: any) => ({
                ...r,
                evaluator_id: 'anonymous',
              })) as KpiEvaluatorReview[],
            };
          } else {
            // Peer evaluator evaluating someone else: only see own assignment, never other peer evaluators
            return {
              ...e,
              assigned_evaluators: (e.assigned_evaluators || []).filter(
                (ev: any) => ev.id === currentUserContext.personnelId
              ),
              assigned_evaluator_id: currentUserContext.personnelId,
              assigned_evaluator_ids: currentUserContext.personnelId ? [currentUserContext.personnelId] : [],
              reviews: (e.reviews || []).filter(
                (r: any) => r.evaluator_id === currentUserContext.personnelId
              ),
            };
          }
        });

    return {
      success: true,
      data: sanitizedEvaluations,
      stats: {
        total: visibleEvaluations.length,
        pendingSelf: pendingSelfCount,
        pendingSupervisor: pendingSupCount,
        completed: completedCount,
        avgScore,
      },
      currentUserContext: {
        userId: currentUserContext.userId,
        personnelId: currentUserContext.personnelId,
        isAdmin: currentUserContext.isAdmin,
        isExecutive: currentUserContext.isExecutive,
        canViewAll: currentUserContext.canViewAll,
      },
    };
  } catch (err: any) {
    console.error('getKpiEvaluations error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Assign Multiple Evaluators to an Evaluation
 */
export async function assignEvaluators(
  evaluationId: string,
  evaluatorPersonnelIds: string[]
): Promise<{
  success: boolean;
  assigned_evaluators?: any[];
  assigned_evaluator_ids?: string[];
  error?: string;
}> {
  try {
    const supabase = getAdminClient();
    const currentUserContext = await resolveUserContext(supabase);
    if (!currentUserContext.canViewAll) {
      return { success: false, error: 'คุณไม่มีสิทธิ์กำหนดผู้ประเมิน (เฉพาะผู้บริหารและผู้ดูแลระบบ)' };
    }

    const primaryId = evaluatorPersonnelIds[0] || null;
    const { error } = await supabase
      .from('kpi_evaluations')
      .update({
        assigned_evaluator_ids: evaluatorPersonnelIds,
        assigned_evaluator_id: primaryId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', evaluationId);

    if (error) throw error;

    let assigned_evaluators: any[] = [];
    if (evaluatorPersonnelIds.length > 0) {
      const { data: pList } = await supabase
        .from('personnel')
        .select('id, name_th, name_en, position_th, category, email, image_url')
        .in('id', evaluatorPersonnelIds);
      assigned_evaluators = pList || [];
    }

    return {
      success: true,
      assigned_evaluators,
      assigned_evaluator_ids: evaluatorPersonnelIds,
    };
  } catch (err: any) {
    console.error('assignEvaluators error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Backward compatibility alias for single/multiple assignment
 */
export async function assignEvaluator(
  evaluationId: string,
  evaluatorPersonnelIdOrIds: string | string[] | null
): Promise<{ success: boolean; error?: string }> {
  const ids = Array.isArray(evaluatorPersonnelIdOrIds)
    ? evaluatorPersonnelIdOrIds
    : evaluatorPersonnelIdOrIds
    ? [evaluatorPersonnelIdOrIds]
    : [];
  return assignEvaluators(evaluationId, ids);
}

/**
 * Bulk Assign Evaluators with multi-selection support
 */
export async function bulkAssignEvaluators(
  assignments: { evaluationId: string; evaluatorPersonnelIds: string[] }[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = getAdminClient();
    const currentUserContext = await resolveUserContext(supabase);
    if (!currentUserContext.canViewAll) {
      return { success: false, count: 0, error: 'คุณไม่มีสิทธิ์กำหนดผู้ประเมิน (เฉพาะผู้บริหารและผู้ดูแลระบบ)' };
    }

    let count = 0;
    for (const item of assignments) {
      const primaryId = item.evaluatorPersonnelIds[0] || null;
      const { error } = await supabase
        .from('kpi_evaluations')
        .update({
          assigned_evaluator_ids: item.evaluatorPersonnelIds,
          assigned_evaluator_id: primaryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.evaluationId);
      if (!error) count++;
    }
    return { success: true, count };
  } catch (err: any) {
    console.error('bulkAssignEvaluators error:', err);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Fetch a single evaluation detail with personnel, cycle, template, assigned evaluators, and reviews
 */
export async function getEvaluationDetail(evaluationId: string): Promise<{
  success: boolean;
  data?: KpiEvaluation;
  currentUserContext?: KpiUserContext;
  myReview?: KpiEvaluatorReview | null;
  error?: string;
}> {
  try {
    const supabase = getAdminClient();
    const currentUserContext = await resolveUserContext(supabase);
    const isAdmin = currentUserContext.isAdmin;
    const currentPersonnelId = currentUserContext.personnelId;

    const { data, error } = await supabase
      .from('kpi_evaluations')
      .select(`
        *,
        personnel:personnel_id(*),
        assigned_evaluator:assigned_evaluator_id(*),
        cycle:cycle_id(*),
        template:template_id(*)
      `)
      .eq('id', evaluationId)
      .single();

    if (error) throw error;

    // Resolve assigned_evaluators
    const ids: string[] =
      data.assigned_evaluator_ids && data.assigned_evaluator_ids.length > 0
        ? data.assigned_evaluator_ids
        : data.assigned_evaluator_id
        ? [data.assigned_evaluator_id]
        : [];

    let assigned_evaluators: any[] = [];
    if (ids.length > 0) {
      const { data: pList } = await supabase
        .from('personnel')
        .select('id, name_th, name_en, position_th, category, email, image_url')
        .in('id', ids);
      assigned_evaluators = pList || [];
    }

    // Fetch all reviews for this evaluation
    const { data: reviews } = await supabase
      .from('kpi_evaluator_reviews')
      .select(`*, evaluator:evaluator_id(id, name_th, name_en, position_th, category, email, image_url)`)
      .eq('evaluation_id', evaluationId);

    const evaluationWithReviews: KpiEvaluation = {
      ...data,
      assigned_evaluator_ids: ids,
      assigned_evaluators,
      reviews: (reviews || []) as KpiEvaluatorReview[],
    };

    const myReview = currentPersonnelId
      ? ((reviews || []).find((r: any) => r.evaluator_id === currentPersonnelId) as KpiEvaluatorReview) || null
      : null;

    const p = data.personnel;
    const isSelf = Boolean(
      (currentUserContext.personnelId && data.personnel_id === currentUserContext.personnelId) ||
      (currentUserContext.userId && p?.user_id === currentUserContext.userId) ||
      (currentUserContext.currentUser?.email && p?.email && p.email.toLowerCase() === currentUserContext.currentUser.email.toLowerCase())
    );

    const isAssignedEvaluator = Boolean(
      currentUserContext.personnelId &&
      (ids.includes(currentUserContext.personnelId) || data.assigned_evaluator_id === currentUserContext.personnelId)
    );

    if (!currentUserContext.canViewAll && !isSelf && !isAssignedEvaluator) {
      return {
        success: false,
        error: 'คุณไม่มีสิทธิ์ในการเข้าถึงข้อมูลการประเมินนี้ (อนุญาตเฉพาะเจ้าของแบบประเมิน กรรมการผู้ประเมิน และผู้บริหาร)',
      };
    }

    // Anonymize evaluator identities for non-admins
    if (!currentUserContext.canViewAll) {
      if (isSelf) {
        evaluationWithReviews.assigned_evaluators = [];
        evaluationWithReviews.assigned_evaluator_id = null;
        evaluationWithReviews.assigned_evaluator_ids = [];
        evaluationWithReviews.reviews = (evaluationWithReviews.reviews || []).map((r: any) => ({
          ...r,
          evaluator_id: 'anonymous',
        })) as KpiEvaluatorReview[];
      } else if (isAssignedEvaluator) {
        evaluationWithReviews.assigned_evaluators = (evaluationWithReviews.assigned_evaluators || []).filter(
          (ev: any) => ev.id === currentPersonnelId
        );
        evaluationWithReviews.assigned_evaluator_id = currentPersonnelId;
        evaluationWithReviews.assigned_evaluator_ids = currentPersonnelId ? [currentPersonnelId] : [];
        evaluationWithReviews.reviews = (evaluationWithReviews.reviews || []).filter(
          (r: any) => r.evaluator_id === currentPersonnelId
        );
      }
    }

    return {
      success: true,
      data: evaluationWithReviews,
      currentUserContext: {
        userId: currentUserContext.userId,
        personnelId: currentUserContext.personnelId,
        isAdmin: currentUserContext.isAdmin,
        isExecutive: currentUserContext.isExecutive,
        canViewAll: currentUserContext.canViewAll,
      },
      myReview,
    };
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

    // 1. Get current evaluation with template & personnel
    const { data: evaluation, error: fetchErr } = await supabase
      .from('kpi_evaluations')
      .select('*, personnel:personnel_id(*), template:template_id(*)')
      .eq('id', evaluationId)
      .single();

    if (fetchErr || !evaluation) throw new Error('ไม่พบข้อมูลการประเมิน');

    const currentUserContext = await resolveUserContext(supabase);
    const p = evaluation.personnel;
    const isSelf = Boolean(
      (currentUserContext.personnelId && evaluation.personnel_id === currentUserContext.personnelId) ||
      (currentUserContext.userId && p?.user_id === currentUserContext.userId) ||
      (currentUserContext.currentUser?.email && p?.email && p.email.toLowerCase() === currentUserContext.currentUser.email.toLowerCase())
    );

    if (!currentUserContext.canViewAll && !isSelf) {
      return {
        success: false,
        error: 'คุณไม่มีสิทธิ์ส่งแบบประเมินตนเองของบุคลากรท่านนี้ (ประเมินตนเองได้เฉพาะเจ้าของแบบประเมินเท่านั้น)',
      };
    }

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
      .select(`*, personnel:personnel_id(*), assigned_evaluator:assigned_evaluator_id(*), cycle:cycle_id(*), template:template_id(*)`)
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
 * Supports multiple evaluators, individual review tracking, score averaging across all evaluators,
 * and automatic anonymous email dispatch upon full completion.
 */
export async function submitSupervisorEvaluation(
  evaluationId: string,
  payload: {
    supervisor_scores: Record<string, number>;
    supervisor_feedback: Record<string, string>;
    supervisor_overall_comment: string;
    supervisor_strengths: string;
    supervisor_improvements: string;
  },
  asEvaluatorId?: string
): Promise<{
  success: boolean;
  data?: KpiEvaluation;
  allCompleted?: boolean;
  emailSent?: boolean;
  submittedCount?: number;
  totalAssigned?: number;
  error?: string;
}> {
  try {
    const supabase = getAdminClient();
    const currentUserContext = await resolveUserContext(supabase);

    // 1. Get current evaluation with template
    const { data: evaluation, error: fetchErr } = await supabase
      .from('kpi_evaluations')
      .select('*, template:template_id(*)')
      .eq('id', evaluationId)
      .single();

    if (fetchErr || !evaluation) throw new Error('ไม่พบข้อมูลการประเมิน');

    const assignedIds: string[] =
      evaluation.assigned_evaluator_ids && evaluation.assigned_evaluator_ids.length > 0
        ? evaluation.assigned_evaluator_ids
        : evaluation.assigned_evaluator_id
        ? [evaluation.assigned_evaluator_id]
        : [];

    const isAssigned = Boolean(currentUserContext.personnelId && assignedIds.includes(currentUserContext.personnelId));

    if (!currentUserContext.canViewAll && !isAssigned) {
      return {
        success: false,
        error: 'คุณไม่มีสิทธิ์ประเมินในฐานะกรรมการของบุคลากรท่านนี้ (ไม่ได้อยู่ในรายชื่อคณะกรรมการผู้ได้รับมอบหมาย)',
      };
    }

    // 2. Identify the active evaluator
    // Only Admin / Executive can evaluate as another evaluator; peer evaluators are strictly locked to own personnelId
    let currentPersonnelId: string | null =
      currentUserContext.canViewAll && asEvaluatorId
        ? asEvaluatorId
        : currentUserContext.personnelId || null;

    // Fallback if admin has no personnel link: pick first assigned evaluator or default director
    if (!currentPersonnelId && currentUserContext.canViewAll) {
      const assigned = evaluation.assigned_evaluator_ids || [];
      currentPersonnelId = assigned[0] || evaluation.assigned_evaluator_id || '3da9e72c-e913-4606-9b33-46aa9427ff43';
    }

    if (!currentPersonnelId) {
      return { success: false, error: 'ไม่พบข้อมูลรหัสบุคลากรของผู้ประเมิน' };
    }

    // 3. Compute single review score
    const draftEval: KpiEvaluation = {
      ...(evaluation as KpiEvaluation),
      supervisor_scores: payload.supervisor_scores,
      supervisor_feedback: payload.supervisor_feedback,
    };
    const { supervisorTotal: myReviewTotal } = calculateKpiScoreSummaries(draftEval);

    // 4. Upsert this evaluator's review into kpi_evaluator_reviews
    const { error: reviewErr } = await supabase.from('kpi_evaluator_reviews').upsert(
      {
        evaluation_id: evaluationId,
        evaluator_id: currentPersonnelId,
        status: 'submitted',
        scores: payload.supervisor_scores,
        feedback: payload.supervisor_feedback,
        overall_comment: payload.supervisor_overall_comment,
        strengths: payload.supervisor_strengths,
        improvements: payload.supervisor_improvements,
        total_score: myReviewTotal,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'evaluation_id,evaluator_id' }
    );

    if (reviewErr) throw reviewErr;

    // 5. Check all submitted reviews for this evaluation
    const { data: allReviews, error: reviewsErr } = await supabase
      .from('kpi_evaluator_reviews')
      .select('*')
      .eq('evaluation_id', evaluationId);

    if (reviewsErr) throw reviewsErr;

    const submittedReviews = (allReviews || []).filter((r) => r.status === 'submitted');
    const totalAssigned = Math.max(assignedIds.length, 1);
    const submittedCount = submittedReviews.length;

    // Check if ALL assigned evaluators have submitted
    const allAssignedDone =
      assignedIds.length > 0
        ? assignedIds.every((id) => submittedReviews.some((r) => r.evaluator_id === id))
        : submittedCount > 0;

    if (allAssignedDone) {
      // 6. Score Averaging across all submitted reviews!
      const avgScores: Record<string, number> = {};
      const sections = evaluation.template?.sections || [];
      const allItems = sections.flatMap((s: any) => s.items);

      allItems.forEach((item: any) => {
        const itemVals = submittedReviews
          .map((r: any) => Number(r.scores?.[item.id] || 0))
          .filter((v: number) => v > 0);
        if (itemVals.length > 0) {
          const sum = itemVals.reduce((a: number, b: number) => a + b, 0);
          avgScores[item.id] = Number((sum / itemVals.length).toFixed(2));
        } else {
          avgScores[item.id] = 0;
        }
      });

      // Combine feedbacks per section
      const combinedFeedback: Record<string, string> = {};
      sections.forEach((sec: any) => {
        const fList = submittedReviews
          .map((r: any) => r.feedback?.[sec.id]?.trim())
          .filter(Boolean);
        if (fList.length > 0) {
          combinedFeedback[sec.id] = fList.join('\n\n---\n\n');
        }
      });

      // Combine strengths & improvements into clean bullet points (anonymously)
      const formatBullets = (items: string[]) => {
        const lines: string[] = [];
        items.forEach((txt) => {
          txt.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (trimmed.startsWith('•') || trimmed.startsWith('-') || /^\d+[\.\)]/.test(trimmed)) {
              lines.push(trimmed);
            } else {
              lines.push(`• ${trimmed}`);
            }
          });
        });
        return lines.join('\n');
      };

      const strengthList = submittedReviews.map((r: any) => r.strengths?.trim()).filter(Boolean);
      const improvementList = submittedReviews.map((r: any) => r.improvements?.trim()).filter(Boolean);
      const combinedStrengths = formatBullets(strengthList);
      const combinedImprovements = formatBullets(improvementList);
      const combinedOverallComment = submittedReviews
        .map((r: any) => r.overall_comment?.trim())
        .filter(Boolean)
        .join('\n\n');

      // Compute final averaged score and final grade
      const averagedEval: KpiEvaluation = {
        ...(evaluation as KpiEvaluation),
        supervisor_scores: avgScores,
        supervisor_feedback: combinedFeedback,
      };
      const { supervisorTotal: finalAveragedScore, finalGrade } = calculateKpiScoreSummaries(averagedEval);

      // 7. Update kpi_evaluations to 'completed'
      const { data: updatedEval, error: updateErr } = await supabase
        .from('kpi_evaluations')
        .update({
          supervisor_scores: avgScores,
          supervisor_feedback: combinedFeedback,
          supervisor_overall_comment: combinedOverallComment || null,
          supervisor_strengths: combinedStrengths || null,
          supervisor_improvements: combinedImprovements || null,
          supervisor_total_score: finalAveragedScore,
          final_score: finalAveragedScore,
          final_grade: finalGrade,
          supervisor_submitted_at: new Date().toISOString(),
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', evaluationId)
        .select(`*, personnel:personnel_id(*), cycle:cycle_id(*), template:template_id(*)`)
        .single();

      if (updateErr) throw updateErr;

      // 8. AUTOMATIC ANONYMOUS GMAIL DISPATCH
      let emailSent = false;
      try {
        await sendAnonymousKpiEmail(updatedEval as KpiEvaluation);
        await supabase
          .from('kpi_evaluations')
          .update({
            email_notified_at: new Date().toISOString(),
            email_notified_status: 'sent',
          })
          .eq('id', evaluationId);
        emailSent = true;
      } catch (mailErr) {
        console.error('Auto dispatch email error:', mailErr);
      }

      return {
        success: true,
        data: updatedEval as KpiEvaluation,
        allCompleted: true,
        emailSent,
        submittedCount,
        totalAssigned,
      };
    } else {
      // Partial completion: some evaluators have submitted, but waiting for the rest
      return {
        success: true,
        allCompleted: false,
        emailSent: false,
        submittedCount,
        totalAssigned,
      };
    }
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
    const currentUserContext = await resolveUserContext(supabase);
    if (!currentUserContext.canViewAll) {
      return { success: false, error: 'คุณไม่มีสิทธิ์จัดส่งผลประเมินทางอีเมล (เฉพาะผู้บริหารและผู้ดูแลระบบ)' };
    }

    // 1. Fetch full evaluation
    const { data: evaluation, error: fetchErr } = await supabase
      .from('kpi_evaluations')
      .select(`
        *,
        personnel:personnel_id(*),
        assigned_evaluator:assigned_evaluator_id(*),
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
    const currentUserContext = await resolveUserContext(supabase);
    if (!currentUserContext.canViewAll) {
      return { success: false, insertedCount: 0, error: 'คุณไม่มีสิทธิ์ซิงค์ข้อมูลบุคลากร (เฉพาะผู้บริหารและผู้ดูแลระบบ)' };
    }

    // Get active template if not provided
    // Get active templates for teacher and staff
    const { data: teacherTmpl } = await supabase
      .from('kpi_templates')
      .select('id')
      .eq('target_role', 'teacher')
      .eq('is_active', true)
      .limit(1)
      .single();

    const { data: staffTmpl } = await supabase
      .from('kpi_templates')
      .select('id')
      .eq('target_role', 'staff')
      .eq('is_active', true)
      .limit(1)
      .single();

    const teacherTemplateId = teacherTmpl?.id || templateId;
    const staffTemplateId = staffTmpl?.id;

    // Get active personnel
    const { data: personnelList } = await supabase
      .from('personnel')
      .select('id, category, position_th')
      .eq('is_active', true);

    if (!personnelList || personnelList.length === 0) {
      return { success: true, insertedCount: 0 };
    }

    // Fetch existing evaluations for this cycle to avoid duplicate entries
    const { data: existingEvaluations } = await supabase
      .from('kpi_evaluations')
      .select('id, personnel_id, template_id')
      .eq('cycle_id', cycleId);

    const existingMap = new Map((existingEvaluations || []).map((e) => [e.personnel_id, e]));

    // If existing records were created before template was published, backfill template_id
    for (const [pId, evalRecord] of existingMap.entries()) {
      if (!evalRecord.template_id) {
        const p = personnelList.find((item) => item.id === pId);
        if (p) {
          const targetTmplId =
            p.category === 'teacher' ? teacherTemplateId : p.category === 'staff' ? staffTemplateId : null;
          if (targetTmplId) {
            await supabase
              .from('kpi_evaluations')
              .update({ template_id: targetTmplId })
              .eq('id', evalRecord.id);
          }
        }
      }
    }

    const unassignedPersonnel = personnelList.filter((p) => !existingMap.has(p.id));
    if (unassignedPersonnel.length === 0) {
      return { success: true, insertedCount: 0 };
    }

    const defaultEvaluatorId = '3da9e72c-e913-4606-9b33-46aa9427ff43';
    let inserted = 0;
    for (const p of unassignedPersonnel) {
      const isTeacher = p.category === 'teacher';
      const isStaff = p.category === 'staff';
      const assignedTmplId = isTeacher ? teacherTemplateId : isStaff ? staffTemplateId : null;

      const { error } = await supabase
        .from('kpi_evaluations')
        .insert([
          {
            cycle_id: cycleId,
            personnel_id: p.id,
            template_id: assignedTmplId || null,
            assigned_evaluator_id: defaultEvaluatorId,
            assigned_evaluator_ids: [defaultEvaluatorId],
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
