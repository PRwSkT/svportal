'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Search,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  User,
  Check,
  X,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPipelineState,
  PIPELINE_EVENT_NAME,
  createOrUpdateAssignment,
} from '@/lib/pipeline/bidirectional-store';
import {
  AcademicAssignmentItem,
  AssignmentSubmissionStatus,
  BidirectionalPipelineState,
} from '@/types/family-pipeline';

export default function AcademicAssignmentsPage() {
  const { isThai } = useLanguage();
  const [pipeline, setPipeline] = useState<BidirectionalPipelineState>(() => getPipelineState());
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State for New / Edit Assignment
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AcademicAssignmentItem | null>(null);

  const [formClassId, setFormClassId] = useState('ป.4/1');
  const [formSubjectName, setFormSubjectName] = useState('คณิตศาสตร์พื้นฐาน (ค14101)');
  const [formTitleTh, setFormTitleTh] = useState('');
  const [formTitleEn, setFormTitleEn] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState('2026-10-25');
  const [formMaxScore, setFormMaxScore] = useState<number>(10);
  const [formAssignedBy, setFormAssignedBy] = useState('ครูธนกฤต สุวรรณภูมิ');
  const [formStudentId, setFormStudentId] = useState('64008');
  const [formSubmissionStatus, setFormSubmissionStatus] = useState<AssignmentSubmissionStatus>('PENDING');
  const [formScore, setFormScore] = useState<string>('');
  const [formFeedback, setFormFeedback] = useState<string>('');

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

  const assignments = pipeline.assignments || [];

  const filteredAssignments = assignments.filter((item) => {
    if (selectedGrade !== 'ALL' && item.grade_level !== selectedGrade) return false;
    if (selectedStatus !== 'ALL' && item.submission_status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title_th.toLowerCase().includes(q) || item.title_en.toLowerCase().includes(q);
      const matchSubject = item.subject_name.toLowerCase().includes(q);
      const matchStudent = item.student_id.toLowerCase().includes(q);
      return matchTitle || matchSubject || matchStudent;
    }
    return true;
  });

  const totalCount = assignments.length;
  const submittedCount = assignments.filter((a) => a.submission_status === 'SUBMITTED').length;
  const pendingCount = assignments.filter((a) => a.submission_status === 'PENDING').length;
  const lateCount = assignments.filter((a) => a.submission_status === 'LATE').length;

  const openCreateModal = () => {
    setEditingItem(null);
    setFormClassId('ป.4/1');
    setFormSubjectName('คณิตศาสตร์พื้นฐาน (ค14101)');
    setFormTitleTh('');
    setFormTitleEn('');
    setFormDescription('');
    setFormDueDate('2026-10-25');
    setFormMaxScore(10);
    setFormAssignedBy('ครูธนกฤต สุวรรณภูมิ');
    setFormStudentId('64008');
    setFormSubmissionStatus('PENDING');
    setFormScore('');
    setFormFeedback('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: AcademicAssignmentItem) => {
    setEditingItem(item);
    setFormClassId(item.class_id);
    setFormSubjectName(item.subject_name);
    setFormTitleTh(item.title_th);
    setFormTitleEn(item.title_en);
    setFormDescription(item.description);
    setFormDueDate(item.due_date);
    setFormMaxScore(item.max_score);
    setFormAssignedBy(item.assigned_by);
    setFormStudentId(item.student_id);
    setFormSubmissionStatus(item.submission_status);
    setFormScore(item.score !== null && item.score !== undefined ? String(item.score) : '');
    setFormFeedback(item.teacher_feedback || '');
    setIsModalOpen(true);
  };

  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitleTh.trim()) {
      toast.error(isThai ? 'กรุณาระบุชื่องาน' : 'Please provide assignment title');
      return;
    }

    const saved = createOrUpdateAssignment({
      id: editingItem?.id,
      class_id: formClassId,
      grade_level: formClassId,
      subject_name: formSubjectName,
      title_th: formTitleTh.trim(),
      title_en: formTitleEn.trim() || formTitleTh.trim(),
      description: formDescription.trim(),
      due_date: formDueDate,
      max_score: Number(formMaxScore) || 10,
      assigned_by: formAssignedBy,
      student_id: formStudentId,
      submission_status: formSubmissionStatus,
      score: formScore.trim() ? Number(formScore) : null,
      teacher_feedback: formFeedback.trim() || null,
    });

    toast.success(
      isThai
        ? `บันทึกการบ้านสำเร็จและซิงค์ไปยัง Parents Portal แล้ว (${saved.title_th})`
        : `Assignment saved & synced to Parents Portal (${saved.title_en})`
    );
    setIsModalOpen(false);
  };

  const statusBadge = (status: AssignmentSubmissionStatus) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isThai ? 'ส่งแล้ว' : 'Submitted'}
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
            <Clock className="w-3.5 h-3.5" />
            {isThai ? 'รอส่ง' : 'Pending'}
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
            <AlertCircle className="w-3.5 h-3.5" />
            {isThai ? 'ส่งล่าช้า' : 'Late'}
          </span>
        );
      case 'NEEDS_REVISION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300">
            <RefreshCw className="w-3.5 h-3.5" />
            {isThai ? 'ส่งกลับแก้ไข' : 'Revise'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="sv-container-context min-h-[100dvh] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link
              href="/academic"
              className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-amber-300 border border-[#7B1C3E]/20 hover:bg-[#7B1C3E]/20 transition-all inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {isThai ? 'กลับศูนย์รวมวิชาการ' : 'Academic Hub'}
            </Link>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {isThai ? 'งานวิชาการประถมศึกษา' : 'Primary Academic Affairs'}
            </span>
          </div>
          <h1 className="sv-fluid-title text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-[#7B1C3E]" />
            {isThai ? 'ระบบสั่งการบ้านและติดตามชิ้นงานประถมศึกษา' : 'Primary Homework & Assignment Tracker'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isThai
              ? 'มอบหมายการบ้าน ตรวจให้คะแนน และแจ้งเตือนสถานะการส่งงานไปยัง Parents Portal แบบสองทางเรียลไทม์'
              : 'Assign homework, review student submissions, provide feedback, and sync in real-time with Parents Portal'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/parents"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold shadow-xs transition-all"
            title="ดูมุมมองผู้ปกครองใน Parents Portal"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
            <span>{isThai ? 'ดูมุมมอง Parents Portal' : 'Open Parents Portal'}</span>
          </Link>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-[#7B1C3E]/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isThai ? 'สั่งการบ้านใหม่' : 'New Assignment'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{isThai ? 'ชิ้นงานทั้งหมด' : 'Total Items'}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</h3>
            <p className="text-[11px] text-slate-400">{isThai ? 'การบ้านในระบบ' : 'Active assignments'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{isThai ? 'ส่งแล้ว / ตรวจแล้ว' : 'Submitted'}</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{submittedCount}</h3>
            <p className="text-[11px] text-slate-400">{isThai ? 'มีคะแนน/ข้อเสนอแนะ' : 'Graded/reviewed'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{isThai ? 'รอส่ง / กำลังทำ' : 'Pending'}</p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</h3>
            <p className="text-[11px] text-slate-400">{isThai ? 'ยังไม่ถึงกำหนดส่ง' : 'Awaiting submission'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{isThai ? 'เกินกำหนดส่ง (Late)' : 'Overdue / Late'}</p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">{lateCount}</h3>
            <p className="text-[11px] text-slate-400">{isThai ? 'ระบบเตือนผู้ปกครอง' : 'Alerted parents'}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isThai ? 'ค้นหาการบ้าน, รายวิชา, รหัสนักเรียน...' : 'Search assignment or subject...'}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#7B1C3E]"
            />
          </div>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">{isThai ? 'ทุกระดับชั้น' : 'All Grades'}</option>
            <option value="ป.1">ประถมศึกษาปีที่ 1</option>
            <option value="ป.2">ประถมศึกษาปีที่ 2</option>
            <option value="ป.3">ประถมศึกษาปีที่ 3</option>
            <option value="ป.4/1">ป.4/1 (ห้องน้องกัปตัน)</option>
            <option value="ป.5">ประถมศึกษาปีที่ 5</option>
            <option value="ป.6">ประถมศึกษาปีที่ 6</option>
            <option value="อ.2/1">อ.2/1 (กิจกรรมเสริมประสบการณ์)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">{isThai ? 'ทุกสถานะการส่ง' : 'All Statuses'}</option>
            <option value="PENDING">{isThai ? 'รอส่ง' : 'Pending'}</option>
            <option value="SUBMITTED">{isThai ? 'ส่งแล้ว' : 'Submitted'}</option>
            <option value="LATE">{isThai ? 'ส่งล่าช้า' : 'Late'}</option>
            <option value="NEEDS_REVISION">{isThai ? 'ส่งกลับแก้ไข' : 'Needs Revision'}</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {isThai
            ? `แสดง ${filteredAssignments.length} จากทั้งหมด ${totalCount} รายการ`
            : `Showing ${filteredAssignments.length} of ${totalCount} items`}
        </div>
      </div>

      {/* Assignment List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="p-4">{isThai ? 'รายวิชา / ชั้น' : 'Subject / Class'}</th>
                <th className="p-4">{isThai ? 'หัวข้องาน / รายละเอียด' : 'Title & Description'}</th>
                <th className="p-4">{isThai ? 'นักเรียน' : 'Student'}</th>
                <th className="p-4 text-center">{isThai ? 'กำหนดส่ง' : 'Due Date'}</th>
                <th className="p-4 text-center">{isThai ? 'สถานะ' : 'Status'}</th>
                <th className="p-4 text-center">{isThai ? 'คะแนน' : 'Score'}</th>
                <th className="p-4 text-center">{isThai ? 'จัดการ' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 text-sm">
                    {isThai ? 'ไม่พบรายการการบ้านที่ค้นหา' : 'No assignments found matching criteria'}
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">{item.subject_name}</div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-300">
                        {item.grade_level}
                      </span>
                    </td>
                    <td className="p-4 max-w-md">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {isThai ? item.title_th : item.title_en}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                      {item.teacher_feedback && (
                        <div className="mt-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item.teacher_feedback}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {item.student_id === '64008' ? 'ก' : 'พ'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.student_id === '64008' ? 'น้องกัปตัน (ด.ช.กิตติภพ)' : 'น้องพราว (ด.ญ.พิมพ์ชนก)'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {item.student_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-300">
                      {item.due_date}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">{statusBadge(item.submission_status)}</td>
                    <td className="p-4 text-center whitespace-nowrap">
                      {item.score !== null && item.score !== undefined ? (
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {item.score}/{item.max_score}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-/{item.max_score}</span>
                      )}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#7B1C3E] hover:text-white text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isThai ? 'ตรวจ/แก้ไข' : 'Grade / Edit'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#7B1C3E]/10 text-[#7B1C3E] rounded-xl">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  {editingItem
                    ? isThai
                      ? 'ตรวจและบันทึกคะแนนการบ้าน'
                      : 'Review & Grade Assignment'
                    : isThai
                    ? 'สั่งการบ้าน / ชิ้นงานใหม่'
                    : 'Create New Assignment'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isThai ? 'ห้องเรียน' : 'Classroom'}
                  </label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                  >
                    <option value="ป.4/1">ป.4/1 (ประถมศึกษา)</option>
                    <option value="ป.3/1">ป.3/1</option>
                    <option value="ป.5/1">ป.5/1</option>
                    <option value="อ.2/1">อ.2/1 (ปฐมวัย)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isThai ? 'นักเรียน' : 'Student'}
                  </label>
                  <select
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                  >
                    <option value="64008">64008 - น้องกัปตัน (ด.ช.กิตติภพ)</option>
                    <option value="67012">67012 - น้องพราว (ด.ญ.พิมพ์ชนก)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isThai ? 'วิชาที่มอบหมาย' : 'Subject Name'}
                </label>
                <input
                  type="text"
                  value={formSubjectName}
                  onChange={(e) => setFormSubjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isThai ? 'ชื่องาน / แบบฝึกหัด (ไทย)' : 'Assignment Title (Thai)'}
                </label>
                <input
                  type="text"
                  value={formTitleTh}
                  onChange={(e) => setFormTitleTh(e.target.value)}
                  placeholder="เช่น แบบฝึกหัดบทที่ 4 หน้า 78-79"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isThai ? 'ชื่องาน (อังกฤษ - เสริม)' : 'Assignment Title (English)'}
                </label>
                <input
                  type="text"
                  value={formTitleEn}
                  onChange={(e) => setFormTitleEn(e.target.value)}
                  placeholder="e.g. Workbook Chapter 4 Page 78-79"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isThai ? 'คำชี้แจง / รายละเอียดงาน' : 'Instructions / Details'}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ระบุคำสั่งและเกณฑ์การประเมิน..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isThai ? 'กำหนดส่ง' : 'Due Date'}
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isThai ? 'คะแนนเต็ม' : 'Max Score'}
                  </label>
                  <input
                    type="number"
                    value={formMaxScore}
                    onChange={(e) => setFormMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isThai ? 'สถานะการส่ง' : 'Status'}
                  </label>
                  <select
                    value={formSubmissionStatus}
                    onChange={(e) => setFormSubmissionStatus(e.target.value as AssignmentSubmissionStatus)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs"
                  >
                    <option value="PENDING">{isThai ? 'รอส่ง' : 'Pending'}</option>
                    <option value="SUBMITTED">{isThai ? 'ส่งแล้ว' : 'Submitted'}</option>
                    <option value="LATE">{isThai ? 'ส่งล่าช้า' : 'Late'}</option>
                    <option value="NEEDS_REVISION">{isThai ? 'ส่งกลับแก้ไข' : 'Revise'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                    {isThai ? 'คะแนนที่ได้ (ถ้าตรวจแล้ว)' : 'Score Earned'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formScore}
                    onChange={(e) => setFormScore(e.target.value)}
                    placeholder="เช่น 9.5"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 rounded-xl font-bold text-emerald-800 dark:text-emerald-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isThai ? 'ครูผู้มอบหมาย' : 'Assigned By'}
                  </label>
                  <input
                    type="text"
                    value={formAssignedBy}
                    onChange={(e) => setFormAssignedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isThai ? 'ข้อเสนอแนะครูสำหรับผู้ปกครองและนักเรียน' : 'Teacher Feedback'}
                </label>
                <input
                  type="text"
                  value={formFeedback}
                  onChange={(e) => setFormFeedback(e.target.value)}
                  placeholder="เช่น ทำแบบฝึกหัดได้เรียบร้อย ลายมือสวยงามมาก..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs"
                >
                  {isThai ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
                >
                  {editingItem
                    ? isThai
                      ? 'บันทึกคะแนนและส่งให้ผู้ปกครอง'
                      : 'Save & Sync with Parents'
                    : isThai
                    ? 'สร้างการบ้านและแจ้งผู้ปกครอง'
                    : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
