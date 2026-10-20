'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Users,
  FileText,
  Smartphone,
  Bus,
  School,
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Baby,
  BellRing,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPipelineState,
  PIPELINE_EVENT_NAME,
  recordStudentAttendance,
  reviewLeaveRequest,
} from '@/lib/pipeline/bidirectional-store';
import {
  AttendanceStatus,
  BidirectionalPipelineState,
} from '@/types/family-pipeline';

export default function StudentAttendance360Page() {
  const { isThai } = useLanguage();
  const [pipeline, setPipeline] = useState<BidirectionalPipelineState>(() =>
    getPipelineState()
  );
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave_queue'>(
    'attendance'
  );
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [reconciledIds, setReconciledIds] = useState<string[]>([]);

  const syncPipeline = useCallback(() => {
    setPipeline({ ...getPipelineState() });
  }, []);

  useEffect(() => {
    syncPipeline();
    const handleUpdate = () => syncPipeline();
    window.addEventListener(PIPELINE_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(PIPELINE_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [syncPipeline]);

  const logs = pipeline.attendance_logs;
  const filteredLogs =
    selectedGrade === 'ALL'
      ? logs
      : logs.filter((l) => l.grade_level === selectedGrade);

  const presentCount = logs.filter((l) => l.status === 'PRESENT').length;
  const lateCount = logs.filter((l) => l.status === 'LATE').length;
  const leaveCount = logs.filter(
    (l) =>
      l.status === 'SICK_LEAVE' ||
      l.status === 'PERSONAL_LEAVE' ||
      l.status === 'EARLY_PICKUP'
  ).length;
  const absentCount = logs.filter((l) => l.status === 'ABSENT').length;

  const pendingLeaves = pipeline.leave_requests.filter(
    (r) => r.status === 'PENDING'
  );

  // Detect students who tapped at NFC Gate or School Van but haven't been confirmed in classroom homeroom
  const unreconciledGateStudents = logs.filter(
    (l) =>
      (l.source === 'NFC_GATE' || l.source === 'VAN_SYNC') &&
      (l.status === 'PRESENT' || l.status === 'LATE') &&
      !reconciledIds.includes(l.student_id)
  );

  const handleSetStatus = (
    studentId: string,
    studentName: string,
    status: AttendanceStatus,
    source: 'TEACHER_APP' | 'NFC_GATE' = 'TEACHER_APP'
  ) => {
    const nowTime =
      new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' น.';
    recordStudentAttendance({
      student_id: studentId,
      status,
      check_in_time:
        status === 'PRESENT' || status === 'LATE' ? nowTime : null,
      source,
      recorded_by:
        source === 'NFC_GATE'
          ? 'เครื่องสแกนบัตร NFC ประตูหน้าโรงเรียน'
          : 'ครูประจำชั้น (SV-Portal)',
      notes:
        source === 'NFC_GATE'
          ? `จำลองแตะบัตร NFC หน้าโรงเรียน เวลา ${nowTime}`
          : `ครูประจำชั้นบันทึกสถานะ ${status}`,
    });
    if (source === 'TEACHER_APP') {
      setReconciledIds((prev) =>
        prev.includes(studentId) ? prev : [...prev, studentId]
      );
    }
    syncPipeline();
    toast.success(
      isThai
        ? `อัปเดตสถานะ ${studentName} เป็น ${status} (ซิงค์ไปยัง Parents Portal ทันที)`
        : `Updated ${studentName} attendance to ${status}`
    );
  };

  const handleReviewLeave = (
    leaveId: string,
    studentName: string,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    reviewLeaveRequest({
      leave_id: leaveId,
      status,
      reviewed_by: 'ครูประจำชั้น (อนุมัติผ่านศูนย์เช็กชื่อ 360°)',
      review_note:
        status === 'APPROVED'
          ? 'ครูประจำชั้นอนุมัติใบลาและซิงค์สถานะเข้าสมุดเช็กชื่อรายวันเรียบร้อยแล้วครับ/ค่ะ'
          : 'ไม่อนุมัติ กรุณาติดต่อครูประจำชั้นเพิ่มเติม',
    });
    syncPipeline();
    if (status === 'APPROVED') {
      toast.success(
        isThai
          ? `อนุมัติใบลาของ ${studentName} เรียบร้อยแล้ว! ระบบซิงค์สถานะเช็กชื่อและแจ้งเตือนผู้ปกครองทันที`
          : `Approved leave request for ${studentName}`
      );
    } else {
      toast.error(
        isThai
          ? `ปฏิเสธใบลาของ ${studentName}`
          : `Rejected leave request for ${studentName}`
      );
    }
  };

  const statusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'PRESENT':
        return {
          label: isThai ? 'มาเรียน (Present)' : 'Present',
          cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200',
        };
      case 'LATE':
        return {
          label: isThai ? 'มาสาย (Late)' : 'Late',
          cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200',
        };
      case 'SICK_LEAVE':
        return {
          label: isThai ? 'ลาป่วย (Sick)' : 'Sick Leave',
          cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200',
        };
      case 'PERSONAL_LEAVE':
        return {
          label: isThai ? 'ลากิจ (Personal)' : 'Personal Leave',
          cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200',
        };
      case 'EARLY_PICKUP':
        return {
          label: isThai ? 'รับกลับก่อน (Early)' : 'Early Pickup',
          cls: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200',
        };
      case 'ABSENT':
      default:
        return {
          label: isThai ? 'ขาดเรียน/ยังไม่แจ้ง (Absent)' : 'Absent',
          cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200',
        };
    }
  };

  return (
    <div className="sv-container-context min-h-[100dvh] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Link
                href="/admin/students"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:text-[#7B1C3E] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {isThai ? 'ทะเบียนนักเรียน' : 'Student Registry'}
              </Link>
              <span>•</span>
              <span className="text-[#7B1C3E] dark:text-amber-300">
                {isThai
                  ? 'ศูนย์เช็กชื่อ 360° และอนุมัติใบลาออนไลน์'
                  : 'Attendance 360° & Leave Approval Center'}
              </span>
            </div>

            <h1 className="sv-fluid-title text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-[#7B1C3E] text-white shadow-md shadow-[#7B1C3E]/20">
                <CheckCircle2 className="w-6 h-6" />
              </span>
              {isThai
                ? 'ระบบเช็กชื่อนักเรียน 360° & คิวอนุมัติใบลาออนไลน์'
                : 'Student Attendance 360° & Parent Leave Queue'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isThai
                ? 'เชื่อมโยงข้อมูลการแตะบัตร NFC หน้าโรงเรียน • รถรับส่ง (School Van) • ครูเช็กชื่อหน้าชั้นเรียน และใบลาจากผู้ปกครองใน Parents Portal แบบเรียลไทม์'
                : 'Real-time reconciliation across NFC Gate, School Van, Classroom Homeroom, and Parent Leave Requests'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/parents"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[#7B1C3E] dark:text-amber-300 border border-[#D4AF37]/40 text-xs font-bold hover:bg-amber-100 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              {isThai ? 'เปิด Parents Portal' : 'Open Parents Portal'}
            </Link>
            <button
              type="button"
              onClick={syncPipeline}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              {isThai ? 'ซิงค์ข้อมูลล่าสุด' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Summary Metrics + Early Years Staff-to-Child Safety Ratio Monitor */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">
              {isThai ? 'มาเรียนปกติ (Present)' : 'Present'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
              {presentCount}{' '}
              <span className="text-xs font-medium text-slate-400">
                / {logs.length} {isThai ? 'คน' : 'students'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-600/80 mt-1 font-medium">
              {isThai ? 'แจ้งเตือนผู้ปกครองอัตโนมัติแล้ว' : 'Parents notified'}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">
              {isThai ? 'มาสาย (Late)' : 'Late'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">
              {lateCount}{' '}
              <span className="text-xs font-medium text-slate-400">
                {isThai ? 'คน' : 'students'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {isThai ? 'หลังเวลา 08:00 น.' : 'After 08:00 AM'}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">
              {isThai ? 'ลาป่วย / ลากิจ' : 'Sick / Personal Leave'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-sky-600 mt-1">
              {leaveCount}{' '}
              <span className="text-xs font-medium text-slate-400">
                {isThai ? 'คน' : 'students'}
              </span>
            </div>
            <p className="text-[11px] text-sky-600/80 mt-1 font-medium">
              {isThai
                ? `รออนุมัติใบลา ${pendingLeaves.length} รายการ`
                : `${pendingLeaves.length} pending requests`}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">
              {isThai ? 'ขาดเรียน / ยังไม่แจ้ง' : 'Absent / Unaccounted'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
              {absentCount}{' '}
              <span className="text-xs font-medium text-slate-400">
                {isThai ? 'คน' : 'students'}
              </span>
            </div>
            <p className="text-[11px] text-rose-500 mt-1 font-medium">
              {absentCount > 0
                ? isThai
                  ? 'ต้องโทรติดตามผู้ปกครองภายใน 09:00 น.'
                  : 'Requires parent call by 09:00'
                : isThai
                ? 'ครบถ้วน 100% ไม่มีเด็กตกหล่น'
                : '100% accounted for'}
            </p>
          </div>

          {/* Early Years Staff-to-Child Safety Ratio Monitor */}
          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-[#7B1C3E] to-[#561129] text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <Baby className="w-3.5 h-3.5" />
                {isThai ? 'อัตราส่วนความปลอดภัยปฐมวัย' : 'Early Years Safety Ratio'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                PASS
              </span>
            </div>
            <div className="my-1">
              <p className="text-base font-extrabold text-white">
                {isThai
                  ? 'อ.2/1 อัตราส่วนครูต่อเด็ก 1:10'
                  : 'K.2/1 Staff-to-Child Ratio 1:10'}
              </p>
              <p className="text-[11px] text-rose-100/90 leading-snug mt-0.5">
                {isThai
                  ? 'ผ่านเกณฑ์มาตรฐานสถานพัฒนาเด็กปฐมวัยแห่งชาติ (ครูประจำชั้น 1 + ครูพี่เลี้ยง 1)'
                  : 'Meets National Early Childhood Development Center Standard'}
              </p>
            </div>
          </div>
        </div>

        {/* Gate vs. Classroom vs. School Van Reconciliation Alert Banner */}
        <div
          className={`p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            unreconciledGateStudents.length > 0
              ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
              : 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                unreconciledGateStudents.length > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {unreconciledGateStudents.length > 0 ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {unreconciledGateStudents.length > 0
                  ? isThai
                    ? `ระบบตรวจสอบไขว้ 3 จุด (Gate vs. Van vs. Classroom): พบนักเรียนแตะบัตรหน้าประตู/รถตู้ ${unreconciledGateStudents.length} คน รอครูประจำชั้นยืนยันเข้าห้องเรียน`
                    : `3-Point Reconciliation Alert: ${unreconciledGateStudents.length} students tapped at Gate/Van awaiting Classroom Check-in`
                  : isThai
                  ? 'ระบบตรวจสอบไขว้ 3 จุด (Gate vs. Classroom vs. School Van): ข้อมูลตรงกันครบถ้วน 100%'
                  : '3-Point Safety Reconciliation (Gate vs. Classroom vs. Van): 100% Verified'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {unreconciledGateStudents.length > 0
                  ? unreconciledGateStudents
                      .map(
                        (s) =>
                          `${s.student_name} (${s.nickname} • ${s.source === 'VAN_SYNC' ? 'ลงรถตู้สาย 1' : 'แตะบัตรประตูหน้า'} เวลา ${s.check_in_time})`
                      )
                      .join(' , ')
                  : isThai
                  ? 'นักเรียนทุกคนที่สแกนบัตรผ่านประตูโรงเรียนหรือลงจากรถรับส่งได้รับการเช็กชื่อเข้าห้องเรียนครบทุกคนแล้ว'
                  : 'All students scanned at gate or school van are confirmed inside their homeroom classrooms.'}
              </p>
            </div>
          </div>

          {unreconciledGateStudents.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setReconciledIds(logs.map((l) => l.student_id));
                toast.success(
                  isThai
                    ? 'ยืนยันนักเรียนทุกคนเข้าห้องเรียนครบถ้วน (Reconciled 100%)'
                    : 'Confirmed all gate/van students in classroom!'
                );
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shrink-0 shadow-sm cursor-pointer"
            >
              {isThai
                ? 'ยืนยันเข้าห้องเรียนครบทุกคน (Reconcile All)'
                : 'Confirm All in Classroom'}
            </button>
          )}
        </div>

        {/* Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'attendance'
                  ? 'bg-[#7B1C3E] text-white shadow-md shadow-[#7B1C3E]/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              {isThai
                ? 'เช็กชื่อรายวัน & จำลองการแตะบัตร NFC (Daily Attendance & NFC Simulator)'
                : 'Daily Attendance & NFC Gate Simulator'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('leave_queue')}
              className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'leave_queue'
                  ? 'bg-[#7B1C3E] text-white shadow-md shadow-[#7B1C3E]/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              {isThai
                ? 'คิวอนุมัติใบลาออนไลน์จาก Parents Portal'
                : 'Parent Leave Requests Queue'}
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                  pendingLeaves.length > 0
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-emerald-500/20 text-emerald-200'
                }`}
              >
                {pipeline.leave_requests.length}
              </span>
            </button>
          </div>

          {activeTab === 'attendance' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {isThai ? 'กรองห้องเรียน:' : 'Filter Class:'}
              </span>
              {['ALL', 'อ.2/1', 'ป.4/1'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    selectedGrade === g
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {g === 'ALL' ? (isThai ? 'ทั้งหมด' : 'All') : g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TAB 1: Daily Attendance & NFC Gate Simulator */}
        {activeTab === 'attendance' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {isThai
                    ? 'ตารางเช็กชื่อนักเรียนรายวัน & จำลองการแตะบัตร NFC หน้าโรงเรียน'
                    : 'Daily Student Attendance Table & NFC Gate Simulator'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isThai
                    ? 'คลิกปุ่มสถานะเพื่ออัปเดตและส่งแจ้งเตือนไปยังหน้า Today ของผู้ปกครองใน /parents ทันที'
                    : 'Click any status button to update attendance and push real-time notification to /parents'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  filteredLogs.forEach((l) => {
                    recordStudentAttendance({
                      student_id: l.student_id,
                      status: 'PRESENT',
                      source: 'TEACHER_APP',
                      recorded_by: 'ครูประจำชั้น (เช็กชื่อทั้งห้อง)',
                    });
                  });
                  syncPipeline();
                  toast.success(
                    isThai
                      ? 'บันทึกสถานะ "มาเรียน (PRESENT)" ครบทุกคนในห้องเรียบร้อย!'
                      : 'Marked all students as PRESENT!'
                  );
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isThai ? 'เช็กชื่อมาเรียนครบทั้งห้อง' : 'Mark All Present'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4 font-bold">{isThai ? 'รหัส / นักเรียน' : 'Student'}</th>
                    <th className="p-4 font-bold">{isThai ? 'ระดับชั้น' : 'Class'}</th>
                    <th className="p-4 font-bold">{isThai ? 'เวลา / ช่องทาง' : 'Check-in / Source'}</th>
                    <th className="p-4 font-bold text-center">{isThai ? 'สถานะปัจจุบัน' : 'Current Status'}</th>
                    <th className="p-4 font-bold">{isThai ? 'เปลี่ยนสถานะด่วน (1-Click Sync)' : '1-Click Status Actions'}</th>
                    <th className="p-4 font-bold text-right">{isThai ? 'จำลองแตะบัตร NFC' : 'NFC Gate Simulator'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.map((log) => {
                    const badge = statusBadge(log.status);
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {log.student_name}{' '}
                            <span className="text-[#7B1C3E] dark:text-amber-300">
                              ({log.nickname})
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            ID: {log.student_id} • {log.notes || 'ปกติ'}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                          {log.grade_level}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            {log.check_in_time || '-'}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            {log.source === 'VAN_SYNC' ? (
                              <Bus className="w-3 h-3 text-blue-500" />
                            ) : log.source === 'NFC_GATE' ? (
                              <Smartphone className="w-3 h-3 text-purple-500" />
                            ) : (
                              <School className="w-3 h-3 text-emerald-600" />
                            )}
                            {log.source} • {log.recorded_by}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(
                              [
                                { code: 'PRESENT', label: 'มาเรียน' },
                                { code: 'LATE', label: 'สาย' },
                                { code: 'SICK_LEAVE', label: 'ลาป่วย' },
                                { code: 'PERSONAL_LEAVE', label: 'ลากิจ' },
                                { code: 'ABSENT', label: 'ขาด' },
                              ] as { code: AttendanceStatus; label: string }[]
                            ).map((btn) => (
                              <button
                                key={btn.code}
                                type="button"
                                onClick={() =>
                                  handleSetStatus(
                                    log.student_id,
                                    log.student_name,
                                    btn.code,
                                    'TEACHER_APP'
                                  )
                                }
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  log.status === btn.code
                                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                {btn.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleSetStatus(
                                log.student_id,
                                log.student_name,
                                'PRESENT',
                                'NFC_GATE'
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all cursor-pointer"
                          >
                            <BellRing className="w-3.5 h-3.5" />
                            {isThai
                              ? 'จำลองแตะบัตร NFC หน้าโรงเรียน'
                              : 'Simulate NFC Tap'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Parent Leave Requests Queue */}
        {activeTab === 'leave_queue' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {isThai
                      ? 'คิวคำร้องขอลาเรียนออนไลน์จากผู้ปกครอง (Parent Leave Requests Queue)'
                      : 'Online Leave Requests Submitted via Parents Portal'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isThai
                      ? 'เมื่อกด "อนุมัติ (Approve)" ระบบจะปรับสถานะเช็กชื่อของนักเรียนในวันนี้โดยอัตโนมัติ และส่งแจ้งเตือนกลับไปยังผู้ปกครองทันที'
                      : 'Approving a request automatically updates the student attendance log and notifies the parent.'}
                  </p>
                </div>
              </div>

              {pipeline.leave_requests.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  {isThai ? 'ยังไม่มีรายการใบลาออนไลน์' : 'No leave requests found'}
                </div>
              ) : (
                <div className="space-y-3">
                  {pipeline.leave_requests.map((req) => {
                    const isPending = req.status === 'PENDING';
                    const isApproved = req.status === 'APPROVED';

                    return (
                      <div
                        key={req.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                          isPending
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                            : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                                req.leave_type === 'SICK_LEAVE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : req.leave_type === 'PERSONAL_LEAVE'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {req.leave_type === 'SICK_LEAVE'
                                ? isThai
                                  ? 'ลาป่วย (Sick Leave)'
                                  : 'Sick Leave'
                                : req.leave_type === 'PERSONAL_LEAVE'
                                ? isThai
                                  ? 'ลากิจ (Personal Leave)'
                                  : 'Personal Leave'
                                : isThai
                                ? 'ขอรับกลับก่อนเวลา (Early Pickup)'
                                : 'Early Pickup'}
                            </span>

                            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                              {req.student_name} • ชั้น {req.grade_level}
                            </h4>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                isPending
                                  ? 'bg-amber-400 text-slate-950'
                                  : isApproved
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {req.status === 'PENDING'
                                ? isThai
                                  ? 'รอครูอนุมัติ (PENDING)'
                                  : 'PENDING'
                                : req.status === 'APPROVED'
                                ? isThai
                                  ? 'อนุมัติแล้ว (APPROVED)'
                                  : 'APPROVED'
                                : isThai
                                ? 'ไม่อนุมัติ (REJECTED)'
                                : 'REJECTED'}
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium">
                            <strong>{isThai ? 'เหตุผลการลา:' : 'Reason:'}</strong>{' '}
                            {req.reason}
                          </p>

                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                            <span>
                              📅 {isThai ? 'วันที่ลา:' : 'Date:'} {req.start_date}{' '}
                              {req.end_date !== req.start_date
                                ? `ถึง ${req.end_date}`
                                : ''}
                            </span>
                            <span>•</span>
                            <span>
                              👤 {isThai ? 'ผู้ปกครองที่ยื่น:' : 'Submitted by:'}{' '}
                              {req.guardian_name}
                            </span>
                            {req.reviewed_by && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                  ✓ ตรวจสอบโดย {req.reviewed_by} ({req.review_note})
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleReviewLeave(
                                req.id,
                                req.student_name,
                                'APPROVED'
                              )
                            }
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            {isThai ? 'อนุมัติ (Approve)' : 'Approve'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleReviewLeave(
                                req.id,
                                req.student_name,
                                'REJECTED'
                              )
                            }
                            className="px-4 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            {isThai ? 'ปฏิเสธ (Reject)' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
