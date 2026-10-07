import { FormDefinition, FormField, QuizSettings, QuizSubmissionScore, ProctoringLog } from '@/types';

/**
 * Automatically grades a quiz submission based on FormField.quiz_config
 */
export function gradeQuizSubmission(
  form: FormDefinition,
  fields: FormField[],
  answers: Record<string, any>,
  timeSpentSeconds: number = 0
): QuizSubmissionScore | null {
  const quizSettings = form.quiz_settings;
  if (!quizSettings?.is_quiz) {
    return null;
  }

  let totalScore = 0;
  let maxScore = 0;
  const breakdown: QuizSubmissionScore['breakdown'] = {};

  const inputTypes = ['text', 'textarea', 'number', 'radio', 'checkbox', 'select', 'rating'];
  const examFields = fields.filter((f) => inputTypes.includes(f.field_type));

  for (const field of examFields) {
    const config = field.quiz_config;
    // Default to 1 point if in quiz mode and points not specified
    const maxPoints = config?.points !== undefined && config.points >= 0 ? config.points : 1;
    maxScore += maxPoints;

    const studentAnswer = answers[field.field_key];
    const correctAnswers = config?.correct_answers || [];

    let isCorrect = false;
    let pointsAwarded = 0;

    if (correctAnswers.length > 0 && studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
      if (field.field_type === 'radio' || field.field_type === 'select') {
        const studentStr = String(studentAnswer).trim();
        isCorrect = correctAnswers.some((ans) => String(ans).trim() === studentStr);
      } else if (field.field_type === 'checkbox') {
        let studentArr: string[] = [];
        if (Array.isArray(studentAnswer)) {
          studentArr = studentAnswer.map((s) => String(s).trim());
        } else if (typeof studentAnswer === 'string') {
          studentArr = studentAnswer.split(',').map((s) => s.trim());
        }

        const sortedStudent = [...studentArr].sort();
        const sortedCorrect = correctAnswers.map((s) => String(s).trim()).sort();

        // Exact match of all choices
        isCorrect =
          sortedStudent.length === sortedCorrect.length &&
          sortedStudent.every((val, idx) => val === sortedCorrect[idx]);
      } else if (field.field_type === 'number') {
        const studentNum = Number(studentAnswer);
        isCorrect = correctAnswers.some((ans) => Number(ans) === studentNum);
      } else if (field.field_type === 'text') {
        const studentText = String(studentAnswer).trim().toLowerCase();
        isCorrect = correctAnswers.some((ans) => String(ans).trim().toLowerCase() === studentText);
      } else if (field.field_type === 'rating') {
        const studentRating = Number(studentAnswer);
        isCorrect = correctAnswers.some((ans) => Number(ans) === studentRating);
      }
    }

    if (isCorrect) {
      pointsAwarded = maxPoints;
      totalScore += pointsAwarded;
    }

    breakdown[field.field_key] = {
      field_key: field.field_key,
      points_awarded: pointsAwarded,
      max_points: maxPoints,
      is_correct: isCorrect,
      student_answer: studentAnswer,
      correct_answers: correctAnswers,
      explanation: config?.explanation?.th || config?.explanation?.en,
    };
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const passThreshold = quizSettings.passing_score_percentage ?? 60;
  const passed = percentage >= passThreshold;

  return {
    total_score: totalScore,
    max_score: maxScore,
    percentage,
    passed,
    time_spent_seconds: timeSpentSeconds,
    submitted_at: new Date().toISOString(),
    breakdown,
  };
}

/**
 * Evaluates the proctoring log to calculate the student's integrity status
 */
export function evaluateIntegrityStatus(log: ProctoringLog): 'clean' | 'suspicious' | 'flagged' {
  if (!log) return 'clean';

  const tabSwitches = log.tab_switch_count || 0;
  const copyAttempts = log.copy_attempt_count || 0;
  const awaySeconds = log.total_away_seconds || 0;

  // Flagged: severe violations
  if (tabSwitches >= 3 || copyAttempts >= 2 || awaySeconds > 60) {
    return 'flagged';
  }

  // Suspicious: minor violations
  if (tabSwitches > 0 || copyAttempts > 0 || awaySeconds > 10) {
    return 'suspicious';
  }

  return 'clean';
}
