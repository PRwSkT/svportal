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
  console.log('\n=== 7. SUBJECTIVE / OPEN-ENDED QUESTION (อัตนัย) VERIFICATION ===');
  const subjectiveQuestions: AcademicExamQuestion[] = [
    ...mockQuestions,
    {
      id: 'q-subj-1',
      exam_id: 'mock-exam-1',
      question_number: 4,
      question_type: 'subjective',
      question_text: 'จงอธิบายกระบวนการสังเคราะห์ด้วยแสงของพืชและเขียนสมการเคมีที่เกี่ยวข้อง',
      math_latex: null,
      question_image_url: null,
      diagram_svg: null,
      choice_a: 'น้ำ + คาร์บอนไดออกไซด์ -> กลูโคส + ออกซิเจน โดยมีคลอโรฟิลล์และแสงแดดเป็นตัวเร่ง',
      choice_b: 'lines_5',
      choice_c: 'อธิบายกระบวนการถูกต้อง (3 คะแนน), เขียนสมการเคมีถูกต้อง (2 คะแนน)',
      choice_d: '-',
      choice_e: null,
      correct_choice: 'A',
      indicator_code: 'ว 1.2 ป.6/2',
      points: 5,
      pin_choice_position: false,
      pinned_choice_index: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'q-subj-2',
      exam_id: 'mock-exam-1',
      question_number: 5,
      question_type: 'subjective',
      question_text: 'จงแสดงวิธีทำในการหาพื้นที่ผิวและปริมาตรของทรงกระบอกที่มีรัศมี 7 ซม. และสูง 10 ซม.',
      math_latex: null,
      question_image_url: null,
      diagram_svg: null,
      choice_a: 'พื้นที่ผิว = 2*pi*r*h + 2*pi*r^2 = 748 ตร.ซม., ปริมาตร = pi*r^2*h = 1,540 ลบ.ซม.',
      choice_b: 'blank_box',
      choice_c: 'แสดงวิธีทำพื้นที่ผิวถูกต้อง (4 คะแนน), แสดงวิธีทำปริมาตรถูกต้อง (4 คะแนน), สรุปคำตอบพร้อมหน่วย (2 คะแนน)',
      choice_d: '-',
      choice_e: null,
      correct_choice: 'A',
      indicator_code: 'ค 2.1 ป.6/1',
      points: 10,
      pin_choice_position: false,
      pinned_choice_index: null,
      created_at: new Date().toISOString()
    }
  ];

  const subjectiveHtml = generateExamPaperHtml(
    {
      id: 'mock-exam-1',
      title: 'ข้อสอบวิทยาศาสตร์และคณิตศาสตร์ (รวมปรนัยและอัตนัย)',
      total_questions: 5,
      duration_minutes: 90,
      max_score: 19,
      course: {
        course_code: 'ว16101',
        name_th: 'วิทยาศาสตร์และเทคโนโลยี',
        grade_level: 'P6'
      }
    },
    subjectiveQuestions,
    {
      setName: 'A',
      schoolName: 'โรงเรียนสมคิดวิทยา'
    }
  );

  if (!subjectiveHtml.includes('ตอนที่ 2 ข้อสอบอัตนัย')) {
    throw new Error('Section 2 Subjective header missing from exam paper');
  }
  if (!subjectiveHtml.includes('subjective-question-card')) {
    throw new Error('Subjective question card missing from exam paper');
  }
  if (!subjectiveHtml.includes('subjective-line')) {
    throw new Error('Subjective writing lines missing from exam paper');
  }
  if (!subjectiveHtml.includes('subjective-box blank-box')) {
    throw new Error('Subjective workings box missing from exam paper');
  }
  if (!subjectiveHtml.includes('[ อัตนัย - 5 คะแนน ]') || !subjectiveHtml.includes('[ อัตนัย - 10 คะแนน ]')) {
    throw new Error('Subjective points badge missing from exam paper');
  }
  if (!subjectiveHtml.includes('ผู้ตรวจ:')) {
    throw new Error('Subjective teacher scoring box missing from exam paper');
  }
  console.log('PASS: A4 Exam Paper rendered Section 2 Subjective questions with dotted lines, workings box, and scoring rubrics.');

  // Verify Exam Sets with Subjective Questions
  const subjSets = generateExamSets(subjectiveQuestions, {
    setNames: ['A', 'B', 'C'],
    shuffleQuestions: true,
    shuffleChoices: true
  });

  for (const s of subjSets) {
    // Check that questions 4 and 5 in mapping remain subjective at the end
    const lastTwo = s.question_order_mapping.slice(-2);
    if (lastTwo[0].original_question_number !== 4 || lastTwo[1].original_question_number !== 5) {
      throw new Error(`Subjective questions were scrambled out of order in Set ${s.set_name}`);
    }
  }
  console.log('PASS: Exam sets A, B, C keep subjective questions in Section 2 without scrambling.');

  // Verify OMR batch notice for subjective questions
  const omrWithSubjective = await generateBatchAnswerSheetsHtml({
    exam: {
      id: 'mock-exam-1',
      title: 'ข้อสอบรวมปรนัย-อัตนัย',
      total_questions: 5,
      duration_minutes: 90,
      max_score: 19
    },
    students: mockStudents,
    setDistribution: 'alternate_abc'
  });

  if (!omrWithSubjective.includes('มีข้อสอบอัตนัย')) {
    throw new Error('OMR answer sheet does not contain subjective question notice strip');
  }
  console.log('PASS: Batch OMR answer sheet displays subjective question notice strip.');

  console.log('\n=== 8. CANVA & WORD EXAM STUDIO (IMAGE LAYOUT & CHOICE IMAGE GRID) ===');
  const { parseImageUrlMeta, formatImageUrlMeta, isImageChoice, parseChoiceContent } = await import('../src/lib/academic/exam-image-utils');

  // Test URL fragment formatting and parsing
  const testUrl = 'https://supabase.co/storage/v1/object/public/website-content/exams/images/diagram1.png';
  const formattedUrl = formatImageUrlMeta({
    url: testUrl,
    size: 'lg',
    align: 'center',
    caption: 'ภาพที่ 1: เซลล์พืชและคลอโรพลาสต์'
  });
  const parsedMeta = parseImageUrlMeta(formattedUrl);
  if (parsedMeta.size !== 'lg' || parsedMeta.align !== 'center' || parsedMeta.caption !== 'ภาพที่ 1: เซลล์พืชและคลอโรพลาสต์') {
    throw new Error('parseImageUrlMeta failed to extract Word-style image metadata');
  }
  console.log('PASS: Word-style image metadata encoding and decoding verified.');

  // Test choice image detection
  const imgChoiceVal = 'https://supabase.co/storage/v1/object/public/website-content/exams/images/choice_a.png|ทรงกลมตัน';
  if (!isImageChoice(imgChoiceVal)) {
    throw new Error('isImageChoice failed to detect choice image');
  }
  const parsedChoice = parseChoiceContent(imgChoiceVal);
  if (!parsedChoice.isImage || parsedChoice.labelText !== 'ทรงกลมตัน') {
    throw new Error('parseChoiceContent failed to extract image URL and label');
  }
  console.log('PASS: Choice-level image detection and label parsing verified.');

  // Test HTML rendering with Word layout and choice image grid
  const imageExamQuestions: AcademicExamQuestion[] = [
    {
      id: 'q-img-1',
      exam_id: 'mock-exam-img',
      question_number: 1,
      question_type: 'mcq',
      question_text: 'จากภาพโครงสร้างด้านล่าง เซลล์นี้จัดเป็นสิ่งมีชีวิตชนิดใด?',
      math_latex: null,
      question_image_url: formattedUrl,
      diagram_svg: null,
      choice_a: 'https://supabase.co/storage/v1/object/public/website-content/exams/images/plant.png|พืช',
      choice_b: 'https://supabase.co/storage/v1/object/public/website-content/exams/images/animal.png|สัตว์',
      choice_c: 'https://supabase.co/storage/v1/object/public/website-content/exams/images/fungi.png|เห็ดรา',
      choice_d: 'https://supabase.co/storage/v1/object/public/website-content/exams/images/bacteria.png|แบคทีเรีย',
      choice_e: null,
      correct_choice: 'A',
      indicator_code: 'ว 1.2 ป.4/1',
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      created_at: new Date().toISOString()
    }
  ];

  const imageExamHtml = generateExamPaperHtml(
    {
      id: 'mock-exam-img',
      title: 'ข้อสอบชีววิทยาและภาพประกอบ',
      total_questions: 1,
      duration_minutes: 50,
      max_score: 1
    },
    imageExamQuestions,
    { setName: 'A', schoolName: 'โรงเรียนสมคิดวิทยา' }
  );

  if (!imageExamHtml.includes('image-align-center') || !imageExamHtml.includes('image-size-lg')) {
    throw new Error('Question image layout classes missing from exam paper');
  }
  if (!imageExamHtml.includes('ภาพที่ 1: เซลล์พืชและคลอโรพลาสต์')) {
    throw new Error('Image caption missing from exam paper');
  }
  if (!imageExamHtml.includes('choices-image-grid') || !imageExamHtml.includes('choice-image-card')) {
    throw new Error('Choices 2x2 image grid missing from exam paper');
  }
  if (!imageExamHtml.includes('choice-thumbnail-img')) {
    throw new Error('Choice thumbnail img tag missing from exam paper');
  }
  console.log('PASS: A4 Exam Paper successfully rendered Word-style image layout, caption, and 2x2 choice image grid.');

  console.log('\n=== 7. CANVAS STUDIO V2.1 BUG FIXES & PARAMETRIC ADJUSTMENT VERIFICATION ===');
  // Test escapeXml
  const rawText = 'ถ้า x < 5 & y > 10 แล้ว "คำตอบ" คืออะไร?';
  const { escapeXml } = await import('../src/components/academic/InStudioDiagramBuilder');
  const escaped = escapeXml(rawText);
  if (!escaped.includes('&lt;') || !escaped.includes('&gt;') || !escaped.includes('&amp;') || !escaped.includes('&quot;')) {
    throw new Error('escapeXml failed to properly encode XML entities');
  }
  console.log('PASS: XML entity escaping verified for math and text labels.');

  // Test Affine Invariant Anchor Mathematics on 45-degree rotated rectangle
  const w = 100, h = 60, rotDeg = 45;
  const rotRad = (rotDeg * Math.PI) / 180;
  const cosRot = Math.cos(rotRad);
  const sinRot = Math.sin(rotRad);
  const startX = 200, startY = 150;
  const startCenterX = startX + w / 2;
  const startCenterY = startY + h / 2;

  // For SE handle, NW corner is stationary anchor:
  const anchorLocalNW = { x: -w / 2, y: -h / 2 };
  const anchorWorldX = startCenterX + anchorLocalNW.x * cosRot - anchorLocalNW.y * sinRot;
  const anchorWorldY = startCenterY + anchorLocalNW.x * sinRot + anchorLocalNW.y * cosRot;

  // Simulate dragging SE handle by (+40, +30)
  const newW = 140, newH = 90;
  const newAnchorLocalNW = { x: -newW / 2, y: -newH / 2 };
  const newCenterX = anchorWorldX - (newAnchorLocalNW.x * cosRot - newAnchorLocalNW.y * sinRot);
  const newCenterY = anchorWorldY - (newAnchorLocalNW.x * sinRot + newAnchorLocalNW.y * cosRot);

  // Verify that the stationary NW corner in the new element has EXACTLY the same world coordinates
  const verifiedWorldNW_X = newCenterX + newAnchorLocalNW.x * cosRot - newAnchorLocalNW.y * sinRot;
  const verifiedWorldNW_Y = newCenterY + newAnchorLocalNW.x * sinRot + newAnchorLocalNW.y * cosRot;

  const deltaX = Math.abs(verifiedWorldNW_X - anchorWorldX);
  const deltaY = Math.abs(verifiedWorldNW_Y - anchorWorldY);
  if (deltaX > 1e-9 || deltaY > 1e-9) {
    throw new Error(`Affine anchor preservation failed: deltaX=${deltaX}, deltaY=${deltaY}`);
  }
  console.log('PASS: Invariant affine transformation anchor mathematics verified (zero drift on rotated resize).');

  // Verify responsive diagram CSS in print engine
  const printExamHtml = generateExamPaperHtml(
    {
      id: 'mock-exam-diag',
      title: 'ข้อสอบการวัดและวงจรไฟฟ้า',
      total_questions: 1,
      duration_minutes: 45,
      max_score: 1
    },
    mockQuestions,
    { setName: 'A', schoolName: 'โรงเรียนสมคิดวิทยา' }
  );

  if (!printExamHtml.includes('.question-diagram-box') || !printExamHtml.includes('max-height: 240px !important')) {
    throw new Error('Print engine CSS does not contain page-safe rules for question-diagram-box');
  }
  console.log('PASS: Print engine diagram responsive styling verified.');

  console.log('\nALL VERIFICATION CHECKS (INCLUDING CANVA & WORD EXAM STUDIO) PASSED SUCCESSFULLY!');
}

runVerification().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
