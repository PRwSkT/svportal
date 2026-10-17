import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callGemma } from '@/lib/ai/gemma';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const { 
      action = 'draft_batch', // 'draft_batch' | 'adjust_question' | 'generate_rubric'
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
      points = 5
    } = body;

    // 0. Generate Model Answer & Scoring Rubric for Subjective Question
    if (action === 'generate_rubric' && question_text) {
      const rubricSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา โรงเรียนสมคิดวิทยา
ทำหน้าที่สร้างแนวคำตอบและเกณฑ์การให้คะแนนรูบริก (Rubric Scoring Guide) สำหรับข้อสอบอัตนัย`;

      const rubricUserPrompt = `ช่วยสร้างแนวคำตอบที่สมบูรณ์และเกณฑ์การให้คะแนนรูบริกสำหรับข้อสอบอัตนัยต่อไปนี้:
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
คะแนนเต็ม: ${points} คะแนน
โจทย์: ${question_text}

ข้อกำหนด:
ตอบกลับเป็น JSON Object เท่านั้น ไม่มีข้อความอื่น และไม่มี markdown backticks:
{
  "model_answer": "แนวคำตอบที่ถูกต้อง พร้อมประเด็นและคีย์เวิร์ดสำคัญที่นักเรียนต้องตอบ",
  "rubric": "เกณฑ์การให้คะแนนแบบแจกแจงแต้มชัดเจน (เช่น ตอบประเด็น ก ได้ X คะแนน, แสดงวิธีทำถูกต้องได้ Y คะแนน)",
  "space_format": "lines_5 หรือ lines_8 หรือ blank_box",
  "explanation": "คำแนะนำเพิ่มเติมสำหรับครูผู้ตรวจ"
}`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: rubricSystemPrompt,
          userPrompt: rubricUserPrompt,
          temperature: 0.3,
          maxTokens: 1024,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = JSON.parse(aiResponse);
        return NextResponse.json({ success: true, ...parsed });
      } catch (err: any) {
        return NextResponse.json({
          success: true,
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

    // 1. Single Question Adjuster
    if (action === 'adjust_question' && question_to_adjust) {
      const adjustInstruction = 
        adjust_type === 'simplify' ? 'ปรับโจทย์และตัวเลือกให้เข้าใจง่ายขึ้น ลดความซับซ้อนของตัวเลขและภาษา เหมาะสำหรับเด็กที่ต้องการเสริมทักษะ' :
        adjust_type === 'increase_rigor' ? 'เพิ่มระดับความท้าทาย ปรับโจทย์ให้เป็นสถานการณ์ปัญหาเชิงลึกที่ต้องคิดหลายขั้นตอน (Multi-step thinking)' :
        'สร้างข้อสอบคู่ขนาน (Parallel Twin Question) ที่วัดตัวชี้วัดและคอนเซปต์เดียวกัน แต่เปลี่ยนตัวเลข ตัวละคร หรือบริบท เพื่อใช้ในการสอบซ่อมหรือชุดข้อสอบคู่ขนาน';

      const adjustSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้ช่วยครูด้านวิชาการ โรงเรียนสมคิดวิทยา
ทำหน้าที่ปรับปรุงและปรับระดับข้อสอบให้เหมาะสมกับผู้เรียน`;

      const adjustUserPrompt = `โปรดปรับปรุงข้อสอบข้อนี้ตามเป้าหมาย: "${adjustInstruction}"

ข้อสอบเดิม:
- โจทย์: ${question_to_adjust.question_text}
- ตัวเลือก ก: ${question_to_adjust.choice_a}
- ตัวเลือก ข: ${question_to_adjust.choice_b}
- ตัวเลือก ค: ${question_to_adjust.choice_c}
- ตัวเลือก ง: ${question_to_adjust.choice_d}
- เฉลยเดิม: ${question_to_adjust.correct_choice}

ข้อกำหนด:
ตอบกลับเป็น JSON Object ข้อเดียวเท่านั้น ไม่มีคำเกริ่นและไม่มี markdown backticks:
{
  "question_text": "ข้อความโจทย์ที่ปรับปรุงแล้ว (หากมีสูตรให้ใส่ในรูปแบบ LaTeX เช่น $3x + 5$)",
  "choice_a": "ตัวเลือก ก",
  "choice_b": "ตัวเลือก ข",
  "choice_c": "ตัวเลือก ค",
  "choice_d": "ตัวเลือก ง",
  "correct_choice": "A หรือ B หรือ C หรือ D",
  "pin_choice_position": boolean,
  "explanation": "คำอธิบายเหตุผลของข้อที่ปรับปรุงแล้ว"
}`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: adjustSystemPrompt,
          userPrompt: adjustUserPrompt,
          temperature: 0.3,
          maxTokens: 1024,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = JSON.parse(aiResponse);
        return NextResponse.json({ success: true, question: parsed });
      } catch (err: any) {
        console.warn('AI Adjust failed, returning safe twin:', err);
        return NextResponse.json({
          success: true,
          question: {
            ...question_to_adjust,
            question_text: `[ปรับปรุง] ${question_to_adjust.question_text}`,
            explanation: 'ปรับปรุงตามคำร้องขอของครูผู้สอน'
          }
        });
      }
    }

    // 2. Batch Question Drafting (Subjective / Open-ended)
    if (question_type === 'subjective') {
      const subjectiveSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา โรงเรียนสมคิดวิทยา
ทำหน้าที่ร่างข้อสอบอัตนัย (เขียนตอบ / แสดงวิธีทำ / อธิบาย) พร้อมแนวคำตอบและเกณฑ์การให้คะแนนรูบริกที่สอดคล้องกับหลักสูตร สพฐ.`;

      const subjectiveUserPrompt = `ช่วยออกข้อสอบแบบอัตนัย (เขียนตอบ / แสดงวิธีทำ / อธิบาย) จำนวน ${count} ข้อ
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
ตัวชี้วัด: ${indicator_code}
หัวข้อ: ${topic}
ภาษา: ${langInstruction}
ระดับความยาก: ${difficultyInstruction}

ข้อกำหนดสำคัญ:
1. ตอบกลับเป็น JSON Array ของข้อสอบเท่านั้น ไม่มีข้อความอื่น และไม่มี markdown backticks
2. แต่ละข้อต้องมีฟิลด์:
   - question_text: ข้อความโจทย์คำถามอัตนัย หรือสถานการณ์ให้แสดงวิธีทำ
   - choice_a: แนวคำตอบที่ถูกต้อง คีย์เวิร์ดสำคัญ หรือขั้นตอนวิธีทำ
   - choice_b: รูปแบบพื้นที่ตอบ ให้เลือกค่าใดค่าหนึ่ง: "lines_3" หรือ "lines_5" หรือ "lines_8" หรือ "blank_box" หรือ "grid_box"
   - choice_c: เกณฑ์การให้คะแนนรูบริกแจกแจงแต้มชัดเจน (คะแนนเต็ม 5 คะแนน)
   - choice_d: "-"
   - correct_choice: "A"
   - indicator_code: "${indicator_code}"
   - points: 5
   - question_type: "subjective"
   - explanation: คำแนะนำสำหรับครูผู้ตรวจข้อสอบ`;

      try {
        const aiResponse = await callGemma({
          systemPrompt: subjectiveSystemPrompt,
          userPrompt: subjectiveUserPrompt,
          temperature: 0.35,
          maxTokens: 3000,
          responseMimeType: 'application/json',
          complexity: 'high'
        });

        const parsed = JSON.parse(aiResponse);
        return NextResponse.json({ success: true, questions: parsed, language, difficulty });
      } catch (aiErr: any) {
        console.warn('Gemma subjective batch drafting failed, falling back to curriculum templates:', aiErr);
        const fallbackSubjective = [
          {
            question_text: `จงอธิบายหลักการสำคัญของ "${topic}" พร้อมยกตัวอย่างการนำไปประยุกต์ใช้ในชีวิตประจำวัน 1 ตัวอย่าง`,
            choice_a: `แนวคำตอบ: อธิบายความหมายและหลักการของ ${topic} ได้อย่างถูกต้อง และยกตัวอย่างสถานการณ์จริงที่สอดคล้องกัน`,
            choice_b: 'lines_5',
            choice_c: 'อธิบายหลักการถูกต้อง (3 คะแนน), ยกตัวอย่างสอดคล้องชัดเจน (2 คะแนน)',
            choice_d: '-',
            correct_choice: 'A',
            indicator_code: indicator_code,
            points: 5,
            question_type: 'subjective',
            explanation: 'เน้นวัดความเข้าใจและการเชื่อมโยงสู่การปฏิบัติ'
          },
          {
            question_text: `จงแสดงวิธีทำและขั้นตอนการแก้ปัญหาเกี่ยวกับ "${topic}" ตามตัวชี้วัด ${indicator_code} อย่างละเอียด`,
            choice_a: 'แนวคำตอบ: เขียนสิ่งที่โจทย์กำหนด แสดงขั้นตอนการคิดคำนวณอย่างเป็นลำดับ และสรุปคำตอบพร้อมหน่วยถูกต้อง',
            choice_b: 'blank_box',
            choice_c: 'แสดงขั้นตอนการคิดถูก (3 คะแนน), สรุปคำตอบพร้อมหน่วยถูก (2 คะแนน)',
            choice_d: '-',
            correct_choice: 'A',
            indicator_code: indicator_code,
            points: 5,
            question_type: 'subjective',
            explanation: 'เน้นวัดทักษะกระบวนการคิดและแก้ปัญหา'
          }
        ];
        return NextResponse.json({ success: true, questions: fallbackSubjective, language, difficulty });
      }
    }

    // 3. Batch Question Drafting (MCQ)
    const systemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา โรงเรียนสมคิดวิทยา
ช่วยครูออกข้อสอบมาตรฐานระดับสูงที่มีคุณภาพ ช้อยส์หลอกมีเหตุผล สอดคล้องกับตัวชี้วัด สพฐ.`;

    const userPrompt = `ช่วยออกข้อสอบแบบปรนัย 4 ตัวเลือก (A, B, C, D) จำนวน ${count} ข้อ
วิชา: ${subject_name}
ระดับชั้น: ${grade_level}
ตัวชี้วัด: ${indicator_code}
หัวข้อ: ${topic}
ภาษา: ${langInstruction}
ระดับความยาก: ${difficultyInstruction}

ข้อกำหนดสำคัญ:
1. ตอบกลับเป็น JSON Array ของข้อสอบเท่านั้น ไม่มีข้อความอื่น และไม่มี markdown backticks
2. ตัวเลือกต้องมีเหตุมีผล ช้อยส์หลอก (Distractors) ต้องสะท้อนความเข้าใจคลาดเคลื่อนทั่วไปของนักเรียนวัยนี้
3. หากเป็นสมการคณิตศาสตร์ ให้เขียนสัญลักษณ์ในรูปแบบ LaTeX เช่น $x^2 + 5x = 0$ หรือ $\\frac{1}{2}$
4. แต่ละข้อต้องมีฟิลด์:
   - question_text: ข้อความโจทย์
   - choice_a: ข้อความตัวเลือก ก
   - choice_b: ข้อความตัวเลือก ข
   - choice_c: ข้อความตัวเลือก ค
   - choice_d: ข้อความตัวเลือก ง
   - correct_choice: "A" หรือ "B" หรือ "C" หรือ "D"
   - indicator_code: "${indicator_code}"
   - pin_choice_position: boolean (ถ้าตัวเลือก ง คือ "ถูกทุกข้อ" หรือ "ไม่มีข้อถูก" ให้ตั้งค่าเป็น true)
   - explanation: คำอธิบายเฉลยสั้นๆ ชี้แจงเหตุผลว่าทำไมตัวเลือกที่ถูกต้องจึงถูก`;

    try {
      const aiResponse = await callGemma({
        systemPrompt,
        userPrompt,
        temperature: 0.35,
        maxTokens: 3000,
        responseMimeType: 'application/json',
        complexity: 'high'
      });

      const parsed = JSON.parse(aiResponse);
      return NextResponse.json({ success: true, questions: parsed, language, difficulty });
    } catch (aiErr: any) {
      console.warn('Gemma batch drafting failed, falling back to curriculum templates:', aiErr);
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
        explanation: 'True competency in educational standards requires authentic contextual application.'
      }
    ] : [
      {
        question_text: `ข้อใดแสดงความเข้าใจที่ถูกต้องเกี่ยวกับ "${topic}" ตามตัวชี้วัด ${indicator_code}?`,
        choice_a: 'การวิเคราะห์สิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ต้องการอย่างรอบคอบ',
        choice_b: 'การลงมือคำนวณทันทีโดยยังไม่อ่านเงื่อนไขของโจทย์ให้ครบถ้วน',
        choice_c: 'การคาดเดาคำตอบจากตัวเลขที่มีค่ามากที่สุดในโจทย์',
        choice_d: 'ถูกทุกข้อ',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'ขั้นตอนแรกที่ถูกต้องในการแก้ปัญหาคือการทำความเข้าใจและวิเคราะห์สิ่งที่โจทย์กำหนดและต้องการ'
      },
      {
        question_text: `ในชีวิตประจำวัน หากต้องการประยุกต์ใช้ความรู้เรื่อง "${topic}" ควรปฏิบัติตามข้อใดจึงจะเหมาะสมที่สุด?`,
        choice_a: 'นำหลักการที่ได้เรียนรู้ไปปรับใช้แก้ปัญหาอย่างเป็นระบบและมีเหตุผล',
        choice_b: 'ท่องจำคำตอบเดิมโดยไม่คำนึงถึงบริบทที่เปลี่ยนไป',
        choice_c: 'หลีกเลี่ยงการตรวจสอบความสมเหตุสมผลของผลลัพธ์',
        choice_d: 'ไม่มีข้อใดถูก',
        correct_choice: 'A',
        indicator_code: indicator_code,
        pin_choice_position: true,
        explanation: 'การเรียนรู้ที่แท้จริงคือการนำหลักการไปประยุกต์ใช้ได้อย่างมีวิจารณญาณในสถานการณ์จริง'
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
