'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  FilePlus2,
  FileText,
  FlaskConical,
  Loader2,
  MapPin,
  Network,
  Paperclip,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEPARTMENT_SCOPES,
  DURATION_LABELS,
  formatLeaveDateRangeTh,
  formatThaiDateShort,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  LeaveStatus,
  LeaveType,
  ORG_CATEGORY_LABELS,
  OrgResponsibilityRole,
  OrgRoleCategory,
  resolveMatchedOrgRoles,
  deduplicateNotifiedUsers,
  StaffLeaveRequest,
} from '@/lib/leave/helpers';
import type { LeavePermissions } from '@/lib/leave/workflow';

interface DashboardStats {
  totalRequests: number;
  pendingCount: number;
  onLeaveTodayCount: number;
  onLeaveToday: StaffLeaveRequest[];
  approvedThisMonthCount: number;
  approvedDaysThisMonth: number;
  byTypeThisMonth: Record<LeaveType, number>;
  byDepartmentThisMonth: Record<string, number>;
}

interface StaffMemberOption {
  user_id: string;
  full_name: string;
  role: string;
  position_th: string;
  department: string;
}

export default function LeaveDashboardClient() {
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const highlightedRequestId = searchParams.get('request');

  const [activeTab, setActiveTab] = useState<'queue' | 'overview' | 'org'>('queue');
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const [permissions, setPermissions] = useState<LeavePermissions>({
    canViewDashboard: false,
    canApprove: false,
    canManageOrg: false,
    assignedRoleTitles: [],
  });
  const [requests, setRequests] = useState<StaffLeaveRequest[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orgRoles, setOrgRoles] = useState<OrgResponsibilityRole[]>([]);
  const [staffList, setStaffList] = useState<StaffMemberOption[]>([]);
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({});
  const [todayBangkok, setTodayBangkok] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<string>('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>(
    highlightedRequestId ? 'all' : 'pending'
  );
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<'all' | LeaveType>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Director Review State
  const [commentsById, setCommentsById] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [subTriggeringId, setSubTriggeringId] = useState<string | null>(null);

  // Org Structure Editor Modal State
  const [editingRole, setEditingRole] = useState<Partial<OrgResponsibilityRole> | null>(null);
  const [isNewRoleModal, setIsNewRoleModal] = useState(false);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        scope: 'dashboard',
        status: statusFilter,
        leave_type: leaveTypeFilter,
        department: departmentFilter,
        month: monthFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/leave?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();

      if (res.status === 403) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }
      if (!res.ok) {
        if (data.code === 'MIGRATION_REQUIRED') {
          setMigrationRequired(true);
          return;
        }
        throw new Error(data.error || 'ไม่สามารถโหลดแดชบอร์ดได้');
      }

      setMigrationRequired(false);
      setAccessDenied(false);
      setPermissions(data.permissions);
      setRequests(data.requests || []);
      setStats(data.stats || null);
      setOrgRoles(data.orgRoles || []);
      setUserNamesMap(data.userNamesMap || {});
      setTodayBangkok(data.todayBangkok || '');
      setCurrentMonth(data.currentMonth || '');
    } catch (err: any) {
      toast.error('โหลดแดชบอร์ดไม่สำเร็จ', {
        id: 'leave-dashboard-error',
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrgStaff = async () => {
    try {
      const res = await fetch('/api/leave/org-structure', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setOrgRoles(data.roles || []);
      setStaffList(data.staff || []);
    } catch {
      // ignore non-fatal
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, statusFilter, leaveTypeFilter, departmentFilter, monthFilter]);

  useEffect(() => {
    if (!authLoading && user) {
      loadOrgStaff();
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (highlightedRequestId && !isLoading) {
      const el = document.getElementById(`leave-req-${highlightedRequestId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedRequestId, isLoading, requests.length]);

  const handleReview = async (id: string, decision: 'approved' | 'rejected') => {
    if (!permissions.canApprove) {
      toast.error('เฉพาะผู้อำนวยการโรงเรียนเท่านั้นที่สามารถอนุมัติหรือไม่อนุมัติคำขอได้');
      return;
    }

    setReviewingId(id);
    try {
      const res = await fetch(`/api/leave/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          comment: (commentsById[id] || '').trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถดำเนินการได้');

      toast.success(
        decision === 'approved' ? 'อนุมัติคำขอเรียบร้อยแล้ว!' : 'บันทึกผลการไม่อนุมัติแล้ว',
        { description: data.message }
      );
      await loadDashboard();
    } catch (err: any) {
      toast.error('ดำเนินการไม่สำเร็จ', { description: err.message });
    } finally {
      setReviewingId(null);
    }
  };

  const handleOpenAttachment = async (path: string) => {
    try {
      const res = await fetch(`/api/leave/upload?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok || !data.signedUrl) throw new Error(data.error || 'เปิดไฟล์ไม่สำเร็จ');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error('เปิดเอกสารไม่สำเร็จ', { description: err.message });
    }
  };

  const handlePreviewSubstitution = async (item: StaffLeaveRequest) => {
    if (!item.personnel_id) {
      toast.info('ยังไม่พบข้อมูล Personnel ID สำหรับครูท่านนี้');
      return;
    }
    setSubTriggeringId(item.id);
    try {
      const res = await fetch('/api/academic/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: item.start_date,
          original_teacher_id: item.personnel_id,
          reason: `${LEAVE_TYPE_LABELS[item.leave_type].labelTh}: ${item.reason}`,
          assigned_by: 'แดชบอร์ดการลา (ทดลอง)',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถประมวลผลสอนแทนได้');
      toast.info('ผลการส่งต่อจัดสอนแทน (ทดลอง)', {
        description: data.message || `สร้างข้อเสนอสอนแทน ${data.substitutions_count || 0} คาบ`,
      });
    } catch (err: any) {
      toast.error('ส่งต่อจัดสอนแทน (ทดลอง) ไม่สำเร็จ', { description: err.message });
    } finally {
      setSubTriggeringId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'รหัสคำขอ',
      'ชื่อ-นามสกุล',
      'ตำแหน่ง',
      'แผนก',
      'ประเภท',
      'วันที่เริ่ม',
      'วันที่สิ้นสุด',
      'ช่วงเวลา',
      'จำนวนวันทำการ',
      'สถานะ',
      'เหตุผล',
      'สถานที่ไปราชการ',
      'เลขที่หนังสือ',
      'ผู้อนุมัติ',
      'ความเห็น ผ.อ.',
    ];

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = requests.map((r) => [
      r.request_code,
      r.applicant_name,
      r.applicant_position || '',
      r.applicant_department,
      LEAVE_TYPE_LABELS[r.leave_type]?.labelTh || r.leave_type,
      r.start_date,
      r.end_date,
      DURATION_LABELS[r.duration_type],
      r.total_days,
      LEAVE_STATUS_LABELS[r.status]?.labelTh || r.status,
      r.reason,
      r.destination || '',
      r.document_ref || '',
      r.approver_name || '',
      r.approver_comment || '',
    ]);

    const csv =
      '\uFEFF' +
      [headers.map(esc).join(','), ...rows.map((row) => row.map(esc).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sv_staff_leave_${currentMonth || 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEditRoleModal = (roleItem: OrgResponsibilityRole) => {
    setIsNewRoleModal(false);
    setEditingRole({ ...roleItem });
    setStaffSearch('');
  };

  const openNewRoleModal = () => {
    setIsNewRoleModal(true);
    setEditingRole({
      title_th: '',
      description_th: '',
      category: 'operations',
      department_scope: 'all',
      assigned_user_ids: [],
      notify_on_submit: false,
      notify_on_approve: true,
      notify_on_reject: false,
      leave_types: ['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other'],
      is_active: true,
      sort_order: orgRoles.length + 1,
    });
    setStaffSearch('');
  };

  const handleSaveOrgRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    if (!editingRole.title_th?.trim()) {
      toast.error('กรุณาระบุชื่อตำแหน่ง / หน่วยงาน');
      return;
    }

    setIsSavingRole(true);
    try {
      const method = isNewRoleModal ? 'POST' : 'PUT';
      const res = await fetch('/api/leave/org-structure', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRole),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');

      toast.success(data.message || 'บันทึกโครงสร้างเรียบร้อยแล้ว');
      setEditingRole(null);
      await Promise.all([loadOrgStaff(), loadDashboard()]);
    } catch (err: any) {
      toast.error('บันทึกโครงสร้างไม่สำเร็จ', { description: err.message });
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteOrgRole = async (roleItem: OrgResponsibilityRole) => {
    if (roleItem.role_key === 'director_approver' || roleItem.can_approve) {
      toast.error('ไม่สามารถลบตำแหน่งผู้อำนวยการ (ผู้อนุมัติหลัก) ได้');
      return;
    }
    try {
      const res = await fetch(`/api/leave/org-structure?id=${encodeURIComponent(roleItem.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบไม่สำเร็จ');

      toast.success('ลบหน่วยงานเรียบร้อยแล้ว');
      await Promise.all([loadOrgStaff(), loadDashboard()]);
    } catch (err: any) {
      toast.error('ลบไม่สำเร็จ', { description: err.message });
    }
  };

  const upcomingRequests = useMemo(() => {
    if (!todayBangkok) return [];
    const limitDateObj = new Date(`${todayBangkok}T00:00:00Z`);
    limitDateObj.setUTCDate(limitDateObj.getUTCDate() + 14);
    const limitIso = limitDateObj.toISOString().slice(0, 10);

    return requests
      .filter(
        (r) =>
          r.status === 'approved' &&
          r.end_date >= todayBangkok &&
          r.start_date <= limitIso
      )
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [requests, todayBangkok]);

  const unassignedActiveRolesCount = useMemo(
    () =>
      orgRoles.filter(
        (r) => r.is_active && (!r.assigned_user_ids || r.assigned_user_ids.length === 0)
      ).length,
    [orgRoles]
  );

  const groupedOrgRoles = useMemo(() => {
    const order: OrgRoleCategory[] = [
      'approver',
      'executive',
      'operations',
      'department_head',
      'notification',
    ];
    return order
      .map((cat) => ({
        category: cat,
        label: ORG_CATEGORY_LABELS[cat],
        items: orgRoles.filter((r) => r.category === cat),
      }))
      .filter((g) => g.items.length > 0);
  }, [orgRoles]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-foreground/50">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm font-medium">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  if (accessDenied) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-3xl bg-surface border border-foreground/10 shadow-xl text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-foreground">ไม่มีสิทธิ์เข้าถึงแดชบอร์ดบริหารการลา</h2>
        <p className="text-sm text-foreground/65">
          หน้านี้สำหรับผู้อำนวยการโรงเรียน ผู้บริหาร ฝ่ายบุคคล/ธุรการ และผู้ที่ได้รับมอบหมายในโครงสร้างการแจ้งเตือนเท่านั้น
        </p>
        <Link
          href="/leave"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>ไปหน้าแจ้งลา / ไปราชการของฉัน</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header + Role Status Banner */}
      <div className="bg-surface p-6 rounded-3xl border border-foreground/10 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-foreground/55 mb-1.5">
              <Link href="/attendance" className="hover:text-primary inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>หน้าลงเวลา</span>
              </Link>
              <span>•</span>
              <Link href="/leave" className="hover:text-primary">
                หน้าแจ้งลาของฉัน
              </Link>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight">
              แดชบอร์ดการลา ไปราชการ &amp; โครงสร้างแจ้งเตือน
            </h1>
            <p className="text-sm text-foreground/65 mt-1">
              ศูนย์กลางพิจารณาอนุมัติคำขอ ซิงค์เวลาทำงานอัตโนมัติ และกระจายแจ้งเตือนตามโครงสร้างองค์กร
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {permissions.canApprove ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                <ShieldCheck className="w-4 h-4" />
                สิทธิ์ผู้อำนวยการ: อนุมัติ / ไม่อนุมัติคำขอได้
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold">
                <ShieldAlert className="w-4 h-4" />
                โหมดติดตาม{permissions.canManageOrg ? 'และจัดการโครงสร้าง' : ''} (เฉพาะ ผ.อ. เท่านั้นที่กดอนุมัติได้)
              </span>
            )}

            <Link
              href="/leave"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-sm transition-all"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>ยื่นใบลา / ไปราชการ</span>
            </Link>
          </div>
        </div>

        {/* Pending Supabase Migration Notice */}
        {migrationRequired && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm mb-0.5">รอติดตั้งตารางฐานข้อมูลบน Supabase (ทำครั้งเดียว)</strong>
              กรุณานำไฟล์{' '}
              <code className="px-1.5 py-0.5 rounded bg-amber-500/15 font-mono">
                supabase/migrations/20261126000002_staff_leave_and_org_routing.sql
              </code>{' '}
              ไปกด Run ใน Supabase SQL Editor แล้วรีเฟรชหน้านี้ ข้อมูลคำขอลาและโครงสร้างแจ้งเตือนทั้ง 9 หน่วยจะโหลดขึ้นมาทันที
            </div>
          </div>
        )}

        {/* Warning if some active roles have no assigned users yet */}
        {unassignedActiveRolesCount > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                มี <strong>{unassignedActiveRolesCount} ตำแหน่งในโครงสร้าง</strong> (เช่น ฝ่ายวิชาการ หรือหัวหน้าแผนก) ที่ยังไม่ได้กำหนดรายชื่อผู้รับแจ้งเตือน
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('org')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs whitespace-nowrap self-start sm:self-center"
            >
              ตั้งค่าผู้รับแจ้งเตือนเลย
            </button>
          </div>
        )}
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-surface border border-amber-500/25 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-foreground/60">รอ ผ.อ. อนุมัติ</span>
            <ClipboardCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-600 tabular-nums">
            {stats?.pendingCount ?? 0}
          </div>
          <p className="text-[11px] text-foreground/50 mt-1">รายการรอดำเนินการ</p>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-indigo-500/25 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-foreground/60">ลา / ไปราชการวันนี้</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-indigo-600 tabular-nums">
            {stats?.onLeaveTodayCount ?? 0}
          </div>
          <p className="text-[11px] text-foreground/50 mt-1 truncate">
            {stats?.onLeaveToday && stats.onLeaveToday.length > 0
              ? stats.onLeaveToday.map((r) => r.applicant_name).join(', ')
              : 'ไม่มีบุคลากรลาวันนี้'}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-emerald-500/25 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-foreground/60">อนุมัติเดือนนี้</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-600 tabular-nums">
            {stats?.approvedThisMonthCount ?? 0}
            <span className="text-xs font-bold text-foreground/50 ml-1.5">
              ({stats?.approvedDaysThisMonth ?? 0} วัน)
            </span>
          </div>
          <p className="text-[11px] text-foreground/50 mt-1">เดือน {currentMonth || '-'}</p>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-foreground/10 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-foreground/60">แยกประเภทเดือนนี้</span>
            <Briefcase className="w-4 h-4 text-[#7B1C3E]" />
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold mt-2">
            <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-700">
              ป่วย {stats?.byTypeThisMonth?.sick ?? 0}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-800">
              กิจ {stats?.byTypeThisMonth?.personal ?? 0}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700">
              ราชการ {stats?.byTypeThisMonth?.official_duty ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-2 rounded-2xl border border-foreground/10 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'queue'
                ? 'bg-[#7B1C3E] text-white shadow-sm'
                : 'text-foreground/70 hover:bg-foreground/5'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>คิวอนุมัติ ผ.อ. &amp; รายการทั้งหมด ({stats?.pendingCount ?? 0} รอ)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-[#7B1C3E] text-white shadow-sm'
                : 'text-foreground/70 hover:bg-foreground/5'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>ภาพรวมวันนี้ &amp; ปฏิทิน</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('org')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'org'
                ? 'bg-[#7B1C3E] text-white shadow-sm'
                : 'text-foreground/70 hover:bg-foreground/5'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>โครงสร้างหน้าที่ &amp; การแจ้งเตือน</span>
            {unassignedActiveRolesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black">
                {unassignedActiveRolesCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-xs font-bold transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* TAB 1: Approval Queue & Requests */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="bg-surface p-4 rounded-2xl border border-foreground/10 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-foreground/5 text-foreground/70 hover:bg-foreground/10'
                  }`}
                >
                  {st === 'all' ? 'ทั้งหมด' : LEAVE_STATUS_LABELS[st].labelTh}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-52">
                <Search className="w-3.5 h-3.5 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadDashboard();
                  }}
                  placeholder="ค้นหาชื่อ / รหัส / เหตุผล..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-background border border-foreground/15 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <select
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-background border border-foreground/15 text-xs font-medium"
              >
                <option value="all">ทุกประเภท</option>
                {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABELS[t].labelTh}
                  </option>
                ))}
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-background border border-foreground/15 text-xs font-medium"
              >
                <option value="all">ทุกแผนก</option>
                {DEPARTMENT_SCOPES.filter((d) => d !== 'all').map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-background border border-foreground/15 text-xs font-medium"
              />

              <button
                type="button"
                onClick={loadDashboard}
                className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20"
              >
                กรอง
              </button>
            </div>
          </div>

          {/* Request List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-foreground/45 bg-surface rounded-3xl border border-foreground/10">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs font-medium">กำลังโหลดรายการคำขอ...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-3xl border border-foreground/10 text-foreground/50">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold">ไม่มีคำขอในสถานะที่เลือก</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((item) => {
                const typeCfg = LEAVE_TYPE_LABELS[item.leave_type];
                const statusCfg = LEAVE_STATUS_LABELS[item.status];
                const isHighlighted = highlightedRequestId === item.id;

                const matchedApproveRoles = resolveMatchedOrgRoles(orgRoles, {
                  event: 'approve',
                  leaveType: item.leave_type,
                  applicantDepartment: item.applicant_department,
                  applicantUserId: item.user_id,
                });
                const previewRecipients = deduplicateNotifiedUsers(matchedApproveRoles);

                return (
                  <div
                    id={`leave-req-${item.id}`}
                    key={item.id}
                    className={`p-5 md:p-6 rounded-3xl bg-surface border shadow-md transition-all space-y-4 ${
                      isHighlighted
                        ? 'border-[#7B1C3E] ring-2 ring-[#7B1C3E]/25'
                        : 'border-foreground/10'
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#7B1C3E]/10 text-[#7B1C3E] font-black flex items-center justify-center text-sm shrink-0">
                          {item.applicant_name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-base text-foreground">
                              {item.applicant_name}
                            </span>
                            <span className="text-[11px] font-mono text-foreground/50">
                              ({item.request_code})
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-foreground/5 text-foreground/70 text-[11px] font-bold">
                              {item.applicant_department}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/55">
                            {item.applicant_position || 'บุคลากรโรงเรียน'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${typeCfg.badgeClass}`}
                        >
                          {typeCfg.labelTh}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.badgeClass}`}
                        >
                          {statusCfg.labelTh}
                        </span>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-foreground/[0.03] border border-foreground/5">
                        <div className="text-[11px] font-bold text-foreground/50 mb-0.5">
                          ช่วงวันที่ &amp; ระยะเวลา
                        </div>
                        <div className="font-bold text-foreground">
                          {formatLeaveDateRangeTh(item.start_date, item.end_date)} ({item.total_days} วัน)
                        </div>
                        <div className="text-[11px] text-foreground/60 mt-0.5">
                          {DURATION_LABELS[item.duration_type]}
                        </div>
                      </div>

                      <div className="md:col-span-2 p-3 rounded-2xl bg-foreground/[0.03] border border-foreground/5 space-y-1">
                        <div className="text-[11px] font-bold text-foreground/50">
                          เหตุผล / รายละเอียด
                        </div>
                        <div className="text-foreground/85 leading-relaxed">{item.reason}</div>
                        {(item.destination || item.document_ref || item.contact_phone) && (
                          <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                            {item.destination && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {item.destination}
                              </span>
                            )}
                            {item.document_ref && <span>หนังสือ: {item.document_ref}</span>}
                            {item.contact_phone && (
                              <span className="text-foreground/60">โทร: {item.contact_phone}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Handover / Attachment */}
                    {(item.substitute_note || item.attachment_path) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-primary/5 border border-primary/10 text-xs">
                        <div className="text-foreground/80">
                          {item.substitute_note ? (
                            <>
                              <strong>โน้ตฝากงาน / สอนแทน:</strong> {item.substitute_note}
                            </>
                          ) : (
                            <span className="text-foreground/55">มีเอกสารประกอบคำขอ</span>
                          )}
                        </div>
                        {item.attachment_path && (
                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(item.attachment_path!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-primary/20 text-primary font-bold text-xs hover:bg-primary/10"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>{item.attachment_name || 'เปิดเอกสารแนบ'}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Pending Request: Preview Recipients & Director Controls */}
                    {item.status === 'pending' && (
                      <div className="pt-3 border-t border-foreground/10 space-y-3">
                        <div className="text-[11px] text-foreground/65 flex flex-wrap items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-primary" />
                          <span>เมื่อ ผ.อ. อนุมัติจะแจ้งเตือนไปยัง:</span>
                          {matchedApproveRoles.length > 0 ? (
                            matchedApproveRoles.map((m) => (
                              <span
                                key={m.role.id}
                                className="px-2 py-0.5 rounded-lg bg-foreground/5 border border-foreground/10 font-semibold text-foreground/80"
                              >
                                {m.role.title_th} (
                                {m.recipientUserIds
                                  .map((uid) => userNamesMap[uid] || 'ผู้รับผิดชอบ')
                                  .join(', ')}
                                )
                              </span>
                            ))
                          ) : (
                            <span className="text-amber-700 font-semibold">
                              ยังไม่มีผู้รับผิดชอบตามโครงสร้าง ({previewRecipients.length} คน)
                            </span>
                          )}
                        </div>

                        {permissions.canApprove ? (
                          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                            <input
                              type="text"
                              value={commentsById[item.id] || ''}
                              onChange={(e) =>
                                setCommentsById((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="ความเห็น / คำสั่งเพิ่มเติมจาก ผ.อ. (ไม่บังคับ)..."
                              className="flex-1 px-3.5 py-2.5 rounded-xl bg-background border border-foreground/15 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={reviewingId === item.id}
                                onClick={() => handleReview(item.id, 'rejected')}
                                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/25 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>ไม่อนุมัติ</span>
                              </button>
                              <button
                                type="button"
                                disabled={reviewingId === item.id}
                                onClick={() => handleReview(item.id, 'approved')}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                              >
                                {reviewingId === item.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                <span>อนุมัติ &amp; แจ้งเตือนโครงสร้าง</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>
                              อยู่ระหว่างรอผู้อำนวยการโรงเรียนพิจารณาอนุมัติ (สิทธิ์การกดอนุมัติเปิดให้เฉพาะบัญชี ผ.อ. เท่านั้น)
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reviewed Audit Trail */}
                    {item.status !== 'pending' && (
                      <div className="pt-3 border-t border-foreground/10 space-y-2 text-[11px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-foreground/75">
                            {item.approver_name && (
                              <span>
                                พิจารณาโดย <strong>{item.approver_name}</strong>
                                {item.approver_comment ? ` — "${item.approver_comment}"` : ''}
                              </span>
                            )}
                            {item.attendance_synced && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                ซิงค์เวลาทำงานแล้ว ({item.attendance_synced_dates?.length || 0} วัน)
                              </span>
                            )}
                          </div>

                          {/* Optional Preview Substitution Handoff for Teachers */}
                          {item.status === 'approved' && item.personnel_id && (
                            <button
                              type="button"
                              disabled={subTriggeringId === item.id}
                              onClick={() => handlePreviewSubstitution(item)}
                              title="ระบบจัดสอนแทนอัตโนมัติยังอยู่ระหว่างพัฒนา/ยังไม่เปิดใช้งานจริง"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-[11px] transition-all"
                            >
                              {subTriggeringId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
                              )}
                              <span>ส่งต่อจัดสอนแทน (ทดลอง)</span>
                            </button>
                          )}
                        </div>

                        {Array.isArray(item.notified_recipients) &&
                          item.notified_recipients.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 text-foreground/60">
                              <span className="font-semibold">แจ้งเตือนแล้ว:</span>
                              {item.notified_recipients.map((rec, idx) => (
                                <span
                                  key={`${rec.user_id}-${rec.event}-${idx}`}
                                  className="px-2 py-0.5 rounded-lg bg-foreground/5 border border-foreground/10"
                                >
                                  {rec.full_name} ({rec.title_th})
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Today & Calendar Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-surface p-6 rounded-3xl border border-foreground/10 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
              <div>
                <h2 className="font-bold text-base text-foreground">
                  บุคลากรที่ลา / ไปราชการวันนี้ ({formatThaiDateShort(todayBangkok)})
                </h2>
                <p className="text-xs text-foreground/55">
                  ข้อมูลคำขอที่ได้รับการอนุมัติจากผู้อำนวยการแล้ว
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-700 text-xs font-black">
                {stats?.onLeaveTodayCount ?? 0} ท่าน
              </span>
            </div>

            {!stats?.onLeaveToday || stats.onLeaveToday.length === 0 ? (
              <div className="p-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center text-emerald-700 font-bold text-sm">
                วันนี้บุคลากรมาปฏิบัติงานครบทุกท่าน ไม่มีรายการลา/ไปราชการที่อนุมัติไว้
              </div>
            ) : (
              <div className="space-y-3">
                {stats.onLeaveToday.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl border border-foreground/10 bg-background/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-sm text-foreground">
                        {r.applicant_name}{' '}
                        <span className="text-xs font-medium text-foreground/55">
                          ({r.applicant_department})
                        </span>
                      </div>
                      <div className="text-xs text-foreground/70 mt-0.5">{r.reason}</div>
                      {r.substitute_note && (
                        <div className="text-[11px] text-primary mt-1 font-medium">
                          ฝากงาน: {r.substitute_note}
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-center ${
                        LEAVE_TYPE_LABELS[r.leave_type].badgeClass
                      }`}
                    >
                      {LEAVE_TYPE_LABELS[r.leave_type].labelTh}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming 14 days */}
            <div className="pt-4 border-t border-foreground/10 space-y-3">
              <h3 className="font-bold text-sm text-foreground">
                ตารางลา / ไปราชการล่วงหน้า 14 วันข้างหน้า
              </h3>
              {upcomingRequests.length === 0 ? (
                <p className="text-xs text-foreground/50">ไม่มีกำหนดการลา/ไปราชการที่อนุมัติไว้ในช่วง 14 วัน</p>
              ) : (
                <div className="space-y-2">
                  {upcomingRequests.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-foreground">{r.applicant_name}</span>{' '}
                        <span className="text-foreground/55">({r.applicant_department})</span>
                        <span className="block text-[11px] text-foreground/65">
                          {formatLeaveDateRangeTh(r.start_date, r.end_date)} • {r.reason}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          LEAVE_TYPE_LABELS[r.leave_type].badgeClass
                        }`}
                      >
                        {LEAVE_TYPE_LABELS[r.leave_type].shortTh} ({r.total_days} วัน)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Department Breakdown */}
          <div className="lg:col-span-5 bg-surface p-6 rounded-3xl border border-foreground/10 shadow-xl space-y-5">
            <div className="border-b border-foreground/10 pb-3">
              <h2 className="font-bold text-base text-foreground">สถิติวันลาแยกตามแผนก (เดือนนี้)</h2>
              <p className="text-xs text-foreground/55">นับจากคำขอที่ ผ.อ. อนุมัติในเดือน {currentMonth}</p>
            </div>

            {Object.keys(stats?.byDepartmentThisMonth || {}).length === 0 ? (
              <p className="text-xs text-foreground/50 py-8 text-center">
                ยังไม่มีข้อมูลการลาที่อนุมัติในเดือนนี้
              </p>
            ) : (
              <div className="space-y-3.5">
                {Object.entries(stats?.byDepartmentThisMonth || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([dept, days]) => {
                    const maxDays = Math.max(
                      1,
                      ...Object.values(stats?.byDepartmentThisMonth || {})
                    );
                    const pct = Math.round((days / maxDays) * 100);
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-foreground">{dept}</span>
                          <span className="text-primary tabular-nums">{days} วัน</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-foreground/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#7B1C3E] to-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Organizational Structure & Notification Routing */}
      {activeTab === 'org' && (
        <div className="space-y-6">
          <div className="bg-surface p-5 rounded-3xl border border-foreground/10 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-foreground">
                  โครงสร้างหน้าที่และความรับผิดชอบในการแจ้งเตือน (Org Notification Routing)
                </h2>
                <p className="text-xs text-foreground/60 mt-0.5">
                  กำหนดว่าเมื่อบุคลากรยื่นลา หรือเมื่อ ผ.อ. อนุมัติ ระบบจะแจ้งเตือนไปยังฝ่ายใดและบุคคลใดบ้าง
                </p>
              </div>
            </div>

            {permissions.canManageOrg && (
              <button
                type="button"
                onClick={openNewRoleModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#7B1C3E] hover:bg-[#641531] text-white font-bold text-xs shadow-sm transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มหน่วยงาน / หน้าที่ใหม่</span>
              </button>
            )}
          </div>

          <div className="space-y-6">
            {groupedOrgRoles.map((group) => (
              <div key={group.category} className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground/55 px-1">
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.items.map((roleItem) => {
                    const hasAssignees = (roleItem.assigned_user_ids || []).length > 0;
                    return (
                      <div
                        key={roleItem.id}
                        className={`p-5 rounded-3xl bg-surface border shadow-sm space-y-3 transition-all ${
                          !roleItem.is_active
                            ? 'opacity-60 border-foreground/10'
                            : !hasAssignees
                            ? 'border-amber-500/40 bg-amber-500/[0.02]'
                            : 'border-foreground/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-sm text-foreground">
                                {roleItem.title_th}
                              </h4>
                              {roleItem.can_approve && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-black">
                                  สิทธิ์อนุมัติหลัก (ผ.อ.)
                                </span>
                              )}
                            </div>
                            {roleItem.description_th && (
                              <p className="text-xs text-foreground/60 mt-1">
                                {roleItem.description_th}
                              </p>
                            )}
                          </div>

                          {permissions.canManageOrg && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditRoleModal(roleItem)}
                                className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                                title="แก้ไขผู้รับผิดชอบ"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {roleItem.role_key !== 'director_approver' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOrgRole(roleItem)}
                                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-colors"
                                  title="ลบหน่วยงานนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Routing rules badges */}
                        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                          <span className="px-2 py-0.5 rounded-lg bg-foreground/5 text-foreground/75">
                            ขอบเขต: {roleItem.department_scope === 'all' ? 'ทุกแผนก' : roleItem.department_scope}
                          </span>
                          {roleItem.notify_on_submit && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800">
                              แจ้งเตือนตอนยื่นคำขอ
                            </span>
                          )}
                          {roleItem.notify_on_approve && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700">
                              แจ้งเตือนตอน ผ.อ. อนุมัติ
                            </span>
                          )}
                          {roleItem.notify_on_reject && (
                            <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700">
                              แจ้งเตือนตอนไม่อนุมัติ
                            </span>
                          )}
                        </div>

                        {/* Assigned personnel */}
                        <div className="pt-2 border-t border-foreground/10">
                          <div className="text-[11px] font-bold text-foreground/55 mb-1.5">
                            ผู้รับผิดชอบในตำแหน่งนี้:
                          </div>
                          {hasAssignees ? (
                            <div className="flex flex-wrap gap-1.5">
                              {roleItem.assigned_user_ids.map((uid) => {
                                const staffMatch = staffList.find((s) => s.user_id === uid);
                                const display =
                                  staffMatch?.full_name || userNamesMap[uid] || uid;
                                return (
                                  <span
                                    key={uid}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-xs font-bold"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    {display}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 text-xs text-amber-700 font-semibold">
                              <span>ยังไม่ได้ระบุรายชื่อผู้รับผิดชอบ (จะยังไม่ส่งแจ้งเตือนสำหรับหน่วยนี้)</span>
                              {permissions.canManageOrg && (
                                <button
                                  type="button"
                                  onClick={() => openEditRoleModal(roleItem)}
                                  className="underline font-bold"
                                >
                                  เลือกผู้รับผิดชอบ
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org Structure Role Modal Editor */}
      <AnimatePresence>
        {editingRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleSaveOrgRole}
              className="bg-surface border border-foreground/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-foreground/10 flex items-center justify-between bg-primary/5">
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    {isNewRoleModal ? 'เพิ่มหน่วยงานในโครงสร้างแจ้งเตือน' : 'แก้ไขโครงสร้างผู้รับผิดชอบ'}
                  </h3>
                  <p className="text-[11px] text-foreground/55">
                    กำหนดรายชื่อผู้รับแจ้งเตือนและเงื่อนไขการส่งแจ้งเตือน
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="w-8 h-8 rounded-full hover:bg-foreground/10 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-foreground/75 mb-1">
                      ชื่อตำแหน่ง / หน่วยงาน <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editingRole.title_th || ''}
                      onChange={(e) =>
                        setEditingRole((prev) => ({ ...prev, title_th: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-background border border-foreground/15"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-foreground/75 mb-1">
                      ขอบเขตแผนกที่จะรับแจ้งเตือน
                    </label>
                    <select
                      value={editingRole.department_scope || 'all'}
                      onChange={(e) =>
                        setEditingRole((prev) => ({ ...prev, department_scope: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-background border border-foreground/15"
                    >
                      <option value="all">ทุกแผนกในโรงเรียน</option>
                      {DEPARTMENT_SCOPES.filter((d) => d !== 'all').map((dept) => (
                        <option key={dept} value={dept}>
                          เฉพาะแผนก {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-foreground/75 mb-1">คำอธิบายหน้าที่</label>
                  <input
                    type="text"
                    value={editingRole.description_th || ''}
                    onChange={(e) =>
                      setEditingRole((prev) => ({ ...prev, description_th: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-background border border-foreground/15"
                  />
                </div>

                {/* Trigger checkboxes */}
                <div className="p-3.5 rounded-2xl bg-foreground/[0.03] border border-foreground/10 space-y-2">
                  <div className="font-bold text-foreground/80">เงื่อนไขช่วงเวลาที่แจ้งเตือน</div>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingRole.notify_on_submit)}
                        onChange={(e) =>
                          setEditingRole((prev) => ({
                            ...prev,
                            notify_on_submit: e.target.checked,
                          }))
                        }
                      />
                      <span>แจ้งเตือนทันทีเมื่อยื่นคำขอ</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingRole.notify_on_approve)}
                        onChange={(e) =>
                          setEditingRole((prev) => ({
                            ...prev,
                            notify_on_approve: e.target.checked,
                          }))
                        }
                      />
                      <span>แจ้งเตือนเมื่อ ผ.อ. อนุมัติ</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingRole.notify_on_reject)}
                        onChange={(e) =>
                          setEditingRole((prev) => ({
                            ...prev,
                            notify_on_reject: e.target.checked,
                          }))
                        }
                      />
                      <span>แจ้งเตือนเมื่อไม่อนุมัติ</span>
                    </label>
                  </div>
                </div>

                {/* Leave Types checkboxes */}
                <div className="p-3.5 rounded-2xl bg-foreground/[0.03] border border-foreground/10 space-y-2">
                  <div className="font-bold text-foreground/80">ประเภทคำขอที่รับแจ้งเตือน</div>
                  <div className="flex flex-wrap gap-3">
                    {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => {
                      const checked = (editingRole.leave_types || []).includes(t);
                      return (
                        <label key={t} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const current = new Set(editingRole.leave_types || []);
                              if (e.target.checked) current.add(t);
                              else current.delete(t);
                              setEditingRole((prev) => ({
                                ...prev,
                                leave_types: Array.from(current),
                              }));
                            }}
                          />
                          <span>{LEAVE_TYPE_LABELS[t].shortTh}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Staff Multi-Select */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-bold text-foreground/75">
                      เลือกผู้รับผิดชอบในตำแหน่งนี้ ({(editingRole.assigned_user_ids || []).length} ท่าน)
                    </label>
                    <input
                      type="text"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="ค้นหาชื่อบุคลากร..."
                      className="px-2.5 py-1 rounded-lg bg-background border border-foreground/15 text-[11px]"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-2xl border border-foreground/10 p-2 space-y-1 bg-background/60">
                    {staffList
                      .filter((s) => {
                        if (!staffSearch.trim()) return true;
                        const q = staffSearch.trim().toLowerCase();
                        return (
                          s.full_name.toLowerCase().includes(q) ||
                          s.position_th.toLowerCase().includes(q) ||
                          s.department.toLowerCase().includes(q)
                        );
                      })
                      .map((person) => {
                        const selected = (editingRole.assigned_user_ids || []).includes(
                          person.user_id
                        );
                        return (
                          <label
                            key={person.user_id}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                              selected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-foreground/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  const current = new Set(editingRole.assigned_user_ids || []);
                                  if (e.target.checked) current.add(person.user_id);
                                  else current.delete(person.user_id);
                                  setEditingRole((prev) => ({
                                    ...prev,
                                    assigned_user_ids: Array.from(current),
                                  }));
                                }}
                              />
                              <span>{person.full_name}</span>
                            </div>
                            <span className="text-[10px] text-foreground/55">
                              {person.position_th}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-foreground/10 bg-foreground/[0.02] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="px-4 py-2 rounded-xl bg-foreground/10 hover:bg-foreground/15 font-bold text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingRole}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingRole && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>บันทึกโครงสร้าง</span>
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
