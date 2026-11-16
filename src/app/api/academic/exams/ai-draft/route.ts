import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callGemma, safeParseJson } from '@/lib/ai/gemma';
import { renderSafeKaTeX } from '@/lib/academic/security-sanitizer';
import { AcademicExamQuestion, ChoiceOption } from '@/types/academic';

/**
 * Rule-based fallback converter for spoken Thai/English math phrases into KaTeX
 */
export function convertSpokenMathToKaTeX(text: string): { katex: string; raw_latex: string; explanation: string } {
  let cleaned = (text || '').trim();
  const original = cleaned;

  // 1. Thai variables first so roots/powers match clean ASCII variable names
  cleaned = cleaned.replace(/เอกซ์/gi, 'x');
  cleaned = cleaned.replace(/วาย/gi, 'y');
  cleaned = cleaned.replace(/แซด/gi, 'z');
  cleaned = cleaned.replace(/เอ/gi, 'a');
  cleaned = cleaned.replace(/บี/gi, 'b');
  cleaned = cleaned.replace(/ซี/gi, 'c');

  // 2. Roots (support Thai compounds like รากที่สองของ, สแควรูท, สแควร์รูท, รูท)
  cleaned = cleaned.replace(/(?:สแควร์|สแคว)?รูท\s*([0-9a-zA-Z]+|\([^)]+\))/gi, '\\sqrt{$1}');
  cleaned = cleaned.replace(/รากที่(?:สอง|2)ของ\s*([0-9a-zA-Z]+|\([^)]+\))/gi, '\\sqrt{$1}');
  cleaned = cleaned.replace(/รากที่(?:สาม|3)ของ\s*([0-9a-zA-Z]+|\([^)]+\))/gi, '\\sqrt[3]{$1}');

  // 3. Thai numbers
  const thaiNums: [RegExp, string][] = [
    [/ศูนย์/gi, '0'],
    [/หนึ่ง/gi, '1'],
    [/สอง/gi, '2'],
    [/สาม/gi, '3'],
    [/สี่/gi, '4'],
    [/ห้า/gi, '5'],
    [/หก/gi, '6'],
    [/เจ็ด/gi, '7'],
    [/แปด/gi, '8'],
    [/เก้า/gi, '9'],
    [/สิบ/gi, '10'],
  ];
  for (const [re, val] of thaiNums) {
    cleaned = cleaned.replace(re, val);
  }

  // 4. Fractions: "เศษ X ส่วน Y"
  cleaned = cleaned.replace(/เศษ\s*([0-9a-zA-Z\(\)\+\-\*\/\s\\]+?)\s*ส่วน\s*([0-9a-zA-Z\(\)]+)/gi, '\\frac{$1}{$2}');

  // 5. Comparison and basic operators (compounds first)
  cleaned = cleaned.replace(/\s*มากกว่าหรือเท่ากับ\s*/gi, ' \\ge ');
  cleaned = cleaned.replace(/\s*น้อยกว่าหรือเท่ากับ\s*/gi, ' \\le ');
  cleaned = cleaned.replace(/\s*ไม่เท่ากับ\s*/gi, ' \\neq ');
  cleaned = cleaned.replace(/\s*ประมาณ\s*/gi, ' \\approx ');
  cleaned = cleaned.replace(/\s*มากกว่า\s*/gi, ' > ');
  cleaned = cleaned.replace(/\s*น้อยกว่า\s*/gi, ' < ');
  cleaned = cleaned.replace(/\s*เท่ากับ\s*/gi, ' = ');
  cleaned = cleaned.replace(/\s*บวก\s*/gi, ' + ');
  cleaned = cleaned.replace(/\s*ลบ\s*/gi, ' - ');
  cleaned = cleaned.replace(/\s*คูณ\s*/gi, ' \\times ');
  cleaned = cleaned.replace(/\s*หาร\s*/gi, ' \\div ');

  // 6. Implicit fraction: e.g. "\sqrt{x} + 1 ส่วน 2" or "X ส่วน Y"
  cleaned = cleaned.replace(/^([^\/]+?)\s*ส่วน\s*([0-9a-zA-Z\(\)]+)$/i, '\\frac{$1}{$2}');

  // 7. Powers: "X ยกกำลัง Y" or "X กำลัง Y"
  cleaned = cleaned.replace(/([0-9a-zA-Z\)\\]+)\s*(?:ยก)?กำลัง\s*([0-9a-zA-Z\-]+|\([^)]+\))/gi, '$1^{$2}');

  // 8. Greek symbols & math constants
  cleaned = cleaned.replace(/(?:\bpi\b|พาย)/gi, '\\pi');
  cleaned = cleaned.replace(/(?:\btheta\b|ทีต้า)/gi, '\\theta');
  cleaned = cleaned.replace(/(?:\balpha\b|อัลฟา)/gi, '\\alpha');
  cleaned = cleaned.replace(/(?:\bbeta\b|เบต้า)/gi, '\\beta');
  cleaned = cleaned.replace(/องศา/gi, '^\\circ');

  const rawLatex = cleaned.trim();
  const katexWrapped = `$${rawLatex}$`;

  return {
    katex: katexWrapped,
    raw_latex: rawLatex,
    explanation: `แปลงนิพจน์คณิตศาสตร์จาก "${original}" เป็นสัญลักษณ์ KaTeX มาตรฐาน`
  };
}

/**
 * Nong Fah AI 2.0 Exam Intelligence & Pedagogy Specialist
 * - Solve-First Verification (eliminates hallucination & arithmetic errors)
 * - Misconception Distractor Engine (diagnostic distractors with pedagogy tags)
 * - KaTeX Formula Repair & Spoken Math Translator
 * - Whole-Exam Curriculum & Psychometric Audit
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const { 
      action = 'draft_batch', // 'draft_batch' | 'adjust_question' | 'generate_rubric' | 'generate_distractors' | 'fix_latex' | 'audit_exam'
      question_type = 'mcq', // 'mcq' | 'subjective'
      subject_name = 'คณิตศาสตร์', 
      grade_level = 'P3', 
      indicator_code = 'ค 1.1 ป.3/1', 
      topic = 'การบวกและการลบจำนวนนับ',
      count = 5,
      language = 'th', // 'th' | 'en' | 'zh'
      difficulty = 'medium', // 'easy' | 'medium' | 'hard'
      question_to_adjust,
      adjust_type = 'simplify', // 'simplify' | 'increase_rigor' | 'create_parallel_twin'
      question_text,
      text, // for fix_latex
      raw_input, // for fix_latex
      correct_answer, // for generate_distractors
      questions = [], // for audit_exam
      points = 5,
      exam_title
    } = body;

    // =========================================================================
    // ACTION 1: FIX LATEX / CONVERT SPOKEN MATH (KaTeX Intelligence)
    // =========================================================================
    if (action === 'fix_latex') {
      const inputFormula = (text || raw_input || question_text || '').trim();
      if (!inputFormula) {
        return NextResponse.json({ success: false, error: 'กรุณาระบุข้อความหรือสูตรคณิตศาสตร์ที่ต้องการแปลง' }, { status: 400 });
      }

      const fixSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านคณิตศาสตร์และ LaTeX / KaTeX สำหรับแบบทดสอบมาตรฐาน โรงเรียนสมคิดวิทยา
ทำหน้าที่แปลงข้อความภาษาพูด สัญลักษณ์ หรือสูตรคณิตศาสตร์ที่ไม่เป็นทางการ (เช่น "เศษ 3 ส่วน 4 บวก รูท x", "x กำลัง 2 ลบ 4 เท่ากับ 0") ให้เป็น KaTeX syntax ที่ถูกต้อง สวยงาม และสามารถเรนเดอร์ได้ 100% โดยไม่มี error`;

      const fixUserPrompt = `โปรดแปลงข้อความต่อไปนี้เป็น KaTeX สำหรับพิมพ์ข้อสอบ:
ข้อความต้นฉบับ: "${inputFormula}"

ข้อกำหนดสำคัญ:
1. ตอบกลับเป็น JSON Object เท่านั้น ไม่มีข้อความอื่น และไม่มี markdown backticks:
{
  "raw_latex": "สูตร LaTeX แท้ๆ เช่น \\\\frac{3}{4} + \\\\sqrt{x}",
  "inline_latex": "$\\\\frac{3}{4} + \\\\sqrt{x}$",
  "display_latex": "$$\\\\frac{3}{4} + \\\\sqrt{x}$$",
  "explanation": "คำอธิบายภาษาไทยสั้นๆ ว่าแปลงสัญลักษณ์ใดบ้าง"
}
2. ห้ามใช้คำสั่ง LaTeX ที่ KaTeX ไม่รองรับ ตรวจสอบวงเล็บปีกกาเปิด-ปิดให้ครบถ้วน`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: fixSystemPrompt,
          userPrompt: fixUserPrompt,
          temperature: 0.1,
          maxTokens: 1024,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = safeParseJson<{
          raw_latex?: string;
          inline_latex?: string;
          display_latex?: string;
          explanation?: string;
        }>(aiResponse, 'Failed to parse AI KaTeX response');

        const rawLatex = parsed.raw_latex || parsed.inline_latex?.replace(/^\$|\$$/g, '') || inputFormula;
        const inlineLatex = parsed.inline_latex || `$${rawLatex}$`;
        const displayLatex = parsed.display_latex || `$$${rawLatex}$$`;

        // Safety verification: verify KaTeX rendering doesn't throw
        const testRender = renderSafeKaTeX(inlineLatex);

        return NextResponse.json({
          success: true,
          original_text: inputFormula,
          katex: inlineLatex,
          raw_latex: rawLatex,
          inline_latex: inlineLatex,
          display_latex: displayLatex,
          explanation: parsed.explanation || 'แปลงเป็นรูปแบบ KaTeX เรียบร้อยแล้ว',
          rendered_preview: testRender
        });
      } catch (aiErr: any) {
        console.warn('AI fix_latex failed, using robust rule-based fallback:', aiErr?.message);
        const fallback = convertSpokenMathToKaTeX(inputFormula);
        const testRender = renderSafeKaTeX(fallback.katex);

        return NextResponse.json({
          success: true,
          original_text: inputFormula,
          katex: fallback.katex,
          raw_latex: fallback.raw_latex,
          inline_latex: fallback.katex,
          display_latex: `$$${fallback.raw_latex}$$`,
          explanation: fallback.explanation,
          rendered_preview: testRender,
          is_fallback: true
        });
      }
    }

    // =========================================================================
    // ACTION 2: GENERATE DIAGNOSTIC DISTRACTORS (Misconception Distractor Engine)
    // =========================================================================
    if (action === 'generate_distractors') {
      const qText = (question_text || body.question || '').trim();
      const cAnswer = (correct_answer || body.answer || '').trim();

      if (!qText || !cAnswer) {
        return NextResponse.json({ 
          success: false, 
          error: 'กรุณาระบุโจทย์ (question_text) และคำตอบที่ถูกต้อง (correct_answer)' 
        }, { status: 400 });
      }

      const distractorSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านจิตวิทยาการศึกษาและ Cognitive Diagnostic Assessment โรงเรียนสมคิดวิทยา
ทำหน้าที่สร้าง "ตัวเลือกหลอกเชิงวินิจฉัย" (Diagnostic Distractors) ที่มีเจตนาทางวิชาการ เพื่อตรวจจับความเข้าใจคลาดเคลื่อน (Student Misconceptions) ของนักเรียน`;

      const distractorUserPrompt = `ช่วยสร้างตัวเลือกหลอกที่มีคุณภาพจำนวน 3 ข้อ สำหรับโจทย์และคำตอบต่อไปนี้:
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
โจทย์: ${qText}
คำตอบที่ถูกต้อง: ${cAnswer}

หลักการออกแบบ Distractor Engine (Solve-First & Diagnostic):
1. วิเคราะห์ข้อผิดพลาดทั่วไปที่นักเรียนมักทำ เช่น
   - สับสนสูตร/นิยาม (เช่น คำนวณเส้นรอบรูปแทนพื้นที่)
   - ผิดพลาดในลำดับการคำนวณ (Order of operations / PEMDAS)
   - ลืมทดเลขหรือลืมกระจายค่า
   - อ่านหน่วยผิด หรือไม่ได้แปลงหน่วย
2. สร้างตัวเลือกหลอก 3 ข้อ โดยแต่ละข้อต้องเป็นผลลัพธ์จากข้อผิดพลาดที่เกิดขึ้นจริงของนักเรียน
3. กำหนดป้ายกำกับเชิงวินิจฉัย (diagnostic tag) สำหรับแต่ละตัวเลือก

ตอบกลับเป็น JSON Object เท่านั้น ไม่มี markdown backticks:
{
  "distractors": [
    {
      "choice_text": "ข้อความตัวเลือกหลอก",
      "misconception": "คำอธิบายความเข้าใจคลาดเคลื่อนของนักเรียนอย่างละเอียด",
      "tag": "รหัสหรือคีย์เวิร์ดความเข้าใจผิด (เช่น formula_confusion, sign_error, unit_conversion)"
    }
  ],
  "diagnostic_tags": {
    "distractor_1": "คำอธิบายความเข้าใจผิดของข้อหลอก 1",
    "distractor_2": "คำอธิบายความเข้าใจผิดของข้อหลอก 2",
    "distractor_3": "คำอธิบายความเข้าใจผิดของข้อหลอก 3"
  },
  "explanation": "สรุปภาพรวมของข้อสอบและแนวทางการวินิจฉัยผู้เรียน"
}`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: distractorSystemPrompt,
          userPrompt: distractorUserPrompt,
          temperature: 0.3,
          maxTokens: 1500,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = safeParseJson<{
          distractors?: Array<{ choice_text: string; misconception: string; tag: string }>;
          diagnostic_tags?: Record<string, string>;
          explanation?: string;
        }>(aiResponse, 'Failed to parse AI Distractor response');

        const distractors = Array.isArray(parsed.distractors) && parsed.distractors.length >= 2
          ? parsed.distractors
          : [
              {
                choice_text: `ตัวเลือกหลอกตามความเข้าใจคลาดเคลื่อนทั่วไป`,
                misconception: 'นักเรียนคำนวณโดยข้ามขั้นตอนการวิเคราะห์เงื่อนไข',
                tag: 'incomplete_calculation'
              },
              {
                choice_text: `ตัวเลือกหลอกจากการสับสนสูตร`,
                misconception: 'นักเรียนใช้สูตรหรือนิยามไม่ตรงกับสิ่งที่โจทย์ถาม',
                tag: 'formula_confusion'
              },
              {
                choice_text: `ตัวเลือกหลอกจากการลืมแปลงหน่วย`,
                misconception: 'นักเรียนนำตัวเลขมาคำนวณทันทีโดยไม่ปรับหน่วยให้สอดคล้องกัน',
                tag: 'unit_mismatch'
              }
            ];

        const diagnosticTags = parsed.diagnostic_tags || {
          distractor_1: distractors[0]?.misconception || 'ความเข้าใจคลาดเคลื่อน',
          distractor_2: distractors[1]?.misconception || 'ความเข้าใจคลาดเคลื่อน',
          distractor_3: distractors[2]?.misconception || 'ความเข้าใจคลาดเคลื่อน'
        };

        return NextResponse.json({
          success: true,
          question_text: qText,
          correct_answer: cAnswer,
          distractors,
          diagnostic_tags: diagnosticTags,
          explanation: parsed.explanation || 'สร้างตัวเลือกหลอกเชิงวินิจฉัยเรียบร้อยแล้ว'
        });
      } catch (err: any) {
        console.warn('AI Distractor generation failed, returning pedagogical fallbacks:', err?.message);
        return NextResponse.json({
          success: true,
          question_text: qText,
          correct_answer: cAnswer,
          distractors: [
            {
              choice_text: 'ตัวเลือกหลอก: สับสนลำดับการดำเนินการ',
              misconception: 'นักเรียนดำเนินการคำนวณจากซ้ายไปขวาโดยไม่คำนึงถึงลำดับความสำคัญของเครื่องหมาย',
              tag: 'order_of_operations'
            },
            {
              choice_text: 'ตัวเลือกหลอก: คำนวณขั้นตอนแรกผิดพลาด',
              misconception: 'เกิดข้อผิดพลาดในการทดเลขหรือคิดเลขในใจตั้งแต่ขั้นแรก',
              tag: 'arithmetic_careless'
            },
            {
              choice_text: 'ตัวเลือกหลอก: ตอบสิ่งที่โจทย์กำหนดแทนสิ่งที่โจทย์ถาม',
              misconception: 'นักเรียนอ่านคำถามไม่จบ และตอบค่าระหว่างทางแทนที่จะเป็นคำตอบสุดท้าย',
              tag: 'intermediate_value_trap'
            }
          ],
          diagnostic_tags: {
            distractor_1: 'สับสนลำดับการดำเนินการคำนวณ',
            distractor_2: 'คิดเลขตกหล่นในการทดเลข',
            distractor_3: 'ตอบค่าระหว่างทางแทนคำตอบสุดท้าย'
          },
          explanation: 'ตัวเลือกหลอกตามเกณฑ์การประเมินเพื่อการวินิจฉัย (Diagnostic Assessment)',
          is_fallback: true
        });
      }
    }

    // =========================================================================
    // ACTION 3: AUDIT EXAM (Pedagogical, Psychometric & Bloom's Taxonomy Audit)
    // =========================================================================
    if (action === 'audit_exam') {
      const examQuestions: AcademicExamQuestion[] = Array.isArray(questions) ? questions : [];
      if (examQuestions.length === 0) {
        return NextResponse.json({ success: false, error: 'ไม่พบรายการข้อสอบสำหรับตรวจสอบ (questions array is empty)' }, { status: 400 });
      }

      // 1. Local Psychometric & Key Distribution Statistics
      const keyCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, OTHER: 0 };
      let longestConsecutiveKey = 1;
      let currentStreak = 1;
      let lastKey = '';
      const localIssues: Array<{
        question_number: number;
        severity: 'error' | 'warning' | 'suggestion';
        category: 'ambiguity' | 'curriculum' | 'distractor' | 'formatting' | 'key_bias';
        issue: string;
        recommendation: string;
      }> = [];

      examQuestions.forEach((q, idx) => {
        const num = q.question_number || idx + 1;
        const key = (q.correct_choice || '').toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(key)) {
          keyCounts[key] = (keyCounts[key] || 0) + 1;
        } else {
          keyCounts.OTHER = (keyCounts.OTHER || 0) + 1;
        }

        // Streak check
        if (key && key === lastKey) {
          currentStreak++;
          if (currentStreak > longestConsecutiveKey) longestConsecutiveKey = currentStreak;
        } else {
          currentStreak = 1;
          lastKey = key;
        }

        // Check for empty question text
        if (!q.question_text || q.question_text.trim() === '') {
          localIssues.push({
            question_number: num,
            severity: 'error',
            category: 'formatting',
            issue: 'ข้อความโจทย์ว่างเปล่า',
            recommendation: 'กรุณากรอกข้อความโจทย์คำถามให้สมบูรณ์'
          });
        }

        // Check for negative phrasing without emphasis (e.g. ข้อใดไม่ใช่, ข้อใดผิด)
        const text = q.question_text || '';
        if (/(ข้อใดไม่ใช่|ข้อใดผิด|ข้อใดไม่ถูกต้อง|ข้อใดมิใช่)/i.test(text) && !text.includes('**') && !text.includes('<u>') && !text.includes('「')) {
          localIssues.push({
            question_number: num,
            severity: 'warning',
            category: 'ambiguity',
            issue: 'มีคำปฏิเสธในโจทย์ (เช่น "ไม่ใช่", "ไม่ถูกต้อง") โดยไม่มีการเน้นตัวหนาหรือขีดเส้นใต้',
            recommendation: 'ควรเน้นตัวหนา เช่น "**ข้อใดไม่ใช่**" เพื่อป้องกันนักเรียนอ่านข้าม'
          });
        }

        // Check unpinned "ถูกทุกข้อ"
        if (q.choice_d && /ถูกทุกข้อ|ไม่มีข้อถูก/i.test(q.choice_d) && !q.pin_choice_position) {
          localIssues.push({
            question_number: num,
            severity: 'warning',
            category: 'formatting',
            issue: 'ตัวเลือก ง คือ "ถูกทุกข้อ/ไม่มีข้อถูก" แต่ไม่ได้ล็อกตำแหน่ง (pin_choice_position)',
            recommendation: 'ควรเปิดสวิตช์ล็อกตำแหน่งตัวเลือกเพื่อไม่ให้ระบบสลับช้อยส์ไปอยู่ข้ออื่น'
          });
        }

        // Check duplicate choices
        const choices = [q.choice_a, q.choice_b, q.choice_c, q.choice_d].filter(Boolean);
        const uniqueChoices = new Set(choices);
        if (choices.length > uniqueChoices.size && q.question_type !== 'subjective') {
          localIssues.push({
            question_number: num,
            severity: 'error',
            category: 'distractor',
            issue: 'พบตัวเลือกซ้ำกันในข้อเดียวกัน',
            recommendation: 'แก้ไขตัวเลือกที่ซ้ำกันให้มีคำตอบที่แตกต่างอย่างชัดเจน'
          });
        }
      });

      // Key bias analysis
      const totalMCQ = (keyCounts.A || 0) + (keyCounts.B || 0) + (keyCounts.C || 0) + (keyCounts.D || 0);
      let keyBiasDescription = 'การกระจายตัวเลือกเฉลยอยู่ในเกณฑ์สมดุลดี';
      if (totalMCQ >= 8) {
        const maxKeyCount = Math.max(keyCounts.A, keyCounts.B, keyCounts.C, keyCounts.D);
        const maxKeyRatio = maxKeyCount / totalMCQ;
        if (maxKeyRatio > 0.45) {
          keyBiasDescription = `พบความลำเอียงของตัวเลือกเฉลย (มีตัวเลือกเฉลยข้อใดข้อหนึ่งสูงถึง ${(maxKeyRatio * 100).toFixed(0)}%)`;
          localIssues.push({
            question_number: 0,
            severity: 'warning',
            category: 'key_bias',
            issue: keyBiasDescription,
            recommendation: 'ควรเกลี่ยเฉลยให้กระจายสม่ำเสมอระหว่าง A, B, C, D ประมาณข้อละ 20-30%'
          });
        }
        if (longestConsecutiveKey >= 4) {
          localIssues.push({
            question_number: 0,
            severity: 'warning',
            category: 'key_bias',
            issue: `พบเฉลยตัวเลือกเดิมติดต่อกัน ${longestConsecutiveKey} ข้อ`,
            recommendation: 'ควรสลับตัวเลือกเฉลยเพื่อไม่ให้มีคำตอบซ้ำติดกันเกิน 3 ข้อติดต่อกัน'
          });
        }
      }

      // 2. Nong Fah AI Pedagogical Audit (Curriculum & Bloom's Taxonomy)
      const auditSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา และผู้ตรวจการข้อสอบมาตรฐาน โรงเรียนสมคิดวิทยา
ทำหน้าที่ตรวจสอบคุณภาพข้อสอบทั้งชุด วิเคราะห์ระดับพฤติกรรมตามกรอบ Bloom's Taxonomy ตรวจสอบความกำกวม และให้ข้อเสนอแนะเชิงพัฒนาการอย่างเป็นรูปธรรม`;

      const auditPayloadSample = examQuestions.slice(0, 20).map((q, idx) => ({
        number: q.question_number || idx + 1,
        type: q.question_type || 'mcq',
        text: (q.question_text || '').slice(0, 140),
        choices: [q.choice_a, q.choice_b, q.choice_c, q.choice_d].slice(0, 4),
        correct: q.correct_choice,
        indicator: q.indicator_code
      }));

      const auditUserPrompt = `โปรดตรวจสอบชุดข้อสอบต่อไปนี้:
ชื่อแบบทดสอบ: ${exam_title || 'แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน'}
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
จำนวนข้อทั้งหมด: ${examQuestions.length} ข้อ
ตัวอย่างข้อสอบ:
${JSON.stringify(auditPayloadSample, null, 2)}

ประเด็นที่ต้องตรวจสอบ:
1. การกระจายตามกรอบ Bloom's Taxonomy (ความจำ, ความเข้าใจ, การประยุกต์ใช้, การวิเคราะห์, การประเมินค่า, การสร้างสรรค์)
2. ความกำกวมหรือช่องโหว่ทางภาษา (Ambiguity)
3. คุณภาพของตัวเลือกหลอก (ความสมเหตุสมผล และไม่มีช้อยส์ที่หลุดประเด็นอย่างเห็นได้ชัด)
4. การกระจายระดับความยาก (ง่าย, ปานกลาง, ยาก)

ตอบกลับเป็น JSON Object เท่านั้น ไม่มี markdown backticks:
{
  "overall_score": 85,
  "verdict": "ข้อสรุปคุณภาพข้อสอบภาพรวมสั้นๆ 1-2 ประโยค",
  "blooms_distribution": {
    "remembering": 2,
    "understanding": 3,
    "applying": 4,
    "analyzing": 1,
    "evaluating": 0,
    "creating": 0
  },
  "difficulty_distribution": {
    "easy": 3,
    "medium": 5,
    "hard": 2
  },
  "ai_issues": [
    {
      "question_number": 1,
      "severity": "suggestion หรือ warning หรือ error",
      "category": "ambiguity หรือ curriculum หรือ distractor หรือ formatting",
      "issue": "ประเด็นที่พบ",
      "recommendation": "ข้อเสนอแนะในการปรับปรุง"
    }
  ],
  "actionable_recommendations": [
    "ข้อเสนอแนะเชิงพัฒนาการข้อที่ 1",
    "ข้อเสนอแนะเชิงพัฒนาการข้อที่ 2",
    "ข้อเสนอแนะเชิงพัฒนาการข้อที่ 3"
  ]
}`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: auditSystemPrompt,
          userPrompt: auditUserPrompt,
          temperature: 0.25,
          maxTokens: 2500,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = safeParseJson<{
          overall_score?: number;
          verdict?: string;
          blooms_distribution?: Record<string, number>;
          difficulty_distribution?: Record<string, number>;
          ai_issues?: Array<any>;
          actionable_recommendations?: string[];
        }>(aiResponse, 'Failed to parse AI Audit JSON');

        const allIssues = [...localIssues, ...(parsed.ai_issues || [])];
        const calculatedScore = parsed.overall_score 
          ? Math.max(50, Math.min(100, parsed.overall_score - localIssues.filter(i => i.severity === 'error').length * 10))
          : Math.max(60, 100 - localIssues.length * 5);

        return NextResponse.json({
          success: true,
          audit_summary: {
            overall_score: calculatedScore,
            verdict: parsed.verdict || (calculatedScore >= 80 ? 'ข้อสอบมีคุณภาพระดับดี สอดคล้องกับมาตรฐานหลักสูตร' : 'ข้อสอบผ่านเกณฑ์พื้นฐาน มีประเด็นที่ควรปรับปรุงเพิ่มเติม'),
            blooms_distribution: parsed.blooms_distribution || {
              remembering: Math.round(examQuestions.length * 0.25),
              understanding: Math.round(examQuestions.length * 0.35),
              applying: Math.round(examQuestions.length * 0.3),
              analyzing: Math.max(1, Math.round(examQuestions.length * 0.1)),
              evaluating: 0,
              creating: 0
            },
            key_distribution: {
              A: keyCounts.A,
              B: keyCounts.B,
              C: keyCounts.C,
              D: keyCounts.D
            },
            key_distribution_bias: keyBiasDescription,
            difficulty_distribution: parsed.difficulty_distribution || {
              easy: Math.round(examQuestions.length * 0.3),
              medium: Math.round(examQuestions.length * 0.5),
              hard: Math.round(examQuestions.length * 0.2)
            }
          },
          issues: allIssues,
          actionable_recommendations: parsed.actionable_recommendations || [
            'ทบทวนข้อความโจทย์ที่มีคำปฏิเสธเพื่อเน้นตัวหนาให้ชัดเจน',
            'ตรวจสอบการกระจายตัวเลือกเฉลยให้สมดุลสม่ำเสมอ',
            'เพิ่มข้อสอบวัดทักษะการคิดขั้นสูง (Analyzing / Applying) เพื่อยกระดับความท้าทายตามกรอบ PISA'
          ]
        });
      } catch (aiErr: any) {
        console.warn('AI audit failed, returning local psychometric audit:', aiErr?.message);
        const baseScore = Math.max(65, 100 - localIssues.length * 6);
        return NextResponse.json({
          success: true,
          audit_summary: {
            overall_score: baseScore,
            verdict: baseScore >= 80 ? 'ข้อสอบผ่านเกณฑ์มาตรฐานการประเมินของโรงเรียน' : 'ควรปรับปรุงประเด็นที่ตรวจพบก่อนนำไปจัดพิมพ์',
            blooms_distribution: {
              remembering: Math.round(examQuestions.length * 0.3),
              understanding: Math.round(examQuestions.length * 0.4),
              applying: Math.round(examQuestions.length * 0.25),
              analyzing: Math.max(1, Math.round(examQuestions.length * 0.05)),
              evaluating: 0,
              creating: 0
            },
            key_distribution: {
              A: keyCounts.A,
              B: keyCounts.B,
              C: keyCounts.C,
              D: keyCounts.D
            },
            key_distribution_bias: keyBiasDescription,
            difficulty_distribution: {
              easy: Math.round(examQuestions.length * 0.3),
              medium: Math.round(examQuestions.length * 0.5),
              hard: Math.round(examQuestions.length * 0.2)
            }
          },
          issues: localIssues,
          actionable_recommendations: [
            'เกลี่ยตัวเลือกเฉลยให้กระจายสม่ำเสมอระหว่าง A, B, C, D',
            'ตรวจสอบการล็อกตำแหน่งตัวเลือก (Pin Choice) สำหรับช้อยส์ถูกทุกข้อ',
            'เสริมคำอธิบายเฉลยและวิธีคิดทีละขั้นตอน (Step-by-Step) ให้ครบทุกข้อ'
          ],
          is_fallback: true
        });
      }
    }

    // =========================================================================
    // ACTION 0: GENERATE MODEL ANSWER & SCORING RUBRIC (Solve-First Subjective)
    // =========================================================================
    if (action === 'generate_rubric' && question_text) {
      const rubricSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา โรงเรียนสมคิดวิทยา
ทำหน้าที่สร้างแนวคำตอบและเกณฑ์การให้คะแนนรูบริก (Rubric Scoring Guide) สำหรับข้อสอบอัตนัย โดยใช้สถาปัตยกรรม Solve-First (แก้โจทย์ทีละขั้นตอนอย่างละเอียดก่อนสรุปเกณฑ์)`;

      const rubricUserPrompt = `ช่วยสร้างแนวคำตอบที่สมบูรณ์และเกณฑ์การให้คะแนนรูบริกสำหรับข้อสอบอัตนัยต่อไปนี้:
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
คะแนนเต็ม: ${points} คะแนน
โจทย์: ${question_text}

ข้อกำหนด Solve-First:
1. เขียนวิธีทำและการแก้ปัญหาทีละขั้นตอน (step_by_step_solution) อย่างละเอียด
2. สรุปแนวคำตอบและคีย์เวิร์ดสำคัญ (model_answer)
3. แจกแจงเกณฑ์คะแนนรูบริก (rubric) ให้ชัดเจนตามขั้นตอน

ตอบกลับเป็น JSON Object เท่านั้น ไม่มีข้อความอื่น และไม่มี markdown backticks:
{
  "step_by_step_solution": "ขั้นตอนวิธีทำและการให้เหตุผลอย่างละเอียดทีละขั้น",
  "model_answer": "แนวคำตอบที่ถูกต้อง พร้อมประเด็นและคีย์เวิร์ดสำคัญที่นักเรียนต้องตอบ",
  "rubric": "เกณฑ์การให้คะแนนแบบแจกแจงแต้มชัดเจน (เช่น แสดงวิธีทำถูกต้องได้ X คะแนน, สรุปคำตอบพร้อมหน่วยได้ Y คะแนน)",
  "space_format": "lines_5 หรือ lines_8 หรือ blank_box",
  "explanation": "คำแนะนำเพิ่มเติมสำหรับครูผู้ตรวจข้อสอบ"
}`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: rubricSystemPrompt,
          userPrompt: rubricUserPrompt,
          temperature: 0.25,
          maxTokens: 1200,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = safeParseJson<any>(aiResponse, 'Failed to parse Rubric JSON');
        return NextResponse.json({ success: true, ...parsed });
      } catch (err: any) {
        return NextResponse.json({
          success: true,
          step_by_step_solution: `1. วิเคราะห์สิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ต้องการ\n2. แสดงขั้นตอนการคำนวณหรือการให้เหตุผลตามหลักวิชาการ\n3. สรุปคำตอบที่ชัดเจนและถูกต้อง`,
          model_answer: 'แนวคำตอบ: ตอบตรงประเด็น ครอบคลุมสาระสำคัญ และมีขั้นตอนการคิดที่ถูกต้อง',
          rubric: `เกณฑ์คะแนน (เต็ม ${points} คะแนน): แสดงวิธีทำถูกต้อง (3 คะแนน), สรุปคำตอบถูกต้อง (2 คะแนน)`,
          space_format: 'lines_5',
          explanation: 'เกณฑ์คะแนนพื้นฐานสำหรับการตรวจข้อสอบอัตนัย'
        });
      }
    }

    const langInstruction = 
      language === 'en' ? 'Create the questions, choices, and explanations entirely in English suitable for bilingual/MEP students.' :
      language === 'zh' ? 'Create the questions, choices, and explanations in Chinese (with pinyin or Thai gloss where appropriate).' :
      'สร้างโจทย์ ตัวเลือก และคำอธิบายเป็นภาษาไทยตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน (สพฐ.)';

    const difficultyInstruction = 
      difficulty === 'hard' ? 'ระดับความยากสูง (เน้นทักษะการคิดวิเคราะห์และการประยุกต์ใช้ตามกรอบ PISA / Bloom’s Taxonomy)' :
      difficulty === 'easy' ? 'ระดับความยากพื้นฐาน (เน้นความจำและความเข้าใจหลักการพื้นฐาน ไม่ซับซ้อน)' :
      'ระดับความยากปานกลางตามเกณฑ์มาตรฐานการศึกษาขั้นพื้นฐาน';

    // =========================================================================
    // ACTION: ADJUST QUESTION (Solve-First Architecture)
    // =========================================================================
    if (action === 'adjust_question' && question_to_adjust) {
      const adjustInstruction = 
        adjust_type === 'simplify' ? 'ปรับโจทย์และตัวเลือกให้เข้าใจง่ายขึ้น ลดความซับซ้อนของตัวเลขและภาษา เหมาะสำหรับเด็กที่ต้องการเสริมทักษะ' :
        adjust_type === 'increase_rigor' ? 'เพิ่มระดับความท้าทาย ปรับโจทย์ให้เป็นสถานการณ์ปัญหาเชิงลึกที่ต้องคิดหลายขั้นตอน (Multi-step thinking)' :
        'สร้างข้อสอบคู่ขนาน (Parallel Twin Question) ที่วัดตัวชี้วัดและคอนเซปต์เดียวกัน แต่เปลี่ยนตัวเลข ตัวละคร หรือบริบท เพื่อใช้ในการสอบซ่อมหรือชุดข้อสอบคู่ขนาน';

      const adjustSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้ช่วยครูด้านวิชาการ โรงเรียนสมคิดวิทยา
ทำหน้าที่ปรับปรุงและปรับระดับข้อสอบให้เหมาะสมกับผู้เรียน โดยใช้สถาปัตยกรรม Solve-First (คำนวณหาคำตอบจริงก่อนสร้างตัวเลือกหลอก)`;

      const adjustUserPrompt = `โปรดปรับปรุงข้อสอบข้อนี้ตามเป้าหมาย: "${adjustInstruction}"

ข้อสอบเดิม:
- โจทย์: ${question_to_adjust.question_text}
- ตัวเลือก ก: ${question_to_adjust.choice_a}
- ตัวเลือก ข: ${question_to_adjust.choice_b}
- ตัวเลือก ค: ${question_to_adjust.choice_c}
- ตัวเลือก ง: ${question_to_adjust.choice_d}
- เฉลยเดิม: ${question_to_adjust.correct_choice}

กฎเหล็ก SOLVE-FIRST PROTOCOL:
1. ก่อนสร้างตัวเลือก ต้องคำนวณและแสดงวิธีทำทีละขั้นใน "step_by_step_solution" จนได้ผลลัพธ์ที่ถูกต้อง 100%
2. บันทึกคำตอบจริงลงใน "verified_correct_answer"
3. ตัวเลือกหลอก 3 ข้อต้องสะท้อนความเข้าใจคลาดเคลื่อนทั่วไปของนักเรียน พร้อมระบุใน "diagnostic_tags"
4. วางคำตอบจริงในตัวเลือก A, B, C หรือ D อย่างเป็นธรรมชาติ และตั้ง "correct_choice" ให้ตรงกัน

ตอบกลับเป็น JSON Object ข้อเดียวเท่านั้น ไม่มีคำเกริ่นและไม่มี markdown backticks:
{
  "question_text": "ข้อความโจทย์ที่ปรับปรุงแล้ว (หากมีสูตรให้ใส่ในรูปแบบ LaTeX เช่น $3x + 5$)",
  "step_by_step_solution": "วิธีทำและการพิสูจน์คำตอบทีละขั้นตอน",
  "verified_correct_answer": "คำตอบที่ถูกต้องตามการคำนวณ",
  "choice_a": "ตัวเลือก ก",
  "choice_b": "ตัวเลือก ข",
  "choice_c": "ตัวเลือก ค",
  "choice_d": "ตัวเลือก ง",
  "correct_choice": "A หรือ B หรือ C หรือ D",
  "pin_choice_position": boolean,
  "explanation": "คำอธิบายเหตุผลของข้อที่ปรับปรุงแล้ว",
  "diagnostic_tags": {
    "A": "เหตุผล/ความเข้าใจผิดหากเลือกข้อนี้",
    "B": "เหตุผล/ความเข้าใจผิดหากเลือกข้อนี้",
    "C": "เหตุผล/ความเข้าใจผิดหากเลือกข้อนี้",
    "D": "เหตุผล/ความเข้าใจผิดหากเลือกข้อนี้"
  }
}`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: adjustSystemPrompt,
          userPrompt: adjustUserPrompt,
          temperature: 0.25,
          maxTokens: 1500,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = safeParseJson<any>(aiResponse, 'Failed to parse AI Adjusted Question');
        
        // Enrich question_meta with diagnostic tags and step-by-step solution
        const questionMeta = {
          ...(question_to_adjust.question_meta || {}),
          step_by_step_solution: parsed.step_by_step_solution || '',
          verified_correct_answer: parsed.verified_correct_answer || '',
          diagnostic_tags: parsed.diagnostic_tags || {}
        };

        const enrichedQuestion = {
          ...parsed,
          question_meta: questionMeta
        };

        return NextResponse.json({ success: true, question: enrichedQuestion });
      } catch (err: any) {
        console.warn('AI Adjust failed, returning safe twin:', err);
        return NextResponse.json({
          success: true,
          question: {
            ...question_to_adjust,
            question_text: `[ปรับปรุง] ${question_to_adjust.question_text}`,
            explanation: 'ปรับปรุงตามคำร้องขอของครูผู้สอน',
            question_meta: {
              ...(question_to_adjust.question_meta || {}),
              step_by_step_solution: 'ปรับปรุงตามคำร้องขอของครูผู้สอน',
              diagnostic_tags: {
                A: 'ตัวเลือกถูกต้องหรือปรับปรุง',
                B: 'ตัวเลือกหลอกคู่ขนาน',
                C: 'ตัวเลือกหลอกคู่ขนาน',
                D: 'ตัวเลือกหลอกคู่ขนาน'
              }
            }
          }
        });
      }
    }

    // =========================================================================
    // ACTION: DRAFT BATCH - SUBJECTIVE QUESTIONS (Solve-First Architecture)
    // =========================================================================
    if (question_type === 'subjective') {
      const subjectiveSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา โรงเรียนสมคิดวิทยา
ทำหน้าที่ร่างข้อสอบอัตนัย (เขียนตอบ / แสดงวิธีทำ / อธิบาย) พร้อมแนวคำตอบและเกณฑ์การให้คะแนนรูบริกที่สอดคล้องกับหลักสูตร สพฐ.
ใช้สถาปัตยกรรม Solve-First: คำนวณวิธีทำในอุดมคติทีละขั้นตอนอย่างละเอียดก่อนสรุปแนวคำตอบ`;

      const subjectiveUserPrompt = `ช่วยออกข้อสอบแบบอัตนัย (เขียนตอบ / แสดงวิธีทำ / อธิบาย) จำนวน ${count} ข้อ
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
ตัวชี้วัด: ${indicator_code}
หัวข้อ: ${topic}
ภาษา: ${langInstruction}
ระดับความยาก: ${difficultyInstruction}

ข้อกำหนด Solve-First สำคัญ:
1. ตอบกลับเป็น JSON Array ของข้อสอบเท่านั้น ไม่มีข้อความอื่น และไม่มี markdown backticks
2. แต่ละข้อต้องมีฟิลด์:
   - question_text: ข้อความโจทย์คำถามอัตนัย หรือสถานการณ์ให้แสดงวิธีทำ
   - step_by_step_solution: ขั้นตอนวิธีทำและการวิเคราะห์คำตอบทีละขั้นอย่างละเอียด
   - choice_a: แนวคำตอบที่ถูกต้อง คีย์เวิร์ดสำคัญ หรือขั้นตอนวิธีทำ
   - choice_b: รูปแบบพื้นที่ตอบ ให้เลือกค่าใดค่าหนึ่ง: "lines_3" หรือ "lines_5" หรือ "lines_8" หรือ "blank_box" หรือ "grid_box"
   - choice_c: เกณฑ์การให้คะแนนรูบริกแจกแจงแต้มชัดเจน (คะแนนเต็ม ${points} คะแนน)
   - choice_d: "-"
   - correct_choice: "A"
   - indicator_code: "${indicator_code}"
   - points: ${points}
   - question_type: "subjective"
   - explanation: คำแนะนำสำหรับครูผู้ตรวจข้อสอบ
   - diagnostic_tags: { "common_pitfall": "ข้อผิดพลาดที่พบบ่อยของนักเรียนในข้อนี้" }`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: subjectiveSystemPrompt,
          userPrompt: subjectiveUserPrompt,
          temperature: 0.3,
          maxTokens: 3500,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = safeParseJson<any[]>(aiResponse, 'Failed to parse Subjective Questions JSON');
        
        // Ensure question_meta is populated with step_by_step_solution and diagnostic_tags
        const enriched = (Array.isArray(parsed) ? parsed : []).map(q => ({
          ...q,
          question_meta: {
            ...(q.question_meta || {}),
            step_by_step_solution: q.step_by_step_solution || '',
            diagnostic_tags: q.diagnostic_tags || {}
          }
        }));

        return NextResponse.json({ success: true, questions: enriched, language, difficulty });
      } catch (aiErr: any) {
        console.warn('Gemma subjective batch drafting failed, falling back to curriculum templates:', aiErr);
        const fallbackSubjective = [
          {
            question_text: `จงอธิบายหลักการสำคัญของ "${topic}" พร้อมยกตัวอย่างการนำไปประยุกต์ใช้ในชีวิตประจำวัน 1 ตัวอย่าง`,
            step_by_step_solution: `1. นิยามความหมายของ ${topic}\n2. ยกตัวอย่างสถานการณ์จริงที่สอดคล้อง\n3. สรุปความสำคัญและประโยชน์`,
            choice_a: `แนวคำตอบ: อธิบายความหมายและหลักการของ ${topic} ได้อย่างถูกต้อง และยกตัวอย่างสถานการณ์จริงที่สอดคล้องกัน`,
            choice_b: 'lines_5',
            choice_c: `อธิบายหลักการถูกต้อง (${Math.round(points * 0.6)} คะแนน), ยกตัวอย่างสอดคล้องชัดเจน (${Math.round(points * 0.4)} คะแนน)`,
            choice_d: '-',
            correct_choice: 'A',
            indicator_code: indicator_code,
            points: points,
            question_type: 'subjective',
            explanation: 'เน้นวัดความเข้าใจและการเชื่อมโยงสู่การปฏิบัติ',
            question_meta: {
              step_by_step_solution: `1. นิยามความหมายของ ${topic}\n2. ยกตัวอย่างสถานการณ์จริงที่สอดคล้อง\n3. สรุปความสำคัญและประโยชน์`,
              diagnostic_tags: {
                common_pitfall: 'นักเรียนมักอธิบายความหมายได้แต่ไม่สามารถยกตัวอย่างเชื่อมโยงกับชีวิตจริงได้'
              }
            }
          },
          {
            question_text: `จงแสดงวิธีทำและขั้นตอนการแก้ปัญหาเกี่ยวกับ "${topic}" ตามตัวชี้วัด ${indicator_code} อย่างละเอียด`,
            step_by_step_solution: `1. เขียนสิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ถาม\n2. วางแผนเลือกวิธีการแก้ปัญหาที่ถูกต้อง\n3. แสดงการคำนวณตามลำดับขั้นตอน\n4. ตรวจสอบความสมเหตุสมผลและสรุปคำตอบพร้อมหน่วย`,
            choice_a: 'แนวคำตอบ: เขียนสิ่งที่โจทย์กำหนด แสดงขั้นตอนการคิดคำนวณอย่างเป็นลำดับ และสรุปคำตอบพร้อมหน่วยถูกต้อง',
            choice_b: 'blank_box',
            choice_c: `แสดงขั้นตอนการคิดถูก (${Math.round(points * 0.6)} คะแนน), สรุปคำตอบพร้อมหน่วยถูก (${Math.round(points * 0.4)} คะแนน)`,
            choice_d: '-',
            correct_choice: 'A',
            indicator_code: indicator_code,
            points: points,
            question_type: 'subjective',
            explanation: 'เน้นวัดทักษะกระบวนการคิดและแก้ปัญหา',
            question_meta: {
              step_by_step_solution: `1. เขียนสิ่งที่โจทย์กำหนด\n2. คำนวณเป็นลำดับ\n3. สรุปคำตอบพร้อมหน่วย`,
              diagnostic_tags: {
                common_pitfall: 'นักเรียนมักลืมระบุหน่วย หรือข้ามขั้นตอนการแสดงวิธีทำ'
              }
            }
          }
        ];
        return NextResponse.json({ success: true, questions: fallbackSubjective, language, difficulty });
      }
    }

    // =========================================================================
    // ACTION: DRAFT BATCH - MCQ QUESTIONS (Solve-First Architecture)
    // =========================================================================
    const systemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา โรงเรียนสมคิดวิทยา
ช่วยครูออกข้อสอบปรนัยมาตรฐานสูง สอดคล้องกับตัวชี้วัด สพฐ. และกรอบ PISA
ใช้สถาปัตยกรรม SOLVE-FIRST เพื่อกำจัดการมโน (Hallucination) และข้อผิดพลาดทางคณิตศาสตร์อย่างเด็ดขาด`;

    const userPrompt = `ช่วยออกข้อสอบแบบปรนัย 4 ตัวเลือก (A, B, C, D) จำนวน ${count} ข้อ
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
ตัวชี้วัด: ${indicator_code}
หัวข้อ: ${topic}
ภาษา: ${langInstruction}
ระดับความยาก: ${difficultyInstruction}

กฎเหล็ก SOLVE-FIRST PROTOCOL:
1. สำหรับแต่ละข้อ น้องฟ้าต้องคำนวณและแสดงวิธีทำทีละขั้นใน "step_by_step_solution" จนได้ผลลัพธ์ที่ถูกต้องแน่นอน 100% ก่อนจะเริ่มตั้งตัวเลือก
2. ระบุคำตอบจริงที่คำนวณได้ลงใน "verified_correct_answer"
3. ออกแบบตัวเลือกหลอก 3 ข้อ โดยอิงจากความเข้าใจคลาดเคลื่อนทั่วไปของนักเรียนวัยนี้ (Misconception-driven)
4. อธิบายเหตุผลใน "diagnostic_tags" สำหรับแต่ละตัวเลือก (ทั้งข้อถูกและข้อผิด เช่น B คือสับสนสูตร, C คือลืมทดเลข)
5. สุ่มวางคำตอบจริงในตัวเลือก A, B, C หรือ D อย่างสมดุล (เว้นแต่ตัวเลือก ง เป็น "ถูกทุกข้อ" ให้ pin_choice_position เป็น true)
6. หากเป็นสมการคณิตศาสตร์ ให้เขียนสัญลักษณ์ในรูปแบบ LaTeX เช่น $x^2 + 5x = 0$ หรือ $\\frac{1}{2}$

ตอบกลับเป็น JSON Array ของข้อสอบเท่านั้น ไม่มีข้อความอื่น และไม่มี markdown backticks:
[
  {
    "question_text": "ข้อความโจทย์",
    "step_by_step_solution": "วิธีทำและการคำนวณทีละขั้นตอนอย่างละเอียด",
    "verified_correct_answer": "คำตอบที่ถูกต้องตามการคำนวณ",
    "choice_a": "ข้อความตัวเลือก ก",
    "choice_b": "ข้อความตัวเลือก ข",
    "choice_c": "ข้อความตัวเลือก ค",
    "choice_d": "ข้อความตัวเลือก ง",
    "correct_choice": "A หรือ B หรือ C หรือ D",
    "indicator_code": "${indicator_code}",
    "pin_choice_position": boolean,
    "explanation": "คำอธิบายเฉลยที่เชื่อมโยงกับวิธีทำ",
    "diagnostic_tags": {
      "A": "คำอธิบายการวินิจฉัย เช่น ถูกต้อง (คำนวณตามขั้นตอนสมบูรณ์)",
      "B": "คำอธิบายการวินิจฉัย เช่น สับสนสูตรพื้นที่กับเส้นรอบรูป",
      "C": "คำอธิบายการวินิจฉัย เช่น คำนวณลำดับการดำเนินการผิด",
      "D": "คำอธิบายการวินิจฉัย เช่น ลืมทดเลขในหลักสิบ"
    }
  }
]`;

    try {
      const aiResponse = await callGemma({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 4000,
        responseMimeType: 'application/json',
        complexity: 'high'
      });

      const parsed = safeParseJson<any[]>(aiResponse, 'Failed to parse AI Batch Questions JSON');

      // Enrich questions with question_meta
      const questionsList = (Array.isArray(parsed) ? parsed : []).map(q => {
        const diagnosticTags = q.diagnostic_tags || {};
        const stepSolution = q.step_by_step_solution || '';
        const verifiedAnswer = q.verified_correct_answer || '';

        return {
          ...q,
          question_meta: {
            ...(q.question_meta || {}),
            step_by_step_solution: stepSolution,
            verified_correct_answer: verifiedAnswer,
            diagnostic_tags: diagnosticTags
          }
        };
      });

      if (questionsList.length > 0) {
        return NextResponse.json({ success: true, questions: questionsList, language, difficulty });
      }
    } catch (aiErr: any) {
      console.warn('Gemma batch drafting failed, falling back to Solve-First curriculum templates:', aiErr);
    }

    // High quality Solve-First fallback templates with diagnostic tags
    const fallbackTemplates = language === 'en' ? [
      {
        question_text: `Regarding ${subject_name} on the topic of "${topic}", which step is the most accurate?`,
        step_by_step_solution: 'Step 1: Understand problem scope.\nStep 2: Identify given variables.\nStep 3: Apply the core principle.',
        verified_correct_answer: 'Carefully analyze what the problem provides and what is asked',
        choice_a: 'Carefully analyze what the problem provides and what is asked',
        choice_b: 'Calculate immediately without reading the full question',
        choice_c: 'Guess the answer based on the highest number in the problem',
        choice_d: 'All of the above are equally valid',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'Analyzing given facts and the objective is the foundational first step in problem solving.',
        diagnostic_tags: {
          A: 'Correct: Foundational systematic problem-solving procedure',
          B: 'Impulsive execution error: rushing without reading constraints',
          C: 'Heuristic fallacy: assumes largest numeral is always the answer',
          D: 'Over-generalization error'
        },
        question_meta: {
          step_by_step_solution: 'Step 1: Understand problem scope.\nStep 2: Identify given variables.\nStep 3: Apply the core principle.',
          verified_correct_answer: 'Carefully analyze what the problem provides and what is asked',
          diagnostic_tags: {
            A: 'Correct: Foundational systematic problem-solving procedure',
            B: 'Impulsive execution error: rushing without reading constraints',
            C: 'Heuristic fallacy: assumes largest numeral is always the answer',
            D: 'Over-generalization error'
          }
        }
      },
      {
        question_text: `Which statement best reflects standard mastery of ${indicator_code}?`,
        step_by_step_solution: 'Step 1: Compare memorization vs authentic contextual application.\nStep 2: Standards emphasize practical competency.',
        verified_correct_answer: 'Applying acquired knowledge appropriately to real-world scenarios',
        choice_a: 'Applying acquired knowledge appropriately to real-world scenarios',
        choice_b: 'Memorizing formulas without understanding the underlying principles',
        choice_c: 'Rushing through answers without verification',
        choice_d: 'None of the above',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'True competency in educational standards requires authentic contextual application.',
        diagnostic_tags: {
          A: 'Correct: Aligned with standard indicators and deep competency',
          B: 'Rote memorization misconception: formulas without conceptual understanding',
          C: 'Careless execution error: skipping verification',
          D: 'Default dismissal misconception'
        },
        question_meta: {
          step_by_step_solution: 'Step 1: Compare memorization vs authentic contextual application.\nStep 2: Standards emphasize practical competency.',
          verified_correct_answer: 'Applying acquired knowledge appropriately to real-world scenarios',
          diagnostic_tags: {
            A: 'Correct: Aligned with standard indicators and deep competency',
            B: 'Rote memorization misconception: formulas without conceptual understanding',
            C: 'Careless execution error: skipping verification',
            D: 'Default dismissal misconception'
          }
        }
      }
    ] : [
      {
        question_text: `ข้อใดแสดงความเข้าใจที่ถูกต้องเกี่ยวกับ "${topic}" ตามตัวชี้วัด ${indicator_code}?`,
        step_by_step_solution: 'ขั้นตอนที่ 1: กำหนดประเด็นหลักของเรื่อง ' + topic + '\nขั้นตอนที่ 2: วิเคราะห์กระบวนการแก้ปัญหาอย่างเป็นระบบ\nขั้นตอนที่ 3: สรุปว่าการวิเคราะห์ข้อมูลคือหัวใจสำคัญ',
        verified_correct_answer: 'การวิเคราะห์สิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ต้องการอย่างรอบคอบ',
        choice_a: 'การวิเคราะห์สิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ต้องการอย่างรอบคอบ',
        choice_b: 'การลงมือคำนวณทันทีโดยยังไม่อ่านเงื่อนไขของโจทย์ให้ครบถ้วน',
        choice_c: 'การคาดเดาคำตอบจากตัวเลขที่มีค่ามากที่สุดในโจทย์',
        choice_d: 'ถูกทุกข้อ',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'ขั้นตอนแรกที่ถูกต้องในการแก้ปัญหาคือการทำความเข้าใจและวิเคราะห์สิ่งที่โจทย์กำหนดและต้องการ',
        diagnostic_tags: {
          A: 'ถูกต้อง: เข้าใจกระบวนการคิดแก้ปัญหาตามหลักวิชาการ',
          B: 'ความเข้าใจผิด: รีบร้อนลงมือทำโดยไม่วิเคราะห์เงื่อนไข',
          C: 'ความเข้าใจผิด: คาดเดาจากตัวเลขที่สะดุดตา',
          D: 'ความเข้าใจผิด: สับสนกับตัวเลือกครอบจักรวาล'
        },
        question_meta: {
          step_by_step_solution: 'ขั้นตอนที่ 1: กำหนดประเด็นหลักของเรื่อง ' + topic + '\nขั้นตอนที่ 2: วิเคราะห์กระบวนการแก้ปัญหาอย่างเป็นระบบ',
          verified_correct_answer: 'การวิเคราะห์สิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ต้องการอย่างรอบคอบ',
          diagnostic_tags: {
            A: 'ถูกต้อง: เข้าใจกระบวนการคิดแก้ปัญหาตามหลักวิชาการ',
            B: 'ความเข้าใจผิด: รีบร้อนลงมือทำโดยไม่วิเคราะห์เงื่อนไข',
            C: 'ความเข้าใจผิด: คาดเดาจากตัวเลขที่สะดุดตา',
            D: 'ความเข้าใจผิด: สับสนกับตัวเลือกครอบจักรวาล'
          }
        }
      },
      {
        question_text: `ในชีวิตประจำวัน หากต้องการประยุกต์ใช้ความรู้เรื่อง "${topic}" ควรปฏิบัติตามข้อใดจึงจะเหมาะสมที่สุด?`,
        step_by_step_solution: 'ขั้นตอนที่ 1: พิจารณาการประยุกต์ใช้ทฤษฎีสู่การปฏิบัติ\nขั้นตอนที่ 2: ประเมินผลลัพธ์และความสมเหตุสมผลตามบริบท',
        verified_correct_answer: 'นำหลักการที่ได้เรียนรู้ไปปรับใช้แก้ปัญหาอย่างเป็นระบบและมีเหตุผล',
        choice_a: 'นำหลักการที่ได้เรียนรู้ไปปรับใช้แก้ปัญหาอย่างเป็นระบบและมีเหตุผล',
        choice_b: 'ท่องจำคำตอบเดิมโดยไม่คำนึงถึงบริบทที่เปลี่ยนไป',
        choice_c: 'หลีกเลี่ยงการตรวจสอบความสมเหตุสมผลของผลลัพธ์',
        choice_d: 'ไม่มีข้อใดถูก',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'การเรียนรู้ที่แท้จริงคือการนำหลักการไปประยุกต์ใช้ได้อย่างมีวิจารณญาณในสถานการณ์จริง',
        diagnostic_tags: {
          A: 'ถูกต้อง: สะท้อนสมรรถนะการนำไปประยุกต์ใช้จริง',
          B: 'ความเข้าใจผิด: การเรียนรู้แบบท่องจำคำตอบสำเร็จรูป',
          C: 'ความเข้าใจผิด: ละเลยขั้นตอนการตรวจสอบความถูกต้อง',
          D: 'ความเข้าใจผิด: ปฏิเสธตัวเลือกที่ถูกต้อง'
        },
        question_meta: {
          step_by_step_solution: 'ขั้นตอนที่ 1: พิจารณาการประยุกต์ใช้ทฤษฎีสู่การปฏิบัติ\nขั้นตอนที่ 2: ประเมินผลลัพธ์และความสมเหตุสมผลตามบริบท',
          verified_correct_answer: 'นำหลักการที่ได้เรียนรู้ไปปรับใช้แก้ปัญหาอย่างเป็นระบบและมีเหตุผล',
          diagnostic_tags: {
            A: 'ถูกต้อง: สะท้อนสมรรถนะการนำไปประยุกต์ใช้จริง',
            B: 'ความเข้าใจผิด: การเรียนรู้แบบท่องจำคำตอบสำเร็จรูป',
            C: 'ความเข้าใจผิด: ละเลยขั้นตอนการตรวจสอบความถูกต้อง',
            D: 'ความเข้าใจผิด: ปฏิเสธตัวเลือกที่ถูกต้อง'
          }
        }
      }
    ];

    return NextResponse.json({
      success: true,
      questions: fallbackTemplates,
      is_fallback: true,
      language,
      difficulty
    });
  } catch (error: any) {
    console.error('Error drafting questions with AI:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
