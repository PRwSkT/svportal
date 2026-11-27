'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bell,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  LayoutDashboard,
  Loader2,
  MapPin,
  Paperclip,
  Send,
  ShieldAlert,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getBangkokDate } from '@/lib/utils';
import {
  computeWorkingDatesInRange,
  deduplicateNotifiedUsers,
  DURATION_LABELS,
  DurationType,
  enumerateCalendarDatesInRange,
  formatLeaveDateRangeTh,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  LeaveStatus,
  LeaveType,
  OrgResponsibilityRole,
  resolveMatchedOrgRoles,
  StaffLeaveRequest,
} from '@/lib/leave/helpers';

interface LeaveSummaryStats {
  pendingCount: number;
  approvedCount: number;
  sickDaysYear: number;
  personalDaysYear: number;
  officialDutyDaysYear: number;
  otherDaysYear: number;
  totalApprovedDaysYear: number;
}

interface ApplicantProfile {
  userId: string;
  fullName: string;
  position: string | null;
  department: string;
}

export default function LeavePortalClient() {
  const { user, isLoading: authLoading } = useAuth();
  const todayBkk = useMemo(() => getBangkokDate(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [requests, setRequests] = useState<StaffLeaveRequest[]>([]);
  const [stats, setStats] = useState<LeaveSummaryStats | null>(null);
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [orgRoles, setOrgRoles] = useState<OrgResponsibilityRole[]>([]);
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({});
  const [canViewDashboard, setCanViewDashboard] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all');

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>('sick');
  const [startDate, setStartDate] = useState<string>(todayBkk);
  const [endDate, setEndDate] = useState<string>(todayBkk);
  const [durationType, setDurationType] = useState<DurationType>('full_day');
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [substituteNote, setSubstituteNote] = useState('');
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const fetchLeaveData = async (filterStatus: 'all' | LeaveStatus = statusFilter) => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({ scope: 'mine', status: filterStatus });
      const res = await fetch(`/api/leave?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'MIGRATION_REQUIRED') {
          setMigrationRequired(true);
          return;
        }
        throw new Error(data.error || 'ไม่สามารถโหลดข้อมูลการลาได้');
      }

      setMigrationRequired(false);
      setRequests(data.requests || []);
      setStats(data.stats || null);
      setProfile(data.applicantProfile || null);
      setOrgRoles(data.orgRoles || []);
      setUserNamesMap(data.userNamesMap || {});
      setCanViewDashboard(Boolean(data.permissions?.canViewDashboard));
    } catch (err: any) {
      toast.error('โหลดข้อมูลไม่สำเร็จ', {
        id: 'leave-load-error',
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchLeaveData(statusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, statusFilter]);

  // Half-day only valid for single-day request
  const isMultiDay = startDate !== endDate;
  useEffect(() => {
    if (isMultiDay && durationType !== 'full_day') {
      setDurationType('full_day');
    }
  }, [isMultiDay, durationType]);

  const previewWorkingDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    const weekdays = computeWorkingDatesInRange(startDate, endDate, new Set());
    if (weekdays.length === 0 && leaveType === 'official_duty') {
      return enumerateCalendarDatesInRange(startDate, endDate).length;
    }
    if (durationType !== 'full_day' && startDate === endDate && weekdays.length > 0) {
      return 0.5;
    }
    return weekdays.length;
  }, [startDate, endDate, durationType, leaveType]);

  // Live routing preview for this user's department & chosen leave type
  const routingPreview = useMemo(() => {
    const dept = profile?.department || 'ทั่วไป';
    const uid = profile?.userId || user?.id || '';

    const submitMatches = resolveMatchedOrgRoles(orgRoles, {
      event: 'submit',
      leaveType,
      applicantDepartment: dept,
      applicantUserId: uid,
    });
    const approveMatches = resolveMatchedOrgRoles(orgRoles, {
      event: 'approve',
      leaveType,
      applicantDepartment: dept,
      applicantUserId: uid,
    });

    const approverRoles = orgRoles.filter((r) => r.can_approve && r.is_active);
    const approveRecipients = deduplicateNotifiedUsers(approveMatches);

    return {
      approvers: approverRoles.flatMap((r) =>
        (r.assigned_user_ids || []).map((id) => ({
          id,
          name: userNamesMap[id] || 'ผู้อำนวยการโรงเรียน',
          title: r.title_th,
        }))
      ),
      submitMatchedCount: submitMatches.length,
      approveMatches,
      approveRecipients,
    };
  }, [orgRoles, profile, user?.id, leaveType, userNamesMap]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const loadingId = toast.loading('กำลังอัปโหลดเอกสารแนบ...');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/leave/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'อัปโหลดไม่สำเร็จ');

      setAttachmentPath(data.path);
      setAttachmentName(data.fileName);
      toast.success('แนบไฟล์เรียบร้อยแล้ว', { id: loadingId });
    } catch (err: any) {
      toast.error('อัปโหลดไฟล์ไม่สำเร็จ', { id: loadingId, description: err.message });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleOpenAttachment = async (path: string) => {
    try {
      const res = await fetch(`/api/leave/upload?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok || !data.signedUrl) throw new Error(data.error || 'ไม่สามารถเปิดไฟล์ได้');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error('เปิดเอกสารไม่สำเร็จ', { description: err.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('กรุณาระบุเหตุผลการลาหรือรายละเอียดไปราชการ');
      return;
    }
    if (leaveType === 'official_duty' && !destination.trim()) {
      toast.error('กรุณาระบุสถานที่ / หน่วยงานสำหรับคำขอไปราชการ');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          duration_type: durationType,
          reason: reason.trim(),
          destination: destination.trim() || null,
          document_ref: documentRef.trim() || null,
          contact_phone: contactPhone.trim() || null,
          substitute_note: substituteNote.trim() || null,
          attachment_path: attachmentPath,
          attachment_name: attachmentName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถส่งคำขอได้');

      toast.success('ส่งคำขอแจ้งลา / ไปราชการเรียบร้อยแล้ว!', {
        description: data.message,
      });

      // Reset form
      setReason('');
      setDestination('');
      setDocumentRef('');
      setSubstituteNote('');
      setAttachmentPath(null);
      setAttachmentName(null);
      setDurationType('full_day');
      await fetchLeaveData(statusFilter);
    } catch (err: any) {
      toast.error('ส่งคำขอไม่สำเร็จ', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch('/api/leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'cancel' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ยกเลิกไม่สำเร็จ');

      toast.success('ยกเลิกคำขอเรียบร้อยแล้ว');
      await fetchLeaveData(statusFilter);
    } catch (err: any) {
      toast.error('ยกเลิกไม่สำเร็จ', { description: err.message });
    } finally {
      setCancellingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-foreground/50">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm font-medium">กำลังตรวจสอบสิทธิ์ผู้ใช้งาน...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/90 backdrop-blur-xl p-6 rounded-3xl border border-foreground/10 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-foreground/55 mb-2">
            <Link
              href="/attendance"
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับหน้าลงเวลาทำงาน</span>
            </Link>
            {profile && (
              <>
                <span>•</span>
                <span className="text-primary font-semibold">
                  สังกัด: {profile.department}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight">
            ระบบแจ้งลา / ไปราชการ (SV-Leave)
          </h1>
          <p className="text-sm text-foreground/65 mt-1">
            ยื่นคำขอลาป่วย ลากิจ หรือไปราชการผ่านระบบ ส่งตรงให้ผู้อำนวยการโรงเรียนอนุมัติ พร้อมแจ้งเตือนผู้เกี่ยวข้องตามโครงสร้างอัตโนมัติ
          </p>
        </div>

        {canViewDashboard && (
          <Link
            href="/admin/leave"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#7B1C3E] hover:bg-[#641531] text-white font-bold text-sm shadow-md shadow-[#7B1C3E]/20 transition-all active:scale-95 shrink-0"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>เปิดแดชบอร์ดอนุมัติ &amp; โครงสร้าง</span>
          </Link>
        )}
      </div>

      {/* Pending Supabase Migration Notice */}
      {migrationRequired && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs leading-relaxed">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm mb-0.5">รอติดตั้งตารางฐานข้อมูลระบบแจ้งลาบน Supabase (ทำครั้งเดียว)</strong>
            กรุณานำไฟล์{' '}
            <code className="px-1.5 py-0.5 rounded bg-amber-500/15 font-mono">
              supabase/migrations/20261126000002_staff_leave_and_org_routing.sql
            </code>{' '}
            ไปกด Run ใน Supabase SQL Editor แล้วรีเฟรชหน้านี้เพื่อเปิดใช้งานการส่งคำขอและประวัติการลาจริง
          </div>
        </div>
      )}

      {/* Personal Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-surface border border-foreground/10 shadow-sm">
          <div className="text-xs font-bold text-foreground/55 mb-1">รอ ผ.อ. อนุมัติ</div>
          <div className="text-2xl font-black text-amber-600 tabular-nums">
            {stats?.pendingCount ?? 0} <span className="text-xs font-semibold text-foreground/50">รายการ</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-foreground/10 shadow-sm">
          <div className="text-xs font-bold text-foreground/55 mb-1">ลาป่วยสะสม (ปีนี้)</div>
          <div className="text-2xl font-black text-rose-600 tabular-nums">
            {stats?.sickDaysYear ?? 0} <span className="text-xs font-semibold text-foreground/50">วัน</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-foreground/10 shadow-sm">
          <div className="text-xs font-bold text-foreground/55 mb-1">ลากิจสะสม (ปีนี้)</div>
          <div className="text-2xl font-black text-amber-700 tabular-nums">
            {stats?.personalDaysYear ?? 0} <span className="text-xs font-semibold text-foreground/50">วัน</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-foreground/10 shadow-sm">
          <div className="text-xs font-bold text-foreground/55 mb-1">ไปราชการ (ปีนี้)</div>
          <div className="text-2xl font-black text-indigo-600 tabular-nums">
            {stats?.officialDutyDaysYear ?? 0} <span className="text-xs font-semibold text-foreground/50">วัน</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Form + History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Submission Form */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-surface p-6 rounded-3xl border border-foreground/10 shadow-xl space-y-5"
        >
          <div className="flex items-center justify-between border-b border-foreground/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-foreground">ยื่นคำขอลา / ไปราชการ</h2>
                <p className="text-[11px] text-foreground/55">
                  ผู้ยื่น: {profile?.fullName || user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Leave Type Pills */}
          <div>
            <label className="block text-xs font-bold text-foreground/70 mb-2">
              ประเภทการลา / ปฏิบัติราชการ
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((typeKey) => {
                const cfg = LEAVE_TYPE_LABELS[typeKey];
                const isSelected = leaveType === typeKey;
                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => setLeaveType(typeKey)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                      isSelected
                        ? `${cfg.pillActiveClass} shadow-md`
                        : 'bg-foreground/[0.03] hover:bg-foreground/[0.07] border-foreground/10 text-foreground/75'
                    }`}
                  >
                    {cfg.shortTh}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground/70 mb-1.5">
                ตั้งแต่วันที่
              </label>
              <input
                type="date"
                value={startDate}
                required
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (endDate < val) setEndDate(val);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-foreground/15 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground/70 mb-1.5">
                ถึงวันที่
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                required
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-foreground/15 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-foreground/70">ช่วงเวลา</label>
              <span className="text-[11px] font-bold text-primary">
                คำนวณวันทำการเบื้องต้น: {previewWorkingDays} วัน
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['full_day', 'half_day_morning', 'half_day_afternoon'] as DurationType[]).map(
                (dur) => {
                  const disabled = isMultiDay && dur !== 'full_day';
                  const active = durationType === dur;
                  return (
                    <button
                      key={dur}
                      type="button"
                      disabled={disabled}
                      onClick={() => setDurationType(dur)}
                      className={`px-2 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                        active
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-foreground/[0.03] border-foreground/10 text-foreground/70 hover:bg-foreground/[0.06]'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {dur === 'full_day'
                        ? 'เต็มวัน'
                        : dur === 'half_day_morning'
                        ? 'ครึ่งเช้า'
                        : 'ครึ่งบ่าย'}
                    </button>
                  );
                }
              )}
            </div>
            {isMultiDay && (
              <p className="text-[10px] text-foreground/50 mt-1">
                * การลาหลายวันระบบกำหนดเป็นแบบเต็มวันอัตโนมัติ (วันหยุดราชการ/เสาร์-อาทิตย์จะถูกหักออกตอนบันทึก)
              </p>
            )}
          </div>

          {/* Conditional Fields for Official Duty */}
          {leaveType === 'official_duty' && (
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <Briefcase className="w-4 h-4" />
                <span>ข้อมูลประกอบการไปราชการ / อบรม</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground/70 mb-1">
                  สถานที่ / หน่วยงานที่ไป <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="เช่น สำนักงานศึกษาธิการจังหวัด / โรงแรม..."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-foreground/15 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground/70 mb-1">
                  เลขที่หนังสือเชิญ / คำสั่ง (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  placeholder="เช่น ศธ 04xxx/1234"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-foreground/15 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-foreground/70 mb-1.5">
              เหตุผล / รายละเอียด <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                leaveType === 'official_duty'
                  ? 'ระบุหัวข้อการประชุม อบรม หรือภารกิจที่ได้รับมอบหมาย...'
                  : 'ระบุเหตุผลการลาอย่างชัดเจน...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-foreground/15 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Handover & Phone */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground/70 mb-1.5">
                โน้ตฝากงาน / แนวทางสอนแทน / ใบงาน (ส่งให้ฝ่ายวิชาการและหัวหน้าแผนก)
              </label>
              <input
                type="text"
                value={substituteNote}
                onChange={(e) => setSubstituteNote(e.target.value)}
                placeholder="เช่น ฝากใบงานวิชาคณิต ป.4 ไว้บนโต๊ะ / ครู...ช่วยดูคาบ 2"
                className="w-full px-3 py-2 rounded-xl bg-background border border-foreground/15 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground/70 mb-1.5">
                เบอร์โทรติดต่อระหว่างลา / ไปราชการ (ถ้ามี)
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
                className="w-full px-3 py-2 rounded-xl bg-background border border-foreground/15 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Attachment Upload */}
          <div>
            <label className="block text-xs font-bold text-foreground/70 mb-1.5">
              เอกสารแนบ (ใบรับรองแพทย์ / หนังสือเชิญ — PDF หรือรูปภาพ ≤ 5 MB)
            </label>
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-foreground/25 hover:border-primary/50 hover:bg-primary/5 text-xs font-semibold text-foreground/75 transition-all">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Upload className="w-4 h-4 text-primary" />
                )}
                <span className="truncate">
                  {attachmentName ? attachmentName : 'เลือกไฟล์แนบ (ถ้ามี)'}
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              {attachmentPath && (
                <button
                  type="button"
                  onClick={() => {
                    setAttachmentPath(null);
                    setAttachmentName(null);
                  }}
                  className="px-2.5 py-2.5 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-bold hover:bg-rose-500/20"
                >
                  ลบ
                </button>
              )}
            </div>
          </div>

          {/* Live Org Routing Preview Box */}
          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/15 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <Bell className="w-4 h-4" />
              <span>เส้นทางอนุมัติและแจ้งเตือนอัตโนมัติ</span>
            </div>
            <div className="text-[11px] text-foreground/75 leading-relaxed space-y-1">
              <div>
                <strong>1. เมื่อกดส่งคำขอ:</strong> ส่งแจ้งเตือนตรงถึง{' '}
                <span className="font-bold text-foreground">
                  {routingPreview.approvers.map((a) => a.name).join(', ') || 'ผู้อำนวยการโรงเรียน'}
                </span>{' '}
                เพื่อพิจารณาอนุมัติ
              </div>
              <div>
                <strong>2. เมื่อ ผ.อ. อนุมัติแล้ว:</strong>{' '}
                {routingPreview.approveMatches.length > 0 ? (
                  <span>
                    แจ้งเตือนไปยัง{' '}
                    {routingPreview.approveMatches.map((m) => m.role.title_th).join(', ')} (
                    {routingPreview.approveRecipients.length} ท่าน)
                  </span>
                ) : (
                  <span className="text-amber-700">ยังไม่มีผู้รับผิดชอบที่ระบุชื่อไว้สำหรับแผนกนี้</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="w-full py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>ส่งคำขอให้ ผ.อ. อนุมัติ</span>
          </button>
        </motion.form>

        {/* Right: My Request History */}
        <div className="lg:col-span-7 bg-surface p-6 rounded-3xl border border-foreground/10 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-foreground/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-foreground">ประวัติคำขอของฉัน</h2>
                <p className="text-[11px] text-foreground/55">
                  ติดตามสถานะอนุมัติจาก ผ.อ. และผลการซิงค์ลงเวลาทำงาน
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-[#7B1C3E] text-white shadow-sm'
                      : 'bg-foreground/5 text-foreground/65 hover:bg-foreground/10'
                  }`}
                >
                  {st === 'all' ? 'ทั้งหมด' : LEAVE_STATUS_LABELS[st].labelTh}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-foreground/45">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs font-medium">กำลังโหลดประวัติการลา...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-foreground/[0.02] border border-dashed border-foreground/15">
              <Info className="w-10 h-10 text-foreground/25 mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground/60">ยังไม่มีรายการแจ้งลา / ไปราชการ</p>
              <p className="text-xs text-foreground/45 mt-1">
                สามารถกรอกแบบฟอร์มด้านซ้ายเพื่อส่งคำขอให้ผู้อำนวยการอนุมัติได้ทันที
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {requests.map((item) => {
                const typeCfg = LEAVE_TYPE_LABELS[item.leave_type];
                const statusCfg = LEAVE_STATUS_LABELS[item.status];
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-foreground/10 bg-background/70 hover:border-foreground/20 transition-all space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-foreground/50">
                          {item.request_code}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${typeCfg.badgeClass}`}
                        >
                          {typeCfg.labelTh}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {formatLeaveDateRangeTh(item.start_date, item.end_date)} ({item.total_days} วัน)
                        </span>
                        <span className="text-[11px] text-foreground/55">
                          • {DURATION_LABELS[item.duration_type]}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.badgeClass}`}
                      >
                        {statusCfg.labelTh}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/80 leading-relaxed">
                      <strong>เหตุผล:</strong> {item.reason}
                    </p>

                    {(item.destination || item.document_ref) && (
                      <div className="flex flex-wrap gap-3 text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-500/5 px-3 py-2 rounded-xl border border-indigo-500/15">
                        {item.destination && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            สถานที่: {item.destination}
                          </span>
                        )}
                        {item.document_ref && (
                          <span>เลขที่หนังสือ: {item.document_ref}</span>
                        )}
                      </div>
                    )}

                    {item.substitute_note && (
                      <div className="text-[11px] text-foreground/70 bg-foreground/[0.03] px-3 py-2 rounded-xl">
                        <strong>ฝากงาน / สอนแทน:</strong> {item.substitute_note}
                      </div>
                    )}

                    {/* Decision / Sync / Attachments Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-foreground/10 text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.attendance_synced && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            ซิงค์เข้าตารางเวลาทำงานแล้ว ({item.attendance_synced_dates?.length || 0} วัน)
                          </span>
                        )}

                        {item.attachment_path && (
                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(item.attachment_path!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/15"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>{item.attachment_name || 'ดูไฟล์แนบ'}</span>
                          </button>
                        )}
                      </div>

                      {item.status === 'pending' && (
                        <button
                          type="button"
                          disabled={cancellingId === item.id}
                          onClick={() => handleCancelRequest(item.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold disabled:opacity-50"
                        >
                          {cancellingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>ยกเลิกคำขอ</span>
                        </button>
                      )}
                    </div>

                    {item.approver_name && (
                      <div className="p-2.5 rounded-xl bg-foreground/[0.03] text-[11px] text-foreground/70 flex flex-wrap items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-primary" />
                        <span>
                          พิจารณาโดย <strong>{item.approver_name}</strong>
                          {item.approver_comment ? ` — "${item.approver_comment}"` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
