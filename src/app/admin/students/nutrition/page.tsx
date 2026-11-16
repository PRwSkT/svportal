'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Heart, 
  Scale, 
  Activity, 
  Utensils, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  RefreshCw, 
  ChevronLeft, 
  Milk, 
  Users, 
  ShieldCheck, 
  DollarSign, 
  Calendar,
  ChefHat,
  Banknote,
  ClipboardPaste
} from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_TERM } from '@/lib/constants/school';
import KitchenProductionTab from '@/components/admin/kitchen/KitchenProductionTab';
import KitchenMenuTab from '@/components/admin/kitchen/KitchenMenuTab';
import KitchenCostTab from '@/components/admin/kitchen/KitchenCostTab';

interface StudentHealthRow {
  studentId: string;
  studentName: string;
  gender: 'ชาย' | 'หญิง';
  grade: string;
  age: { years: number; months: number; label: string };
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  weightForHeight: {
    status: string;
    bgClass: string;
    textClass: string;
    isMalnourished: boolean;
  };
  heightForAge: {
    status: string;
    bgClass: string;
    textClass: string;
    isStunted: boolean;
  };
  nutritionWatch?: {
    needsAttention: boolean;
    reason: string;
    criteriaMet: string[];
    priority: string;
    kitchenAdvice: string;
  };
  lunchSubsidy?: {
    isEligible: boolean;
    reason: string;
    criteriaMet: string[];
    priority: string;
  };
}

export default function NutritionManagementPage() {
  const [mainTab, setMainTab] = useState<'production' | 'menu' | 'cost' | 'growth'>('production');
  const [growthSubTab, setGrowthSubTab] = useState<'batch' | 'watch' | 'milk'>('batch');
  
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [gradesList, setGradesList] = useState<string[]>([]);
  
  const [academicYear, setAcademicYear] = useState<string>(DEFAULT_ACADEMIC_YEAR);
  const [term, setTerm] = useState<number>(Number(DEFAULT_TERM) || 1);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  
  // Local editable measurements state: studentId -> { height: string, weight: string }
  const [measurements, setMeasurements] = useState<Record<string, { height: string; weight: string }>>({});

  // Milk log state
  const [milkDate, setMilkDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [milkLogs, setMilkLogs] = useState<any[]>([]);
  const [milkFormData, setMilkFormData] = useState<Record<string, { present: number; consumed: number; allergy: number; notes: string }>>({});
  const [isSavingMilk, setIsSavingMilk] = useState(false);

  // Fetch Nutrition Summary & Students
  const fetchNutritionData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/nutrition?grade=${encodeURIComponent(selectedGrade)}`);
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลโภชนาการได้');
      const data = await res.json();
      if (data.summary) {
        setSummaryData(data.summary);
        
        // Extract distinct grades
        if (gradesList.length === 0 && data.summary.classBreakdown) {
          const sortedGrades = Object.keys(data.summary.classBreakdown).sort((a, b) => {
            const isAnubanA = a.startsWith('อ.');
            const isAnubanB = b.startsWith('อ.');
            if (isAnubanA && !isAnubanB) return -1;
            if (!isAnubanA && isAnubanB) return 1;
            return a.localeCompare(b);
          });
          setGradesList(sortedGrades);
        }

        // Initialize editable measurements
        const initMap: Record<string, { height: string; weight: string }> = {};
        (data.summary.results || []).forEach((r: StudentHealthRow) => {
          initMap[r.studentId] = {
            height: r.heightCm !== null ? String(r.heightCm) : '',
            weight: r.weightKg !== null ? String(r.weightKg) : ''
          };
        });
        setMeasurements(initMap);
      }
    } catch (err: any) {
      toast.error('โหลดข้อมูลโภชนาการไม่สำเร็จ', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Milk Logs
  const fetchMilkLogs = async () => {
    try {
      const res = await fetch(`/api/admin/nutrition/milk?date=${milkDate}`);
      if (res.ok) {
        const data = await res.json();
        setMilkLogs(data.logs || []);
        
        const map: Record<string, any> = {};
        (data.logs || []).forEach((l: any) => {
          map[l.grade] = {
            present: l.present_count,
            consumed: l.milk_consumed_count,
            allergy: l.dairy_allergy_count,
            notes: l.notes || ''
          };
        });
        setMilkFormData(map);
      }
    } catch (err) {
      console.error('Milk logs error:', err);
    }
  };

  useEffect(() => {
    fetchNutritionData();
  }, [selectedGrade]);

  useEffect(() => {
    if (mainTab === 'growth' && growthSubTab === 'milk') {
      fetchMilkLogs();
    }
  }, [mainTab, growthSubTab, milkDate]);

  // Handle Height / Weight change in batch table
  const handleMeasurementChange = (studentId: string, field: 'height' | 'weight', value: string) => {
    setIsDirty(true);
    setMeasurements(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  // Keyboard navigation for batch measurement table
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    field: 'height' | 'weight',
    totalRows: number
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx < totalRows - 1) {
        document.getElementById(`cell-${field}-${rowIdx + 1}`)?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) {
        document.getElementById(`cell-${field}-${rowIdx - 1}`)?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'height') {
        document.getElementById(`cell-weight-${rowIdx}`)?.focus();
      } else {
        if (rowIdx < totalRows - 1) {
          document.getElementById(`cell-height-${rowIdx + 1}`)?.focus();
        }
      }
    }
  };

  // Clipboard Paste handler (supports multi-row copy/paste from Excel/Sheets)
  const handleCellPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRowIdx: number,
    field: 'height' | 'weight',
    rows: StudentHealthRow[]
  ) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const rawRows = text.split(/\r\n|\r|\n/).map(r => r.trim()).filter(r => r !== '');
    if (rawRows.length <= 1 && !rawRows[0].includes('\t')) return;

    e.preventDefault();
    setMeasurements(prev => {
      const nextMap = { ...prev };
      rawRows.forEach((rowText, offset) => {
        const targetIdx = startRowIdx + offset;
        if (targetIdx >= rows.length) return;
        const targetRow = rows[targetIdx];
        const cols = rowText.split('\t').map(c => c.trim());
        
        if (cols.length >= 2) {
          const h = parseFloat(cols[0]);
          const w = parseFloat(cols[1]);
          nextMap[targetRow.studentId] = {
            height: !isNaN(h) ? String(h) : (nextMap[targetRow.studentId]?.height || ''),
            weight: !isNaN(w) ? String(w) : (nextMap[targetRow.studentId]?.weight || '')
          };
        } else if (cols.length === 1) {
          const val = parseFloat(cols[0]);
          if (!isNaN(val)) {
            nextMap[targetRow.studentId] = {
              ...nextMap[targetRow.studentId],
              [field]: String(val)
            };
          }
        }
      });
      return nextMap;
    });
    setIsDirty(true);
    toast.success(`วางข้อมูลจากคลิปบอร์ด ${rawRows.length} แถวเรียบร้อยแล้ว`);
  };

  // Save Batch Measurements
  const handleSaveBatch = async () => {
    setIsSaving(true);
    const toastId = toast.loading('กำลังบันทึกข้อมูลส่วนสูง-น้ำหนัก...');
    try {
      const payload: any[] = [];
      Object.entries(measurements).forEach(([studentId, val]) => {
        const h = val.height.trim();
        const w = val.weight.trim();
        if (h || w) {
          payload.push({
            studentId,
            height: h ? parseFloat(h) : null,
            weight: w ? parseFloat(w) : null,
          });
        }
      });

      if (payload.length === 0) {
        toast.warning('ไม่มีข้อมูลใหม่ที่ต้องบันทึก', { id: toastId });
        setIsSaving(false);
        return;
      }

      const res = await fetch('/api/admin/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYear,
          term,
          measurements: payload
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'บันทึกล้มเหลว');
      }

      toast.success(`บันทึกส่วนสูง-น้ำหนักสำเร็จ ${payload.length} คน`, { id: toastId });
      setIsDirty(false);
      setLastSavedTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
      fetchNutritionData();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก', { id: toastId, description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Save Milk Log for a grade
  const handleSaveMilkLog = async (grade: string) => {
    const data = milkFormData[grade] || { present: 0, consumed: 0, allergy: 0, notes: '' };
    setIsSavingMilk(true);
    try {
      const res = await fetch('/api/admin/nutrition/milk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: milkDate,
          grade,
          presentCount: data.present,
          milkConsumedCount: data.consumed,
          dairyAllergyCount: data.allergy,
          notes: data.notes
        })
      });
      if (!res.ok) throw new Error('บันทึกนมโรงเรียนไม่สำเร็จ');
      toast.success(`บันทึกนมโรงเรียนห้อง ${grade} เรียบร้อยแล้ว`);
      fetchMilkLogs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingMilk(false);
    }
  };

  // Download Reports
  const handleDownloadWatchExcel = () => {
    window.open(`/api/admin/nutrition/export?type=lunch&year=2568`, '_blank');
  };

  const watchCount = summaryData?.nutritionWatchCount ?? summaryData?.lunchSubsidyEligibleCount ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans"
    >
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link 
              href="/admin/students"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#7B1C3E] transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> กลับหน้าทะเบียนนักเรียน
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              โรงครัวภายใน (รวมในค่าเทอม) & โภชนาการกรมอนามัย
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ChefHat className="w-7 h-7 text-[#7B1C3E]" />
            ระบบโรงครัวภายใน & โภชนาการนักเรียน
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">
            ใบสั่งผลิตอาหารรายวัน 08:30 น., ป้ายกำกับถาดพิเศษเด็กแพ้อาหาร/ฮาลาล/อาหารอ่อน, คุมงบวัตถุดิบ (COA 52200), และประเมินการเจริญเติบโต BMI
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <button
            onClick={handleDownloadWatchExcel}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md shadow-emerald-700/20 active:scale-95 text-xs sm:text-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>ส่งออกบัญชีเฝ้าระวังโภชนาการ (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 4 Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2 hide-scrollbar">
        <button
          onClick={() => setMainTab('production')}
          className={`py-3 px-5 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            mainTab === 'production'
              ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-rose-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Utensils className="w-4 h-4" /> 1. ใบสั่งผลิตรายวัน 08:30 น. & ป้ายถาดพิเศษ
        </button>
        <button
          onClick={() => setMainTab('menu')}
          className={`py-3 px-5 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            mainTab === 'menu'
              ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-rose-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ChefHat className="w-4 h-4" /> 2. เมนูประจำสัปดาห์ & เมนูทดแทน
        </button>
        <button
          onClick={() => setMainTab('cost')}
          className={`py-3 px-5 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            mainTab === 'cost'
              ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-rose-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Banknote className="w-4 h-4" /> 3. คุมงบวัตถุดิบโรงครัว (COA 52200)
        </button>
        <button
          onClick={() => setMainTab('growth')}
          className={`py-3 px-5 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            mainTab === 'growth'
              ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-rose-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" /> 4. การเจริญเติบโต กรมอนามัย (BMI) & นม
        </button>
      </div>

      {/* TAB 1: Kitchen Production Sheet & Special Labels */}
      {mainTab === 'production' && <KitchenProductionTab />}

      {/* TAB 2: Weekly Menu & Substitutes */}
      {mainTab === 'menu' && <KitchenMenuTab />}

      {/* TAB 3: Raw Material Cost Control & Section 32 Analytics */}
      {mainTab === 'cost' && <KitchenCostTab />}

      {/* TAB 4: Growth Assessment (Batch Entry, Nutrition Watch, Milk) */}
      {mainTab === 'growth' && (
        <div className="space-y-6">
          {/* Sub-tabs for Growth */}
          <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <button
              onClick={() => setGrowthSubTab('batch')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                growthSubTab === 'batch'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              บันทึกส่วนสูง-น้ำหนักยกห้อง
            </button>
            <button
              onClick={() => setGrowthSubTab('watch')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                growthSubTab === 'watch'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              รายชื่อเฝ้าระวังโภชนาการสำหรับโรงครัว
              {watchCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white">
                  {watchCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setGrowthSubTab('milk')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                growthSubTab === 'milk'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              บันทึกแจกนมโรงเรียนประจำวัน
            </button>
          </div>

          {/* KPI Cards for Growth */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">สมส่วน (Normal)</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {isLoading ? '...' : `${summaryData?.normalPct ?? 0}%`}
                  <span className="text-xs font-medium text-slate-400 ml-1.5 font-mono">
                    ({summaryData?.normalCount ?? 0} คน)
                  </span>
                </p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">ทุพโภชนาการ (ผอม)</p>
                <p className="text-xl sm:text-2xl font-extrabold text-amber-700 dark:text-amber-300">
                  {isLoading ? '...' : `${summaryData?.thinCount ?? 0}`} <span className="text-xs font-normal">คน</span>
                  <span className="text-xs font-medium text-slate-400 ml-1 font-mono">
                    ({summaryData?.thinPct ?? 0}%)
                  </span>
                </p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-2xl">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400">เริ่มอ้วน / อ้วน</p>
                <p className="text-xl sm:text-2xl font-extrabold text-purple-700 dark:text-purple-300">
                  {isLoading ? '...' : `${summaryData?.overweightCount ?? 0}`} <span className="text-xs font-normal">คน</span>
                  <span className="text-xs font-medium text-slate-400 ml-1 font-mono">
                    ({summaryData?.overweightPct ?? 0}%)
                  </span>
                </p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-2xl">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">เฝ้าระวังโรงครัว</p>
                <p className="text-xl sm:text-2xl font-extrabold text-blue-800 dark:text-blue-300">
                  {isLoading ? '...' : `${watchCount}`} <span className="text-xs font-normal">คน</span>
                </p>
              </div>
            </div>
          </div>

          {/* Sub-tab 1: Batch Entry */}
          {growthSubTab === 'batch' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">เลือกห้องเรียน:</span>
                  <select
                    value={selectedGrade}
                    onChange={e => setSelectedGrade(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
                  >
                    <option value="all">ทุกระดับชั้น (อ.1 - ป.6)</option>
                    {gradesList.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>

                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">ปีการศึกษา:</span>
                  <select
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
                  >
                    <option value="2567">2567</option>
                    <option value="2568">2568</option>
                    <option value="2569">2569</option>
                  </select>

                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">ภาคเรียน:</span>
                  <select
                    value={term}
                    onChange={e => setTerm(Number(e.target.value))}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
                  >
                    <option value={1}>เทอม 1 (ต้นปี)</option>
                    <option value={2}>เทอม 2 (ปลายปี)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isDirty ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      ยังไม่ได้บันทึก
                    </span>
                  ) : lastSavedTime ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      บันทึกแล้ว ({lastSavedTime})
                    </span>
                  ) : null}

                  <button
                    onClick={fetchNutritionData}
                    disabled={isLoading}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>รีเฟรช</span>
                  </button>
                  <button
                    onClick={handleSaveBatch}
                    disabled={isSaving}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 bg-[#7B1C3E] hover:bg-[#681834] text-white font-extrabold rounded-xl shadow-md text-xs sm:text-sm disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนสูง-น้ำหนัก'}</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3.5 px-4 w-16">รหัส</th>
                        <th className="py-3.5 px-4">ชื่อ - นามสกุล</th>
                        <th className="py-3.5 px-3 w-20">ห้อง</th>
                        <th className="py-3.5 px-3 w-28">อายุ</th>
                        <th className="py-3.5 px-3 w-32">ส่วนสูง (ซม.)</th>
                        <th className="py-3.5 px-3 w-32">น้ำหนัก (กก.)</th>
                        <th className="py-3.5 px-3 w-20">BMI</th>
                        <th className="py-3.5 px-4">ภาวะโภชนาการ (กรมอนามัย)</th>
                        <th className="py-3.5 px-4">ส่วนสูงตามเกณฑ์</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryData?.results?.map((row: StudentHealthRow, idx: number) => {
                        const currentH = measurements[row.studentId]?.height ?? '';
                        const currentW = measurements[row.studentId]?.weight ?? '';
                        const liveBmi = currentH && currentW && parseFloat(currentH) > 0 && parseFloat(currentW) > 0
                          ? (parseFloat(currentW) / Math.pow(parseFloat(currentH) / 100, 2)).toFixed(1)
                          : row.bmi?.toFixed(1) ?? '-';

                        return (
                          <tr key={row.studentId} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                              {row.studentId}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {row.studentName}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {row.grade}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-xs">
                              {row.age.label}
                            </td>
                            <td className="py-3 px-3">
                              <input
                                id={`cell-height-${idx}`}
                                type="number"
                                step="0.1"
                                placeholder="ซม."
                                value={currentH}
                                onChange={e => handleMeasurementChange(row.studentId, 'height', e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, idx, 'height', summaryData.results.length)}
                                onPaste={e => handleCellPaste(e, idx, 'height', summaryData.results)}
                                className="w-24 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <input
                                id={`cell-weight-${idx}`}
                                type="number"
                                step="0.1"
                                placeholder="กก."
                                value={currentW}
                                onChange={e => handleMeasurementChange(row.studentId, 'weight', e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, idx, 'weight', summaryData.results.length)}
                                onPaste={e => handleCellPaste(e, idx, 'weight', summaryData.results)}
                                className="w-24 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                              />
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                              {liveBmi}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${row.weightForHeight.bgClass} ${row.weightForHeight.textClass}`}>
                                {row.weightForHeight.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${row.heightForAge.bgClass} ${row.heightForAge.textClass}`}>
                                {row.heightForAge.status}
                              </span>
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

          {/* Sub-tab 2: Nutrition Watch List */}
          {growthSubTab === 'watch' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-blue-900 dark:text-blue-200 text-sm sm:text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    บัญชีเฝ้าระวังโภชนาการสำหรับโรงครัวภายใน (Somkidvittaya Nutrition Watch)
                  </h3>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    คัดกรองเด็กที่มีภาวะผอมมาก/ผอม, เริ่มอ้วน/อ้วน หรือมีประวัติแพ้อาหาร เพื่อส่งคำแนะนำให้โรงครัวจัดสัดส่วนและเมนูทดแทน
                  </p>
                </div>
                <button
                  onClick={handleDownloadWatchExcel}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> ดาวน์โหลด Excel (.xlsx)
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3 px-4 w-12">ลำดับ</th>
                        <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                        <th className="py-3 px-3">ชั้น</th>
                        <th className="py-3 px-3">ภาวะโภชนาการ</th>
                        <th className="py-3 px-4">เหตุที่ต้องเฝ้าระวัง</th>
                        <th className="py-3 px-4">คำแนะนำสำหรับโรงครัว</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryData?.results
                        ?.filter((r: StudentHealthRow) => r.nutritionWatch?.needsAttention ?? r.lunchSubsidy?.isEligible)
                        ?.map((r: StudentHealthRow, idx: number) => {
                          const watch = r.nutritionWatch;
                          return (
                            <tr key={r.studentId} className="hover:bg-slate-50/60">
                              <td className="py-3 px-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                              <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                {r.studentName}
                                <span className="block text-[11px] font-mono text-slate-400">รหัส {r.studentId}</span>
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">{r.grade}</td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${r.weightForHeight.bgClass} ${r.weightForHeight.textClass}`}>
                                  {r.weightForHeight.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                                {watch?.reason ?? r.lunchSubsidy?.reason}
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                                {watch?.kitchenAdvice || 'ดูแลตามแผนโภชนาการมาตรฐาน'}
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

          {/* Sub-tab 3: Daily Milk Log */}
          {growthSubTab === 'milk' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">วันที่บันทึกนมโรงเรียน:</span>
                  <input
                    type="date"
                    value={milkDate}
                    onChange={e => setMilkDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <span className="text-xs text-slate-400">
                  บันทึกการแจกนม UHT / พาสเจอร์ไรส์ รสจืด ประจำวัน
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3 px-4">ห้องเรียน</th>
                        <th className="py-3 px-3 w-28">นักเรียนมาเรียน</th>
                        <th className="py-3 px-3 w-28">ดื่มนม (กล่อง)</th>
                        <th className="py-3 px-3 w-28">แพ้นมวัว (คน)</th>
                        <th className="py-3 px-4">หมายเหตุ</th>
                        <th className="py-3 px-4 w-28 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {gradesList.map(grade => {
                        const row = milkFormData[grade] || { present: 0, consumed: 0, allergy: 0, notes: '' };
                        return (
                          <tr key={grade} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{grade}</td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                min="0"
                                value={row.present}
                                onChange={e => setMilkFormData(prev => ({
                                  ...prev,
                                  [grade]: { ...row, present: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                min="0"
                                value={row.consumed}
                                onChange={e => setMilkFormData(prev => ({
                                  ...prev,
                                  [grade]: { ...row, consumed: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-700"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                min="0"
                                value={row.allergy}
                                onChange={e => setMilkFormData(prev => ({
                                  ...prev,
                                  [grade]: { ...row, allergy: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-700"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                placeholder="เช่น แจกนมถั่วเหลืองทดแทน..."
                                value={row.notes}
                                onChange={e => setMilkFormData(prev => ({
                                  ...prev,
                                  [grade]: { ...row, notes: e.target.value }
                                }))}
                                className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleSaveMilkLog(grade)}
                                disabled={isSavingMilk}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-sm"
                              >
                                บันทึก
                              </button>
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
        </div>
      )}
    </motion.div>
  );
}
