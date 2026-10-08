import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { generateChoicesWithNongFah } from '@/lib/ai/gemma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = await req.json();
    const {
      questionTitle,
      questionHelp,
      fieldType = 'radio',
      existingOptions = [],
      action = 'generate_all',
      optionCount = 4,
      enableSearchGrounding = false,
      examLanguage,
    } = body;

    if (!questionTitle || !String(questionTitle).trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุโจทย์คำถามก่อนให้น้องฟ้าช่วยดำเนินการ' },
        { status: 400 }
      );
    }

    const result = await generateChoicesWithNongFah({
      questionTitle: String(questionTitle).trim(),
      questionHelp: questionHelp ? String(questionHelp).trim() : undefined,
      fieldType,
      existingOptions,
      action,
      optionCount: Number(optionCount) || 4,
      enableSearchGrounding: Boolean(enableSearchGrounding),
      examLanguage,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error('Nong Fah choice generation error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการสร้างตัวเลือกด้วย AI' },
      { status: 500 }
    );
  }
}
