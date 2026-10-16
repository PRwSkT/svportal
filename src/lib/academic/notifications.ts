import { getAdminClient } from '@/lib/supabase/admin';
import { broadcastPushNotifications } from '@/lib/notifications/webpush';

export interface AcademicNotificationOptions {
  title: string;
  body: string;
  recipientUserId?: string | null;
  recipientRole?: string; // 'teacher' | 'academic staff' | 'executive' | 'admin' | 'all'
  category?: 'academic' | 'urgent' | 'reminder' | 'gradebook';
  actionUrl?: string;
  metadata?: Record<string, any>;
  sendPush?: boolean;
}

/**
 * Universal Academic Notification Dispatcher
 * Inserts in-app notification record and dispatches Web Push to mobile/desktop devices.
 */
export async function sendAcademicNotification(opts: AcademicNotificationOptions): Promise<boolean> {
  try {
    const admin = getAdminClient();
    const {
      title,
      body,
      recipientUserId = null,
      recipientRole = 'all',
      category = 'academic',
      actionUrl = '/academic',
      metadata = {},
      sendPush = true
    } = opts;

    // 1. In-App Notification Record
    const { data: record, error: inAppErr } = await admin
      .from('app_notifications')
      .insert({
        title,
        body,
        recipient_user_id: recipientUserId,
        recipient_role: recipientRole,
        category,
        action_url: actionUrl,
        sent_by: 'nongfah_ai',
        is_read: false,
        metadata
      })
      .select()
      .single();

    if (inAppErr) {
      console.error('[Academic Notification] In-app insert failed:', inAppErr.message);
    }

    // 2. Dispatch Web Push if requested
    if (sendPush) {
      let query = admin.from('user_push_subscriptions').select('*');

      if (recipientUserId) {
        query = query.eq('user_id', recipientUserId);
      } else if (recipientRole && recipientRole !== 'all') {
        query = query.or(`user_role.eq.${recipientRole},user_role.eq.all,user_role.eq.admin`);
      }

      const { data: subscriptions, error: subErr } = await query;

      if (!subErr && subscriptions && subscriptions.length > 0) {
        await broadcastPushNotifications(subscriptions, {
          title,
          body,
          url: actionUrl,
          tag: `svportal-academic-${Date.now()}`,
          data: { category, ...metadata }
        });
      }
    }

    return true;
  } catch (error: any) {
    console.error('[Academic Notification] Error sending notification:', error.message);
    return false;
  }
}

/**
 * Notify Department Head when teacher submits gradebook for review
 */
export async function notifyGradebookSubmitted(params: {
  gradebookId: string;
  courseName: string;
  className: string;
  teacherName: string;
}) {
  const { gradebookId, courseName, className, teacherName } = params;
  return sendAcademicNotification({
    title: `[เล่ม ปพ.5 รอตรวจทาน] (${className})`,
    body: `${teacherName} ได้ส่งผลการเรียนวิชา ${courseName} ห้อง ${className} เรียบร้อยแล้ว กรุณาตรวจสอบสถิติและอนุมัติค่ะ`,
    recipientRole: 'academic staff',
    category: 'academic',
    actionUrl: `/academic/gradebook?gradebook_id=${gradebookId}`,
    metadata: { gradebookId, event: 'GRADEBOOK_SUBMITTED' }
  });
}

/**
 * Notify Director when Department Head approves initial review
 */
export async function notifyGradebookApprovedByHead(params: {
  gradebookId: string;
  courseName: string;
  className: string;
  headName?: string;
  headReviewerName?: string;
}) {
  const { gradebookId, courseName, className, headName, headReviewerName } = params;
  const reviewer = headName || headReviewerName || 'หัวหน้ากลุ่มสาระ';
  return sendAcademicNotification({
    title: `[เล่ม ปพ.5 รอผู้อำนวยการลงนามอนุมัติ] (${className})`,
    body: `${reviewer} ได้ตรวจทานผลการเรียนวิชา ${courseName} ห้อง ${className} แล้ว อยู่ในสถานะพร้อมลงนามอนุมัติขั้นสุดท้าย (Final Lock)`,
    recipientRole: 'executive',
    category: 'academic',
    actionUrl: `/academic?tab=review`,
    metadata: { gradebookId, event: 'HEAD_APPROVED' }
  });
}

/**
 * Notify Teacher when revision is requested by reviewer
 */
export async function notifyGradebookRevisionRequested(params: {
  gradebookId: string;
  teacherUserId?: string | null;
  courseName: string;
  className: string;
  reviewerRoleName: string;
  notes: string;
}) {
  const { gradebookId, teacherUserId, courseName, className, reviewerRoleName, notes } = params;
  return sendAcademicNotification({
    title: `[มีข้อเสนอแนะให้ปรับปรุงเล่ม ปพ.5] (${className})`,
    body: `${reviewerRoleName} ได้ส่งผลการเรียนวิชา ${courseName} ห้อง ${className} กลับมาแก้ไข โน้ต: "${notes}"`,
    recipientUserId: teacherUserId,
    recipientRole: 'teacher',
    category: 'urgent',
    actionUrl: `/academic/gradebook?gradebook_id=${gradebookId}`,
    metadata: { gradebookId, notes, event: 'REVISION_REQUESTED' }
  });
}

/**
 * Notify Teacher when Director officially locks and signs off
 */
export async function notifyGradebookOfficiallyLocked(params: {
  gradebookId: string;
  teacherUserId?: string | null;
  courseName: string;
  className: string;
}) {
  const { gradebookId, teacherUserId, courseName, className } = params;
  return sendAcademicNotification({
    title: `[เล่ม ปพ.5 ได้รับการอนุมัติสมบูรณ์แล้ว] (${className})`,
    body: `ผู้อำนวยการได้ลงนามอนุมัติผลการเรียนวิชา ${courseName} ห้อง ${className} และล็อกข้อมูลถาวรเรียบร้อยแล้วค่ะ`,
    recipientUserId: teacherUserId,
    recipientRole: 'teacher',
    category: 'academic',
    actionUrl: `/academic/gradebook?gradebook_id=${gradebookId}`,
    metadata: { gradebookId, event: 'OFFICIALLY_LOCKED' }
  });
}

/**
 * Notify Substitute Teacher when assigned
 */
export async function notifySubstituteAssigned(params: {
  substituteUserId?: string | null;
  substituteTeacherName: string;
  periodNumber: number;
  className: string;
  courseName: string;
  date: string;
  worksheetInfo?: string | null;
}) {
  const {
    substituteUserId,
    substituteTeacherName,
    periodNumber,
    className,
    courseName,
    date,
    worksheetInfo
  } = params;

  return sendAcademicNotification({
    title: `[มอบหมายสอนแทน] คาบที่ ${periodNumber} (${className})`,
    body: `สวัสดีค่ะ ${substituteTeacherName} คุณได้รับมอบหมายสอนแทนในวิชา ${courseName} ห้อง ${className} วันที่ ${date} (คาบ ${periodNumber}) ${worksheetInfo ? `สื่อ/ใบงาน: ${worksheetInfo}` : ''}`,
    recipientUserId: substituteUserId,
    recipientRole: 'teacher',
    category: 'urgent',
    actionUrl: `/academic/timetable?tab=substitute`,
    metadata: { date, periodNumber, className, event: 'SUBSTITUTE_ASSIGNED' }
  });
}

/**
 * Notify Teacher when student attendance drops to at-risk zone (80% - 85%)
 */
export async function notifyAttendanceAtRisk(params: {
  teacherUserId?: string | null;
  studentName: string;
  className: string;
  courseName: string;
  attendancePercent: number;
}) {
  const { teacherUserId, studentName, className, courseName, attendancePercent } = params;
  return sendAcademicNotification({
    title: `[แจ้งเตือนเวลาเรียนกลุ่มเสี่ยง] ${studentName}`,
    body: `นักเรียน ${studentName} ห้อง ${className} ในวิชา ${courseName} มีเวลาเรียนลดลงแตะ ${attendancePercent.toFixed(1)}% เสี่ยงติด มส. ตามระเบียบ สพฐ. ค่ะ`,
    recipientUserId: teacherUserId,
    recipientRole: 'teacher',
    category: 'urgent',
    actionUrl: `/academic/gradebook`,
    metadata: { studentName, attendancePercent, event: 'ATTENDANCE_WARNING' }
  });
}
