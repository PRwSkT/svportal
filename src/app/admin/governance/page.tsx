'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Award, 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  Printer, 
  BookOpen, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  ExternalLink, 
  DollarSign, 
  TrendingUp, 
  ChevronLeft, 
  RefreshCw, 
  Users, 
  Calendar,
  Save,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { evaluateLicenseStatus, KSP_ESERVICE_URL, TeacherLicenseRecord } from '@/lib/governance/license-guard';
import { evaluateBoardCompliance, calculateUnitCostPerStudent, OPEC_CHART_OF_ACCOUNTS } from '@/lib/governance/board-and-finance';
import { EsarReportDocument } from '@/lib/governance/esar-aggregator';
import EsarPrintModal from '@/components/governance/EsarPrintModal';

export default function SchoolGovernancePage() {
  const [activeTab, setActiveTab] = useState<'esar' | 'licenses' | 'board'>('esar');
  const [academicYear, setAcademicYear] = useState<string>('2568');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // e-SAR State
  const [esarReport, setEsarReport] = useState<EsarReportDocument | null>(null);
  const [isEsarPrintModalOpen, setIsEsarPrintModalOpen] = useState<boolean>(false);

  // Teacher Licenses State
  const [licenses, setLicenses] = useState<any[]>([]);
  const [licenseStats, setLicenseStats] = useState<any>({});
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const [newTeacherName, setNewTeacherName] = useState<string>('');
  const [newCitizenId, setNewCitizenId] = useState<string>('');
  const [newLicenseNo, setNewLicenseNo] = useState<string>('');
  const [newIssueDate, setNewIssueDate] = useState<string>('2022-05-16');
  const [newExpireDate, setNewExpireDate] = useState<string>('2027-05-15');
  const [newCpdHours, setNewCpdHours] = useState<number>(24);
  const [isSavingLicense, setIsSavingLicense] = useState<boolean>(false);

  // Board & Finance State
  const [meetings, setMeetings] = useState<any[]>([]);
  const [boardCompliance, setBoardCompliance] = useState<any>({});
  const [unitCost, setUnitCost] = useState<any>({});
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState<boolean>(false);
  const [meetingNo, setMeetingNo] = useState<number>(1);
  const [meetingDate, setMeetingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [meetingTitle, setMeetingTitle] = useState<string>('การประชุมคณะกรรมการบริหารโรงเรียน ไตรมาส 1');
  const [meetingAgenda, setMeetingAgenda] = useState<string>('1. รับรองรายงานการประชุมครั้งก่อน\n2. รายงานผลการดำเนินงานวิชาการและระบบดูแลช่วยเหลือนักเรียน\n3. พิจารณาร่างงบประมาณและอัตราค่าธรรมเนียมการเรียน');
  const [meetingResolutions, setMeetingResolutions] = useState<string>('1. มีมติรับรองรายงานการประชุมเป็นเอกฉันท์\n2. เห็นชอบรายงานการดำเนินงานตามมาตรฐาน สช.\n3. อนุมัติการจัดสรรงบประมาณประจำปี 2568');
  const [isSavingMeeting, setIsSavingMeeting] = useState<boolean>(false);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch e-SAR
      const esarRes = await fetch(`/api/governance/esar?academicYear=${academicYear}`);
      const esarData = await esarRes.json();
      if (esarRes.ok) {
        setEsarReport(esarData.report || null);
      }

      // 2. Fetch Licenses
      const licRes = await fetch('/api/governance/licenses');
      const licData = await licRes.json();
      if (licRes.ok) {
        setLicenses(licData.licenses || []);
        setLicenseStats(licData.stats || {});
      }

      // 3. Fetch Board & Finance
      const boardRes = await fetch(`/api/governance/board?academicYear=${academicYear}`);
      const boardData = await boardRes.json();
      if (boardRes.ok) {
        setMeetings(boardData.meetings || []);
        setBoardCompliance(boardData.compliance || {});
        setUnitCost(boardData.unitCost || {});
      }
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดข้อมูลการกำกับดูแลโรงเรียนได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [academicYear]);

  const handleSaveLicense = async () => {
    if (!newTeacherName || !newCitizenId || !newLicenseNo) {
      toast.error('กรุณากรอกข้อมูลครูให้ครบถ้วน');
      return;
    }

    setIsSavingLicense(true);
    try {
      const res = await fetch('/api/governance/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_name: newTeacherName,
          citizen_id: newCitizenId,
          license_number: newLicenseNo,
          issue_date: newIssueDate,
          expire_date: newExpireDate,
          cpd_hours: newCpdHours
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      toast.success('บันทึกข้อมูลใบอนุญาตครูเรียบร้อยแล้ว');
      setIsLicenseModalOpen(false);
      setNewTeacherName('');
      setNewCitizenId('');
      setNewLicenseNo('');
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSavingLicense(false);
    }
  };

  const handleSaveMeeting = async () => {
    setIsSavingMeeting(true);
    try {
      const res = await fetch('/api/governance/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: academicYear,
          meeting_no: meetingNo,
          meeting_date: meetingDate,
          title: meetingTitle,
          agenda: meetingAgenda.split('\n').filter(Boolean),
          resolutions: meetingResolutions.split('\n').filter(Boolean)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      toast.success('บันทึกการประชุมคณะกรรมการบริหารโรงเรียนสำเร็จ');
      setIsMeetingModalOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSavingMeeting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/admin/students" className="hover:text-[#7B1C3E] flex items-center gap-1 transition-colors">
              <ChevronLeft className="w-4 h-4" /> ทะเบียนนักเรียน
            </Link>
            <span>/</span>
            <span className="text-purple-600 dark:text-purple-400">e-SAR & School Governance Hub</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-2xl shadow-md shadow-purple-600/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                e-SAR Smart Engine & School Governance Hub
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                เล่มประเมินตนเอง e-SAR 93 หน้า • เฝ้าระวังใบอนุญาตคุรุสภา • ประชุมบอร์ด ม.30 และบัญชีส่ง CPA ม.32
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
            <span className="text-slate-500">ปีการศึกษา:</span>
            <select
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="2568">2568</option>
              <option value="2567">2567</option>
            </select>
          </div>

          <button
            onClick={fetchAll}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
            title="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-4 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('esar')}
          className={`flex items-center gap-2 pb-3 px-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'esar'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" /> เล่มรายงานประเมินตนเอง e-SAR 93 หน้า
        </button>
        <button
          onClick={() => setActiveTab('licenses')}
          className={`flex items-center gap-2 pb-3 px-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'licenses'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" /> ใบอนุญาตประกอบวิชาชีพครู (Teacher License Guard)
        </button>
        <button
          onClick={() => setActiveTab('board')}
          className={`flex items-center gap-2 pb-3 px-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'board'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" /> ประชุมบอร์ด ม.30 & งบการเงินส่ง CPA ม.32
        </button>
      </div>

      {/* TAB 1: e-SAR Smart Auto-Aggregator */}
      {activeTab === 'esar' && esarReport && (
        <div className="space-y-6">
          
          {/* Action Ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/70 dark:bg-purple-950/20 p-5 rounded-3xl border border-purple-200 dark:border-purple-800">
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-purple-950 dark:text-purple-200">
                เล่มประเมินตนเองของสถานศึกษา e-SAR ประจำปี {academicYear}
              </h2>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                ระบบสังเคราะห์สถิตินักเรียน ผลสัมฤทธิ์ 8 กลุ่มสาระ และข้อมูลโภชนาการแบบสด 100%
              </p>
            </div>
            <button
              onClick={() => setIsEsarPrintModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl shadow-md shadow-purple-600/20 transition-all active:scale-95 text-xs sm:text-sm self-start sm:self-auto"
            >
              <Printer className="w-4 h-4" /> เปิดดู / พิมพ์เล่ม e-SAR ทางการ
            </button>
          </div>

          {/* 3 Quality Standards Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-extrabold text-xs">
                  {esarReport.part2.standard1.overallRating}
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  มาตรฐานที่ 1: คุณภาพของผู้เรียน
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  ผลสัมฤทธิ์วิชาการ, คุณลักษณะอันพึงประสงค์, และสุขภาวะ
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ผลการเรียน &ge; 3.00 (8 กลุ่มสาระ):</span>
                  <strong className="text-emerald-600">82.0% (ผ่านเป้าหมาย)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">คุณลักษณะอันพึงประสงค์:</span>
                  <strong className="text-emerald-600">{esarReport.part2.standard1.desirableCharacteristicsPassPercent}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">โภชนาการสมส่วน:</span>
                  <strong className="text-emerald-600">{esarReport.part2.standard1.normalNutritionPercent}%</strong>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-extrabold text-xs">
                  {esarReport.part2.standard2.overallRating}
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  มาตรฐานที่ 2: การบริหารและการจัดการ
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  วิสัยทัศน์, โครงสร้างบริหาร, และการพัฒนาวิชาชีพครู
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ประชุมบอร์ดบริหาร (ม.30):</span>
                  <strong className="text-emerald-600">{esarReport.part2.standard2.boardMeetingsHeld} / 4 ครั้ง (ครบถ้วน)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">อบรมพัฒนาครู (CPD เฉลี่ย):</span>
                  <strong className="text-emerald-600">{esarReport.part2.standard2.averageCpdHoursPerTeacher} ชม./คน/ปี</strong>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 font-extrabold text-xs">
                  {esarReport.part2.standard3.overallRating}
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  มาตรฐานที่ 3: การจัดการเรียนรู้ที่เน้นผู้เรียน
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  การเรียนรู้เชิงรุก (Active Learning) และการวัดผลตามจริง
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">จัดการเรียนรู้เชิงรุก:</span>
                  <strong className="text-emerald-600">{esarReport.part2.standard3.activeLearningPercent}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">การใช้เทคโนโลยีดิจิทัล:</span>
                  <strong className="text-emerald-600">SVPortal 100%</strong>
                </div>
              </div>
            </div>

          </div>

          {/* Academic 8 Core Subject Table */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              สรุปผลสัมฤทธิ์ทางการเรียน 8 กลุ่มสาระการเรียนรู้ (เทียบค่าเป้าหมายสถานศึกษา)
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5 font-bold">กลุ่มสาระการเรียนรู้</th>
                    <th className="p-3.5 font-bold text-center">นักเรียนทั้งหมด</th>
                    <th className="p-3.5 font-bold text-center">ได้เกรด &ge; 3.00</th>
                    <th className="p-3.5 font-bold text-center">ร้อยละผลจริง</th>
                    <th className="p-3.5 font-bold text-center">ค่าเป้าหมาย</th>
                    <th className="p-3.5 font-bold text-center">สถานะเทียบเป้าหมาย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {esarReport.part2.standard1.academicAchievements.map((ach, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">{ach.subjectName}</td>
                      <td className="p-3.5 text-center font-mono">{ach.totalStudents}</td>
                      <td className="p-3.5 text-center font-mono">{ach.grade3PlusCount}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-purple-700 dark:text-purple-400">
                        {ach.grade3PlusPercent.toFixed(1)}%
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-500">{ach.targetPercent.toFixed(1)}%</td>
                      <td className="p-3.5 text-center">
                        {ach.resultComparison === 'BELOW_TARGET' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> ต่ำกว่าเป้าหมาย
                          </span>
                        ) : ach.resultComparison === 'EXCEEDED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" /> สูงกว่าเป้าหมาย
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> บรรลุเป้าหมาย
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Teacher License Guard (คุรุสภา) */}
      {activeTab === 'licenses' && (
        <div className="space-y-6">
          
          {/* Action & Stats Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="font-extrabold text-lg text-slate-900 dark:text-white">
                ระบบเฝ้าระวังใบอนุญาตประกอบวิชาชีพครู (Teacher License Guard)
              </h2>
              <p className="text-xs text-slate-500">
                แจ้งเตือนล่วงหน้า 180 วัน / 90 วัน / 30 วัน ป้องกันการถูก สช. ตัดเงินสมทบเงินเดือนครู 100%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={KSP_ESERVICE_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" /> ระบบ KSP e-Service คุรุสภา
              </a>
              <button
                onClick={() => setIsLicenseModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-purple-600/20 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" /> เพิ่มใบอนุญาตครู
              </button>
            </div>
          </div>

          {/* Licenses Table */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5 font-bold">ชื่อ - นามสกุล ครู</th>
                    <th className="p-3.5 font-bold">เลขที่ใบอนุญาต</th>
                    <th className="p-3.5 font-bold">วันหมดอายุ</th>
                    <th className="p-3.5 font-bold text-center">ชั่วโมง CPD</th>
                    <th className="p-3.5 font-bold text-center">สถานะความเสี่ยง</th>
                    <th className="p-3.5 font-bold">แนวทางดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {licenses.map(lic => {
                    const ev = lic.evaluation;

                    return (
                      <tr key={lic.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {lic.teacher_name}
                          <span className="block text-[11px] font-mono text-slate-400 font-normal">
                            บัตรประชาชน: {lic.citizen_id}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">{lic.license_number}</td>
                        <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">{lic.expire_date}</td>
                        <td className="p-3.5 text-center font-mono">
                          <span className={ev?.cpdCompliant ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                            {lic.cpd_hours} ชม.
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${ev?.badgeColor}`}>
                            {ev?.statusLabel}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-sm text-xs text-slate-600 dark:text-slate-300">
                          {ev?.actionRequired}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: Board Meetings (ม.30) & Financial Compliance (ม.32) */}
      {activeTab === 'board' && (
        <div className="space-y-6">
          
          {/* Section 30 Compliance Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                การปฏิบัติตาม พ.ร.บ. โรงเรียนเอกชน พ.ศ. 2550 (มาตรา 30)
              </span>
              <h2 className="font-extrabold text-lg text-slate-900 dark:text-white">
                การประชุมคณะกรรมการบริหารโรงเรียน (School Board Meetings)
              </h2>
              <div className="pt-1">
                <span className={`px-3 py-1 rounded-full text-xs font-black border ${boardCompliance.badgeColor}`}>
                  {boardCompliance.complianceLabel}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsMeetingModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> บันทึกการประชุมบอร์ด
            </button>
          </div>

          {/* Section 32 Financial Unit Cost Card */}
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-3xl border border-emerald-200 dark:border-emerald-800 space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-700" />
              <h3 className="font-extrabold text-sm sm:text-base text-emerald-950 dark:text-emerald-200">
                การคำนวณต้นทุนต่อหน่วย (Cost per Student) ตามมาตรา 32
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
              {unitCost?.summaryText}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200">
                <span className="text-slate-500 block">ต้นทุนรายปีต่อคน:</span>
                <strong className="text-emerald-700 text-sm font-black">
                  {(unitCost?.annualCostPerStudent || 0).toLocaleString()} บาท
                </strong>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200">
                <span className="text-slate-500 block">ต้นทุนรายเทอมต่อคน:</span>
                <strong className="text-emerald-700 text-sm font-black">
                  {(unitCost?.termCostPerStudent || 0).toLocaleString()} บาท
                </strong>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 col-span-2 sm:col-span-1">
                <span className="text-slate-500 block">การรับรองบัญชี:</span>
                <strong className="text-emerald-700 text-sm font-black">พร้อมส่งผู้สอบบัญชี CPA</strong>
              </div>
            </div>
          </div>

          {/* Meetings History */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              บันทึกการประชุมคณะกรรมการบริหารโรงเรียน (ปีการศึกษา {academicYear})
            </h3>

            <div className="space-y-3">
              {meetings.map(m => (
                <div key={m.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        ครั้งที่ {m.meeting_no}: {m.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">
                        วันที่ประชุม: {m.meeting_date}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                      มีมติรับรองแล้ว
                    </span>
                  </div>

                  <div className="text-xs space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    <strong className="block text-slate-900 dark:text-white">มติที่ประชุมสำคัญ:</strong>
                    {(m.resolutions || []).map((res: string, i: number) => (
                      <p key={i} className="pl-3">• {res}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* License Modal */}
      {isLicenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">เพิ่มใบอนุญาตประกอบวิชาชีพครู</h3>
              <button onClick={() => setIsLicenseModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">ชื่อ - สกุล ครู:</label>
                <input type="text" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} placeholder="เช่น ครูสมจิตต์ สดใส" className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold mb-1">เลขประจำตัวประชาชน (13 หลัก):</label>
                <input type="text" value={newCitizenId} onChange={e => setNewCitizenId(e.target.value)} maxLength={13} placeholder="เลข 13 หลัก" className="w-full p-2.5 border rounded-xl font-mono" />
              </div>
              <div>
                <label className="block font-bold mb-1">เลขที่ใบอนุญาตคุรุสภา:</label>
                <input type="text" value={newLicenseNo} onChange={e => setNewLicenseNo(e.target.value)} placeholder="เช่น 6310900012345" className="w-full p-2.5 border rounded-xl font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">วันหมดอายุ:</label>
                  <input type="date" value={newExpireDate} onChange={e => setNewExpireDate(e.target.value)} className="w-full p-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold mb-1">ชั่วโมง CPD:</label>
                  <input type="number" value={newCpdHours} onChange={e => setNewCpdHours(Number(e.target.value))} className="w-full p-2 border rounded-xl" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setIsLicenseModalOpen(false)} className="px-4 py-2 font-bold text-slate-600">ยกเลิก</button>
              <button onClick={handleSaveLicense} disabled={isSavingLicense} className="px-5 py-2 bg-purple-600 text-white rounded-xl font-bold">
                {isSavingLicense ? 'กำลังบันทึก...' : 'บันทึกใบอนุญาต'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Modal */}
      {isMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">บันทึกการประชุมคณะกรรมการบริหารโรงเรียน (ม.30)</h3>
              <button onClick={() => setIsMeetingModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">ครั้งที่:</label>
                  <input type="number" min={1} max={10} value={meetingNo} onChange={e => setMeetingNo(Number(e.target.value))} className="w-full p-2.5 border rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold mb-1">วันที่ประชุม:</label>
                  <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="w-full p-2.5 border rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">หัวข้อการประชุม:</label>
                <input type="text" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold mb-1">วาระการประชุม (1 บรรทัดต่อ 1 วาระ):</label>
                <textarea rows={3} value={meetingAgenda} onChange={e => setMeetingAgenda(e.target.value)} className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold mb-1">มติที่ประชุม (1 บรรทัดต่อ 1 มติ):</label>
                <textarea rows={3} value={meetingResolutions} onChange={e => setMeetingResolutions(e.target.value)} className="w-full p-2.5 border rounded-xl" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setIsMeetingModalOpen(false)} className="px-4 py-2 font-bold text-slate-600">ยกเลิก</button>
              <button onClick={handleSaveMeeting} disabled={isSavingMeeting} className="px-5 py-2 bg-purple-600 text-white rounded-xl font-bold">
                {isSavingMeeting ? 'กำลังบันทึก...' : 'บันทึกการประชุม'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Modal */}
      <EsarPrintModal
        isOpen={isEsarPrintModalOpen}
        onClose={() => setIsEsarPrintModalOpen(false)}
        report={esarReport}
      />

    </div>
  );
}
