import { NextRequest, NextResponse } from 'next/server';
import { compilePP6Report } from '@/lib/academic/pp6-compiler';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    let studentId = searchParams.get('student_id');

    const supabase = getAdminClient();

    if (!studentId) {
      const { data: defaultStudent } = await supabase
        .from('students')
        .select('id')
        .limit(1)
        .single();

      studentId = defaultStudent?.id || '10053';
    }

    const finalStudentId = String(studentId || '10053');
    const report = await compilePP6Report(finalStudentId, supabase);
    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('Error compiling PP6 report:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const { 
      student_id, 
      action = 'generate_ai_comment', 
      term = '2',
      gpa = 3.85,
      strengths = 'วิทยาศาสตร์และภาษาอังกฤษ'
    } = body;

    if (action === 'generate_ai_comment') {
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

      if (geminiKey) {
        const prompt = `คุณคือน้องฟ้า AI ผู้ช่วยครูประจำชั้น โรงเรียนสมคิดวิทยา
ช่วยร่าง "ข้อคิดเห็นและข้อเสนอแนะของครูประจำชั้น" สำหรับใส่ในสมุดรายงานประจำตัวนักเรียน (ปพ.6) ภาคเรียนที่ ${term}
เกรดเฉลี่ยสะสม: ${gpa}
จุดเด่นของนักเรียน: ${strengths}
โทนเสียง: สุภาพ ทางการ เชิงบวก เสริมพลังใจ และให้แนวทางการพัฒนาต่อยอด 
ความยาว: 2-3 ประโยคกระชับ เหมาะกับพื้นที่ในสมุดพก`;

        try {
          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4 }
            })
          });

          if (aiRes.ok) {
            const data = await aiRes.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) {
              return NextResponse.json({ success: true, comment: text });
            }
          }
        } catch (e) {
          console.warn('Gemini comment generation fallback:', e);
        }
      }

      // Pedagogical template fallback
      const fallbackComment = gpa >= 3.5
        ? 'นักเรียนมีความรับผิดชอบต่อการเรียนดีเยี่ยม มีความกระตือรือร้นในการทำกิจกรรมกลุ่มและแสดงภาวะผู้นำที่เด่นชัด ควรได้รับการส่งเสริมความเป็นเลิศทางวิชาการอย่างต่อเนื่อง'
        : 'นักเรียนมีความตั้งใจและมีพัฒนาการการเรียนรู้ที่ดีขึ้นอย่างสม่ำเสมอ ให้ความร่วมมือกับเพื่อนร่วมชั้นเป็นอย่างดี หากได้รับการทบทวนบทเรียนเพิ่มเติมจะสามารถพัฒนาศักยภาพได้ดียิ่งขึ้น';

      return NextResponse.json({ success: true, comment: fallbackComment });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in PP6 action POST:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
