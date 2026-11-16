import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAuthenticatedGuardianId } from '@/lib/parents/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { runOmniscientNongFahAgent, CallerContext } from '@/lib/ai/omniscient-agent';
import { recordTeacherConversation } from '@/lib/ai/collective-memory';

export const dynamic = 'force-dynamic';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    let guardianId: string | null = null;
    if (!user) {
      guardianId = getAuthenticatedGuardianId(req);
    }

    if (!user && !guardianId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบเพื่อใช้งานน้องฟ้า AI' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const message = body?.message?.trim();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุข้อความที่ต้องการคุยกับน้องฟ้า' },
        { status: 400 }
      );
    }

    const history: ChatHistoryItem[] = Array.isArray(body?.history) ? body.history : [];
    const context = body?.context || {};
    const pathname: string = context.pathname || '/';

    const supabase = getAdminClient();
    let caller: CallerContext;

    if (user) {
      const { data: appUser } = await supabase
        .from('app_users')
        .select('full_name, role, assigned_features')
        .eq('id', user.id)
        .maybeSingle();

      caller = {
        isStaff: true,
        userId: user.id,
        userEmail: user.email,
        userName:
          appUser?.full_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'คุณครู',
        role: appUser?.role || 'teacher',
        assignedFeatures: (appUser?.assigned_features as string[]) || [],
      };
    } else {
      // Authenticated Guardian / Parent
      const { data: guardian } = await supabase
        .schema('family')
        .from('guardians')
        .select('id, prefix, first_name, last_name')
        .eq('id', guardianId!)
        .maybeSingle();

      const { data: links } = await supabase
        .schema('family')
        .from('guardian_student_links')
        .select('student_id')
        .eq('guardian_id', guardianId!);

      const allowedStudentIds = (links || []).map((l) => l.student_id);

      caller = {
        isStaff: false,
        userId: guardianId,
        userName: guardian
          ? `${guardian.prefix || 'คุณ'}${guardian.first_name} ${guardian.last_name}`.trim()
          : 'ผู้ปกครอง',
        role: 'parent',
        guardianId,
        allowedStudentIds,
      };
    }

    // Contextual suggestions based on route
    let defaultSuggestions = [
      'น้องฟ้าช่วยงานอะไรได้บ้าง',
      'สรุปสิ่งที่ต้องติดตามวันนี้',
      'ข้อมูลโรงครัวและเมนูอาหารกลางวัน',
    ];

    if (pathname.startsWith('/parents')) {
      defaultSuggestions = [
        'ตรวจสอบค่าเทอมและผ่อนชำระ 5 งวด',
        'เมนูอาหารกลางวันของลูกวันนี้',
        'เช็คยอดเงินในกระเป๋าเงิน (Wallet)',
        'เวลาปล่อยตัวและรถรับส่งนักเรียน',
      ];
    } else if (pathname.includes('/fees') || pathname.includes('/pos/fees')) {
      defaultSuggestions = [
        'โครงสร้างแผนผ่อนชำระ 5 งวด/เทอม',
        'นโยบายค่าปรับล่าช้าและวันผ่อนผัน 5 วัน',
        'ขั้นตอนการขอยกเว้นค่าปรับ (Maker-Checker)',
        'ระบบแยกเล่มใบเสร็จ 01 REC- vs 02 SRV-',
      ];
    } else if (pathname.includes('/nutrition') || pathname.includes('/kitchen')) {
      defaultSuggestions = [
        'ยอดสั่งผลิตอาหารกลางวันประจำวัน',
        'ป้ายถาดอาหารพิเศษ (แพ้อาหาร/ฮาลาล/อาหารอ่อน)',
        'บันทึกใบสำคัญจ่ายวัตถุดิบ COA 52200',
        'เมนูรอบสัปดาห์และเมนูทดแทน',
      ];
    } else if (pathname.includes('/academic')) {
      defaultSuggestions = [
        'วิธีตรวจสอบความพร้อมเล่ม ปพ.5',
        'ขั้นตอนพิมพ์ระเบียน ปพ.1 หรือสมุดพก ปพ.6',
        'สรุปผลการเรียนและ GPAX นักเรียน',
      ];
    }

    const conversationHistory = history.map((h) => ({
      role: h.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: h.content,
    }));

    // Run Omniscient Nong Fah Agent
    const agentResult = await runOmniscientNongFahAgent({
      userPrompt: message,
      caller,
      conversationHistory,
    });

    // Record conversation in background
    recordTeacherConversation({
      userEmail: caller.userEmail || undefined,
      userName: caller.userName || undefined,
      userRole: caller.role,
      pathname,
      userPrompt: message,
      aiResponse: agentResult.answer,
      actionType: agentResult.actionCard?.type || 'chat',
      actionPayload: agentResult.actionCard?.data || null,
    }).catch((err) => console.warn('[RecordTeacherConversation Error]:', err));

    return NextResponse.json({
      success: true,
      answer: agentResult.answer,
      actionCard: agentResult.actionCard || null,
      toolsUsed: agentResult.toolsUsed,
      suggestions: defaultSuggestions,
    });
  } catch (error: any) {
    console.error('Nong Fah Chat API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'เกิดข้อผิดพลาดในการประมวลผลข้อความกับน้องฟ้า',
      },
      { status: 500 }
    );
  }
}
