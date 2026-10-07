import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { prepareResponsesForSummarization } from '@/lib/ai/pdpa-sanitizer';
import { summarizeResponsesWithNongFah } from '@/lib/ai/gemma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const formId = body?.formId?.trim();

    if (!formId) {
      return NextResponse.json({ success: false, error: 'ไม่พบรหัสแบบฟอร์ม (formId)' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Fetch Form Definition
    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลแบบฟอร์ม' }, { status: 404 });
    }

    // 2. Fetch Form Fields
    const { data: fields, error: fieldsErr } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('sort_order', { ascending: true });

    if (fieldsErr) {
      return NextResponse.json({ success: false, error: 'ไม่สามารถโหลดฟิลด์ของแบบฟอร์มได้' }, { status: 500 });
    }

    // 3. Fetch Form Responses
    const { data: responses, error: respErr } = await supabase
      .from('form_responses')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });

    if (respErr) {
      return NextResponse.json({ success: false, error: 'ไม่สามารถโหลดข้อมูลคำตอบได้' }, { status: 500 });
    }

    const allResponses = responses || [];
    if (allResponses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ยังไม่มีผู้ส่งข้อมูลตอบกลับในแบบฟอร์มนี้ จึงยังไม่สามารถวิเคราะห์ผลสรุปได้',
      });
    }

    // 4. Pass through PDPA Zero-PII Sanitizer & Statistical Aggregator
    const sanitizedPayload = prepareResponsesForSummarization(form, fields || [], allResponses);

    // 5. Invoke Gemma via Nong Fah Summarizer
    const summaryResult = await summarizeResponsesWithNongFah(sanitizedPayload);

    return NextResponse.json({
      success: true,
      data: summaryResult,
      totalResponses: allResponses.length,
    });
  } catch (err: any) {
    console.error('Nong Fah Summarization error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์สรุปผลข้อมูล' },
      { status: 500 }
    );
  }
}
