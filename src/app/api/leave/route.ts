import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { getBangkokDate } from '@/lib/utils';
import {
  canAccessLeaveDashboard,
  computeEffectiveLeaveDates,
  computeLeaveTotalDays,
  dispatchLeaveNotifications,
  DurationType,
  generateRequestCode,
  getAllOrgRoles,
  getHolidayDatesBetween,
  inferDepartmentFromPosition,
  LeaveType,
  StaffLeaveRequest,
} from '@/lib/leave/workflow';

const VALID_LEAVE_TYPES: LeaveType[] = [
  'sick',
  'personal',
  'official_duty',
  'maternity',
  'ordination',
  'other',
];

const VALID_DURATIONS: DurationType[] = [
  'full_day',
  'half_day_morning',
  'half_day_afternoon',
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getApplicantContext(userId: string, fallbackName?: string | null) {
  const admin = getAdminClient();
  const [{ data: appUser }, { data: personnelRows }] = await Promise.all([
    admin
      .from('app_users')
      .select('id, full_name, role, assigned_features, personnel_id')
      .eq('id', userId)
      .maybeSingle(),
    admin
      .from('personnel')
      .select('id, name_th, position_th, category, user_id')
      .eq('user_id', userId)
      .limit(1),
  ]);

  let personnel = personnelRows?.[0] || null;
  if (!personnel && appUser?.personnel_id) {
    const { data: pById } = await admin
      .from('personnel')
      .select('id, name_th, position_th, category, user_id')
      .eq('id', appUser.personnel_id)
      .maybeSingle();
    personnel = pById || null;
  }

  const applicantName =
    personnel?.name_th || appUser?.full_name || fallbackName || 'บุคลากร';
  const applicantPosition = personnel?.position_th || appUser?.role || null;
  const applicantDepartment = inferDepartmentFromPosition(
    personnel?.position_th,
    personnel?.category || appUser?.role
  );

  return {
    appUser,
    personnel,
    applicantName,
    applicantPosition,
    applicantDepartment,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') === 'dashboard' ? 'dashboard' : 'mine';
    const statusFilter = searchParams.get('status') || 'all';
    const leaveTypeFilter = searchParams.get('leave_type') || 'all';
    const monthFilter = searchParams.get('month') || '';
    const departmentFilter = searchParams.get('department') || 'all';
    const searchFilter = (searchParams.get('search') || '').trim().toLowerCase();

    const admin = getAdminClient();
    const [{ appUser, applicantName, applicantPosition, applicantDepartment }, orgRoles] =
      await Promise.all([
        getApplicantContext(user.id, user.user_metadata?.full_name),
        getAllOrgRoles(),
      ]);

    const permissions = await canAccessLeaveDashboard(
      user.id,
      appUser?.role,
      appUser?.assigned_features as string[] | null,
      user.email
    );

    const todayBangkok = getBangkokDate();
    const currentMonth = todayBangkok.slice(0, 7);
    const currentYear = todayBangkok.slice(0, 4);

    if (scope === 'dashboard') {
      if (!permissions.canViewDashboard) {
        return NextResponse.json(
          { error: 'ไม่มีสิทธิ์เข้าถึงแดชบอร์ดการลาและไปราชการ' },
          { status: 403 }
        );
      }

      const { data: allRows, error } = await admin
        .from('staff_leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const requests = (allRows || []) as StaffLeaveRequest[];

      // Build name lookup for all user_ids referenced in orgRoles
      const orgUserIds = Array.from(
        new Set(orgRoles.flatMap((r) => r.assigned_user_ids || []))
      );
      let userNamesMap: Record<string, string> = {};
      if (orgUserIds.length > 0) {
        const { data: usersData } = await admin
          .from('app_users')
          .select('id, full_name')
          .in('id', orgUserIds);
        for (const u of usersData || []) {
          userNamesMap[u.id] = u.full_name;
        }
      }

      const pendingCount = requests.filter((r) => r.status === 'pending').length;
      const onLeaveToday = requests.filter(
        (r) =>
          r.status === 'approved' &&
          r.start_date <= todayBangkok &&
          r.end_date >= todayBangkok
      );

      const approvedThisMonth = requests.filter(
        (r) =>
          r.status === 'approved' &&
          (r.start_date.startsWith(currentMonth) || r.end_date.startsWith(currentMonth))
      );

      const byTypeThisMonth: Record<LeaveType, number> = {
        sick: 0,
        personal: 0,
        official_duty: 0,
        maternity: 0,
        ordination: 0,
        other: 0,
      };
      const byDepartmentThisMonth: Record<string, number> = {};
      let approvedDaysThisMonth = 0;

      for (const reqItem of approvedThisMonth) {
        byTypeThisMonth[reqItem.leave_type] =
          (byTypeThisMonth[reqItem.leave_type] || 0) + 1;
        byDepartmentThisMonth[reqItem.applicant_department] =
          (byDepartmentThisMonth[reqItem.applicant_department] || 0) +
          Number(reqItem.total_days || 0);
        approvedDaysThisMonth += Number(reqItem.total_days || 0);
      }

      const filtered = requests.filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (leaveTypeFilter !== 'all' && r.leave_type !== leaveTypeFilter) return false;
        if (departmentFilter !== 'all' && r.applicant_department !== departmentFilter) {
          return false;
        }
        if (
          monthFilter &&
          !r.start_date.startsWith(monthFilter) &&
          !r.end_date.startsWith(monthFilter)
        ) {
          return false;
        }
        if (searchFilter) {
          const hay = [
            r.request_code,
            r.applicant_name,
            r.applicant_position || '',
            r.applicant_department,
            r.reason,
            r.destination || '',
            r.document_ref || '',
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(searchFilter)) return false;
        }
        return true;
      });

      return NextResponse.json({
        success: true,
        todayBangkok,
        currentMonth,
        permissions,
        requests: filtered,
        stats: {
          totalRequests: requests.length,
          pendingCount,
          onLeaveTodayCount: onLeaveToday.length,
          onLeaveToday,
          approvedThisMonthCount: approvedThisMonth.length,
          approvedDaysThisMonth,
          byTypeThisMonth,
          byDepartmentThisMonth,
        },
        orgRoles,
        userNamesMap,
      });
    }

    // scope === 'mine'
    const { data: myRows, error: myErr } = await admin
      .from('staff_leave_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (myErr) throw myErr;
    const myRequests = (myRows || []) as StaffLeaveRequest[];

    const orgUserIds = Array.from(
      new Set(orgRoles.flatMap((r) => r.assigned_user_ids || []))
    );
    let userNamesMap: Record<string, string> = {};
    if (orgUserIds.length > 0) {
      const { data: usersData } = await admin
        .from('app_users')
        .select('id, full_name')
        .in('id', orgUserIds);
      for (const u of usersData || []) {
        userNamesMap[u.id] = u.full_name;
      }
    }

    const approvedThisYear = myRequests.filter(
      (r) => r.status === 'approved' && r.start_date.startsWith(currentYear)
    );
    const sumDays = (type?: LeaveType) =>
      approvedThisYear
        .filter((r) => (!type ? true : r.leave_type === type))
        .reduce((acc, r) => acc + Number(r.total_days || 0), 0);

    const filteredMine = myRequests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (leaveTypeFilter !== 'all' && r.leave_type !== leaveTypeFilter) return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      todayBangkok,
      currentMonth,
      permissions,
      applicantProfile: {
        userId: user.id,
        fullName: applicantName,
        position: applicantPosition,
        department: applicantDepartment,
      },
      requests: filteredMine,
      stats: {
        pendingCount: myRequests.filter((r) => r.status === 'pending').length,
        approvedCount: myRequests.filter((r) => r.status === 'approved').length,
        sickDaysYear: sumDays('sick'),
        personalDaysYear: sumDays('personal'),
        officialDutyDaysYear: sumDays('official_duty'),
        otherDaysYear: sumDays('maternity') + sumDays('ordination') + sumDays('other'),
        totalApprovedDaysYear: sumDays(),
      },
      orgRoles: orgRoles.filter((r) => r.is_active),
      userNamesMap,
    });
  } catch (error: any) {
    const msg = String(error?.message || '');
    const isMissingTable =
      error?.code === 'PGRST205' ||
      error?.code === '42P01' ||
      /schema cache|does not exist/i.test(msg);

    if (isMissingTable) {
      return NextResponse.json(
        {
          success: false,
          code: 'MIGRATION_REQUIRED',
          error:
            'ยังไม่ได้รันไฟล์ Migration สร้างตารางระบบลาใน Supabase (supabase/migrations/20261126000002_staff_leave_and_org_routing.sql)',
        },
        { status: 503 }
      );
    }

    console.error('GET /api/leave error:', error);
    return NextResponse.json(
      { success: false, error: msg || 'ไม่สามารถโหลดข้อมูลการลาได้' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const leaveType = body.leave_type as LeaveType;
    const startDate = String(body.start_date || '').slice(0, 10);
    const endDate = String(body.end_date || '').slice(0, 10);
    const durationType = (body.duration_type || 'full_day') as DurationType;
    const reason = String(body.reason || '').trim();
    const destination = body.destination ? String(body.destination).trim() : null;
    const documentRef = body.document_ref ? String(body.document_ref).trim() : null;
    const contactPhone = body.contact_phone ? String(body.contact_phone).trim() : null;
    const substituteNote = body.substitute_note ? String(body.substitute_note).trim() : null;
    const attachmentPath = body.attachment_path ? String(body.attachment_path).trim() : null;
    const attachmentName = body.attachment_name ? String(body.attachment_name).trim() : null;

    if (!VALID_LEAVE_TYPES.includes(leaveType)) {
      return NextResponse.json({ error: 'ประเภทการลา/ราชการไม่ถูกต้อง' }, { status: 400 });
    }
    if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
      return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น' }, { status: 400 });
    }
    if (!VALID_DURATIONS.includes(durationType)) {
      return NextResponse.json({ error: 'ช่วงเวลาที่เลือกไม่ถูกต้อง' }, { status: 400 });
    }
    if (durationType !== 'full_day' && startDate !== endDate) {
      return NextResponse.json(
        { error: 'การลาครึ่งวันสามารถเลือกได้เฉพาะวันที่เริ่มต้นและสิ้นสุดเป็นวันเดียวกัน' },
        { status: 400 }
      );
    }
    if (!reason) {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลการลาหรือรายละเอียดไปราชการ' }, { status: 400 });
    }
    if (leaveType === 'official_duty' && !destination) {
      return NextResponse.json(
        { error: 'กรุณาระบุสถานที่ / หน่วยงานสำหรับคำขอไปราชการ' },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Check overlapping pending / approved requests
    const { data: existingOverlaps, error: overlapErr } = await admin
      .from('staff_leave_requests')
      .select('id, request_code, start_date, end_date, duration_type, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (overlapErr) throw overlapErr;

    const conflicting = (existingOverlaps || []).find((ex) => {
      if (ex.duration_type === 'full_day' || durationType === 'full_day') return true;
      return ex.duration_type === durationType;
    });

    if (conflicting) {
      return NextResponse.json(
        {
          error: `มีคำขอลาช่วงวันที่ซ้ำซ้อนอยู่แล้ว (${conflicting.request_code}: ${conflicting.start_date} ถึง ${conflicting.end_date})`,
        },
        { status: 409 }
      );
    }

    const [holidayDates, context, requestCode] = await Promise.all([
      getHolidayDatesBetween(startDate, endDate),
      getApplicantContext(user.id, user.user_metadata?.full_name),
      generateRequestCode(),
    ]);

    const workingDates = computeEffectiveLeaveDates(
      startDate,
      endDate,
      leaveType,
      holidayDates
    );

    if (workingDates.length === 0) {
      return NextResponse.json(
        { error: 'ช่วงวันที่เลือกตรงกับวันหยุดทั้งหมด ไม่พบวันทำการสำหรับยื่นคำขอลา' },
        { status: 400 }
      );
    }

    const totalDays = computeLeaveTotalDays(
      workingDates,
      durationType,
      leaveType,
      startDate,
      endDate
    );

    const { data: inserted, error: insertErr } = await admin
      .from('staff_leave_requests')
      .insert({
        request_code: requestCode,
        user_id: user.id,
        personnel_id: context.personnel?.id || null,
        applicant_name: context.applicantName,
        applicant_position: context.applicantPosition,
        applicant_department: context.applicantDepartment,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        duration_type: durationType,
        working_dates: workingDates,
        total_days: totalDays,
        reason,
        destination,
        document_ref: documentRef,
        contact_phone: contactPhone,
        substitute_note: substituteNote,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      throw insertErr || new Error('ไม่สามารถบันทึกคำขอได้');
    }

    // Dispatch notifications to Director approver (and any submit-configured roles)
    const sentLogs = await dispatchLeaveNotifications({
      request: inserted as StaffLeaveRequest,
      event: 'submit',
      notifyApplicant: false,
    });

    const { data: finalRow } = await admin
      .from('staff_leave_requests')
      .update({
        notified_recipients: sentLogs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inserted.id)
      .select()
      .single();

    return NextResponse.json(
      {
        success: true,
        request: finalRow || inserted,
        notifiedCount: sentLogs.length,
        message: 'ยื่นคำขอลา/ไปราชการเรียบร้อย และแจ้งเตือนผู้อำนวยการโรงเรียนเพื่อพิจารณาอนุมัติแล้ว',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/leave error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถยื่นคำขอได้' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();

    if (!id || action !== 'cancel') {
      return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: existing, error: fetchErr } = await admin
      .from('staff_leave_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบคำขอที่ต้องการยกเลิก' }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'คุณสามารถยกเลิกได้เฉพาะคำขอของตนเองเท่านั้น' }, { status: 403 });
    }
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'ยกเลิกได้เฉพาะคำขอที่ยังอยู่ในสถานะรออนุมัติเท่านั้น' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await admin
      .from('staff_leave_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      request: updated,
      message: 'ยกเลิกคำขอเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    console.error('PATCH /api/leave error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถยกเลิกคำขอได้' },
      { status: 500 }
    );
  }
}
