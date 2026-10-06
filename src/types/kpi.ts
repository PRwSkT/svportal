export type KpiStatus = 'pending_self' | 'self_submitted' | 'completed';
export type KpiGrade = 'A' | 'B+' | 'B' | 'C' | 'D';

export interface KpiCycle {
  id: string;
  title: string;
  academic_year: string;
  semester: string;
  start_date: string | null;
  end_date: string | null;
  status: 'draft' | 'active' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface KpiItem {
  id: string;
  code: string;
  title: string;
  description: string;
  max_score: number;
}

export interface KpiSection {
  id: string;
  title: string;
  weight: number; // percentage (e.g. 40)
  items: KpiItem[];
}

export interface KpiTemplate {
  id: string;
  title: string;
  description: string | null;
  target_role: 'teacher' | 'staff' | 'executive' | 'all';
  sections: KpiSection[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KpiEvaluation {
  id: string;
  cycle_id: string;
  personnel_id: string;
  template_id: string | null;
  status: KpiStatus;

  // Self assessment
  self_scores: Record<string, number>; // { [itemId]: 1-5 }
  self_notes: Record<string, string>; // { [sectionId]: evidence text }
  self_overall_comment: string | null;
  self_total_score: number | null;
  self_submitted_at: string | null;

  // Supervisor assessment
  supervisor_id: string | null;
  supervisor_scores: Record<string, number>; // { [itemId]: 1-5 }
  supervisor_feedback: Record<string, string>; // { [sectionId]: feedback text }
  supervisor_overall_comment: string | null;
  supervisor_strengths: string | null;
  supervisor_improvements: string | null;
  supervisor_total_score: number | null;
  supervisor_submitted_at: string | null;

  // Final results
  final_score: number | null;
  final_grade: KpiGrade | null;

  // Anonymous email notification tracking
  email_notified_at: string | null;
  email_notified_status: 'pending' | 'sent' | 'failed';

  created_at: string;
  updated_at: string;

  // Joined personnel details
  personnel?: {
    id: string;
    name_th: string;
    name_en: string;
    position_th: string;
    position_en: string;
    category: string;
    email: string | null;
    image_url: string | null;
    user_id: string | null;
  };

  // Joined cycle details
  cycle?: KpiCycle;

  // Joined template details
  template?: KpiTemplate;
}

export interface SectionScoreSummary {
  sectionId: string;
  sectionTitle: string;
  weight: number;
  selfAvg: number; // average 1-5
  selfScoreWeighted: number; // scaled to weight
  supervisorAvg: number; // average 1-5
  supervisorScoreWeighted: number; // scaled to weight
  gap: number; // supervisorAvg - selfAvg
}
