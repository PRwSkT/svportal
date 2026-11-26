import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requirePostAssistantAuth } from '@/lib/post-assistant/api-helpers';

export async function GET(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const gradeFilter = (searchParams.get('grade') || '').trim();
    const admin = getAdminClient();

    // Query family.consents where parents explicitly declined PHOTO_PUBLIC_PR
    const { data: optOuts, error } = await admin
      .schema('family')
      .from('consents')
      .select('student_id')
      .eq('purpose_code', 'PHOTO_PUBLIC_PR')
      .eq('is_granted', false)
      .is('revoked_at', null);

    if (error || !Array.isArray(optOuts) || optOuts.length === 0) {
      return NextResponse.json({
        success: true,
        optedOutCount: 0,
        matchedGradeCount: 0,
        matchedClassrooms: [],
        advisory: 'ไม่พบรายชื่อนักเรียนที่ปฏิเสธความยินยอม PHOTO_PUBLIC_PR ในระบบ (โปรดตรวจสอบใบหน้าเด็กในภาพก่อนเผยแพร่ตามปกติ)',
      });
    }

    const studentIds = Array.from(
      new Set((optOuts as Array<{ student_id?: string | null }>).map((o) => String(o.student_id || '')).filter(Boolean))
    );
    let matchedGradeCount = 0;
    let matchedClassrooms: string[] = [];

    if (studentIds.length > 0) {
      const { data: students } = await admin
        .from('students')
        .select('student_id, level_room, grade_level, room')
        .in('student_id', studentIds.slice(0, 500));

      if (Array.isArray(students)) {
        const rooms = new Set<string>();
        for (const st of students as Array<{ level_room?: string; grade_level?: string; room?: string }>) {
          const roomLabel = String(st.level_room || [st.grade_level, st.room].filter(Boolean).join('/') || '').trim();
          if (roomLabel) rooms.add(roomLabel);
          if (gradeFilter && roomLabel.toLowerCase().includes(gradeFilter.toLowerCase())) {
            matchedGradeCount++;
          }
        }
        matchedClassrooms = Array.from(rooms).slice(0, 12);
      }
    }

    const advisory =
      matchedGradeCount > 0
        ? `คำเตือน PDPA: พบนักเรียน ${matchedGradeCount} คนในกลุ่ม "${gradeFilter}" (รวมทั้งโรงเรียน ${studentIds.length} คน) ที่ผู้ปกครองไม่อนุญาตเผยแพร่ภาพสาธารณะ (PHOTO_PUBLIC_PR) โปรดเบลอใบหน้าหรือคัดภาพออกก่อนโพสต์`
        : `คำเตือน PDPA: พบนักเรียน ${studentIds.length} คนในโรงเรียนที่ผู้ปกครองไม่อนุญาต PHOTO_PUBLIC_PR${matchedClassrooms.length ? ` (ห้อง: ${matchedClassrooms.join(', ')})` : ''} โปรดตรวจสอบภาพก่อนเผยแพร่`;

    return NextResponse.json({
      success: true,
      optedOutCount: studentIds.length,
      matchedGradeCount,
      matchedClassrooms,
      advisory,
    });
  } catch {
    return NextResponse.json({
      success: true,
      optedOutCount: 0,
      matchedGradeCount: 0,
      matchedClassrooms: [],
      advisory: 'โปรดตรวจสอบความยินยอม PDPA ของนักเรียนในภาพก่อนเผยแพร่สู่สาธารณะ',
    });
  }
}
