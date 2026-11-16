import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callGemma, safeParseJson } from '@/lib/ai/gemma';
import { getAdminClient } from '@/lib/supabase/admin';
import { sanitizeSvg } from '@/lib/academic/security-sanitizer';

/**
 * Nano Banana & Nong Fah AI Visual Co-Pilot
 * Generates educational monochrome line-art and editable vector diagrams for school exams.
 * Embeds <!-- sv-diagram-meta: [...] --> so teachers can edit shapes, lines, and labels
 * directly in the InStudioDiagramBuilder visual builder.
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

    // Specialized Exam-Ready Monochrome Line-Art Prompt (High Contrast for Laser Printers)
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

    // Attempt 2: AI Vector SVG Generator with InStudioDiagramBuilder Metadata Co-Generation
    try {
      const svgSystemPrompt = `คุณคือน้องฟ้า (Nong Fah) ผู้เชี่ยวชาญด้านการวาดแผนภาพเวกเตอร์สำหรับการพิมพ์ข้อสอบ โรงเรียนสมคิดวิทยา
ทำหน้าที่สร้างแผนภาพเวกเตอร์ SVG คุณภาพสูง พร้อมแยก Vector Elements ที่สอดคล้องกับ InStudioDiagramBuilder เพื่อให้ครูผู้สอนสามารถเปิดแก้ไขรูปทรง องศา และข้อความในสตูดิโอได้อย่างอิสระ`;

      const svgUserPrompt = `ช่วยสร้างโค้ด SVG และโครงสร้าง Vector Elements สำหรับหัวข้อ: "${prompt}" ในรายวิชา "${subject}"
ข้อกำหนดสำคัญ:
1. ตอบกลับเป็น JSON Object เท่านั้น ไม่มีข้อความอื่น และไม่มี markdown backticks:
{
  "diagram_svg": "<svg viewBox=\"0 0 400 240\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
  "elements": [
    {
      "id": "el-1",
      "type": "rect" | "circle" | "triangle" | "right_triangle" | "line" | "arrow" | "angle_arc" | "text_label" | "speech_bubble",
      "x": 40,
      "y": 30,
      "width": 120,
      "height": 80,
      "rotation": 0,
      "stroke": "#0f172a",
      "strokeWidth": 2,
      "fill": "#ffffff",
      "text": "ข้อความป้ายกำกับภาษาไทย"
    }
  ]
}
2. ลายเส้นสีดำหรือสีเข้ม (#0f172a, #1e293b) พื้นหลังสีขาว (#ffffff) คมชัด เหมาะสำหรับพิมพ์ข้อสอบ
3. ป้ายข้อความกำกับ (labels) เป็นภาษาไทยที่อ่านง่าย ถูกต้องตามหลักวิชาการ`;

      const aiResponse = await callGemma({
        systemPrompt: svgSystemPrompt,
        userPrompt: svgUserPrompt,
        temperature: 0.25,
        maxTokens: 2500,
        responseMimeType: 'application/json',
        complexity: 'high'
      });

      let parsed: { diagram_svg?: string; elements?: any[] } = {};
      try {
        parsed = safeParseJson<{ diagram_svg?: string; elements?: any[] }>(
          aiResponse,
          'Failed to parse AI SVG JSON'
        );
      } catch {
        // Fallback: extract raw svg tag if JSON wrapped incorrectly
        if (aiResponse.includes('<svg') && aiResponse.includes('</svg>')) {
          const rawSvg = aiResponse.substring(
            aiResponse.indexOf('<svg'),
            aiResponse.lastIndexOf('</svg>') + 6
          );
          parsed = { diagram_svg: rawSvg, elements: [] };
        }
      }

      if (parsed?.diagram_svg && parsed.diagram_svg.includes('<svg') && parsed.diagram_svg.includes('</svg>')) {
        let svgCode = parsed.diagram_svg;

        // Ensure elements array exists
        const elementsList = Array.isArray(parsed.elements) && parsed.elements.length > 0
          ? parsed.elements
          : [
              {
                id: `el-base-${Date.now()}`,
                type: 'rect',
                x: 20,
                y: 20,
                width: 360,
                height: 200,
                rotation: 0,
                stroke: '#1e293b',
                strokeWidth: 2,
                fill: '#ffffff',
                text: prompt
              }
            ];

        // Embed <!-- sv-diagram-meta: [...] --> if not already present
        if (!svgCode.includes('<!-- sv-diagram-meta:')) {
          const metaComment = `<!-- sv-diagram-meta: ${JSON.stringify(elementsList)} -->`;
          svgCode = svgCode.replace(/(<svg\b[^>]*>)/i, `$1\n  ${metaComment}\n`);
        }

        // Sanitize the SVG using security-sanitizer (removes script, foreignObject, event handlers, etc.)
        const sanitizedSvg = sanitizeSvg(svgCode);

        return NextResponse.json({
          success: true,
          diagram_svg: sanitizedSvg,
          source: 'ai-vector-svg',
          elements_count: elementsList.length
        });
      }
    } catch (svgErr) {
      console.warn('AI SVG generator error:', svgErr);
    }

    // Attempt 3: High-Quality Fallback Educational Diagram with Embedded Editable Metadata
    const fallbackElements = [
      {
        id: 'el-box-border',
        type: 'rounded_rect',
        x: 30,
        y: 30,
        width: 340,
        height: 180,
        rotation: 0,
        stroke: '#334155',
        strokeWidth: 2,
        fill: '#f8fafc',
        fillOpacity: 1,
        rx: 4
      },
      {
        id: 'el-circ-left',
        type: 'circle',
        x: 70,
        y: 70,
        width: 100,
        height: 100,
        rotation: 0,
        stroke: '#1e293b',
        strokeWidth: 2.5,
        fill: '#e2e8f0',
        text: 'องค์ประกอบ A'
      },
      {
        id: 'el-circ-right',
        type: 'circle',
        x: 230,
        y: 70,
        width: 100,
        height: 100,
        rotation: 0,
        stroke: '#1e293b',
        strokeWidth: 2.5,
        fill: '#e2e8f0',
        text: 'องค์ประกอบ B'
      },
      {
        id: 'el-arrow-link',
        type: 'arrow',
        x: 170,
        y: 120,
        width: 60,
        height: 1,
        rotation: 0,
        stroke: '#b91c1c',
        strokeWidth: 3,
        strokeDasharray: '4,2',
        fill: 'none',
        extraProps: { x1: 170, y1: 120, x2: 230, y2: 120, endCap: 'arrow' }
      },
      {
        id: 'el-text-title',
        type: 'text_label',
        x: 60,
        y: 55,
        width: 280,
        height: 25,
        rotation: 0,
        stroke: '#0f172a',
        strokeWidth: 1,
        fill: 'none',
        text: prompt,
        fontSize: 14,
        fontWeight: 'bold'
      }
    ];

    const fallbackMeta = `<!-- sv-diagram-meta: ${JSON.stringify(fallbackElements)} -->`;
    const rawFallbackSvg = `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  ${fallbackMeta}
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

    const sanitizedFallbackSvg = sanitizeSvg(rawFallbackSvg);

    return NextResponse.json({
      success: true,
      diagram_svg: sanitizedFallbackSvg,
      source: 'fallback-educational-svg',
      elements_count: fallbackElements.length
    });
  } catch (error: any) {
    console.error('Error generating AI diagram:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
