import { NextRequest, NextResponse } from 'next/server';
import { chatWithNongFah } from '@/lib/ai/gemma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message?.trim();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุข้อความที่ต้องการคุยกับน้องฟ้า' },
        { status: 400 }
      );
    }

    const history = Array.isArray(body?.history) ? body.history : [];
    const context = body?.context || undefined;

    const chatResponse = await chatWithNongFah(message, history, context);

    return NextResponse.json({
      success: true,
      data: chatResponse,
    });
  } catch (err: any) {
    console.error('Nong Fah Chat error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการสนทนากับน้องฟ้า AI' },
      { status: 500 }
    );
  }
}
