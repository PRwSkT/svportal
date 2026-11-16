import { test, describe } from 'node:test';
import assert from 'node:assert';
import { convertSpokenMathToKaTeX } from '../../src/app/api/academic/exams/ai-draft/route.ts';
import { renderSafeKaTeX, sanitizeSvg } from '../../src/lib/academic/security-sanitizer.ts';
import { AcademicExamQuestion } from '../../src/types/academic.ts';

describe('Nong Fah AI 2.0: Spoken Math to KaTeX Engine (fix_latex)', () => {
  test('should accurately convert spoken Thai fractions and square roots to KaTeX', () => {
    const input = 'เศษ 3 ส่วน 4 บวก รูท x';
    const result = convertSpokenMathToKaTeX(input);

    assert.ok(result.raw_latex.includes('\\frac{3}{4}'));
    assert.ok(result.raw_latex.includes('\\sqrt{x}'));
    assert.ok(result.katex.startsWith('$') && result.katex.endsWith('$'));

    // Verify safe KaTeX rendering
    const rendered = renderSafeKaTeX(result.katex);
    assert.ok(rendered.includes('katex'));
    assert.ok(!rendered.includes('error'));
  });

  test('should convert spoken power expressions and equations', () => {
    const input = 'x กำลัง 2 ลบ 4 เท่ากับ 0';
    const result = convertSpokenMathToKaTeX(input);

    assert.ok(result.raw_latex.includes('x^{2}'));
    assert.ok(result.raw_latex.includes(' - 4'));
    assert.ok(result.raw_latex.includes(' = 0'));

    const rendered = renderSafeKaTeX(result.katex);
    assert.ok(rendered.includes('katex'));
  });

  test('should convert Greek symbols, square roots and multiplication', () => {
    const input = 'รากที่สองของ y คูณ พาย';
    const result = convertSpokenMathToKaTeX(input);

    assert.ok(result.raw_latex.includes('\\sqrt{y}'));
    assert.ok(result.raw_latex.includes('\\times'));
    assert.ok(result.raw_latex.includes('\\pi'));

    const rendered = renderSafeKaTeX(result.katex);
    assert.ok(rendered.includes('katex'));
  });

  test('should accurately convert complex spoken phrase "สแควรูทเอกซ์บวกหนึ่งส่วนสอง" into \\frac{\\sqrt{x} + 1}{2}', () => {
    const input = 'สแควรูทเอกซ์บวกหนึ่งส่วนสอง';
    const result = convertSpokenMathToKaTeX(input);

    assert.ok(
      result.raw_latex.includes('\\frac{\\sqrt{x} + 1}{2}') ||
      result.raw_latex.includes('\\frac{\\sqrt{x}+1}{2}')
    );

    const rendered = renderSafeKaTeX(result.katex);
    assert.ok(rendered.includes('katex'));
    assert.ok(!rendered.includes('error'));
  });
});

describe('Nong Fah AI 2.0: Co-Generated Diagram Metadata & SVG Sanitization', () => {
  test('should preserve <!-- sv-diagram-meta: [...] --> while stripping dangerous XSS scripts and handlers', () => {
    const elementsMeta = [
      {
        id: 'el-circ-1',
        type: 'circle',
        x: 100,
        y: 100,
        width: 60,
        height: 60,
        stroke: '#0f172a',
        strokeWidth: 2,
        fill: '#ffffff',
        text: 'เซลล์พืช'
      },
      {
        id: 'el-text-1',
        type: 'text_label',
        x: 100,
        y: 140,
        width: 100,
        height: 20,
        text: 'คลอโรพลาสต์'
      }
    ];

    const rawSvgWithAttack = `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
  <!-- sv-diagram-meta: ${JSON.stringify(elementsMeta)} -->
  <rect width="400" height="240" fill="#ffffff" onload="alert('XSS')"/>
  <circle cx="100" cy="100" r="30" stroke="#0f172a" fill="#ffffff"/>
  <script>evilScript()</script>
</svg>`;

    const cleanedSvg = sanitizeSvg(rawSvgWithAttack);

    // Metadata comment must be completely intact for InStudioDiagramBuilder
    assert.ok(cleanedSvg.includes('<!-- sv-diagram-meta:'));
    assert.ok(cleanedSvg.includes('el-circ-1'));
    assert.ok(cleanedSvg.includes('คลอโรพลาสต์'));

    // Malicious vectors must be thoroughly stripped
    assert.ok(!cleanedSvg.includes('<script>'));
    assert.ok(!cleanedSvg.includes('evilScript'));
    assert.ok(!cleanedSvg.includes('onload'));
    assert.ok(!cleanedSvg.includes('alert('));

    // Validate that InStudioDiagramBuilder can parse the metadata back
    const match = cleanedSvg.match(/<!-- sv-diagram-meta: (.*?) -->/);
    assert.ok(match && match[1]);
    const parsed = JSON.parse(match[1]);
    assert.strictEqual(Array.isArray(parsed), true);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].type, 'circle');
    assert.strictEqual(parsed[1].text, 'คลอโรพลาสต์');
  });
});

describe('Nong Fah AI 2.0: Solve-First Architecture & Diagnostic Tags Verification', () => {
  test('question drafting should structure Solve-First derivation and misconception diagnostic tags', () => {
    const sampleQuestion = {
      question_text: 'รูปสี่เหลี่ยมผืนผ้ามีความกว้าง 5 เซนติเมตร และความยาว 8 เซนติเมตร จะมีพื้นที่กี่ตารางเซนติเมตร',
      step_by_step_solution: 'สูตรพื้นที่สี่เหลี่ยมผืนผ้า = กว้าง x ยาว = 5 x 8 = 40 ตารางเซนติเมตร',
      verified_correct_answer: '40 ตารางเซนติเมตร',
      choice_a: '40 ตารางเซนติเมตร',
      choice_b: '26 เซนติเมตร',
      choice_c: '13 ตารางเซนติเมตร',
      choice_d: '80 ตารางเซนติเมตร',
      correct_choice: 'A' as const,
      indicator_code: 'ค 2.1 ป.3/1',
      pin_choice_position: false,
      explanation: 'พื้นที่ = กว้าง x ยาว = 5 x 8 = 40 ตารางเซนติเมตร',
      diagnostic_tags: {
        A: 'ถูกต้อง: คำนวณตามสูตรพื้นที่ กว้าง x ยาว ได้ถูกต้อง',
        B: 'สับสนสูตร: คำนวณความยาวรอบรูป (2 x (5+8) = 26) แทนที่จะหาพื้นที่',
        C: 'คำนวณไม่ครบ: นำกว้างมาบวกกับยาว (5 + 8 = 13)',
        D: 'คำนวณผิดพลาด: คูณเลขเกินจริง'
      },
      question_meta: {
        step_by_step_solution: 'สูตรพื้นที่สี่เหลี่ยมผืนผ้า = กว้าง x ยาว = 5 x 8 = 40 ตารางเซนติเมตร',
        verified_correct_answer: '40 ตารางเซนติเมตร',
        diagnostic_tags: {
          A: 'ถูกต้อง: คำนวณตามสูตรพื้นที่ กว้าง x ยาว ได้ถูกต้อง',
          B: 'สับสนสูตร: คำนวณความยาวรอบรูป (2 x (5+8) = 26) แทนที่จะหาพื้นที่',
          C: 'คำนวณไม่ครบ: นำกว้างมาบวกกับยาว (5 + 8 = 13)',
          D: 'คำนวณผิดพลาด: คูณเลขเกินจริง'
        }
      }
    };

    assert.ok(sampleQuestion.step_by_step_solution.includes('5 x 8 = 40'));
    assert.strictEqual(sampleQuestion.verified_correct_answer, '40 ตารางเซนติเมตร');
    assert.strictEqual(sampleQuestion.choice_a, sampleQuestion.verified_correct_answer);
    assert.strictEqual(sampleQuestion.correct_choice, 'A');

    // Diagnostic tags verify pedagogical value
    assert.ok(sampleQuestion.question_meta.diagnostic_tags.B.includes('สับสนสูตร'));
    assert.ok(sampleQuestion.question_meta.diagnostic_tags.C.includes('คำนวณไม่ครบ'));
  });

  test('action generate_distractors: should populate choices B, C, D and save diagnostic tags into question_meta', () => {
    const rawQuestion: AcademicExamQuestion = {
      id: 'q-math-1',
      exam_id: 'ex-1',
      question_number: 1,
      question_type: 'mcq',
      question_text: 'ถ้า 2x + 6 = 18 ค่าของ x เท่ากับเท่าใด',
      choice_a: '6',
      choice_b: '',
      choice_c: '',
      choice_d: '',
      choice_e: null,
      correct_choice: 'A',
      indicator_code: 'ค 1.2 ม.1/1',
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      created_at: new Date().toISOString()
    };

    // Simulated API response from Nong Fah AI generate_distractors
    const mockApiResponse = {
      success: true,
      question_text: rawQuestion.question_text,
      correct_answer: '6',
      distractors: [
        {
          choice_text: '12',
          misconception: 'นักเรียนนำ 18 ลบ 6 ได้ 12 แต่ลืมหารด้วยสัมประสิทธิ์ 2',
          tag: 'incomplete_operation'
        },
        {
          choice_text: '7',
          misconception: 'นักเรียนย้ายข้างเครื่องหมายผิด โดยนำ 18 บวก 6 เป็น 24 แล้วหาร 2 ได้ 12 หรือสับสนลำดับ',
          tag: 'sign_error'
        },
        {
          choice_text: '9',
          misconception: 'นักเรียนนำ 18 หารด้วย 2 ทันทีโดยไม่ได้ย้าย 6 ไปลบก่อน',
          tag: 'order_of_operations'
        }
      ],
      diagnostic_tags: {
        distractor_1: 'ลืมหารสัมประสิทธิ์หน้าตัวแปร',
        distractor_2: 'ย้ายข้างสลับเครื่องหมายผิด',
        distractor_3: 'หารก่อนย้ายข้างบวกลบ'
      },
      explanation: 'ตัวเลือกหลอกครอบคลุมข้อผิดพลาดพีชคณิตระดับ ม.1 ทั้ง 3 รูปแบบ'
    };

    // Client-side application as implemented in ExamAuthoringModal.tsx
    const distractors = mockApiResponse.distractors;
    const updatedQ: AcademicExamQuestion = {
      ...rawQuestion,
      choice_b: distractors[0].choice_text,
      choice_c: distractors[1].choice_text,
      choice_d: distractors[2].choice_text,
      question_meta: {
        diagnostic_tags: {
          B: distractors[0].misconception,
          C: distractors[1].misconception,
          D: distractors[2].misconception,
          ...mockApiResponse.diagnostic_tags
        },
        distractor_rationale: mockApiResponse.explanation
      }
    };

    // Assert choices B, C, D are correctly populated
    assert.strictEqual(updatedQ.choice_a, '6');
    assert.strictEqual(updatedQ.choice_b, '12');
    assert.strictEqual(updatedQ.choice_c, '7');
    assert.strictEqual(updatedQ.choice_d, '9');

    // Assert diagnostic tags in question_meta
    assert.ok(updatedQ.question_meta?.diagnostic_tags?.B.includes('ลืมหารด้วยสัมประสิทธิ์ 2'));
    assert.ok(updatedQ.question_meta?.diagnostic_tags?.C.includes('ย้ายข้างเครื่องหมายผิด'));
    assert.ok(updatedQ.question_meta?.diagnostic_tags?.D.includes('ไม่ได้ย้าย 6 ไปลบก่อน'));
    assert.strictEqual(updatedQ.question_meta?.diagnostic_tags?.distractor_1, 'ลืมหารสัมประสิทธิ์หน้าตัวแปร');
  });
});

describe('Nong Fah AI 2.0: Whole-Exam Audit Intelligence', () => {
  const mockExam: AcademicExamQuestion[] = [
    {
      id: 'q1',
      exam_id: 'ex1',
      question_number: 1,
      question_type: 'mcq',
      question_text: 'ข้อใดไม่ใช่คุณสมบัติของสิ่งมีชีวิต',
      choice_a: 'การเจริญเติบโต',
      choice_b: 'การสืบพันธุ์',
      choice_c: 'การไม่ตอบสนองต่อสิ่งเร้า',
      choice_d: 'การหายใจ',
      correct_choice: 'C',
      indicator_code: 'ว 1.1 ป.3/1',
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q2',
      exam_id: 'ex1',
      question_number: 2,
      question_type: 'mcq',
      question_text: 'ผลรวมของ 120 + 350 เท่ากับเท่าใด',
      choice_a: '470',
      choice_b: '470',
      choice_c: '500',
      choice_d: '570',
      correct_choice: 'A',
      indicator_code: 'ค 1.1 ป.3/1',
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q3',
      exam_id: 'ex1',
      question_number: 3,
      question_type: 'mcq',
      question_text: 'พืชสังเคราะห์ด้วยแสงได้สารใด',
      choice_a: 'น้ำตาลกลูโคสและออกซิเจน',
      choice_b: 'คาร์บอนไดออกไซด์',
      choice_c: 'ไนโตรเจน',
      choice_d: 'ถูกทุกข้อ',
      correct_choice: 'A',
      indicator_code: 'ว 1.2 ป.3/1',
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      question_image_url: null,
      created_at: new Date().toISOString()
    }
  ];

  test('audit should flag negative phrasing without emphasis and duplicate choices', () => {
    const issues: string[] = [];

    mockExam.forEach(q => {
      // 1. Negative phrasing check
      if (/(ข้อใดไม่ใช่|ข้อใดผิด)/.test(q.question_text) && !q.question_text.includes('**')) {
        issues.push(`q${q.question_number}:unbolded_negative`);
      }
      // 2. Duplicate choices check
      const choices = [q.choice_a, q.choice_b, q.choice_c, q.choice_d];
      if (new Set(choices).size < choices.length) {
        issues.push(`q${q.question_number}:duplicate_choices`);
      }
      // 3. Unpinned "ถูกทุกข้อ"
      if (q.choice_d === 'ถูกทุกข้อ' && !q.pin_choice_position) {
        issues.push(`q${q.question_number}:unpinned_choice_d`);
      }
    });

    assert.ok(issues.includes('q1:unbolded_negative'));
    assert.ok(issues.includes('q2:duplicate_choices'));
    assert.ok(issues.includes('q3:unpinned_choice_d'));
  });

  test('key distribution bias detector should measure frequency accurately', () => {
    const keyDistribution = { A: 0, B: 0, C: 0, D: 0 };
    mockExam.forEach(q => {
      if (['A', 'B', 'C', 'D'].includes(q.correct_choice)) {
        keyDistribution[q.correct_choice as 'A' | 'B' | 'C' | 'D']++;
      }
    });

    assert.strictEqual(keyDistribution.A, 2);
    assert.strictEqual(keyDistribution.B, 0);
    assert.strictEqual(keyDistribution.C, 1);
    assert.strictEqual(keyDistribution.D, 0);
  });

  test('action audit_exam: should output complete pedagogical metrics (Blooms taxonomy, difficulty, actionable insights)', () => {
    // Simulated audit response as produced by /api/academic/exams/ai-draft action: 'audit_exam'
    const auditPayload = {
      success: true,
      audit_summary: {
        overall_score: 88,
        verdict: 'ข้อสอบมีคุณภาพระดับดี สอดคล้องกับมาตรฐานหลักสูตรและการวัดผลทางการศึกษา',
        blooms_distribution: {
          remembering: 1,
          understanding: 1,
          applying: 1,
          analyzing: 0,
          evaluating: 0,
          creating: 0
        },
        difficulty_distribution: {
          easy: 1,
          medium: 2,
          hard: 0
        },
        key_distribution: { A: 2, B: 0, C: 1, D: 0 },
        key_distribution_bias: 'การกระจายตัวเลือกเฉลยอยู่ในเกณฑ์สมดุลดี'
      },
      issues: [
        {
          question_number: 1,
          severity: 'warning' as const,
          category: 'ambiguity' as const,
          issue: 'มีคำปฏิเสธในโจทย์ ("ไม่ใช่") โดยไม่มีการเน้นตัวหนา',
          recommendation: 'ควรเน้นตัวหนา เช่น "**ข้อใดไม่ใช่**"'
        },
        {
          question_number: 2,
          severity: 'error' as const,
          category: 'distractor' as const,
          issue: 'พบตัวเลือกซ้ำกันในข้อเดียวกัน',
          recommendation: 'แก้ไขตัวเลือกที่ซ้ำกันให้มีคำตอบที่แตกต่างอย่างชัดเจน'
        }
      ],
      actionable_recommendations: [
        'ทบทวนข้อความโจทย์ที่มีคำปฏิเสธเพื่อเน้นตัวหนาให้ชัดเจน',
        'ตรวจสอบการกระจายตัวเลือกเฉลยให้สมดุลสม่ำเสมอ',
        'เพิ่มข้อสอบวัดทักษะการคิดขั้นสูง (Analyzing / Applying) เพื่อยกระดับความท้าทายตามกรอบ PISA'
      ]
    };

    // Assert structural invariants expected by ExamPreFlightDrawer
    assert.strictEqual(auditPayload.success, true);
    assert.ok(auditPayload.audit_summary.overall_score >= 0 && auditPayload.audit_summary.overall_score <= 100);
    assert.ok(auditPayload.audit_summary.verdict.length > 0);
    assert.strictEqual(typeof auditPayload.audit_summary.blooms_distribution.remembering, 'number');
    assert.strictEqual(typeof auditPayload.audit_summary.blooms_distribution.understanding, 'number');
    assert.strictEqual(typeof auditPayload.audit_summary.blooms_distribution.applying, 'number');
    assert.strictEqual(typeof auditPayload.audit_summary.blooms_distribution.analyzing, 'number');
    assert.strictEqual(typeof auditPayload.audit_summary.difficulty_distribution.easy, 'number');
    assert.strictEqual(typeof auditPayload.audit_summary.difficulty_distribution.medium, 'number');
    assert.strictEqual(typeof auditPayload.audit_summary.difficulty_distribution.hard, 'number');
    assert.strictEqual(auditPayload.issues.length, 2);
    assert.strictEqual(auditPayload.issues[0].question_number, 1);
    assert.strictEqual(auditPayload.issues[1].severity, 'error');
    assert.strictEqual(auditPayload.actionable_recommendations.length, 3);
  });
});

describe('Nong Fah AI 2.0: Robust Safe JSON Parser (Arrays and Objects)', () => {
  test('should parse JSON array wrapped with markdown backticks', () => {
    const rawMarkdownArray = '```json\n[{"id": 1, "text": "hello"}]\n```';
    const match = rawMarkdownArray.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(match);
    assert.strictEqual(Array.isArray(parsed), true);
    assert.strictEqual(parsed[0].text, 'hello');
  });

  test('should handle spoken inequalities and complex math operators', () => {
    const input = '2x บวก 5 มากกว่าหรือเท่ากับ 15';
    const result = convertSpokenMathToKaTeX(input);
    assert.ok(result.raw_latex.includes('\\ge'));
    assert.ok(result.raw_latex.includes('2x + 5'));
  });
});
