import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { analyzeAndCleanseFormResponses, executeCleanseFormResponses } from '@/lib/forms/data-cleansing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/forms/cleanse-responses?formId=...
 * วิเคราะห์และแสดงพรีวิวการ Cleanse ข้อมูลในผลการตอบกลับ
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const formId = searchParams.get('formId');

    if (!formId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ formId' },
        { status: 400 }
      );
    }

    const analysis = await analyzeAndCleanseFormResponses(formId);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (err: any) {
    console.error('[Cleanse Responses GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์ข้อมูล' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/forms/cleanse-responses
 * ดำเนินการทำความสะอาดและปรับฟอร์แมตข้อมูลในตาราง form_responses
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { formId, items } = body;

    if (!formId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ formId' },
        { status: 400 }
      );
    }

    let itemsToCleanse = items;
    // If no items explicitly passed, analyze and clean all eligible
    if (!itemsToCleanse || !Array.isArray(itemsToCleanse) || itemsToCleanse.length === 0) {
      const analysis = await analyzeAndCleanseFormResponses(formId);
      itemsToCleanse = analysis.items
        .filter(i => i.changes.length > 0)
        .map(i => ({ responseId: i.responseId, cleanedAnswers: i.cleanedAnswers }));
    }

    if (itemsToCleanse.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'ไม่มีรายการที่ต้องทำความสะอาด ข้อมูลทุกรายการถูกต้องตามมาตรฐานแล้ว',
        totalSuccess: 0,
      });
    }

    const result = await executeCleanseFormResponses(formId, itemsToCleanse);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Cleanse Responses POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' },
      { status: 500 }
    );
  }
}
