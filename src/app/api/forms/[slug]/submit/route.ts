import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role key is not configured');
  }
  return createClient(url, key);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { answers, attachments, lang = 'th' } = body;

    const supabase = getAdminClient();

    // 1. Fetch form
    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('slug', slug)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ error: 'ไม่พบแบบฟอร์มนี้' }, { status: 404 });
    }

    // 2. Check if published
    if (!form.is_published) {
      return NextResponse.json(
        { error: 'แบบฟอร์มนี้ปิดรับคำตอบอยู่ หรือยังไม่เผยแพร่' },
        { status: 403 }
      );
    }

    // 3. Check time windows
    const now = new Date();
    if (form.starts_at && new Date(form.starts_at) > now) {
      return NextResponse.json(
        { error: 'แบบฟอร์มนี้ยังไม่เปิดรับคำตอบ' },
        { status: 400 }
      );
    }
    if (form.ends_at && new Date(form.ends_at) < now) {
      return NextResponse.json(
        { error: 'แบบฟอร์มนี้สิ้นสุดระยะเวลากรอกข้อมูลแล้ว' },
        { status: 400 }
      );
    }

    // 4. Check max responses
    if (form.max_responses && (form.response_count || 0) >= form.max_responses) {
      return NextResponse.json(
        { error: 'แบบฟอร์มนี้มีผู้ตอบครบตามจำนวนที่กำหนดแล้ว' },
        { status: 400 }
      );
    }

    // 5. Check internal user access
    let respondentId = null;
    let respondentEmail = null;
    const user = await getServerUser();

    if (form.access_type !== 'public') {
      if (!user) {
        return NextResponse.json(
          { error: 'แบบฟอร์มนี้สงวนสิทธิ์เฉพาะบุคลากรโรงเรียนสมคิดวิทยา กรุณาเข้าสู่ระบบ' },
          { status: 401 }
        );
      }
      respondentId = user.id;
      respondentEmail = user.email;
    } else if (user) {
      respondentId = user.id;
      respondentEmail = user.email;
    }

    // Capture IP
    const respondentIp =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      null;

    // 6. Insert response
    const { data: responseData, error: respErr } = await supabase
      .from('form_responses')
      .insert([
        {
          form_id: form.id,
          respondent_id: respondentId,
          respondent_email: respondentEmail,
          respondent_ip: respondentIp,
          submission_lang: lang,
          answers: answers || {},
          attachments: attachments || [],
          submitted_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (respErr) {
      console.error('Response insert error:', respErr);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกคำตอบได้: ' + respErr.message },
        { status: 500 }
      );
    }

    // 7. Increment response count
    await supabase
      .from('forms')
      .update({
        response_count: (form.response_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', form.id);

    return NextResponse.json({
      success: true,
      response_id: responseData.id,
    });
  } catch (error: any) {
    console.error('Submit API error:', error);
    return NextResponse.json(
      { error: error?.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล' },
      { status: 500 }
    );
  }
}
