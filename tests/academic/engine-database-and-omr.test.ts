import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  normalizeQuestionMeta, 
  buildQuestionRow, 
  evaluateTeacherSubjectiveBubbles,
  generateExamSets,
  rebuildAnswerKeyFromMapping,
  scoreExamAnswers,
  recalculateAllSubmissions,
  buildSetPointsMap
} from '../../src/lib/academic/exam-engine';
import { generateBatchAnswerSheetsHtml } from '../../src/lib/academic/exam-print-engine';
import type { AcademicExamQuestion, ChoiceOption } from '../../src/types/academic';

test('Database Persistence: normalizeQuestionMeta & buildQuestionRow preserve all 9 subjective modes and rich metadata', () => {
  const all9Modes = [
    'short_fill',
    'step_by_step_math',
    'sub_questions',
    'comparison_table',
    'diagram_labeling',
    'sequencing_flow',
    'drawing_and_explain',
    'language_writing',
    'essay_extended'
  ] as const;

  for (const mode of all9Modes) {
    const rawQuestion = {
      question_number: 1,
      question_type: 'subjective',
      question_text: `ข้อสอบอัตนัยโหมด ${mode}`,
      math_latex: '\\frac{a}{b} = c',
      diagram_svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
      choice_a: 'แนวคำตอบสมบูรณ์',
      choice_b: 'lines_5',
      choice_c: 'เกณฑ์ 5 คะแนน: มีกระบวนการคิดและคำตอบถูกต้อง',
      points: 5,
      diagnostic_tags: ['TAG_MISCONCEPTION_1', 'TAG_FORMULA_ERROR'],
      step_by_step_solution: 'ขั้นตอนที่ 1: ตั้งสมการ\nขั้นตอนที่ 2: คำนวณหาค่า c',
      question_meta: {
        subjective_mode: mode
      }
    };

    const row = buildQuestionRow(rawQuestion, 'exam-db-test-id', 0);

    // 1. Verify table columns
    assert.strictEqual(row.exam_id, 'exam-db-test-id');
    assert.strictEqual(row.question_number, 1);
    assert.strictEqual(row.question_type, 'subjective');
    assert.strictEqual(row.math_latex, '\\frac{a}{b} = c');
    assert.strictEqual(row.diagram_svg?.includes('<circle'), true);
    assert.strictEqual(row.choice_a, 'แนวคำตอบสมบูรณ์');
    assert.strictEqual(row.choice_b, 'lines_5');
    assert.strictEqual(row.choice_c, 'เกณฑ์ 5 คะแนน: มีกระบวนการคิดและคำตอบถูกต้อง');

    // 2. Verify complete question_meta persistence
    assert.ok(row.question_meta, 'question_meta should be present');
    assert.strictEqual(row.question_meta.subjective_mode, mode, `Subjective mode ${mode} should be persisted`);
    assert.strictEqual(row.question_meta.sample_answer, 'แนวคำตอบสมบูรณ์');
    assert.strictEqual(row.question_meta.answer_format, 'lines_5');
    assert.strictEqual(row.question_meta.rubric_criteria, 'เกณฑ์ 5 คะแนน: มีกระบวนการคิดและคำตอบถูกต้อง');
    assert.deepStrictEqual(row.question_meta.diagnostic_tags, ['TAG_MISCONCEPTION_1', 'TAG_FORMULA_ERROR']);
    assert.strictEqual(row.question_meta.step_by_step_solution, 'ขั้นตอนที่ 1: ตั้งสมการ\nขั้นตอนที่ 2: คำนวณหาค่า c');
    assert.deepStrictEqual(row.question_meta.scoring_limits, { min: 0, max: 5 });
  }
});

test('Database Persistence: bidirectional fallback from question_meta to choice_a..c', () => {
  // If client sends data inside question_meta only, choice_a..c are populated as backward-compatible fallbacks
  const questionWithMetaOnly = {
    question_number: 21,
    question_type: 'subjective',
    question_text: 'จงอธิบายวัฏจักรของน้ำ',
    points: 4,
    question_meta: {
      subjective_mode: 'drawing_and_explain',
      sample_answer: 'การระเหย -> การควบแน่น -> หยาดน้ำฟ้า',
      answer_format: 'blank_box',
      rubric_criteria: 'เกณฑ์ 4 คะแนน: วาดภาพถูกต้อง 2 คะแนน อธิบายถูกต้อง 2 คะแนน',
      scoring_limits: { min: 0, max: 4 }
    }
  };

  const row = buildQuestionRow(questionWithMetaOnly, 'exam-db-test-2', 20);

  assert.strictEqual(row.choice_a, 'การระเหย -> การควบแน่น -> หยาดน้ำฟ้า');
  assert.strictEqual(row.choice_b, 'blank_box');
  assert.strictEqual(row.choice_c, 'เกณฑ์ 4 คะแนน: วาดภาพถูกต้อง 2 คะแนน อธิบายถูกต้อง 2 คะแนน');
  assert.strictEqual(row.question_meta.subjective_mode, 'drawing_and_explain');
});

test('Teacher Subjective Score Bubble Zone: renders dynamic bubble groups for N subjective questions', async () => {
  // Create 3 subjective questions
  const mockSubjectiveQuestions: AcademicExamQuestion[] = [
    {
      id: 'q-s1',
      exam_id: 'exam-omr-dynamic',
      question_number: 21,
      question_type: 'subjective',
      question_text: 'แสดงวิธีทำ 1',
      choice_a: 'คำตอบ 1',
      choice_b: 'lines_5',
      choice_c: 'เกณฑ์ 5 แต้ม',
      choice_d: '-',
      correct_choice: 'A',
      points: 5,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      indicator_code: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q-s2',
      exam_id: 'exam-omr-dynamic',
      question_number: 22,
      question_type: 'subjective',
      question_text: 'แสดงวิธีทำ 2',
      choice_a: 'คำตอบ 2',
      choice_b: 'lines_5',
      choice_c: 'เกณฑ์ 5 แต้ม',
      choice_d: '-',
      correct_choice: 'A',
      points: 5,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      indicator_code: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q-s3',
      exam_id: 'exam-omr-dynamic',
      question_number: 23,
      question_type: 'subjective',
      question_text: 'แสดงวิธีทำ 3',
      choice_a: 'คำตอบ 3',
      choice_b: 'lines_5',
      choice_c: 'เกณฑ์ 5 แต้ม',
      choice_d: '-',
      correct_choice: 'A',
      points: 5,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      indicator_code: null,
      created_at: new Date().toISOString()
    }
  ];

  const html = await generateBatchAnswerSheetsHtml({
    exam: {
      id: 'exam-omr-dynamic',
      title: 'ข้อสอบกลางภาค วิชาคณิตศาสตร์',
      total_questions: 23,
      duration_minutes: 60,
      max_score: 30
    },
    students: [
      { id: 'std-dyn-1', student_id: '10001', name: 'นายทดสอบ บับเบิ้ล', grade: 'ป.5/1', roll_number: 1 }
    ],
    subjectiveQuestions: mockSubjectiveQuestions,
    hasSubjective: true
  });

  // Check that Teacher Scoring Zone renders exactly 3 subjective items
  assert.ok(html.includes('data-teacher-zone="true"'), 'Should render data-teacher-zone');
  assert.ok(html.includes('data-teacher-item="1"'), 'Should render item 1');
  assert.ok(html.includes('data-teacher-item="2"'), 'Should render item 2');
  assert.ok(html.includes('data-teacher-item="3"'), 'Should render item 3');
  assert.strictEqual(html.includes('data-teacher-item="4"'), false, 'Should NOT render item 4');

  // Check that labels are clear for teachers and optical recognition
  assert.ok(html.includes('อ.1 (ข้อ 21):'), 'Should render label with question number');
  assert.ok(html.includes('อ.2 (ข้อ 22):'), 'Should render label with question number');
  assert.ok(html.includes('อ.3 (ข้อ 23):'), 'Should render label with question number');

  // Check optical scanner attributes
  assert.ok(html.includes('data-qnum="21"'), 'Should render data-qnum for scanner intake');
  assert.ok(html.includes('data-score="0"'), 'Should render bubble score 0');
  assert.ok(html.includes('data-score="5"'), 'Should render bubble score 5');
});

test('Optical Bubble Recognition: evaluateTeacherSubjectiveBubbles detects marks accurately', () => {
  // 1. Clean Teacher Mark on Score 4
  const markScore4: Record<number, number> = {
    0: 0.05,
    1: 0.04,
    2: 0.08,
    3: 0.12,
    4: 0.88, // Dark marked bubble
    5: 0.06
  };
  const result4 = evaluateTeacherSubjectiveBubbles(markScore4);
  assert.strictEqual(result4.score, 4);
  assert.strictEqual(result4.isAmbiguous, false);
  assert.strictEqual(result4.confidence, 0.88);

  // 2. Score 0 (student got zero)
  const markScore0: Record<number, number> = {
    0: 0.92,
    1: 0.03,
    2: 0.01,
    3: 0.02,
    4: 0.04,
    5: 0.01
  };
  const result0 = evaluateTeacherSubjectiveBubbles(markScore0);
  assert.strictEqual(result0.score, 0);
  assert.strictEqual(result0.isAmbiguous, false);

  // 3. Blank / Unmarked (all bubbles below threshold)
  const blankMark: Record<number, number> = {
    0: 0.1,
    1: 0.05,
    2: 0.08,
    3: 0.12,
    4: 0.09,
    5: 0.04
  };
  const resultBlank = evaluateTeacherSubjectiveBubbles(blankMark);
  assert.strictEqual(resultBlank.score, null);
  assert.strictEqual(resultBlank.isAmbiguous, false);

  // 4. Ambiguous / Double Mark (teacher changed mind, both bubbles 3 and 4 dark)
  const ambiguousMark: Record<number, number> = {
    0: 0.05,
    1: 0.02,
    2: 0.05,
    3: 0.72,
    4: 0.78, // Difference < 0.15
    5: 0.03
  };
  const resultAmbiguous = evaluateTeacherSubjectiveBubbles(ambiguousMark);
  assert.strictEqual(resultAmbiguous.score, 4);
  assert.strictEqual(resultAmbiguous.isAmbiguous, true);
});

test('OMR Grading & Scoring Intake: merges subjective scores and scales correctly', () => {
  // Simulate 3 MCQ questions (1 pt each) and 1 Subjective question (5 pts)
  const answerKey: Record<string, ChoiceOption> = {
    '1': 'A',
    '2': 'B',
    '3': 'C',
    '4': 'A' // Subjective slot in set answer key
  };

  const pointsMap: Record<string, number> = {
    '1': 1.0,
    '2': 1.0,
    '3': 1.0,
    '4': 5.0 // 5 points for subjective question
  };

  // Student got MCQ 1 and 2 right, 3 wrong; teacher awarded 4 points for subjective question 4
  const studentAnswers = {
    '1': 'A',
    '2': 'B',
    '3': 'D',
    '4': 4 // Numeric score awarded by teacher
  };

  const scoring = scoreExamAnswers(
    studentAnswers as any,
    answerKey,
    pointsMap,
    20 // Max exam score = 20
  );

  // Total raw points = 1 + 1 + 0 + 4 = 6
  // Max raw points = 1 + 1 + 1 + 5 = 8
  // Scaled score = (6 / 8) * 20 = 15.0
  assert.strictEqual(scoring.rawScore, 6);
  assert.strictEqual(scoring.maxPoints, 8);
  assert.strictEqual(scoring.totalScore, 15);
  assert.strictEqual(scoring.itemResults['4'].points, 4);
});

test('OMR Retroactive Recalculation: recalculates both objective and subjective scores', () => {
  const sets = [
    {
      id: 'set-a',
      exam_id: 'exam-1',
      set_name: 'A' as const,
      question_order_mapping: [
        { original_question_number: 1, new_question_number: 1, choice_map: { A: 'A' as ChoiceOption, B: 'B' as ChoiceOption, C: 'C' as ChoiceOption, D: 'D' as ChoiceOption, E: 'E' as ChoiceOption } },
        { original_question_number: 2, new_question_number: 2, choice_map: { A: 'A' as ChoiceOption, B: 'B' as ChoiceOption, C: 'C' as ChoiceOption, D: 'D' as ChoiceOption, E: 'E' as ChoiceOption } }
      ],
      answer_key: { '1': 'A' as ChoiceOption, '2': 'A' as ChoiceOption },
      created_at: new Date().toISOString()
    }
  ];

  const questions = [
    { question_number: 1, points: 5 }, // MCQ
    { question_number: 2, points: 5 }  // Subjective
  ];

  const submissions = [
    {
      id: 'sub-1',
      student_id: 'std-1',
      set_name: 'A',
      student_answers: {
        '1': 'A' as ChoiceOption, // Correct (5 pts)
        '2': 3 as any            // Subjective score 3 pts
      }
    }
  ];

  const recalculated = recalculateAllSubmissions(submissions, sets as any, 10, questions);
  // Total raw = 5 + 3 = 8 / 10 -> total_score = 8
  assert.strictEqual(recalculated.length, 1);
  assert.strictEqual(recalculated[0].raw_score, 8);
  assert.strictEqual(recalculated[0].total_score, 8);
});
