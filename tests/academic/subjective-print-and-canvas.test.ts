import test from 'node:test';
import assert from 'node:assert/strict';
import { generateExamPaperHtml, generateBatchAnswerSheetsHtml } from '../../src/lib/academic/exam-print-engine';
import { pointsToSmoothPathD } from '../../src/components/academic/InStudioDiagramBuilder';
import type { AcademicExamQuestion } from '../../src/types/academic';

test('Subjective Print Engine: generates distinctive layouts for all 9 modes', async () => {
  const modes = [
    { mode: 'short_fill', expectedClass: 'subjective-short-fill' },
    { mode: 'step_by_step_math', expectedClass: 'subjective-math-steps' },
    { mode: 'sub_questions', expectedClass: 'subjective-sub-questions' },
    { mode: 'comparison_table', expectedClass: 'subjective-comparison-table' },
    { mode: 'diagram_labeling', expectedClass: 'subjective-diagram-labeling' },
    { mode: 'sequencing_flow', expectedClass: 'subjective-sequencing-flow' },
    { mode: 'drawing_and_explain', expectedClass: 'subjective-drawing-explain' },
    { mode: 'language_writing', expectedClass: 'subjective-language-writing' },
    { mode: 'essay_extended', expectedClass: 'subjective-essay' }
  ];

  for (const { mode, expectedClass } of modes) {
    const questions: AcademicExamQuestion[] = [
      {
        id: `q-${mode}`,
        exam_id: 'exam-test-1',
        question_number: 1,
        question_type: 'subjective',
        question_text: `คำถามอัตนัยแบบ ${mode}`,
        question_image_url: null,
        diagram_svg: null,
        choice_a: 'แนวคำตอบที่ถูกต้อง',
        choice_b: 'lines_5',
        choice_c: 'เกณฑ์ 5 คะแนน: แสดงวิธีคิดและสรุปคำตอบครบถ้วน',
        choice_d: '-',
        choice_e: null,
        correct_choice: 'A',
        points: 5,
        indicator_code: 'ว 1.1 ป.4/1',
        pin_choice_position: false,
        pinned_choice_index: null,
        question_meta: {
          subjective_mode: mode
        },
        created_at: new Date().toISOString()
      }
    ];

    const html = await generateExamPaperHtml(
      {
        id: 'exam-test-1',
        title: 'แบบทดสอบอัตนัยทดสอบ',
        total_questions: 1,
        duration_minutes: 50,
        max_score: 5
      },
      questions,
      {
        setName: 'A'
      }
    );

    assert.ok(html.includes(expectedClass), `HTML output should contain class ${expectedClass} for mode ${mode}`);
    assert.ok(html.includes('คะแนนเต็ม: <strong>5 คะแนน</strong>'), 'Should render teacher score marking box');
    assert.ok(html.includes('เกณฑ์การให้คะแนน:'), 'Should render rubric criteria box');
  }
});

test('OMR Answer Sheet: renders Teacher Subjective Score Bubble Zone when hasSubjective is true', async () => {
  const html = await generateBatchAnswerSheetsHtml({
    exam: {
      id: 'exam-omr-test',
      title: 'ข้อสอบปลายภาคพร้อมข้อสอบอัตนัย',
      total_questions: 20,
      duration_minutes: 60,
      max_score: 30
    },
    students: [
      {
        id: 'std-1',
        student_id: '10001',
        name: 'ด.ช. ทดสอบ ระบบ',
        grade: 'ป.4/1',
        roll_number: 1
      }
    ],
    hasSubjective: true
  });

  assert.ok(html.includes('teacher-subjective-box'), 'Should render teacher-subjective-box');
  assert.ok(html.includes('ส่วนสำหรับครูผู้ตรวจให้คะแนนข้อสอบอัตนัย'), 'Should render Thai title for teacher zone');
  assert.ok(html.includes('teacher-bubble'), 'Should render optical bubble circles 0-5 for teachers');
});

test('Canvas Goodnotes Engine: pointsToSmoothPathD converts freehand points into smooth Bézier path', () => {
  const empty = pointsToSmoothPathD([]);
  assert.strictEqual(empty, '');

  const single = pointsToSmoothPathD([{ x: 10, y: 20 }]);
  assert.strictEqual(single, 'M 10.0 20.0 L 10.0 20.0');

  const line = pointsToSmoothPathD([{ x: 10, y: 20 }, { x: 50, y: 80 }]);
  assert.strictEqual(line, 'M 10.0 20.0 L 50.0 80.0');

  const curve = pointsToSmoothPathD([
    { x: 10, y: 20 },
    { x: 30, y: 50 },
    { x: 70, y: 90 },
    { x: 100, y: 120 }
  ]);
  assert.ok(curve.startsWith('M 10.0 20.0'), 'Should start with M');
  assert.ok(curve.includes(' Q '), 'Should contain quadratic Bézier Q segments');
  assert.ok(curve.endsWith('L 100.0 120.0'), 'Should end with L to last point');
});
