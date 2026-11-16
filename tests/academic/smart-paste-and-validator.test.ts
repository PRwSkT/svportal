import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseSmartPaste, parseSingleQuestionBlock } from '../../src/lib/academic/smart-paste-parser';
import { validateExamPreFlight } from '../../src/lib/academic/preflight-validator';
import { AcademicExamQuestion } from '../../src/types/academic';

describe('Smart Paste Parser', () => {
  test('should parse a single Thai MCQ question with ก-ง choices and answer', () => {
    const raw = `
    ข้อ 1. มุมภายในของรูปสามเหลี่ยมรวมกันได้กี่องศา?
    ก. 90 องศา
    ข. 180 องศา
    ค. 270 องศา
    ง. 360 องศา
    เฉลย: ข
    คำอธิบาย: ผลรวมมุมภายในของสามเหลี่ยมใดๆ เท่ากับ 180 องศาเสมอ
    (2 คะแนน)
    `;

    const res = parseSmartPaste(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.questions.length, 1);
    
    const q = res.questions[0];
    assert.ok(q.question_text.includes('มุมภายในของรูปสามเหลี่ยม'));
    assert.strictEqual(q.choice_a, '90 องศา');
    assert.strictEqual(q.choice_b, '180 องศา');
    assert.strictEqual(q.choice_c, '270 องศา');
    assert.strictEqual(q.choice_d, '360 องศา');
    assert.strictEqual(q.correct_choice, 'B');
    assert.strictEqual(q.points, 2);
    assert.ok(q.explanation?.includes('180 องศาเสมอ'));
    assert.strictEqual(q.pin_choice_position, false);
  });

  test('should detect pinned choice D (e.g. ถูกทุกข้อ)', () => {
    const raw = `
    2. ข้อใดเป็นประโยชน์ของการสังเคราะห์ด้วยแสงของพืช
    ก. ผลิตแก๊สออกซิเจน
    ข. ลดปริมาณแก๊สคาร์บอนไดออกไซด์
    ค. สร้างสารอาหารประเภทแป้ง
    ง. ถูกทุกข้อ
    ตอบ: ง
    `;

    const q = parseSingleQuestionBlock(raw);
    assert.strictEqual(q.choice_d, 'ถูกทุกข้อ');
    assert.strictEqual(q.correct_choice, 'D');
    assert.strictEqual(q.pin_choice_position, true);
  });

  test('should parse multiple questions separated by question numbers', () => {
    const raw = `
    1. 2 + 3 เท่ากับเท่าใด
    ก. 4
    ข. 5
    ค. 6
    ง. 7
    เฉลย: ข

    2. สัตว์ชนิดใดเป็นสัตว์เลี้ยงลูกด้วยนม
    ก. นกพิราบ
    ข. ปลาช่อน
    ค. วาฬสีน้ำเงิน
    ง. กบหนอง
    เฉลย: ค
    `;

    const res = parseSmartPaste(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.questions.length, 2);
    assert.strictEqual(res.questions[0].correct_choice, 'B');
    assert.strictEqual(res.questions[1].correct_choice, 'C');
  });

  test('should classify question as subjective if no choices exist', () => {
    const raw = `
    ข้อ 3. จงอธิบายความแตกต่างระหว่างเซลล์พืชและเซลล์สัตว์อย่างน้อย 3 ข้อ
    คำอธิบาย: เซลล์พืชมีผนังเซลล์และคลอโรพลาสต์ แต่เซลล์สัตว์ไม่มี
    (5 คะแนน)
    `;

    const q = parseSingleQuestionBlock(raw);
    assert.strictEqual(q.question_type, 'subjective');
    assert.strictEqual(q.points, 5);
    assert.ok(q.choice_a.includes('ผนังเซลล์'));
  });
});

describe('Pre-Flight Exam Quality Validator', () => {
  const baseQuestions: AcademicExamQuestion[] = [
    {
      id: 'q1',
      exam_id: 'ex1',
      question_number: 1,
      question_type: 'mcq',
      question_text: 'ข้อใดคือเมืองหลวงของประเทศไทย',
      choice_a: 'เชียงใหม่',
      choice_b: 'กรุงเทพมหานคร',
      choice_c: 'ภูเก็ต',
      choice_d: 'ขอนแก่น',
      correct_choice: 'B',
      indicator_code: 'ส 4.1 ป.3/1',
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      created_at: new Date().toISOString()
    }
  ];

  test('should pass validation for valid exam question', () => {
    const report = validateExamPreFlight(baseQuestions, { total_score: 1, duration_minutes: 10 });
    assert.strictEqual(report.isValid, true);
    assert.strictEqual(report.canPrint, true);
    assert.strictEqual(report.errorCount, 0);
  });

  test('should detect empty question text error', () => {
    const invalidQuestions: AcademicExamQuestion[] = [
      {
        ...baseQuestions[0],
        question_text: ''
      }
    ];

    const report = validateExamPreFlight(invalidQuestions);
    assert.strictEqual(report.isValid, false);
    assert.strictEqual(report.canPrint, false);
    assert.ok(report.issues.some(i => i.field === 'question_text' && i.severity === 'error'));
  });

  test('should detect duplicate choices warning', () => {
    const dupQuestions: AcademicExamQuestion[] = [
      {
        ...baseQuestions[0],
        choice_a: 'กรุงเทพมหานคร',
        choice_b: 'กรุงเทพมหานคร'
      }
    ];

    const report = validateExamPreFlight(dupQuestions);
    assert.ok(report.issues.some(i => i.id.startsWith('duplicate_choices')));
  });

  test('should warn if choice D is "ถูกทุกข้อ" but pin_choice_position is false', () => {
    const unpinnedQuestions: AcademicExamQuestion[] = [
      {
        ...baseQuestions[0],
        choice_d: 'ถูกทุกข้อ',
        pin_choice_position: false
      }
    ];

    const report = validateExamPreFlight(unpinnedQuestions);
    assert.ok(report.issues.some(i => i.id.startsWith('unpinned_choice_d')));
  });

  test('should warn on total points mismatch with examConfig', () => {
    const report = validateExamPreFlight(baseQuestions, { total_score: 10 });
    assert.ok(report.issues.some(i => i.id === 'score_mismatch'));
  });
});
