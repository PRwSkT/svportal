import { NextRequest, NextResponse } from 'next/server';
import { chatWithNongFah } from '@/lib/ai/gemma';
import { sanitizeTextForAI, prepareResponsesForSummarization } from '@/lib/ai/pdpa-sanitizer';
import { getAdminClient } from '@/lib/supabase/admin';
import { getServerUser } from '@/lib/auth';
import { getCollectiveMemoryContext, recordTeacherConversation } from '@/lib/ai/collective-memory';
import { analyzeAndCleanseFormResponses } from '@/lib/forms/data-cleansing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งานน้องฟ้า AI' }, { status: 401 });
    }

    const body = await req.json();
    const message = body?.message?.trim();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุข้อความที่ต้องการคุยกับน้องฟ้า' },
        { status: 400 }
      );
    }

    const history = Array.isArray(body?.history) ? body.history : [];
    const context = body?.context || {};

    // Fetch collective teacher memory for forms
    try {
      context.collectiveMemoryContext = await getCollectiveMemoryContext('forms');
    } catch (memErr) {
      console.warn('[Forms Chat] Collective memory lookup failed:', memErr);
    }

    // If on responses page and formId is provided, enrich context with real sanitized responses data, database sync opportunities, and data cleansing analysis
    if (context.formId && (context.page === 'responses' || !context.responsesSummary)) {
      try {
        const supabase = getAdminClient();
        const [formRes, fieldsRes, responsesRes, studentsRes, cleansingAnalysis] = await Promise.all([
          supabase.from('forms').select('*').eq('id', context.formId).maybeSingle(),
          supabase.from('form_fields').select('*').eq('form_id', context.formId).order('sort_order'),
          supabase.from('form_responses').select('*').eq('form_id', context.formId),
          supabase.from('students').select('*, student_parents(*)').order('id', { ascending: true }),
          analyzeAndCleanseFormResponses(context.formId).catch((err) => {
            console.warn('[Forms Chat] Cleansing analysis failed:', err);
            return null;
          }),
        ]);

        if (formRes.data && fieldsRes.data) {
          const responsesData = responsesRes.data || [];
          const sanitizedPayload = prepareResponsesForSummarization(
            formRes.data,
            fieldsRes.data,
            responsesData
          );
          context.responsesSummary = sanitizedPayload;
          context.formTitle = formRes.data.title?.th || formRes.data.title?.en || context.formTitle;
          context.totalResponses = responsesData.length;

          // Analyze database sync opportunities for student profile updates
          const { analyzeStudentSyncOpportunities } = await import('@/lib/forms/database-sync');
          const syncOpportunities = analyzeStudentSyncOpportunities(
            formRes.data,
            fieldsRes.data,
            responsesData,
            studentsRes.data || []
          );
          context.syncOpportunities = syncOpportunities;
          if (cleansingAnalysis) {
            context.cleansingAnalysis = cleansingAnalysis;
          }
        }
      } catch (enrichErr) {
        console.warn('[NongFah Chat] Could not enrich context with responses data:', enrichErr);
      }
    }

    const { cleanText: sanitizedMessage } = sanitizeTextForAI(message);
    const chatResponse = await chatWithNongFah(sanitizedMessage, history, context);

    // Record conversation asynchronously for Nong Fah to learn from teachers across the school
    recordTeacherConversation({
      userEmail: (user as any)?.email,
      userName: (user as any)?.name || (user as any)?.email?.split('@')[0],
      userRole: (user as any)?.role || 'teacher',
      pathname: context.formId ? `/admin/forms/${context.formId}` : '/admin/forms',
      userPrompt: sanitizedMessage,
      aiResponse: chatResponse.reply,
      actionType: chatResponse.actionType,
      actionPayload:
        chatResponse.actionType === 'data_cleansing'
          ? chatResponse.dataCleansingPayload
          : chatResponse.databaseSyncPayload,
    }).catch((err) => console.warn('[Record Conversation Warning]:', err));

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
