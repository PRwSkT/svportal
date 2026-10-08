import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = await req.json();
    const { responseId, fieldKey, teacherScore, teacherComment } = body;

    if (!responseId || !fieldKey) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน (responseId หรือ fieldKey ขาดหาย)' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const { data: resp, error: fetchErr } = await supabase
      .from('form_responses')
      .select('id, form_id, quiz_score, forms(quiz_settings)')
      .eq('id', responseId)
      .single();

    if (fetchErr || !resp) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลการตอบกลับนี้' },
        { status: 404 }
      );
    }

    const curQuizScore = resp.quiz_score || {
      total_score: 0,
      max_score: 0,
      percentage: 0,
      passed: false,
      time_spent_seconds: 0,
      submitted_at: new Date().toISOString(),
      breakdown: {},
    };

    const breakdown = { ...(curQuizScore.breakdown || {}) };
    const curItem = breakdown[fieldKey] || {
      field_key: fieldKey,
      points_awarded: 0,
      max_points: 1,
      is_correct: false,
      student_answer: null,
    };

    const maxPts = curItem.max_points || 1;
    const validatedScore = Math.min(maxPts, Math.max(0, Number(teacherScore) || 0));

    breakdown[fieldKey] = {
      ...curItem,
      points_awarded: validatedScore,
      teacher_score: validatedScore,
      teacher_comment: teacherComment || curItem.teacher_comment || null,
      is_correct: validatedScore >= maxPts * 0.5,
      graded_by: 'teacher',
    };

    // Recalculate totals
    let newTotalScore = 0;
    let newMaxScore = 0;

    for (const item of Object.values(breakdown) as any[]) {
      newTotalScore += Number(item.points_awarded) || 0;
      newMaxScore += Number(item.max_points) || 0;
    }

    const formQuizSettings = (resp.forms as any)?.quiz_settings;
    const passThreshold = formQuizSettings?.passing_score_percentage ?? 60;
    const newPercentage = newMaxScore > 0 ? Math.round((newTotalScore / newMaxScore) * 100) : 0;
    const newPassed = newPercentage >= passThreshold;

    const updatedQuizScore = {
      ...curQuizScore,
      total_score: Math.round(newTotalScore * 10) / 10,
      max_score: newMaxScore,
      percentage: newPercentage,
      passed: newPassed,
      breakdown,
    };

    const { error: updateErr } = await supabase
      .from('form_responses')
      .update({
        quiz_score: updatedQuizScore,
      })
      .eq('id', responseId);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      quiz_score: updatedQuizScore,
    });
  } catch (err: any) {
    console.error('Score update error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการบันทึกคะแนน' },
      { status: 500 }
    );
  }
}
