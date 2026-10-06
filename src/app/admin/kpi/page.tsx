'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  KpiCycle,
  KpiEvaluation,
  KpiStatus,
  KpiGrade,
  KpiQuarter,
} from '@/types/kpi';
import {
  getKpiCycles,
  getKpiEvaluations,
  dispatchEvaluationEmail,
  syncPersonnelForCycle,
  createQuarterlyCycle,
  assignEvaluator,
  assignEvaluators,
  bulkAssignEvaluators,
  getEvaluatorCandidates,
} from './actions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Filter,
  GraduationCap,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  User,
  UserCheck,
  Users,
  X,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Plus,
  Settings2,
  Save,
  Check,
  Info,
} from 'lucide-react';

export default function KpiDashboardPage() {
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [evaluations, setEvaluations] = useState<KpiEvaluation[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    pendingSelf: number;
    pendingSupervisor: number;
    completed: number;
    avgScore: number;
  }>({
    total: 0,
    pendingSelf: 0,
    pendingSupervisor: 0,
    completed: 0,
    avgScore: 0,
  });

  const [currentUserContext, setCurrentUserContext] = useState<{
    userId: string | null;
    personnelId: string | null;
    isAdmin: boolean;
  }>({
    userId: null,
    personnelId: null,
    isAdmin: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | KpiStatus>('all');
  const [viewFilter, setViewFilter] = useState<'all' | 'assigned_to_me' | 'my_self'>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  // Evaluator Candidates
  const [evaluators, setEvaluators] = useState<{
    id: string;
    name_th: string;
    name_en?: string;
    position_th: string;
    category?: string;
    email: string | null;
    image_url?: string | null;
  }[]>([]);

  // Email Notification Modal State
  const [emailModalEval, setEmailModalEval] = useState<KpiEvaluation | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // New Quarter Cycle Modal State
  const [showCreateQuarterModal, setShowCreateQuarterModal] = useState(false);
  const [isCreatingCycle, setIsCreatingCycle] = useState(false);
  const [newQuarter, setNewQuarter] = useState<KpiQuarter>('Q2');
  const [newYear, setNewYear] = useState('2568');
  const [newTitle, setNewTitle] = useState('');

  // Assign Evaluator Permission Modal State (Multi-Evaluators Support)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [assignmentsDraft, setAssignmentsDraft] = useState<Record<string, string[]>>({});
  const [bulkSupervisorChoices, setBulkSupervisorChoices] = useState<string[]>([
    '3da9e72c-e913-4606-9b33-46aa9427ff43',
  ]);

  // Individual Person Evaluator Assignment Modal
  const [personAssignModalEval, setPersonAssignModalEval] = useState<KpiEvaluation | null>(null);
  const [personSelectedEvaluatorIds, setPersonSelectedEvaluatorIds] = useState<string[]>([]);
  const [isSavingPersonAssignment, setIsSavingPersonAssignment] = useState(false);
  const [evaluatorSearchQuery, setEvaluatorSearchQuery] = useState('');

  // 1. Initial Load of Cycles & Evaluators
  const loadCyclesAndCandidates = async () => {
    setIsLoading(true);
    const [cycleRes, evalCandRes] = await Promise.all([
      getKpiCycles(),
      getEvaluatorCandidates(),
    ]);

    if (evalCandRes.success && evalCandRes.data) {
      setEvaluators(evalCandRes.data);
    }

    if (cycleRes.success && cycleRes.data && cycleRes.data.length > 0) {
      setCycles(cycleRes.data);
      const active = cycleRes.data.find((c) => c.status === 'active') || cycleRes.data[0];
      setSelectedCycleId(active.id);
      await loadEvaluations(active.id);
    } else {
      toast.error('ไม่พบรอบการประเมิน');
      setIsLoading(false);
    }
  };

  // 2. Load Evaluations for selected cycle
  const loadEvaluations = async (cycleId: string) => {
    setIsLoading(true);
    const res = await getKpiEvaluations(cycleId);
    if (res.success && res.data) {
      setEvaluations(res.data);
      if (res.stats) setStats(res.stats);
      if (res.currentUserContext) setCurrentUserContext(res.currentUserContext);

      // Pre-fill assignments draft with multi-evaluators
      const draft: Record<string, string[]> = {};
      res.data.forEach((e) => {
        const ids =
          e.assigned_evaluator_ids && e.assigned_evaluator_ids.length > 0
            ? e.assigned_evaluator_ids
            : e.assigned_evaluator_id
            ? [e.assigned_evaluator_id]
            : [];
        draft[e.id] = ids;
      });
      setAssignmentsDraft(draft);
    } else {
      toast.error('ไม่สามารถโหลดข้อมูลการประเมินได้', { description: res.error });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadCyclesAndCandidates();
  }, []);

  const handleCycleChange = async (cycleId: string) => {
    setSelectedCycleId(cycleId);
    await loadEvaluations(cycleId);
  };

  // Create new quarterly cycle
  const handleCreateQuarterCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    const quarterLabels: Record<KpiQuarter, string> = {
      Q1: 'ไตรมาสที่ 1 (Q1: ต.ค. - ธ.ค.)',
      Q2: 'ไตรมาสที่ 2 (Q2: ม.ค. - มี.ค.)',
      Q3: 'ไตรมาสที่ 3 (Q3: เม.ย. - มิ.ย.)',
      Q4: 'ไตรมาสที่ 4 (Q4: ก.ค. - ก.ย.)',
    };

    const finalTitle =
      newTitle.trim() ||
      `การประเมินผลการปฏิบัติงาน ประจำปีการศึกษา ${newYear} (${quarterLabels[newQuarter]})`;

    setIsCreatingCycle(true);
    const res = await createQuarterlyCycle({
      title: finalTitle,
      academic_year: newYear,
      semester: newQuarter === 'Q1' || newQuarter === 'Q2' ? '1' : '2',
      quarter: newQuarter,
    });
    setIsCreatingCycle(false);

    if (res.success && res.data) {
      toast.success(`สร้างรอบการประเมิน ${newQuarter} สำเร็จ!`);
      setShowCreateQuarterModal(false);
      setNewTitle('');
      await loadCyclesAndCandidates();
      setSelectedCycleId(res.data.id);
      await loadEvaluations(res.data.id);
    } else {
      toast.error('สร้างรอบการประเมินไม่สำเร็จ', { description: res.error });
    }
  };

  // Sync active personnel
  const handleSyncPersonnel = async () => {
    if (!selectedCycleId) return;
    setIsSyncing(true);
    const res = await syncPersonnelForCycle(selectedCycleId);
    setIsSyncing(false);

    if (res.success) {
      toast.success(
        res.insertedCount > 0
          ? `เพิ่มบุคลากรใหม่ ${res.insertedCount} ท่านเข้าสู่รอบประเมินเรียบร้อย`
          : 'ข้อมูลบุคลากรในรอบประเมินนี้เป็นปัจจุบันแล้ว'
      );
      loadEvaluations(selectedCycleId);
    } else {
      toast.error('การซิงค์ล้มเหลว', { description: res.error });
    }
  };

  // Add an evaluator to draft for a person
  const handleAddEvaluatorToDraft = (evaluationId: string, evaluatorId: string) => {
    if (!evaluatorId) return;
    setAssignmentsDraft((prev) => {
      const current = prev[evaluationId] || [];
      if (current.includes(evaluatorId)) return prev;
      return {
        ...prev,
        [evaluationId]: [...current, evaluatorId],
      };
    });
  };

  // Remove an evaluator from draft for a person
  const handleRemoveEvaluatorFromDraft = (evaluationId: string, evaluatorId: string) => {
    setAssignmentsDraft((prev) => {
      const current = prev[evaluationId] || [];
      return {
        ...prev,
        [evaluationId]: current.filter((id) => id !== evaluatorId),
      };
    });
  };

  // Toggle evaluator in bulk choice set
  const handleToggleBulkChoice = (evaluatorId: string) => {
    setBulkSupervisorChoices((prev) => {
      if (prev.includes(evaluatorId)) {
        return prev.filter((id) => id !== evaluatorId);
      } else {
        return [...prev, evaluatorId];
      }
    });
  };

  // Apply bulk choices to all in modal draft
  const handleApplyBulkSupervisor = () => {
    if (bulkSupervisorChoices.length === 0) {
      toast.warning('กรุณาเลือกผู้ประเมินหลักอย่างน้อย 1 ท่านในแถบมอบหมายด่วน');
      return;
    }
    const updated: Record<string, string[]> = {};
    evaluations.forEach((e) => {
      updated[e.id] = [...bulkSupervisorChoices];
    });
    setAssignmentsDraft(updated);
    toast.info(
      `ปรับใช้คณะกรรมการ (${bulkSupervisorChoices.length} ท่าน) กับทุกคนในตารางแล้ว (กด "บันทึกสิทธิ์ทั้งหมด" เพื่อยืนยัน)`
    );
  };

  // Bulk Save Evaluator Assignments
  const handleSaveAllAssignments = async () => {
    setIsSavingAssignments(true);
    const list = Object.entries(assignmentsDraft).map(([evaluationId, evaluatorPersonnelIds]) => ({
      evaluationId,
      evaluatorPersonnelIds: evaluatorPersonnelIds || [],
    }));

    const res = await bulkAssignEvaluators(list);
    setIsSavingAssignments(false);

    if (res.success) {
      toast.success(`บันทึกสิทธิ์ผู้ประเมินสำเร็จ ${res.count} รายการ`);
      setShowAssignModal(false);
      loadEvaluations(selectedCycleId);
    } else {
      toast.error('บันทึกสิทธิ์ไม่สำเร็จ', { description: res.error });
    }
  };

  // Open individual person assign modal
  const handleOpenPersonAssignModal = (evaluation: KpiEvaluation) => {
    const ids =
      evaluation.assigned_evaluator_ids && evaluation.assigned_evaluator_ids.length > 0
        ? [...evaluation.assigned_evaluator_ids]
        : evaluation.assigned_evaluator_id
        ? [evaluation.assigned_evaluator_id]
        : [];
    setPersonSelectedEvaluatorIds(ids);
    setPersonAssignModalEval(evaluation);
    setEvaluatorSearchQuery('');
  };

  // Toggle individual evaluator
  const handleTogglePersonEvaluator = (evaluatorId: string) => {
    setPersonSelectedEvaluatorIds((prev) =>
      prev.includes(evaluatorId) ? prev.filter((id) => id !== evaluatorId) : [...prev, evaluatorId]
    );
  };

  // Save individual person assignment
  const handleSavePersonAssignment = async () => {
    if (!personAssignModalEval) return;
    setIsSavingPersonAssignment(true);
    const res = await assignEvaluators(personAssignModalEval.id, personSelectedEvaluatorIds);
    setIsSavingPersonAssignment(false);

    if (res.success) {
      toast.success(
        `บันทึกผู้ประเมิน (${personSelectedEvaluatorIds.length} ท่าน) ให้ ${personAssignModalEval.personnel?.name_th} เรียบร้อยแล้ว`
      );

      const updatedEvaluators = evaluators.filter((ev) => personSelectedEvaluatorIds.includes(ev.id));
      setEvaluations((prev) =>
        prev.map((item) => {
          if (item.id === personAssignModalEval.id) {
            return {
              ...item,
              assigned_evaluator_ids: personSelectedEvaluatorIds,
              assigned_evaluator_id: personSelectedEvaluatorIds[0] || null,
              assigned_evaluators: updatedEvaluators,
            };
          }
          return item;
        })
      );

      // Also sync into assignmentsDraft
      setAssignmentsDraft((prev) => ({
        ...prev,
        [personAssignModalEval.id]: personSelectedEvaluatorIds,
      }));

      setPersonAssignModalEval(null);
    } else {
      toast.error('บันทึกสิทธิ์ไม่สำเร็จ', { description: res.error });
    }
  };

  // Send anonymous email
  const handleSendEmail = async (evaluation: KpiEvaluation) => {
    if (!evaluation.personnel?.email) {
      toast.error('บุคลากรท่านนี้ไม่มีที่อยู่อีเมลในระบบ');
      return;
    }
    setIsSendingEmail(true);
    const res = await dispatchEvaluationEmail(evaluation.id);
    setIsSendingEmail(false);

    if (res.success) {
      toast.success(`ส่งผลประเมินไปยัง ${res.recipientEmail} เรียบร้อยแล้ว (ไม่เปิดเผยตัวตนผู้ประเมิน)`);
      setEmailModalEval(null);
      loadEvaluations(selectedCycleId);

      if (res.mode === 'simulated' && res.gmailComposeUrl) {
        window.open(res.gmailComposeUrl, '_blank');
      }
    } else {
      toast.error('ไม่สามารถส่งอีเมลได้', { description: res.error });
    }
  };

  // Filtered List
  const filteredList = evaluations.filter((e) => {
    const p = e.personnel;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !searchQuery ||
      p?.name_th?.toLowerCase().includes(q) ||
      p?.name_en?.toLowerCase().includes(q) ||
      p?.position_th?.toLowerCase().includes(q) ||
      p?.email?.toLowerCase().includes(q) ||
      (e.assigned_evaluators || []).some((ev) => ev.name_th?.toLowerCase().includes(q));

    const matchStatus = statusFilter === 'all' || e.status === statusFilter;

    let matchView = true;
    if (viewFilter === 'assigned_to_me') {
      matchView = Boolean(
        currentUserContext.personnelId &&
          (e.assigned_evaluator_ids?.includes(currentUserContext.personnelId) ||
            e.assigned_evaluator_id === currentUserContext.personnelId)
      );
    } else if (viewFilter === 'my_self') {
      matchView = e.personnel_id === currentUserContext.personnelId;
    }

    return matchSearch && matchStatus && matchView;
  });

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  return (
    <div className="min-h-screen bg-[#F5F4F2] pb-24 font-sans text-slate-800">
      {/* Top Banner / Breadcrumb */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#7B1C3E] text-white flex items-center justify-center shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  ระบบประเมินผลการปฏิบัติงานรายไตรมาส (Quarterly KPI)
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Somkidvittaya Official
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ประเมินตนเอง (Self) • หัวหน้างานประเมินตามสิทธิ์ (Supervisor) • วิเคราะห์ผล & แจ้งผลทาง Gmail
              </p>
            </div>
          </div>

          {/* Quarter Switcher & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Cycle Selector */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500 ml-2" />
              <select
                value={selectedCycleId}
                onChange={(e) => handleCycleChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 py-1.5 px-2.5 focus:outline-none cursor-pointer"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.quarter || 'Q1'}] {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Admin Action: Assign Evaluators */}
            {currentUserContext.isAdmin && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold shadow-2xs transition-colors"
                title="กำหนดสิทธิ์ผู้ประเมินพร้อมกันหลายคนหรือภาพรวมทั้งตาราง (Bulk Assign)"
              >
                <Settings2 className="w-3.5 h-3.5 text-purple-600" />
                <span>กำหนดสิทธิ์ภาพรวม / Bulk</span>
              </button>
            )}

            {/* Admin Action: Add New Quarterly Cycle */}
            {currentUserContext.isAdmin && (
              <button
                onClick={() => setShowCreateQuarterModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                title="เปิดรอบประเมินไตรมาสใหม่"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มรอบไตรมาสใหม่</span>
              </button>
            )}

            {/* Sync Personnel */}
            <button
              onClick={handleSyncPersonnel}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="ตรวจสอบและซิงค์รายชื่อบุคลากรใหม่เข้าสู่รอบนี้"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#7B1C3E]' : ''}`} />
              <span className="hidden sm:inline">ซิงค์บุคลากร</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Process Information Banner */}
        <div className="bg-gradient-to-r from-[#7B1C3E] via-[#631430] to-[#1B3A6B] rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold mb-3 backdrop-blur-xs">
              <span className="bg-amber-400 text-amber-950 px-2 py-0.2 rounded font-black text-[10px]">
                {selectedCycle?.quarter || 'Q1'}
              </span>
              <span>การประเมินรายไตรมาสตามสิทธิ์ที่ Admin กำหนด</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold leading-snug">
              {selectedCycle?.title || 'การประเมินผลการปฏิบัติงาน'}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 mt-2 leading-relaxed">
              • <strong>รอบประเมินรายไตรมาส (Quarterly):</strong> บุคลากรประเมินตนเองตามตัวชี้วัด &rarr;
              • <strong>การแบ่งสิทธิ์ประเมิน:</strong> ผู้ที่ได้รับมอบหมายเป็นผู้ประเมิน (Supervisor) เท่านั้นที่จะมีสิทธิ์ให้คะแนนบุคลากรที่ตนดูแล &rarr;
              • <strong>แจ้งผลอย่างเป็นธรรม:</strong> สรุปผลเรดาร์ชาร์ตและส่งเข้า Gmail โดยไม่ระบุตัวตนผู้ประเมิน
            </p>
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">บุคลากรทั้งหมด</span>
              <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              {stats.total} <span className="text-xs font-normal text-slate-400">ท่าน</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">ในรอบ {selectedCycle?.quarter || 'Q1'}</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">รอประเมินตนเอง</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-amber-600">
              {stats.pendingSelf} <span className="text-xs font-normal text-slate-400">ท่าน</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">ยังไม่ได้ส่งการประเมินตนเอง</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">รอหัวหน้างานประเมิน</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-blue-600">
              {stats.pendingSupervisor} <span className="text-xs font-normal text-slate-400">ท่าน</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">รอผู้ประเมินที่ได้รับมอบหมายตรวจ</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">ประเมินเสร็จสิ้น</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {stats.completed} <span className="text-xs font-normal text-slate-400">ท่าน</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              คะแนนเฉลี่ย: <strong>{stats.avgScore}%</strong>
            </div>
          </div>
        </div>

        {/* Filter Bar & Scope Switcher */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อครู, ตำแหน่ง, ผู้ประเมิน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all"
            />
          </div>

          {/* Scope Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* View Scope (All vs Assigned to me) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setViewFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              {currentUserContext.personnelId && (
                <>
                  <button
                    onClick={() => setViewFilter('assigned_to_me')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      viewFilter === 'assigned_to_me'
                        ? 'bg-purple-600 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    👔 ที่ฉันต้องประเมิน
                  </button>
                  <button
                    onClick={() => setViewFilter('my_self')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      viewFilter === 'my_self'
                        ? 'bg-[#7B1C3E] text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    👤 ของฉันเอง
                  </button>
                </>
              )}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                ทุกสถานะ
              </button>
              <button
                onClick={() => setStatusFilter('pending_self')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'pending_self' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                รอประเมินตนเอง
              </button>
              <button
                onClick={() => setStatusFilter('self_submitted')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'self_submitted' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                รอหัวหน้างาน
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>

        {/* Staff Evaluation Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#7B1C3E]" />
              <p className="text-sm font-medium">กำลังโหลดข้อมูลการประเมิน...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">ไม่พบรายชื่อในเงื่อนไขที่เลือก</h3>
              <p className="text-xs text-slate-500 mt-1">ลองเปลี่ยนตัวกรองหรือกดปุ่มซิงค์บุคลากร</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                    <th className="py-4 px-6">บุคลากรผู้รับการประเมิน</th>
                    <th className="py-4 px-4">ผู้มีสิทธิ์ประเมิน (Supervisor)</th>
                    <th className="py-4 px-4">สถานะ</th>
                    <th className="py-4 px-4 text-center">ตนเอง</th>
                    <th className="py-4 px-4 text-center">หัวหน้างาน</th>
                    <th className="py-4 px-4 text-center">เกรดสรุป</th>
                    <th className="py-4 px-6 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((e) => {
                    const p = e.personnel;
                    const assignedSup = e.assigned_evaluator;
                    const hasEmail = Boolean(p?.email);

                    // Check if current user is one of the assigned supervisors or admin
                    const canSupervise =
                      currentUserContext.isAdmin ||
                      Boolean(
                        currentUserContext.personnelId &&
                          (e.assigned_evaluator_ids?.includes(currentUserContext.personnelId) ||
                            e.assigned_evaluator_id === currentUserContext.personnelId)
                      );

                    // Check if current user has already submitted their review
                    const myReview = (e.reviews || []).find(
                      (r) => r.evaluator_id === currentUserContext.personnelId && r.status === 'submitted'
                    );

                    // Check if current user is this personnel
                    const isSelf = currentUserContext.personnelId === e.personnel_id;

                    // Evaluator submission progress
                    const submittedReviewCount = e.reviews?.filter((r) => r.status === 'submitted').length || 0;
                    const assignedReviewCount = e.assigned_evaluator_ids?.length || (e.assigned_evaluator_id ? 1 : 0);

                    return (
                      <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Personnel Column */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                              {p?.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name_th}
                                  className="w-full h-full object-cover object-top"
                                />
                              ) : (
                                <User className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{p?.name_th || 'ไม่ระบุชื่อ'}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                    คุณ
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {p?.position_th || 'ครูผู้สอน'}
                              </div>
                              {p?.email && (
                                <div className="text-[11px] text-indigo-600 truncate font-mono">
                                  {p.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Assigned Evaluators (Committee) Column */}
                        <td className="py-4 px-4">
                          <div className="space-y-1.5 min-w-[190px]">
                            {e.assigned_evaluators && e.assigned_evaluators.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {e.assigned_evaluators.map((ev) => {
                                  const review = (e.reviews || []).find(
                                    (r) => r.evaluator_id === ev.id && r.status === 'submitted'
                                  );
                                  const isSubmitted = Boolean(review);
                                  return (
                                    <div
                                      key={ev.id}
                                      className="flex items-center justify-between gap-1.5 text-[11px] font-semibold py-0.5 px-2 bg-purple-50/70 border border-purple-200/80 rounded-lg text-purple-950"
                                    >
                                      <span className="truncate max-w-[130px]">{ev.name_th}</span>
                                      {isSubmitted ? (
                                        <span className="inline-flex items-center text-[10px] text-emerald-700 font-bold shrink-0">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-0.5" />
                                          {review?.total_score ? `${review.total_score}%` : 'ประเมินแล้ว'}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center text-[10px] text-amber-600 font-medium shrink-0">
                                          <Clock className="w-3 h-3 text-amber-500 mr-0.5" /> รอ
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">ยังไม่กำหนดผู้ประเมิน</span>
                            )}

                            {currentUserContext.isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenPersonAssignModal(e)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                title={`กำหนดผู้ประเมินรายคนให้ ${p?.name_th}`}
                              >
                                <Settings2 className="w-3.5 h-3.5 text-purple-600" />
                                <span>กำหนดผู้ประเมิน ({e.assigned_evaluator_ids?.length || 0} ท่าน)</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="py-4 px-4">
                          {e.status === 'pending_self' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              รอประเมินตนเอง
                            </span>
                          )}
                          {e.status === 'self_submitted' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              รอผู้ประเมิน ({submittedReviewCount}/{assignedReviewCount} คน)
                            </span>
                          )}
                          {e.status === 'completed' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ประเมินครบแล้ว
                            </span>
                          )}
                        </td>

                        {/* Self Score */}
                        <td className="py-4 px-4 text-center">
                          {e.self_total_score !== null ? (
                            <span className="font-bold text-slate-700">
                              {Number(e.self_total_score).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Supervisor Score */}
                        <td className="py-4 px-4 text-center">
                          {e.supervisor_total_score !== null ? (
                            <span className="font-bold text-[#7B1C3E]">
                              {Number(e.supervisor_total_score).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Final Grade Badge */}
                        <td className="py-4 px-4 text-center">
                          {e.final_grade ? (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black text-white shadow-2xs ${
                                e.final_grade === 'A'
                                    ? 'bg-emerald-600'
                                  : e.final_grade === 'B+'
                                  ? 'bg-blue-600'
                                  : e.final_grade === 'B'
                                  ? 'bg-indigo-600'
                                  : e.final_grade === 'C'
                                  ? 'bg-amber-600'
                                  : 'bg-rose-600'
                              }`}
                            >
                              {e.final_grade}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* 1. Self Evaluation Button */}
                            <Link
                              href={`/admin/kpi/${e.id}/self`}
                              title="ประเมินตนเอง (Self Evaluation)"
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span className="hidden sm:inline">ประเมินตนเอง</span>
                            </Link>

                            {/* 2. Supervisor Evaluation Button (Only if authorized) */}
                            {canSupervise ? (
                              <Link
                                href={`/admin/kpi/${e.id}/supervisor`}
                                title="ตรวจประเมินผลการปฏิบัติงาน"
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs ${
                                  myReview
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                                    : 'bg-[#1B3A6B] hover:bg-[#122748] text-white'
                                }`}
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">
                                  {myReview ? 'แก้ไขคะแนน' : 'ตรวจประเมิน'}
                                </span>
                              </Link>
                            ) : (
                              <button
                                disabled
                                title={`สงวนสิทธิ์เฉพาะผู้ได้รับมอบหมายและผู้ดูแลระบบ`}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-medium cursor-not-allowed opacity-60 flex items-center gap-1"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">ไม่มีสิทธิ์</span>
                              </button>
                            )}

                            {/* 3. Analytics Button */}
                            <Link
                              href={`/admin/kpi/${e.id}/analytics`}
                              title="วิเคราะห์ผลคะแนน & เรดาร์ชาร์ต"
                              className="px-2.5 py-1.5 rounded-xl bg-[#7B1C3E] hover:bg-[#631430] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>วิเคราะห์ผล</span>
                            </Link>

                            {/* 4. Anonymous Email Notify Button */}
                            <button
                              type="button"
                              onClick={() => setEmailModalEval(e)}
                              disabled={e.status !== 'completed' || !hasEmail}
                              title={
                                !hasEmail
                                  ? 'ไม่มีอีเมลในระบบ'
                                  : e.status !== 'completed'
                                  ? 'ต้องประเมินเสร็จสิ้นก่อนจึงจะแจ้งผลได้'
                                  : 'ส่งผลการประเมินเข้า Gmail (ไม่ระบุชื่อผู้ประเมิน)'
                              }
                              className={`p-1.5 rounded-xl border transition-colors ${
                                e.email_notified_status === 'sent'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 disabled:opacity-30'
                              }`}
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 1. Modal: Create New Quarterly Cycle */}
      <AnimatePresence>
        {showCreateQuarterModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-slate-800 relative"
            >
              <button
                onClick={() => setShowCreateQuarterModal(false)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    เพิ่มรอบการประเมินรายไตรมาสใหม่
                  </h3>
                  <p className="text-xs text-slate-500">
                    สร้างรอบประเมินตามไตรมาส (Quarterly KPI)
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateQuarterCycle} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    เลือกไตรมาส (Quarter)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as KpiQuarter[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setNewQuarter(q)}
                        className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                          newQuarter === q
                            ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ปีการศึกษา (พ.ศ.)
                  </label>
                  <input
                    type="text"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                    placeholder="2568"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ชื่อรอบการประเมิน (ปล่อยว่างเพื่อใช้ชื่อมาตรฐาน)
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                    placeholder={`การประเมินผลการปฏิบัติงาน ประจำปีการศึกษา ${newYear} (${newQuarter})`}
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                  💡 ระบบจะทำการซิงค์รายชื่อบุคลากรทั้งหมด 28 ท่านเข้าสู่รอบใหม่นี้ให้อัตโนมัติทันที
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateQuarterModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCycle}
                    className="flex-1 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCreatingCycle ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังสร้าง...</span>
                      </>
                    ) : (
                      <span>ยืนยันสร้างรอบใหม่</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Modal: Assign Evaluator Permissions (กำหนดสิทธิ์ผู้ประเมิน) */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] p-6 sm:p-7 shadow-2xl border border-slate-200 flex flex-col relative text-slate-800"
            >
              <button
                onClick={() => setShowAssignModal(false)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Settings2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    กำหนดสิทธิ์ผู้ประเมินของแต่ละคน (Assign Evaluators)
                  </h3>
                  <p className="text-xs text-slate-500">
                    รอบ: {selectedCycle?.title}
                  </p>
                </div>
              </div>

              {/* Bulk Quick Assign Bar */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 my-4 flex flex-col gap-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-purple-950 text-sm">
                      ⚡ กำหนดผู้ประเมินหลักชุดเดียวกัน (Bulk Assign):
                    </span>
                    <p className="text-purple-700 text-[11px] mt-0.5">
                      เลือกคณะกรรมการ (เลือกได้มากกว่า 1 ท่าน) แล้วกดปุ่มเพื่อปรับใช้กับทุกคนในตารางทันที
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyBulkSupervisor}
                    disabled={bulkSupervisorChoices.length === 0}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-xs transition-colors shrink-0 disabled:opacity-40"
                  >
                    ปรับใช้ชุดนี้ ({bulkSupervisorChoices.length} ท่าน) กับทุกคน
                  </button>
                </div>

                {/* Chips of chosen bulk evaluators */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {evaluators.map((c) => {
                    const isSelected = bulkSupervisorChoices.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleToggleBulkChoice(c.id)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-slate-400" />}
                        <span>{c.name_th}</span>
                        <span className="text-[10px] opacity-75">({c.position_th})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Personnel Assignment List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
                {evaluations.map((item) => {
                  const p = item.personnel;
                  const assignedIds = assignmentsDraft[item.id] || [];
                  const availableCandidates = evaluators.filter((c) => !assignedIds.includes(c.id));

                  return (
                    <div
                      key={item.id}
                      className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          {p?.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name_th}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <User className="w-4 h-4 text-slate-400 m-auto mt-2" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{p?.name_th}</div>
                          <div className="text-[11px] text-slate-500">{p?.position_th}</div>
                        </div>
                      </div>

                      {/* Multi-evaluators badges and selector */}
                      <div className="flex flex-col sm:items-end gap-1.5 min-w-[280px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {assignedIds.length > 0 ? (
                            assignedIds.map((candId) => {
                              const cand = evaluators.find((c) => c.id === candId);
                              return (
                                <span
                                  key={candId}
                                  className="inline-flex items-center gap-1 py-0.5 px-2 bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-xs font-medium"
                                >
                                  <span>{cand?.name_th || 'ผู้ประเมิน'}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEvaluatorFromDraft(item.id, candId)}
                                    className="text-purple-400 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                                    title="ลบผู้ประเมินท่านนี้"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400 italic">ยังไม่ได้กำหนดผู้ประเมิน</span>
                          )}
                        </div>

                        {/* Add more evaluator dropdown */}
                        {availableCandidates.length > 0 && (
                          <div className="flex items-center gap-1">
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddEvaluatorToDraft(item.id, e.target.value);
                                }
                              }}
                              className="py-1 px-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                            >
                              <option value="">+ เพิ่มผู้ประเมินท่านอื่น...</option>
                              {availableCandidates.map((cand) => (
                                <option key={cand.id} value={cand.id}>
                                  + {cand.name_th} ({cand.position_th})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSavingAssignments}
                  onClick={handleSaveAllAssignments}
                  className="py-2.5 px-6 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingAssignments ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึกสิทธิ์...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>บันทึกสิทธิ์ทั้งหมด</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2.5 Modal: Individual Person Evaluator Assignment (กำหนดผู้ประเมินรายบุคคล) */}
      <AnimatePresence>
        {personAssignModalEval && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] p-6 sm:p-7 shadow-2xl border border-slate-200 flex flex-col relative text-slate-800"
            >
              <button
                type="button"
                onClick={() => setPersonAssignModalEval(null)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    กำหนดผู้มีสิทธิ์ประเมินรายบุคคล
                  </h3>
                  <p className="text-xs text-slate-500">
                    รอบ: {selectedCycle?.title} [{selectedCycle?.quarter || 'Q1'}]
                  </p>
                </div>
              </div>

              {/* Target Personnel Box */}
              <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/60 to-slate-50 rounded-2xl p-4 my-3.5 border border-purple-100 flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white border-2 border-purple-200 shrink-0 flex items-center justify-center">
                  {personAssignModalEval.personnel?.image_url ? (
                    <img
                      src={personAssignModalEval.personnel.image_url}
                      alt={personAssignModalEval.personnel.name_th}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <User className="w-6 h-6 text-purple-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                    <span className="truncate">{personAssignModalEval.personnel?.name_th}</span>
                    <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full shrink-0">
                      ผู้รับการประเมิน
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 truncate">
                    {personAssignModalEval.personnel?.position_th || 'บุคลากร'}
                    {personAssignModalEval.personnel?.email && (
                      <span className="ml-2 font-mono text-purple-700 font-medium">
                        ({personAssignModalEval.personnel.email})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Explanatory Info Card */}
              <div className="bg-blue-50/80 border border-blue-200/90 rounded-xl p-3 mb-3 text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong>สามารถเลือกผู้ประเมินได้มากกว่า 1 ท่าน:</strong> บุคลากรผู้ประเมินที่ถูกเลือกจะมีสิทธิ์ตรวจและให้คะแนนท่านนี้ และเมื่อผู้ประเมินทุกคนให้คะแนนครบ ระบบจะ<strong>นำคะแนนเฉลี่ยรวมกัน</strong>และส่งแจ้งผลอัตโนมัติ
                </div>
              </div>

              {/* Filter & Selection Counter */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อผู้ประเมิน..."
                    value={evaluatorSearchQuery}
                    onChange={(e) => setEvaluatorSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="text-xs font-bold text-purple-900 bg-purple-100 px-2.5 py-1 rounded-lg">
                    เลือกแล้ว {personSelectedEvaluatorIds.length} ท่าน
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPersonSelectedEvaluatorIds(evaluators.map((ev) => ev.id))}
                      className="px-2 py-1 text-purple-700 hover:bg-purple-50 rounded font-semibold cursor-pointer"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setPersonSelectedEvaluatorIds([])}
                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded font-semibold cursor-pointer"
                    >
                      ล้างค่า
                    </button>
                  </div>
                </div>
              </div>

              {/* Evaluators Checklist */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[42vh]">
                {evaluators
                  .filter((c) => {
                    const q = evaluatorSearchQuery.toLowerCase();
                    return (
                      !q ||
                      c.name_th?.toLowerCase().includes(q) ||
                      c.name_en?.toLowerCase().includes(q) ||
                      c.position_th?.toLowerCase().includes(q)
                    );
                  })
                  .map((c) => {
                    const isSelected = personSelectedEvaluatorIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleTogglePersonEvaluator(c.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-purple-50/90 border-purple-300 ring-1 ring-purple-400 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                            {c.image_url ? (
                              <img
                                src={c.image_url}
                                alt={c.name_th}
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <User className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {c.name_th}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{c.position_th}</div>
                            {c.email && (
                              <div className="text-[10px] text-purple-700 font-mono truncate">{c.email}</div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 pr-1">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-lg border-2 border-slate-300 flex items-center justify-center bg-white" />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPersonAssignModalEval(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSavingPersonAssignment}
                  onClick={handleSavePersonAssignment}
                  className="py-2.5 px-6 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPersonAssignment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึกสิทธิ์...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>บันทึกผู้มีสิทธิ์ประเมิน ({personSelectedEvaluatorIds.length} ท่าน)</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Modal: Anonymous Email Dispatch Confirmation */}
      <AnimatePresence>
        {emailModalEval && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-slate-800 relative"
            >
              <button
                onClick={() => setEmailModalEval(null)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    แจ้งผลการประเมินผ่าน Gmail
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ระบบไม่ระบุข้อมูลตัวตนผู้ประเมิน (Anonymous Report)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ผู้รับ (บุคลากร):</span>
                  <strong className="text-slate-800">{emailModalEval.personnel?.name_th}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ที่อยู่อีเมล:</span>
                  <span className="font-mono text-indigo-700 font-semibold">{emailModalEval.personnel?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">รอบการประเมิน:</span>
                  <span className="text-slate-700">[{emailModalEval.cycle?.quarter}] {emailModalEval.cycle?.title}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">คะแนนสรุป / เกรด:</span>
                  <strong className="text-[#7B1C3E] text-sm">
                    {Number(emailModalEval.final_score).toFixed(2)}% (เกรด {emailModalEval.final_grade})
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-relaxed mb-6">
                <strong>ความปลอดภัยและความเป็นส่วนตัว:</strong> อีเมลที่ส่งออกจะแสดงเฉพาะคะแนนประเมินสรุปและข้อเสนอแนะเชิงพัฒนา โดยจะ<strong>ตัดชื่อและข้อมูลของผู้ประเมินออกทั้งหมด</strong> เพื่อสร้างบรรยากาศการสะท้อนผลเชิงสร้างสรรค์
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEmailModalEval(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={() => handleSendEmail(emailModalEval)}
                  className="flex-1 py-2.5 px-4 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังส่ง...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>ยืนยันส่งอีเมล</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
