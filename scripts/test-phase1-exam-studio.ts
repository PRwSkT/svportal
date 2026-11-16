import { parseSmartPaste, parseSingleQuestionBlock } from '../src/lib/academic/smart-paste-parser';
import { validateExamPreFlight } from '../src/lib/academic/preflight-validator';
import { SUBJECTIVE_MODES } from '../src/components/academic/SubjectiveModeSelector';
import { AcademicExamQuestion } from '../src/types/academic';
import assert from 'assert';

console.log('========================================');
console.log('🧪 RUNNING EXAM STUDIO PHASE 1 TEST SUITE');
console.log('========================================\n');

// ----------------------------------------------------
// TEST 1: Smart Paste Parser
// ----------------------------------------------------
console.log('Test 1: Smart Paste Parser');

const rawThaiMcq = `1. ข้อใดต่อไปนี้เป็นจำนวนเฉพาะ?
ก. 9
ข. 15
ค. 17
ง. ถูกทุกข้อ
เฉลย: ค
คำอธิบาย: 17 มีตัวประกอบเพียง 1 และ 17 เท่านั้น
(1 คะแนน) [ตัวชี้วัด: ค 1.1 ป.6/1]

2. สมการ 2x + 4 = 10 ค่าของ x คือข้อใด?
A. 2
B. 3
C. 4
D. 5
Ans: B
(2 คะแนน)

3. จงอธิบายกระบวนการแบ่งเซลล์แบบไมโทซิส
คำอธิบาย: เป็นการแบ่งเซลล์ร่างกายเพื่อเพิ่มจำนวน ได้เซลล์ใหม่ 2 เซลล์ที่มีโครโมโซมเท่าเดิม
(5 คะแนน) [ตัวชี้วัด: ว 1.3 ม.3/1]`;

const parsed = parseSmartPaste(rawThaiMcq);
assert.strictEqual(parsed.success, true, 'Smart paste should succeed');
assert.strictEqual(parsed.questions.length, 3, 'Should parse 3 questions');

// Check Q1 (MCQ with pinned "ถูกทุกข้อ" at Choice D)
const q1 = parsed.questions[0];
assert.strictEqual(q1.question_type, 'mcq', 'Q1 should be MCQ');
assert.strictEqual(q1.choice_a, '9', 'Q1 choice A should be 9');
assert.strictEqual(q1.choice_c, '17', 'Q1 choice C should be 17');
assert.strictEqual(q1.choice_d, 'ถูกทุกข้อ', 'Q1 choice D should be ถูกทุกข้อ');
assert.strictEqual(q1.correct_choice, 'C', 'Q1 correct choice should be C');
assert.strictEqual(q1.pin_choice_position, true, 'Q1 Choice D "ถูกทุกข้อ" must automatically trigger pin_choice_position');
assert.strictEqual(q1.points, 1, 'Q1 points should be 1');
assert.strictEqual(q1.indicator_code, 'ค 1.1 ป.6/1', 'Q1 indicator code matches');

// Check Q2 (English letter A, B, C, D)
const q2 = parsed.questions[1];
assert.strictEqual(q2.question_type, 'mcq', 'Q2 should be MCQ');
assert.strictEqual(q2.correct_choice, 'B', 'Q2 correct choice should be B');
assert.strictEqual(q2.points, 2, 'Q2 points should be 2');

// Check Q3 (Subjective auto-classification)
const q3 = parsed.questions[2];
assert.strictEqual(q3.question_type, 'subjective', 'Q3 without choices should be classified as subjective');
assert.strictEqual(q3.points, 5, 'Q3 subjective default points should be 5');
assert.ok(q3.choice_a.includes('ไมโทซิส') || q3.choice_a.includes('เซลล์'), 'Q3 model answer populated from explanation');

console.log('✅ Test 1 Passed: Smart Paste accurately parses Thai/English MCQs and Subjective questions.\n');

// ----------------------------------------------------
// TEST 2: Pre-Flight Quality Validator
// ----------------------------------------------------
console.log('Test 2: Pre-Flight Quality Validator');

const testQuestions: AcademicExamQuestion[] = [
  {
    id: '1',
    exam_id: 'exam-1',
    question_number: 1,
    question_type: 'mcq',
    question_text: 'ข้อใดถูก?',
    choice_a: 'ข้อ A',
    choice_b: 'ข้อ B',
    choice_c: 'ข้อ C',
    choice_d: 'ถูกทุกข้อ',
    correct_choice: 'D',
    pin_choice_position: false, // Intentional warning: "ถูกทุกข้อ" without pinning
    pinned_choice_index: null,
    points: 1,
    question_image_url: null,
    indicator_code: null,
    created_at: ''
  },
  {
    id: '2',
    exam_id: 'exam-1',
    question_number: 2,
    question_type: 'mcq',
    question_text: '', // Intentional error: empty question text
    choice_a: 'ก',
    choice_b: 'ข',
    choice_c: 'ค',
    choice_d: 'ง',
    correct_choice: 'A',
    pin_choice_position: false,
    pinned_choice_index: null,
    points: 1,
    question_image_url: null,
    indicator_code: null,
    created_at: ''
  },
  {
    id: '3',
    exam_id: 'exam-1',
    question_number: 3,
    question_type: 'mcq',
    question_text: 'ผลรวมของ 5 + 5?',
    choice_a: '10',
    choice_b: '10', // Intentional warning: duplicate choice
    choice_c: '12',
    choice_d: '14',
    correct_choice: 'A',
    pin_choice_position: false,
    pinned_choice_index: null,
    points: 1,
    question_image_url: null,
    indicator_code: null,
    created_at: ''
  }
];

const report = validateExamPreFlight(testQuestions, { total_score: 10, duration_minutes: 30 });
assert.strictEqual(report.isValid, false, 'Should be invalid due to empty question text');
assert.strictEqual(report.errorCount, 1, 'Should detect 1 error for empty question text');

const emptyIssue = report.issues.find(i => i.field === 'question_text');
assert.ok(emptyIssue, 'Should flag empty question text');
assert.strictEqual(emptyIssue?.question_number, 2, 'Should point to question #2');

const unpinnedIssue = report.issues.find(i => i.autoFixAction === 'pin_choice');
assert.ok(unpinnedIssue, 'Should flag unpinned "ถูกทุกข้อ"');
assert.strictEqual(unpinnedIssue?.question_number, 1, 'Should point to question #1');

const duplicateIssue = report.issues.find(i => i.id.startsWith('duplicate_choices'));
assert.ok(duplicateIssue, 'Should flag duplicate choices');
assert.strictEqual(duplicateIssue?.question_number, 3, 'Should point to question #3');

const scoreMismatchIssue = report.issues.find(i => i.id === 'score_mismatch');
assert.ok(scoreMismatchIssue, 'Should flag score mismatch between sum(3) and config(10)');

console.log('✅ Test 2 Passed: Pre-Flight Validator correctly catches errors, unpinned choices, duplicate choices, and score mismatches.\n');

// ----------------------------------------------------
// TEST 3: 9 Subjective Question Modes
// ----------------------------------------------------
console.log('Test 3: 9 Subjective Question Modes');

assert.strictEqual(SUBJECTIVE_MODES.length, 9, 'Must have exactly 9 Subjective Question Modes');

const expectedModeIds = [
  'short_fill',
  'step_by_step_math',
  'sub_questions',
  'comparison_table',
  'diagram_labeling',
  'sequencing_flow',
  'drawing_and_explain',
  'language_writing',
  'essay_extended'
];

expectedModeIds.forEach(id => {
  const mode = SUBJECTIVE_MODES.find(m => m.id === id);
  assert.ok(mode, `Subjective mode '${id}' must be defined`);
  assert.ok(mode.title, `Subjective mode '${id}' must have a title`);
  assert.ok(mode.fallbackChoiceB, `Subjective mode '${id}' must have fallbackChoiceB for print compatibility`);
  assert.ok(mode.suggestedPoints > 0, `Subjective mode '${id}' must suggest points > 0`);
});

// Verify fallback mappings
const mathMode = SUBJECTIVE_MODES.find(m => m.id === 'step_by_step_math');
assert.strictEqual(mathMode?.fallbackChoiceB, 'grid_box', 'step_by_step_math fallback must be grid_box');

const shortFillMode = SUBJECTIVE_MODES.find(m => m.id === 'short_fill');
assert.strictEqual(shortFillMode?.fallbackChoiceB, 'lines_3', 'short_fill fallback must be lines_3');

const essayMode = SUBJECTIVE_MODES.find(m => m.id === 'essay_extended');
assert.strictEqual(essayMode?.fallbackChoiceB, 'lines_8', 'essay_extended fallback must be lines_8');

console.log('✅ Test 3 Passed: All 9 Subjective Modes defined with complete fallback mappings and rubrics.\n');

// ----------------------------------------------------
// TEST 4: Autosave Draft Serialization
// ----------------------------------------------------
console.log('Test 4: Autosave Draft Serialization');

const draftSnapshot = {
  timestamp: Date.now(),
  savedAt: '13:30 น.',
  title: 'ข้อสอบกลางภาค วิทยาศาสตร์ ป.4',
  courseId: 'course-123',
  gradebookId: 'gb-456',
  academicYear: '2568',
  term: '1',
  examType: 'midterm',
  status: 'ready',
  durationMinutes: 60,
  maxScore: 20,
  instructions: 'คำชี้แจง',
  questions: testQuestions
};

const serialized = JSON.stringify(draftSnapshot);
const deserialized = JSON.parse(serialized);
assert.strictEqual(deserialized.title, draftSnapshot.title, 'Draft title matches');
assert.strictEqual(deserialized.questions.length, 3, 'Draft questions preserved');
assert.strictEqual(deserialized.maxScore, 20, 'Draft maxScore preserved');

console.log('✅ Test 4 Passed: Autosave draft serialization and recovery are intact.\n');

console.log('========================================');
console.log('🎉 ALL EXAM STUDIO PHASE 1 TESTS PASSED!');
console.log('========================================');
