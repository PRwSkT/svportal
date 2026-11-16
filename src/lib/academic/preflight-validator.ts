/**
 * Pre-Flight Exam Quality Validator for SVPortal Exam Studio
 * Runs comprehensive educational and technical quality checks before saving or printing.
 */

import type { AcademicExamQuestion, ChoiceOption } from '@/types/academic';
import { isPinnedOption } from './exam-engine';

export type PreFlightSeverity = 'error' | 'warning' | 'info';

export interface PreFlightIssue {
  id: string;
  question_number?: number;
  field?: 'question_text' | 'choices' | 'correct_choice' | 'points' | 'pin_choice_position' | 'general';
  severity: PreFlightSeverity;
  title: string;
  description: string;
  suggestion?: string;
  autoFixAction?: 'pin_choice' | 'balance_keys' | 'fix_empty';
}

export interface PreFlightReport {
  isValid: boolean;
  canPrint: boolean;
  totalQuestions: number;
  totalPoints: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: PreFlightIssue[];
  keyDistribution: Record<ChoiceOption, number>;
  estimatedCompletionMinutes: number;
}

/**
 * Runs all pre-flight quality checks on an exam's questions
 */
export function validateExamPreFlight(
  questions: AcademicExamQuestion[],
  examConfig?: {
    total_score?: number;
    duration_minutes?: number;
  }
): PreFlightReport {
  const issues: PreFlightIssue[] = [];
  const keyDist: Record<ChoiceOption, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let totalCalculatedPoints = 0;
  let mcqCount = 0;
  let subjectiveCount = 0;

  if (!questions || questions.length === 0) {
    return {
      isValid: false,
      canPrint: false,
      totalQuestions: 0,
      totalPoints: 0,
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
      issues: [{
        id: 'no_questions',
        severity: 'error',
        title: 'ยังไม่มีข้อสอบในฉบับ',
        description: 'กรุณาเพิ่มข้อสอบอย่างน้อย 1 ข้อก่อนบันทึกหรือพิมพ์'
      }],
      keyDistribution: keyDist,
      estimatedCompletionMinutes: 0
    };
  }

  // Consecutive answer keys tracker
  let lastKey: ChoiceOption | null = null;
  let consecutiveKeyCount = 0;
  let maxConsecutiveKey = 0;
  let maxConsecutiveChoice: ChoiceOption = 'A';

  questions.forEach((q, idx) => {
    const qNum = q.question_number || idx + 1;
    totalCalculatedPoints += Number(q.points || 0);

    const isSubj = q.question_type === 'subjective';
    if (isSubj) {
      subjectiveCount++;
    } else {
      mcqCount++;
      if (q.correct_choice && keyDist[q.correct_choice] !== undefined) {
        keyDist[q.correct_choice]++;
      }

      // Check consecutive answer keys
      if (q.correct_choice === lastKey) {
        consecutiveKeyCount++;
        if (consecutiveKeyCount > maxConsecutiveKey) {
          maxConsecutiveKey = consecutiveKeyCount;
          maxConsecutiveChoice = q.correct_choice;
        }
      } else {
        lastKey = q.correct_choice;
        consecutiveKeyCount = 1;
      }
    }

    // 1. Check empty question text
    if (!q.question_text || !q.question_text.trim()) {
      issues.push({
        id: `empty_text_${qNum}`,
        question_number: qNum,
        field: 'question_text',
        severity: 'error',
        title: `ข้อที่ ${qNum}: ข้อความโจทย์ว่างเปล่า`,
        description: 'กรุณากรอกข้อความโจทย์หรือใส่แผนภาพประกอบ',
        suggestion: 'พิมพ์คำถาม หรือใช้เครื่องมือ Smart Paste'
      });
    }

    if (!isSubj) {
      // 2. Check empty choices
      const choices = [
        { key: 'A', text: (q.choice_a || '').trim() },
        { key: 'B', text: (q.choice_b || '').trim() },
        { key: 'C', text: (q.choice_c || '').trim() },
        { key: 'D', text: (q.choice_d || '').trim() }
      ];

      choices.forEach(c => {
        if (!c.text) {
          issues.push({
            id: `empty_choice_${qNum}_${c.key}`,
            question_number: qNum,
            field: 'choices',
            severity: 'error',
            title: `ข้อที่ ${qNum}: ตัวเลือก ${c.key} ว่างเปล่า`,
            description: `กรุณากรอกข้อความสำหรับตัวเลือก ${c.key}`
          });
        }
      });

      // 3. Check duplicate choices within the same question
      const texts = choices.map(c => c.text.toLowerCase()).filter(t => t.length > 0);
      const uniqueTexts = new Set(texts);
      if (uniqueTexts.size < texts.length) {
        issues.push({
          id: `duplicate_choices_${qNum}`,
          question_number: qNum,
          field: 'choices',
          severity: 'warning',
          title: `ข้อที่ ${qNum}: มีตัวเลือกซ้ำกันในข้อเดียวกัน`,
          description: 'ตรวจพบตัวเลือกที่มีข้อความเหมือนกัน อาจทำให้นักเรียนสับสนหรือได้คะแนนฟรี',
          suggestion: 'ตรวจสอบและปรับเปลี่ยนข้อความตัวเลือกไม่ให้ซ้ำกัน'
        });
      }

      // 4. Check unmodified default choices
      const defaultPlaceholders = ['ตัวเลือก ก', 'ตัวเลือก ข', 'ตัวเลือก ค', 'ตัวเลือก ง', 'option a', 'option b'];
      const hasDefaultPlaceholder = choices.some(c => defaultPlaceholders.includes(c.text.toLowerCase()));
      if (hasDefaultPlaceholder) {
        issues.push({
          id: `default_placeholder_${qNum}`,
          question_number: qNum,
          field: 'choices',
          severity: 'warning',
          title: `ข้อที่ ${qNum}: ยังใช้ข้อความตัวเลือกตั้งต้น`,
          description: 'ตรวจพบข้อความเช่น "ตัวเลือก ก" ที่ยังไม่ได้แก้ไขเนื้อหาจริง'
        });
      }

      // 5. Check pinned choice unpinned (e.g. "ถูกทุกข้อ" in choice D without pin_choice_position)
      const dIsPinned = isPinnedOption(q.choice_d);
      if (dIsPinned && !q.pin_choice_position) {
        issues.push({
          id: `unpinned_choice_d_${qNum}`,
          question_number: qNum,
          field: 'pin_choice_position',
          severity: 'warning',
          title: `ข้อที่ ${qNum}: ตัวเลือก ง คือ "${q.choice_d}" แต่ไม่ได้ล็อกตำแหน่ง`,
          description: 'หากไม่เปิดใช้งาน "ล็อกตำแหน่ง (Pin)", ตัวเลือกนี้อาจถูกสลับไปอยู่ข้อ ก. หรือ ข. ในข้อสอบชุด B/C',
          suggestion: 'เปิดล็อกตำแหน่ง (Pin Position) ให้อัตโนมัติ',
          autoFixAction: 'pin_choice'
        });
      }

      // 6. Check pinned choice text at choice A, B, or C
      ['choice_a', 'choice_b', 'choice_c'].forEach((cKey, cIdx) => {
        const cText = (q as any)[cKey] || '';
        if (isPinnedOption(cText)) {
          const letter = ['ก', 'ข', 'ค'][cIdx];
          issues.push({
            id: `pinned_not_at_end_${qNum}_${letter}`,
            question_number: qNum,
            field: 'choices',
            severity: 'warning',
            title: `ข้อที่ ${qNum}: คำว่า "${cText}" อยู่ในตัวเลือก ${letter}`,
            description: 'ข้อความประเภท "ถูกทุกข้อ" หรือ "ไม่มีข้อถูก" ควรอยู่ที่ตัวเลือก ง. หรือท้ายสุดเสมอ',
            suggestion: 'ย้ายตัวเลือกนี้ไปไว้ที่ตัวเลือก ง. และเปิดล็อกตำแหน่ง'
          });
        }
      });
    } else {
      // Subjective checks
      if (!q.choice_a || !q.choice_a.trim()) {
        issues.push({
          id: `subj_no_model_answer_${qNum}`,
          question_number: qNum,
          field: 'choices',
          severity: 'warning',
          title: `ข้อที่ ${qNum} (อัตนัย): ยังไม่มีแนวคำตอบสำหรับครูผู้ตรวจ`,
          description: 'แนะนำให้ใส่แนวคำตอบหรือคีย์เวิร์ดสำคัญ เพื่อใช้ในการเฉลยและตรวจข้อสอบ'
        });
      }
    }
  });

  // 7. Check answer key distribution skew (MCQ only)
  if (mcqCount >= 8) {
    const totalMcq = mcqCount;
    const slots: ChoiceOption[] = ['A', 'B', 'C', 'D'];
    slots.forEach(slot => {
      const count = keyDist[slot] || 0;
      const percentage = (count / totalMcq) * 100;
      if (percentage >= 50) {
        issues.push({
          id: `skew_key_${slot}`,
          field: 'correct_choice',
          severity: 'warning',
          title: `เฉลยข้อ ${slot} มีสัดส่วนสูงผิดปกติ (${percentage.toFixed(0)}%)`,
          description: `มีข้อที่เฉลย ${slot} ถึง ${count} จาก ${totalMcq} ข้อ อาจทำให้นักเรียนเดาทางข้อสอบได้ง่าย`,
          suggestion: 'แนะนำให้เกลี่ยเฉลยให้กระจายตัวอย่างสมดุล (ประมาณ 20-30% ต่อตัวเลือก)',
          autoFixAction: 'balance_keys'
        });
      } else if (count === 0 && totalMcq >= 10) {
        issues.push({
          id: `missing_key_${slot}`,
          field: 'correct_choice',
          severity: 'info',
          title: `ไม่มีข้อสอบข้อใดที่เฉลยข้อ ${slot} เลย`,
          description: `จากทั้งหมด ${totalMcq} ข้อ ไม่มีข้อใดตอบ ${slot}`
        });
      }
    });

    // Check consecutive streaks (e.g. 4 'A's in a row)
    if (maxConsecutiveKey >= 4) {
      issues.push({
        id: 'consecutive_keys_streak',
        field: 'correct_choice',
        severity: 'warning',
        title: `ตรวจพบเฉลยตัวเลือก ${maxConsecutiveChoice} ติดกันถึง ${maxConsecutiveKey} ข้อรวด`,
        description: 'การออกเฉลยซ้ำติดกันเกิน 3 ข้ออาจทำให้นักเรียนลังเลหรือเกิดความลำเอียงในการเดา'
      });
    }
  }

  // 8. Check total points mismatch with config
  if (examConfig?.total_score && Math.abs(totalCalculatedPoints - examConfig.total_score) > 0.01) {
    issues.push({
      id: 'score_mismatch',
      field: 'points',
      severity: 'warning',
      title: 'คะแนนรวมของทุกข้อไม่ตรงกับคะแนนเต็มของข้อสอบ',
      description: `ผลรวมคะแนนรายข้อได้ ${totalCalculatedPoints} คะแนน แต่คะแนนเต็มของแบบทดสอบตั้งไว้ที่ ${examConfig.total_score} คะแนน`,
      suggestion: 'ปรับคะแนนรายข้อให้รวมกันเท่ากับคะแนนเต็ม'
    });
  }

  // Calculate estimated completion time
  // Rough benchmark: ~1.2 mins per MCQ, ~3.5 mins per subjective question
  const estimatedMins = Math.ceil(mcqCount * 1.2 + subjectiveCount * 3.5);

  if (examConfig?.duration_minutes && estimatedMins > examConfig.duration_minutes * 1.2) {
    issues.push({
      id: 'time_warning_too_long',
      severity: 'info',
      title: 'ความยาวข้อสอบอาจเกินเวลาที่กำหนด',
      description: `ประเมินเวลาทำข้อสอบประมาณ ${estimatedMins} นาที แต่กำหนดเวลาสอบไว้ ${examConfig.duration_minutes} นาที`
    });
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return {
    isValid: errorCount === 0,
    canPrint: errorCount === 0,
    totalQuestions: questions.length,
    totalPoints: totalCalculatedPoints,
    errorCount,
    warningCount,
    infoCount,
    issues,
    keyDistribution: keyDist,
    estimatedCompletionMinutes: estimatedMins
  };
}
