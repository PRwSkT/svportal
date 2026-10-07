import { NextRequest, NextResponse } from 'next/server';
import { generateFormWithNongFah } from '@/lib/ai/gemma';
import { getServerUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = await req.json();
    const prompt = body?.prompt?.trim();

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุข้อความคำสั่งหรือรายละเอียดแบบฟอร์มที่ต้องการสร้าง' },
        { status: 400 }
      );
    }

    const generatedForm = await generateFormWithNongFah(prompt);

    return NextResponse.json({
      success: true,
      data: generatedForm,
    });
  } catch (err: any) {
    console.error('Nong Fah Form Generation error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการสร้างแบบฟอร์มด้วย AI' },
      { status: 500 }
    );
  }
}
