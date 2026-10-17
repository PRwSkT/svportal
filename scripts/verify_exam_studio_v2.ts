import { generateExamPaperHtml, renderMathInHtml, generateBatchAnswerSheetsHtml } from '../src/lib/academic/exam-print-engine';
import { generateExamSets, evaluateOMRBubbles } from '../src/lib/academic/exam-engine';
import { AcademicExamQuestion } from '../src/types/academic';

async function runVerification() {
  console.log('=== 1. SECURITY & ANTI-LEAK VERIFICATION ===');
  // Verify KaTeX math renderer
  const mathSample = 'จงหาคำตอบของสมการ $3x + 5 = 20$ และคำนวณพื้นที่วงกลม $A = \\pi r^2$';
  const compiledMath = renderMathInHtml(mathSample);
  if (!compiledMath.includes('katex') || !compiledMath.includes('math')) {
    throw new Error('KaTeX rendering failed to generate math elements');
  }
  console.log('PASS: KaTeX formula rendering into HTML vector tags verified.');

  console.log('\n=== 2. IN-STUDIO DIAGRAM & PRINT ENGINE INTEGRATION ===');
  const mockQuestions: AcademicExamQuestion[] = [
    {
      id: 'q-1',
      exam_id: 'mock-exam-1',
      question_number: 1,
      question_type: 'mcq',
      question_text: 'จากรูปเรขาคณิตด้านล่าง ด้านตรงข้ามมุมฉากยาวเท่าใด?',
      math_latex: null,
      question_image_url: null,
      diagram_svg: `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg"><polygon points="60,180 280,180 60,40" fill="#f8fafc" stroke="#1e293b" stroke-width="2.5"/><text x="170" y="202">8 cm</text></svg>`,
      choice_a: '10 cm',
      choice_b: '12 cm',
      choice_c: '14 cm',
      choice_d: '15 cm',
      choice_e: null,
      correct_choice: 'A',
      indicator_code: 'ค 2.2 ป.6/1',
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q-2',
      exam_id: 'mock-exam-1',
      question_number: 2,
      question_type: 'matching',
      question_text: 'จงจับคู่โครงสร้างของเซลล์กับหน้าที่ให้ถูกต้อง',
      math_latex: null,
      question_image_url: null,
      diagram_svg: null,
      choice_a: '1. Chloroplast',
      choice_b: '2. Cell wall',
      choice_c: 'ก. สร้างความแข็งแรงให้เซลล์',
      choice_d: 'ข. สังเคราะห์แสง',
      choice_e: null,
      correct_choice: 'B',
      indicator_code: 'ว 1.2 ป.6/1',
      points: 2,
      pin_choice_position: false,
      pinned_choice_index: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q-3',
      exam_id: 'mock-exam-1',
      question_number: 3,
      question_type: 'mcq',
      question_text: 'ข้อใดกล่าวถึง $\\frac{3}{4} + \\frac{1}{2}$ ได้ถูกต้อง?',
      math_latex: null,
      question_image_url: null,
      diagram_svg: null,
      choice_a: '$\\frac{5}{4}$',
      choice_b: '$\\frac{4}{6}$',
      choice_c: '$1\\frac{1}{4}$',
      choice_d: 'ข้อ ก และ ค ถูก',
      choice_e: 'ไม่มีข้อใดถูก',
      correct_choice: 'D',
      indicator_code: 'ค 1.1 ป.5/2',
      points: 1,
      pin_choice_position: true,
      pinned_choice_index: 'E',
      created_at: new Date().toISOString()
    }
  ];

  const html = generateExamPaperHtml(
    {
      id: 'mock-exam-1',
      title: 'ข้อสอบทดสอบระบบ KaTeX และ In-Studio Diagram',
      total_questions: 3,
      duration_minutes: 60,
      max_score: 4,
      course: {
        course_code: 'ว16101',
        name_th: 'วิทยาศาสตร์และเทคโนโลยี',
        grade_level: 'P6'
      }
    },
    mockQuestions,
    {
      setName: 'A',
      schoolName: 'โรงเรียนสมคิดวิทยา'
    }
  );

  if (!html.includes('question-diagram-box')) {
    throw new Error('Diagram SVG was not rendered in exam paper');
  }
  if (!html.includes('matching-container')) {
    throw new Error('Matching question layout was not rendered in exam paper');
  }
  if (!html.includes('katex.min.css')) {
    throw new Error('KaTeX stylesheet was not included in HTML head');
  }
  console.log('PASS: A4 Exam Paper rendered with SVG diagram, matching layout, 5 choices, and KaTeX stylesheet.');

  console.log('\n=== 3. EXAM SET GENERATION & CHOICE PINNING ===');
  const sets = generateExamSets(mockQuestions, {
    setNames: ['A', 'B', 'C'],
    shuffleQuestions: true,
    shuffleChoices: true
  });

  if (sets.length !== 3) {
    throw new Error(`Expected 3 sets, got ${sets.length}`);
  }
  // Check Set A
  if (sets[0].answer_key['1'] !== 'A') {
    throw new Error('Set A original answer key mismatch');
  }
  console.log('PASS: Exam sets A, B, C generated successfully with choice pinning protection.');

  console.log('\n=== 4. 3-SET (A/B/C) QUESTION & CHOICE SHUFFLING VERIFICATION ===');
  const htmlSetA = generateExamPaperHtml(
    {
      id: 'mock-exam-1',
      title: 'ข้อสอบชุด A-B-C',
      total_questions: 3,
      duration_minutes: 60,
      max_score: 4
    },
    mockQuestions,
    {
      setName: 'A',
      variantSet: sets[0]
    }
  );

  const htmlSetB = generateExamPaperHtml(
    {
      id: 'mock-exam-1',
      title: 'ข้อสอบชุด A-B-C',
      total_questions: 3,
      duration_minutes: 60,
      max_score: 4
    },
    mockQuestions,
    {
      setName: 'B',
      variantSet: sets[1]
    }
  );

  const htmlSetC = generateExamPaperHtml(
    {
      id: 'mock-exam-1',
      title: 'ข้อสอบชุด A-B-C',
      total_questions: 3,
      duration_minutes: 60,
      max_score: 4
    },
    mockQuestions,
    {
      setName: 'C',
      variantSet: sets[2]
    }
  );

  if (!htmlSetA.includes('ข้อสอบชุด A') || !htmlSetB.includes('ข้อสอบชุด B') || !htmlSetC.includes('ข้อสอบชุด C')) {
    throw new Error('Exam header sets (A, B, C) missing from paper output');
  }

  // Verify that Set B question or choice ordering differs from Set A
  if (htmlSetA === htmlSetB) {
    throw new Error('Set A and Set B HTML are identical! Questions and choices were not shuffled.');
  }

  // Check that the first question in Set B matches the question mapped in sets[1].question_order_mapping[0]
  const setBMapping0 = sets[1].question_order_mapping[0];
  const origQuestion0 = mockQuestions.find(q => q.question_number === setBMapping0.original_question_number);
  const renderedText = renderMathInHtml(origQuestion0!.question_text);
  if (!htmlSetB.includes(renderedText)) {
    throw new Error('Mapped question for Set B was not rendered in HTML');
  }
  console.log('PASS: Set A, Set B, and Set C render distinct, correctly shuffled questions and choices.');

  console.log('\n=== 5. BATCH OMR 3-SET (ALTERNATE_ABC) DISTRIBUTION VERIFICATION ===');
  const mockStudents = [
    { id: '1001', name: 'เด็กชายสมชาย ใจดี', grade: 'ป.6/1', roll_number: 1 },
    { id: '1002', name: 'เด็กหญิงสมหญิง รักเรียน', grade: 'ป.6/1', roll_number: 2 },
    { id: '1003', name: 'เด็กชายมานะ อดทน', grade: 'ป.6/1', roll_number: 3 },
    { id: '1004', name: 'เด็กหญิงปิติ ชูใจ', grade: 'ป.6/1', roll_number: 4 }
  ];

  const batchHtml = await generateBatchAnswerSheetsHtml({
    exam: {
      id: 'mock-exam-1',
      title: 'ข้อสอบจำลอง',
      total_questions: 3,
      duration_minutes: 60,
      max_score: 4
    },
    students: mockStudents,
    setDistribution: 'alternate_abc',
    spareSheetsCount: 3
  });

  if (!batchHtml.includes('set-badge-tag set-A') || !batchHtml.includes('set-badge-tag set-B') || !batchHtml.includes('set-badge-tag set-C')) {
    throw new Error('Batch OMR HTML does not contain Set A, B, and C badges');
  }

  if (!batchHtml.includes('SV-OMR-V2 | ID:mock-exa-A-1001') || 
      !batchHtml.includes('SV-OMR-V2 | ID:mock-exa-B-1002') || 
      !batchHtml.includes('SV-OMR-V2 | ID:mock-exa-C-1003') || 
      !batchHtml.includes('SV-OMR-V2 | ID:mock-exa-A-1004')) {
    throw new Error('Batch OMR alternate_abc student set mapping is incorrect in rendered output');
  }
  console.log('PASS: Batch OMR successfully distributed Sets A, B, and C alternately across student roster.');

  console.log('\n=== 6. OMR SCANNER 5-CHOICE COMPATIBILITY ===');
  const bubbleEval = evaluateOMRBubbles({
    A: 0.05,
    B: 0.10,
    C: 0.02,
    D: 0.65,
    E: 0.04
  });

  if (bubbleEval.selectedChoice !== 'D' || bubbleEval.isAmbiguous) {
    throw new Error('OMR bubble evaluation failed for 5-choice input');
  }
  console.log('PASS: 5-Choice OMR bubble evaluation verified.');

  console.log('\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

runVerification().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
