import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const { 
      subject_name = 'คณิตศาสตร์', 
      grade_level = 'P3', 
      indicator_code = 'ค 1.1 ป.3/1', 
      topic = 'การบวกและการลบจำนวนนับ',
      count = 5,
      language = 'th', // 'th' | 'en' | 'zh'
      difficulty = 'medium' // 'easy' | 'medium' | 'hard'
    } = body;

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    const langInstruction = 
      language === 'en' ? 'Create the questions, choices, and explanations entirely in English suitable for bilingual/MEP students.' :
      language === 'zh' ? 'Create the questions, choices, and explanations in Chinese (with pinyin or Thai gloss where appropriate).' :
      'สร้างโจทย์ ตัวเลือก และคำอธิบายเป็นภาษาไทยตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน';

    const difficultyInstruction = 
      difficulty === 'hard' ? 'ระดับความยากสูง (เน้นทักษะการคิดวิเคราะห์และการประยุกต์ใช้)' :
      difficulty === 'easy' ? 'ระดับความยากพื้นฐาน (เน้นความจำและความเข้าใจหลักการ)' :
      'ระดับความยากปานกลางตามเกณฑ์มาตรฐานการศึกษาขั้นพื้นฐาน';

    if (geminiKey) {
      const prompt = `คุณคือผู้ช่วยครูด้านวิชาการ โรงเรียนสมคิดวิทยา
ช่วยออกข้อสอบแบบปรนัย (4 ตัวเลือก: A, B, C, D) จำนวน ${count} ข้อ
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
ตัวชี้วัด: ${indicator_code}
หัวข้อ: ${topic}
ภาษา: ${langInstruction}
ระดับความยาก: ${difficultyInstruction}

ข้อกำหนดสำคัญ:
1. ตอบกลับเป็น JSON Array เท่านั้น ไม่มีข้อความอื่นและไม่มี markdown backticks
2. ตัวเลือกต้องมีเหตุมีผล ช้อยส์หลอก (Distractors) ต้องสะท้อนความเข้าใจคลาดเคลื่อนทั่วไปของนักเรียนวัยนี้
3. แต่ละข้อต้องมีฟิลด์:
   - question_text: ข้อความโจทย์
   - choice_a: ข้อความตัวเลือก ก / A
   - choice_b: ข้อความตัวเลือก ข / B
   - choice_c: ข้อความตัวเลือก ค / C
   - choice_d: ข้อความตัวเลือก ง / D
   - correct_choice: "A" หรือ "B" หรือ "C" หรือ "D"
   - indicator_code: "${indicator_code}"
   - pin_choice_position: boolean (ถ้าตัวเลือก ง คือ "ถูกทุกข้อ" หรือ "ไม่มีข้อถูก" หรือ "All of the above" ให้ตั้งค่าเป็น true เพื่อไม่ให้ระบบสลับตำแหน่ง)
   - explanation: คำอธิบายเฉลยสั้นๆ ชี้แจงเหตุผลว่าทำไมตัวเลือกที่ถูกต้องจึงถูก`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.35,
              responseMimeType: 'application/json'
            }
          })
        });

        if (response.ok) {
          const result = await response.json();
          const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            return NextResponse.json({ success: true, questions: parsed, language, difficulty });
          }
        }
      } catch (aiErr) {
        console.warn('Gemini drafting failed, falling back to curriculum templates:', aiErr);
      }
    }

    // High quality fallback templates based on language and subject
    const fallbackTemplates = language === 'en' ? [
      {
        question_text: `Regarding ${subject_name} on the topic of "${topic}", which step is the most accurate?`,
        choice_a: 'Carefully analyze what the problem provides and what is asked',
        choice_b: 'Calculate immediately without reading the full question',
        choice_c: 'Guess the answer based on the highest number in the problem',
        choice_d: 'All of the above are equally valid',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'Analyzing given facts and the objective is the foundational first step in problem solving.'
      },
      {
        question_text: `Which statement best reflects standard mastery of ${indicator_code}?`,
        choice_a: 'Applying acquired knowledge appropriately to real-world scenarios',
        choice_b: 'Memorizing formulas without understanding the underlying principles',
        choice_c: 'Rushing through answers without verification',
        choice_d: 'None of the above',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'Core curriculum standards emphasize practical application over rote memorization.'
      }
    ] : language === 'zh' ? [
      {
        question_text: `关于${subject_name}主题"${topic}"，下列哪一步骤是最正确的？`,
        choice_a: '仔细分析题目条件与问题',
        choice_b: '不读完题目就直接计算',
        choice_c: '直接猜测最大的数值',
        choice_d: '以上皆是',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: '审题与理解已知条件是解决问题的最基础且核心的第一步。'
      },
      {
        question_text: `下列哪项最符合指标 ${indicator_code} 的学习要求？`,
        choice_a: '将所学知识恰当地应用于日常实际生活',
        choice_b: '死记硬背但不理解概念原理',
        choice_c: '忽略推导过程只求答案',
        choice_d: '以上皆非',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: '课程标准强调知识理解与实际运用能力。'
      }
    ] : [
      {
        question_text: `ในการแก้ปัญหาทาง${subject_name} เรื่อง "${topic}" ข้อใดคือขั้นตอนที่ถูกต้องที่สุด?`,
        choice_a: 'วิเคราะห์สิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ถามอย่างรอบคอบ',
        choice_b: 'ลงมือคำนวณทันทีโดยไม่จำเป็นต้องอ่านโจทย์จนจบ',
        choice_c: 'เดาคำตอบจากตัวเลขที่มากที่สุดในโจทย์',
        choice_d: 'ถูกทุกข้อ',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'การวิเคราะห์สิ่งที่โจทย์กำหนดและสิ่งที่โจทย์ถามเป็นก้าวแรกที่สำคัญที่สุด'
      },
      {
        question_text: `ข้อใดสอดคล้องกับการเรียนรู้ตามตัวชี้วัด ${indicator_code} เรื่อง "${topic}" มากที่สุด?`,
        choice_a: 'การประยุกต์ใช้ความรู้และกระบวนการคิดในชีวิตประจำวันอย่างเหมาะสม',
        choice_b: 'การท่องจำสูตรโดยไม่เข้าใจหลักการและที่มา',
        choice_c: 'การละเลยกระบวนการหาคำตอบเพื่อเน้นความเร็วเพียงอย่างเดียว',
        choice_d: 'ไม่มีข้อใดถูก',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'หลักสูตรแกนกลางเน้นการนำความรู้ไปใช้ประโยชน์จริงและการคิดวิเคราะห์'
      }
    ];

    return NextResponse.json({ 
      success: true, 
      questions: fallbackTemplates.slice(0, count),
      language,
      difficulty
    });
  } catch (error: any) {
    console.error('AI draft error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
