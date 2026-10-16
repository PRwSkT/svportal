import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { 
  detectCollisions, 
  findBestTeacherSubstitute, 
  calculateTeacherWorkloads,
  getDayName 
} from '@/lib/academic/timetable-engine';
import { callGemma } from '@/lib/ai/gemma';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();
    const { message = '', history = [], context = {} } = body;
    const trimmedMsg = message.trim();

    if (!trimmedMsg) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุข้อความ' }, { status: 400 });
    }

    const lower = trimmedMsg.toLowerCase();

    // 1. INTENT: ตรวจสอบชั่วโมงชน (COLLISION DETECTION)
    if (lower.includes('ชั่วโมงชน') || lower.includes('ชน') || lower.includes('ตรวจตาราง') || lower.includes('ตรวจสอบข้อขัดแย้ง')) {
      const year = context.academic_year || '2568';
      const term = context.term || '1';

      const { data: slots } = await supabase
        .from('academic_timetables')
        .select(`
          *,
          class:academic_classes(id, name, grade_level),
          course:academic_courses(id, course_code, name_th, subject_group),
          teacher:personnel!academic_timetables_teacher_id_fkey(id, name_th, position_th)
        `)
        .eq('academic_year', year)
        .eq('term', term);

      const collisions = detectCollisions(slots || []);

      if (collisions.length === 0) {
        return NextResponse.json({
          success: true,
          actionType: 'collision_check',
          response: `หนูฟ้าได้ตรวจสอบตารางเรียนตารางสอนทั้งหมด ${(slots || []).length} คาบของปีการศึกษา ${year} ภาคเรียนที่ ${term} เรียบร้อยแล้วค่ะ\n\nผลการตรวจสอบ: ปราศจากชั่วโมงชน 100% (ตรวจพบ 0 ข้อขัดแย้ง)\n- ไม่มีครูท่านใดมีตารางสอนซ้อนกันในคาบเดียวกัน\n- ทุกห้องเรียนมีวิชาลงอย่างถูกต้อง ไม่มีการลงวิชาซ้ำ\n- ห้องพิเศษและห้องปฏิบัติการไม่มีการจองชนกันค่ะ`,
          data: { collisionCount: 0, totalSlots: (slots || []).length },
          suggestions: [
            'วิเคราะห์ภาระงานสอนครู',
            'จัดครูสอนแทนด่วน',
            'ดูสถิติรายวิชา'
          ]
        });
      } else {
        const details = collisions.map((c, i) => `${i + 1}. ${c.description}`).join('\n');
        return NextResponse.json({
          success: true,
          actionType: 'collision_check',
          response: `หนูฟ้าตรวจพบข้อขัดแย้งในตารางสอนจำนวน ${collisions.length} จุดค่ะ:\n\n${details}\n\nคุณครูสามารถใช้โหมดสลับคาบด่วน (Quick Swap) หรือคลิกที่คาบเรียนเพื่อปรับเปลี่ยนครูหรือย้ายคาบได้ทันทีค่ะ`,
          data: { collisionCount: collisions.length, collisions },
          suggestions: [
            'ให้น้องฟ้าร่างตารางใหม่ทั้งหมด',
            'เปิดโหมดสลับคาบด่วน'
          ]
        });
      }
    }

    // 2. INTENT: จัดครูสอนแทน (SUBSTITUTION MATCHING)
    if (lower.includes('สอนแทน') || lower.includes('ครูลา') || lower.includes('ลาป่วย') || lower.includes('ลากิจ')) {
      const { data: allTeachers } = await supabase
        .from('personnel')
        .select('id, name_th, position_th');

      // Check if a teacher's name is mentioned in the message
      const matchedTeacher = (allTeachers || []).find(t => 
        t.name_th && trimmedMsg.includes(t.name_th.replace('นางสาว', '').replace('นาย', '').replace('นาง', '').trim())
      );

      if (!matchedTeacher) {
        return NextResponse.json({
          success: true,
          actionType: 'prompt_teacher_select',
          response: 'หนูฟ้าพร้อมช่วยจัดหาครูสอนแทนด้วยอัลกอริทึม 5 ลำดับขั้นค่ะ เพื่อความแม่นยำ กรุณาเลือกหรือระบุชื่อคุณครูที่ติดภารกิจหรือต้องการลาด้านล่างนี้ได้เลยค่ะ',
          data: { teachers: allTeachers || [] },
          suggestions: (allTeachers || []).slice(0, 4).map(t => `ครู${t.name_th} ลา`)
        });
      }

      // Teacher is identified, find today's slots or target date's slots
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      let dayOfWeek = today.getDay();
      if (dayOfWeek < 1 || dayOfWeek > 5) dayOfWeek = 1; // Default to Monday if weekend

      // Fetch teacher slots on this day
      const { data: teacherSlots } = await supabase
        .from('academic_timetables')
        .select(`
          *,
          class:academic_classes(id, name, grade_level),
          course:academic_courses(id, course_code, name_th, subject_group, grade_level)
        `)
        .eq('teacher_id', matchedTeacher.id)
        .eq('day_of_week', dayOfWeek)
        .eq('academic_year', '2568')
        .eq('term', context.term || '1');

      if (!teacherSlots || teacherSlots.length === 0) {
        return NextResponse.json({
          success: true,
          actionType: 'substitute_none_needed',
          response: `หนูฟ้าตรวจสอบตารางสอนของ ${matchedTeacher.name_th} ในวัน${getDayName(dayOfWeek)} แล้วค่ะ พบว่าในวันนี้คุณครูไม่มีคาบสอนในระบบ จึงไม่จำเป็นต้องจัดครูสอนแทนค่ะ`,
          suggestions: [
            'ตรวจสอบตารางของครูท่านอื่น',
            'ตรวจชั่วโมงชนในตาราง'
          ]
        });
      }

      // Fetch all timetables and competencies
      const { data: allSlots } = await supabase.from('academic_timetables').select('*');
      const { data: competencies } = await supabase.from('academic_teacher_competencies').select('*');
      const { data: recentSubs } = await supabase.from('academic_substitutions').select('*');

      const matches = [];
      for (const slot of teacherSlots) {
        const result = findBestTeacherSubstitute({
          dayOfWeek: slot.day_of_week,
          periodNumber: slot.period_number,
          classId: slot.class_id,
          courseId: slot.course_id,
          courseSubjectGroup: slot.course?.subject_group || 'ทั่วไป',
          courseGradeLevel: slot.course?.grade_level || 'P1',
          originalTeacherId: matchedTeacher.id,
          allTeachers: (allTeachers || []).map(t => ({ id: t.id, name_th: t.name_th })),
          timetables: allSlots || [],
          competencies: competencies || [],
          recentSubstitutions: recentSubs || []
        });

        // Insert proposed record into academic_substitutions
        let insertedId = '';
        if (result.teacherId && result.teacherId !== matchedTeacher.id) {
          try {
            const { data: subRecord } = await supabase
              .from('academic_substitutions')
              .insert({
                date: dateStr,
                period_number: slot.period_number,
                class_id: slot.class_id,
                course_id: slot.course_id,
                original_teacher_id: matchedTeacher.id,
                substitute_teacher_id: result.teacherId,
                reason: 'ลาป่วย/ลากิจ (แจ้งผ่านน้องฟ้า AI)',
                status: 'PROPOSED',
                assigned_by: 'น้องฟ้า AI วิชาการ',
                matching_criteria: `${result.tier}: ${result.reason}`
              })
              .select()
              .single();
            if (subRecord) insertedId = subRecord.id;
          } catch (e) {}
        }

        matches.push({
          substitutionId: insertedId,
          periodNumber: slot.period_number,
          className: slot.class?.name,
          courseName: slot.course?.name_th,
          substituteTeacherId: result.teacherId,
          substituteTeacherName: result.teacherName,
          tierBadge: result.tier === 'TIER_1_SAME_SUBJECT' ? 'ระดับ 1: ครูสายตรงกลุ่มสาระ' :
                     result.tier === 'TIER_2_SAME_GRADE' ? 'ระดับ 2: ครูประจำสายชั้น' :
                     result.tier === 'TIER_3_FAIR_WORKLOAD' ? 'ระดับ 3: เกลี่ยภาระงานสมดุล' : 'ระดับ 4: แผนสำรอง',
          reason: result.reason,
          worksheet: result.readyToTeachWorksheet
        });
      }

      return NextResponse.json({
        success: true,
        actionType: 'substitute_match',
        response: `หนูฟ้าประมวลผลจับคู่ครูสอนแทนให้ ${matchedTeacher.name_th} จำนวน ${matches.length} คาบ ในวัน${getDayName(dayOfWeek)} เรียบร้อยแล้วค่ะ โดยคัดกรองเฉพาะครูที่ไม่มีคาบสอนซ้อน และพิจารณาตามความถนัดกลุ่มสาระเป็นลำดับแรก ดังนี้ค่ะ:`,
        data: {
          originalTeacher: matchedTeacher,
          matches
        },
        suggestions: [
          'อนุมัติการสอนแทนทั้งหมด',
          'ตรวจสอบตารางของครูสอนแทน'
        ]
      });
    }

    // 3. INTENT: สรุปภาระงานครู (TEACHER WORKLOAD)
    if (lower.includes('ภาระงาน') || lower.includes('เพดาน') || lower.includes('ชั่วโมงสอน') || lower.includes('โหลด')) {
      const { data: allSlots } = await supabase.from('academic_timetables').select('*');
      const { data: competencies } = await supabase.from('academic_teacher_competencies').select(`
        *,
        teacher:personnel(name_th, position_th)
      `);

      const workloads = calculateTeacherWorkloads(allSlots || [], competencies || []);
      const summaryList: any[] = [];

      workloads.forEach((w) => {
        const comp = (competencies || []).find(c => c.teacher_id === w.teacherId);
        summaryList.push({
          teacherName: comp?.teacher?.name_th || 'ไม่ระบุ',
          hours: w.totalWeeklyHours,
          maxHours: w.maxWeeklyHours,
          isOverloaded: w.isOverloaded,
          consecutiveWarnings: w.consecutiveWarnings
        });
      });

      summaryList.sort((a, b) => b.hours - a.hours);

      const overloaded = summaryList.filter(s => s.isOverloaded);
      let replyText = `หนูฟ้าสรุปภาระงานสอนของคณะครูประจำสัปดาห์นี้ค่ะ:\n\n- จำนวนครูผู้สอนทั้งหมด: ${summaryList.length} ท่าน\n- ครูที่สอนเกินเพดานชั่วโมง: ${overloaded.length} ท่าน\n\nลำดับชั่วโมงสอนสูงสุด:\n`;
      summaryList.slice(0, 5).forEach((s, idx) => {
        replyText += `${idx + 1}. ${s.teacherName}: ${s.hours}/${s.maxHours} คาบ (${s.isOverloaded ? 'เกินเพดาน' : 'ปกติ'})\n`;
      });

      return NextResponse.json({
        success: true,
        actionType: 'workload_summary',
        response: replyText,
        data: { summaries: summaryList },
        suggestions: [
          'ตรวจชั่วโมงชนในตาราง',
          'จัดครูสอนแทนด่วน'
        ]
      });
    }

    // 4. GENERAL AI CHAT WITH GEMMA (FALLBACK TO KNOWLEDGE BASE)
    const systemPrompt = `คุณคือ "น้องฟ้า" (Nong Fah) ผู้ช่วยปัญญาประดิษฐ์อัจฉริยะฝ่ายวิชาการและระบบบริหารจัดการโรงเรียนสมคิดวิทยา (Somkidvittaya School SV-Portal)
ข้อกำหนดสำคัญสูงสุด:
1. ห้ามใช้ Emoji หรือ Emoticon ใดๆ เด็ดขาด ไม่ว่าจะเป็นรูปภาพหรือสัญลักษณ์อีโมจิทุกชนิด (Strictly ZERO EMOJIS).
2. ตอบเป็นภาษาไทยด้วยน้ำเสียงสุภาพ นุ่มนวล มืออาชีพ ลงท้ายด้วย "ค่ะ" หรือ "นะคะ".
3. ให้คำตอบที่กระชับ ชัดเจน ตรงประเด็น ช่วยเหลือฝ่ายวิชาการและคณะครูได้อย่างแท้จริง.
4. มีความเชี่ยวชาญด้าน: ระบบตารางเรียนตารางสอน, การจัดครูสอนแทน 5 ลำดับขั้น, เกณฑ์การประเมิน ปพ.5, การประเมินปฐมวัย 4 ด้าน, ปฏิทินปฏิบัติงานโรงเรียน, และระเบียบ สช./สพฐ.`;

    try {
      const aiReply = await callGemma({
        systemPrompt,
        userPrompt: trimmedMsg,
        temperature: 0.3,
        maxTokens: 1024
      });

      // Filter out any emojis if AI outputs them by accident
      const cleanReply = aiReply.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

      return NextResponse.json({
        success: true,
        actionType: 'chat',
        response: cleanReply,
        suggestions: [
          'ตรวจสอบชั่วโมงชนในตาราง',
          'จัดครูสอนแทนด่วน',
          'สรุปภาระงานครูผู้สอน'
        ]
      });
    } catch (aiErr: any) {
      // Fallback response if API key is not present or offline
      return NextResponse.json({
        success: true,
        actionType: 'chat',
        response: 'สวัสดีค่ะคุณครู หนูฟ้ายินดีให้บริการค่ะ คุณครูสามารถสั่งการให้หนูฟ้าช่วยจัดครูสอนแทน ตรวจสอบชั่วโมงชน สรุปภาระงานสอน หรือแนะนำเกณฑ์งานวิชาการได้ทันทีค่ะ สามารถพิมพ์คำสั่งที่ต้องการได้เลยนะคะ',
        suggestions: [
          'ตรวจสอบชั่วโมงชนในตาราง',
          'จัดครูสอนแทนด่วน',
          'สรุปภาระงานครูผู้สอน'
        ]
      });
    }
  } catch (error: any) {
    console.error('NongFah academic chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
