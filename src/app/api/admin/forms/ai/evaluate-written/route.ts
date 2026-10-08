import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { evaluateWrittenAnswerWithNongFah } from '@/lib/ai/gemma';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = await req.json();
    const {
      responseId,
      fieldKey,
      questionTitle,
      questionHelp,
      studentAnswer,
      gradingRubric,
      sampleAnswers,
      maxPoints = 1,
      enableSearchGrounding = false,
    } = body;

    if (!questionTitle) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุโจทย์คำถาม' },
        { status: 400 }
      );
    }

    // Call Nong Fah AI to evaluate and suggest score
    const evaluation = await evaluateWrittenAnswerWithNongFah({
      questionTitle,
      questionHelp,
      studentAnswer: studentAnswer || '',
      gradingRubric: gradingRubric || null,
      sampleAnswers: Array.isArray(sampleAnswers) ? sampleAnswers : null,
      maxPoints: Number(maxPoints) || 1,
      enableSearchGrounding: Boolean(enableSearchGrounding),
    });

    // If responseId & fieldKey provided, persist AI evaluation in database
    if (responseId && fieldKey) {
      try {
        const supabase = getAdminClient();
        const { data: resp } = await supabase
          .from('form_responses')
          .select('quiz_score')
          .eq('id', responseId)
          .single();

        if (resp && resp.quiz_score && resp.quiz_score.breakdown) {
          const breakdown = { ...resp.quiz_score.breakdown };
          const curItem = breakdown[fieldKey] || {
            field_key: fieldKey,
            points_awarded: 0,
            max_points: Number(maxPoints) || 1,
            is_correct: false,
            student_answer: studentAnswer,
          };

          breakdown[fieldKey] = {
            ...curItem,
            ai_evaluation: {
              suggested_points: evaluation.suggested_points,
              max_points: evaluation.max_points,
              feedback: evaluation.feedback,
              key_points_covered: evaluation.key_points_covered,
              key_points_missed: evaluation.key_points_missed,
              evaluated_at: new Date().toISOString(),
            },
          };

          await supabase
            .from('form_responses')
            .update({
              quiz_score: {
                ...resp.quiz_score,
                breakdown,
              },
            })
            .eq('id', responseId);
        }
      } catch (dbErr) {
        console.warn('Failed to persist AI evaluation to response record:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (err: any) {
    console.error('Nong Fah written evaluation error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการประเมินคำตอบด้วย AI' },
      { status: 500 }
    );
  }
}
