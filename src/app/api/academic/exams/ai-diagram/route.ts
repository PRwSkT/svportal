import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callGemma } from '@/lib/ai/gemma';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Nano Banana (Google Imagen 3 & Gemini AI Visual Assistant)
 * Generates educational line-art diagrams for school exams.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const { 
      prompt, 
      style = 'line_art', // 'line_art' | 'svg_vector'
      subject = 'วิทยาศาสตร์' 
    } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

    // Specialized Exam-Ready Monochrome Line-Art Prompt
    const specializedPrompt = `Clean minimalist black-and-white line art educational diagram, high contrast vector style, pure white background, no grayscale shading, suitable for monochrome laser printer exam paper, clear educational textbook illustration of: ${prompt}. Labeled clearly for primary and secondary school education in ${subject}.`;

    // Attempt 1: Google Imagen 3 (Nano Banana Image Generation)
    if (geminiKey && style === 'line_art') {
      try {
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiKey}`;
        const imagenRes = await fetch(imagenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: specializedPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '4:3',
              outputMimeType: 'image/jpeg'
            }
          })
        });

        if (imagenRes.ok) {
          const data = await imagenRes.json();
          const base64Bytes = data?.predictions?.[0]?.bytesBase64Encoded;
          if (base64Bytes) {
            const dataUrl = `data:image/jpeg;base64,${base64Bytes}`;

            // Optionally upload to Supabase Storage if bucket exists
            try {
              const supabase = getAdminClient();
              const buffer = Buffer.from(base64Bytes, 'base64');
              const filename = `diagram_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
              const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('website-content')
                .upload(`exams/diagrams/${filename}`, buffer, {
                  contentType: 'image/jpeg',
                  upsert: true
                });

              if (!uploadErr && uploadData) {
                const { data: publicUrlData } = supabase.storage
                  .from('website-content')
                  .getPublicUrl(`exams/diagrams/${filename}`);

                return NextResponse.json({
                  success: true,
                  image_url: publicUrlData.publicUrl,
                  source: 'imagen-3'
                });
              }
            } catch (storageErr) {
              console.warn('Supabase storage upload skipped, returning data URI:', storageErr);
            }

            // Return data URL directly for instant client usage
            return NextResponse.json({
              success: true,
              image_url: dataUrl,
              source: 'imagen-3-inline'
            });
          }
        }
      } catch (imagenErr) {
        console.warn('Imagen 3 request error, proceeding to AI SVG Generator:', imagenErr);
      }
    }

    // Attempt 2: AI Vector SVG Generator using Gemma / Gemini
    try {
      const svgSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวาดแผนภาพเวกเตอร์ SVG สำหรับพิมพ์ข้อสอบโรงเรียนสมคิดวิทยา
เขียนโค้ด SVG ที่มีความคมชัดระดับเวกเตอร์ พื้นหลังสีขาว เส้นสีดำคมกริบ พร้อมตัวอักษรภาษาไทยกำกับชัดเจน`;

      const svgUserPrompt = `ช่วยสร้างโค้ด SVG แบบสมบูรณ์ สำหรับแผนภาพข้อสอบหัวข้อ: "${prompt}" ในวิชา "${subject}"
ข้อกำหนดสำคัญ:
1. ตอบกลับเป็นโค้ด <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">...</svg> เท่านั้น
2. ห้ามมี markdown backticks และห้ามมีข้อความอื่นนอกเหนือจากแท็ก <svg>
3. ใช้เส้นสีดำ (#1e293b หรือ #000000) หนา 2-3px พื้นหลังสีขาว (#ffffff)
4. มีป้ายข้อความกำกับ (labels) เป็นภาษาไทยที่อ่านง่าย เหมาะสำหรับข้อสอบ`;

      const svgCode = await callGemma({
        systemPrompt: svgSystemPrompt,
        userPrompt: svgUserPrompt,
        temperature: 0.2,
        maxTokens: 2048,
        complexity: 'high'
      });

      // Extract only the svg tag
      const cleanedSvg = svgCode.includes('<svg') 
        ? svgCode.substring(svgCode.indexOf('<svg'), svgCode.lastIndexOf('</svg>') + 6)
        : svgCode;

      if (cleanedSvg.startsWith('<svg') && cleanedSvg.endsWith('</svg>')) {
        return NextResponse.json({
          success: true,
          diagram_svg: cleanedSvg,
          source: 'ai-vector-svg'
        });
      }
    } catch (svgErr) {
      console.warn('AI SVG generator error:', svgErr);
    }

    // Attempt 3: High-Quality Fallback Educational Diagram
    const fallbackSvg = `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="400" height="240" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="30" y="30" width="340" height="180" fill="#f8fafc" stroke="#334155" stroke-width="2" rx="4"/>
  <circle cx="120" cy="120" r="50" fill="#e2e8f0" stroke="#1e293b" stroke-width="2.5"/>
  <circle cx="280" cy="120" r="50" fill="#e2e8f0" stroke="#1e293b" stroke-width="2.5"/>
  <line x1="170" y1="120" x2="230" y2="120" stroke="#b91c1c" stroke-width="3" stroke-dasharray="4,2"/>
  <text x="200" y="70" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${prompt}</text>
  <text x="120" y="125" font-size="13" font-weight="bold" fill="#334155" text-anchor="middle">องค์ประกอบ A</text>
  <text x="280" y="125" font-size="13" font-weight="bold" fill="#334155" text-anchor="middle">องค์ประกอบ B</text>
  <text x="200" y="195" font-size="11" fill="#64748b" text-anchor="middle">แผนภาพประกอบข้อสอบมาตรฐาน โรงเรียนสมคิดวิทยา</text>
</svg>`;

    return NextResponse.json({
      success: true,
      diagram_svg: fallbackSvg,
      source: 'fallback-educational-svg'
    });
  } catch (error: any) {
    console.error('Error generating AI diagram:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
