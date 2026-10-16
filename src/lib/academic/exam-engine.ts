import { AcademicExamQuestion, AcademicExamSet, ChoiceOption, ExamQuestionOrderMapping } from '@/types/academic';

/**
 * Shuffles an array with Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const result = [...array];
  let m = result.length;
  let t: T;
  let i: number;

  // Simple pseudo-random with optional seed
  let random = seed !== undefined 
    ? () => {
        seed = (seed! * 9301 + 49297) % 233280;
        return seed / 233280;
      }
    : Math.random;

  while (m) {
    i = Math.floor(random() * m--);
    t = result[m];
    result[m] = result[i];
    result[i] = t;
  }

  return result;
}

/**
 * Checks if a choice text is a classic pinned option (e.g. "ถูกทุกข้อ", "ไม่มีข้อถูก")
 */
export function isPinnedOption(text: string): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  const pinnedPhrases = [
    'ถูกทุกข้อ',
    'ผิดทุกข้อ',
    'ไม่มีข้อใดถูก',
    'ไม่มีข้อถูก',
    'ข้อ ก และ ข ถูก',
    'ข้อ a และ b ถูก',
    'all of the above',
    'none of the above',
    'both a and b are correct'
  ];
  return pinnedPhrases.some(phrase => normalized.includes(phrase));
}

export interface GenerateSetsOptions {
  setNames?: ('A' | 'B' | 'C' | 'D')[];
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
}

/**
 * Generates Exam Sets (A, B, C...) with:
 * 1. Question re-ordering
 * 2. Choice shuffling with PINNING protection (e.g. "ถูกทุกข้อ" stays at D)
 * 3. Exact answer key calculation per set
 */
export function generateExamSets(
  questions: AcademicExamQuestion[],
  options: GenerateSetsOptions = {}
): AcademicExamSet[] {
  const setNames = options.setNames || ['A', 'B', 'C'];
  const shuffleQuestions = options.shuffleQuestions ?? true;
  const shuffleChoices = options.shuffleChoices ?? true;

  const sets: AcademicExamSet[] = [];

  for (let sIdx = 0; sIdx < setNames.length; sIdx++) {
    const setName = setNames[sIdx];

    // Set A keeps original master order (1..N), variants B/C/D are shuffled
    const isSetA = setName === 'A';
    const qList = (isSetA || !shuffleQuestions) 
      ? [...questions] 
      : shuffleArray(questions, (sIdx + 1) * 777);

    const questionMapping: ExamQuestionOrderMapping[] = [];
    const answerKey: Record<string, ChoiceOption> = {};

    qList.forEach((q, newIndex) => {
      const newQuestionNumber = newIndex + 1;
      const originalChoices: { key: ChoiceOption; text: string }[] = [
        { key: 'A', text: q.choice_a },
        { key: 'B', text: q.choice_b },
        { key: 'C', text: q.choice_c },
        { key: 'D', text: q.choice_d }
      ];

      // Check if D (or any choice) must be pinned
      const isDPinned = q.pin_choice_position || 
        isPinnedOption(q.choice_d) || 
        q.pinned_choice_index === 'D';

      let shuffledChoices: { key: ChoiceOption; text: string }[];

      if (!shuffleChoices || isSetA) {
        shuffledChoices = [...originalChoices];
      } else if (isDPinned) {
        // Pin D in place, shuffle only A, B, C
        const top3 = shuffleArray(originalChoices.slice(0, 3), (sIdx + 1) * 31 + newIndex);
        shuffledChoices = [...top3, originalChoices[3]];
      } else {
        // Shuffle all 4 choices
        shuffledChoices = shuffleArray(originalChoices, (sIdx + 1) * 31 + newIndex);
      }

      // Map choice positions: new slot (A,B,C,D) -> which original key was it?
      const choiceSlots: ChoiceOption[] = ['A', 'B', 'C', 'D'];
      const choiceMap: Record<ChoiceOption, ChoiceOption> = { A: 'A', B: 'B', C: 'C', D: 'D' };
      let newCorrectChoice: ChoiceOption = 'A';

      choiceSlots.forEach((slot, idx) => {
        const item = shuffledChoices[idx];
        choiceMap[slot] = item.key;
        if (item.key === q.correct_choice) {
          newCorrectChoice = slot;
        }
      });

      questionMapping.push({
        original_question_number: q.question_number,
        new_question_number: newQuestionNumber,
        choice_map: choiceMap
      });

      answerKey[newQuestionNumber.toString()] = newCorrectChoice;
    });

    sets.push({
      id: '',
      exam_id: questions[0]?.exam_id || '',
      set_name: setName,
      question_order_mapping: questionMapping,
      answer_key: answerKey,
      created_at: new Date().toISOString()
    });
  }

  return sets;
}

/**
 * Scores student answers against a set's answer key
 */
export function scoreExamAnswers(
  studentAnswers: Record<string, ChoiceOption>,
  answerKey: Record<string, ChoiceOption>,
  questionPoints?: Record<string, number>,
  maxExamScore: number = 20
): {
  rawScore: number;
  totalScore: number;
  maxPoints: number;
  correctCount: number;
  totalQuestions: number;
  itemResults: Record<string, { correct: boolean; studentAns: ChoiceOption | null; keyAns: ChoiceOption; points: number }>;
} {
  let rawScore = 0;
  let maxPoints = 0;
  let correctCount = 0;
  const itemResults: Record<string, any> = {};
  const questionNumbers = Object.keys(answerKey).sort((a, b) => Number(a) - Number(b));

  questionNumbers.forEach(qNum => {
    const key = answerKey[qNum];
    const studentAns = studentAnswers[qNum] || null;
    const pt = questionPoints?.[qNum] ?? 1.0;
    maxPoints += pt;

    const isCorrect = studentAns === key;
    const earned = isCorrect ? pt : 0;
    if (isCorrect) correctCount++;
    rawScore += earned;

    itemResults[qNum] = {
      correct: isCorrect,
      studentAns,
      keyAns: key,
      points: earned
    };
  });

  const scaledScore = maxPoints > 0 
    ? Math.round(((rawScore / maxPoints) * maxExamScore) * 100) / 100 
    : 0;

  return {
    rawScore,
    totalScore: scaledScore,
    maxPoints,
    correctCount,
    totalQuestions: questionNumbers.length,
    itemResults
  };
}

/**
 * Build a points lookup keyed by the question number AS PRINTED in a given set.
 * Sets shuffle question order, so set question N maps back to an original question
 * through question_order_mapping. Falls back to 1 point when unknown.
 */
export function buildSetPointsMap(
  set: Pick<AcademicExamSet, 'question_order_mapping'> | null | undefined,
  questions: Array<Pick<AcademicExamQuestion, 'question_number' | 'points'>>
): Record<string, number> {
  const pointsByOriginal = new Map<number, number>();
  questions.forEach(q => pointsByOriginal.set(Number(q.question_number), Number(q.points) || 1));

  const map: Record<string, number> = {};
  const mapping = set?.question_order_mapping || [];
  if (mapping.length > 0) {
    mapping.forEach(m => {
      map[String(m.new_question_number)] = pointsByOriginal.get(Number(m.original_question_number)) ?? 1;
    });
  } else {
    questions.forEach(q => {
      map[String(q.question_number)] = Number(q.points) || 1;
    });
  }
  return map;
}

/**
 * Rebuild a set's answer key from the CURRENT questions using the set's existing
 * shuffle mapping. Used when a teacher fixes a wrong key after students already
 * answered: printed papers are unchanged, only the key is corrected.
 */
export function rebuildAnswerKeyFromMapping(
  set: Pick<AcademicExamSet, 'question_order_mapping'>,
  questions: Array<Pick<AcademicExamQuestion, 'question_number' | 'correct_choice'>>
): Record<string, ChoiceOption> {
  const correctByOriginal = new Map<number, ChoiceOption>();
  questions.forEach(q => correctByOriginal.set(Number(q.question_number), q.correct_choice));

  const key: Record<string, ChoiceOption> = {};
  (set.question_order_mapping || []).forEach(m => {
    const originalCorrect = correctByOriginal.get(Number(m.original_question_number));
    if (!originalCorrect) return;
    const slots: ChoiceOption[] = ['A', 'B', 'C', 'D'];
    const slot = slots.find(s => m.choice_map?.[s] === originalCorrect) || originalCorrect;
    key[String(m.new_question_number)] = slot;
  });
  return key;
}

/**
 * 1-Second Retroactive Re-scoring Engine
 * Recalculates all student scores when an answer key or point value changes
 */
export function recalculateAllSubmissions(
  submissions: Array<{
    id: string;
    student_id: string;
    set_name: string;
    student_answers: Record<string, ChoiceOption>;
  }>,
  sets: AcademicExamSet[],
  maxScore: number = 20,
  questions: Array<Pick<AcademicExamQuestion, 'question_number' | 'points'>> = []
): Array<{
  id: string;
  student_id: string;
  raw_score: number;
  total_score: number;
}> {
  const setMap = new Map<string, AcademicExamSet>();
  sets.forEach(s => setMap.set(s.set_name, s));

  return submissions.map(sub => {
    const examSet = setMap.get(sub.set_name) || sets[0];
    const key = examSet?.answer_key || {};
    const points = questions.length > 0 ? buildSetPointsMap(examSet, questions) : undefined;
    const scoring = scoreExamAnswers(sub.student_answers || {}, key, points, maxScore);

    return {
      id: sub.id,
      student_id: sub.student_id,
      raw_score: scoring.rawScore,
      total_score: scoring.totalScore
    };
  });
}

/**
 * Optical Bubble Ambiguity Classifier
 * Evaluates densities of A, B, C, D to find student choice and detects ghost marks
 */
export function evaluateOMRBubbles(
  densities: Record<ChoiceOption, number>,
  options: {
    markThreshold?: number;     // Min density to consider a bubble marked (0.0 to 1.0)
    ambiguityDiff?: number;     // Min difference between 1st & 2nd choice to be confident
  } = {}
): {
  selectedChoice: ChoiceOption | null;
  isAmbiguous: boolean;
  confidence: number;
} {
  const markThreshold = options.markThreshold ?? 0.35;
  const ambiguityDiff = options.ambiguityDiff ?? 0.15;

  const choices: ChoiceOption[] = ['A', 'B', 'C', 'D'];
  const sorted = choices
    .map(c => ({ choice: c, density: densities[c] || 0 }))
    .sort((a, b) => b.density - a.density);

  const top1 = sorted[0];
  const top2 = sorted[1];

  // If even top1 is below threshold, the student left it blank
  if (top1.density < markThreshold) {
    return {
      selectedChoice: null,
      isAmbiguous: false,
      confidence: 1.0
    };
  }

  // If top2 is also above threshold and very close to top1 -> Ghost mark or multiple marks!
  if (top2.density >= markThreshold && (top1.density - top2.density) < ambiguityDiff) {
    return {
      selectedChoice: top1.choice,
      isAmbiguous: true,
      confidence: Math.max(0.1, (top1.density - top2.density) / top1.density)
    };
  }

  return {
    selectedChoice: top1.choice,
    isAmbiguous: false,
    confidence: Math.min(1.0, top1.density)
  };
}
