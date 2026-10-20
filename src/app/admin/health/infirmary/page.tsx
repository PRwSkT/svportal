'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  HeartPulse, 
  Thermometer, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Pill, 
  Bed, 
  PhoneCall, 
  ChevronLeft, 
  RefreshCw, 
  Search, 
  Plus, 
  Save, 
  X,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  LogOut,
  Sparkles,
  ExternalLink,
  Shield,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPipelineState,
  PIPELINE_EVENT_NAME,
  recordMedicationAdministered
} from '@/lib/pipeline/bidirectional-store';
import {
  BidirectionalPipelineState,
  MedicationRequest,
  StudentIncident
} from '@/types/family-pipeline';
import { 
  COMMON_SYMPTOMS, 
  CONTAGIOUS_DISEASES_MAP, 
  ContagiousDiseaseType, 
  evaluateBodyTemperature,
  InfirmaryVisitRecord,
  OutbreakAlertItem
} from '@/lib/health/infirmary';

export default function SchoolInfirmaryPage() {
  const { isThai } = useLanguage();
  const [infirmaryTab, setInfirmaryTab] = useState<'visits' | 'medication_queue' | 'incidents'>('visits');
  const [pipeline, setPipeline] = useState<BidirectionalPipelineState>(() => getPipelineState());
  const [nurseNoteInput, setNurseNoteInput] = useState<Record<string, string>>({});
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [visits, setVisits] = useState<InfirmaryVisitRecord[]>([]);
  const [outbreakAnalysis, setOutbreakAnalysis] = useState<{ hasOutbreak: boolean; alerts: OutbreakAlertItem[] }>({
    hasOutbreak: false,
    alerts: []
  });
  const [stats, setStats] = useState<any>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Visit Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [candidateStudents, setCandidateStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [temperature, setTemperature] = useState<string>('36.8');
  const [treatmentGiven, setTreatmentGiven] = useState<string>('นอนพักผ่อน ดื่มน้ำอุ่น');
  const [medicationGiven, setMedicationGiven] = useState<string>('พาราเซตามอล 250 มก.');
  const [contagiousDisease, setContagiousDisease] = useState<ContagiousDiseaseType>('NONE');
  const [restInBed, setRestInBed] = useState<boolean>(true);
  const [parentContacted, setParentContacted] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/health/infirmary?days=${selectedDays}&grade=${selectedGrade}`);
      const data = await res.json();
      if (res.ok) {
        setVisits(data.visits || []);
        setOutbreakAnalysis(data.outbreakAnalysis || { hasOutbreak: false, alerts: [] });
        setStats(data.stats || {});
      } else {
        toast.error(data.error || 'Failed to load infirmary data');
      }
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดข้อมูลห้องพยาบาลได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDays, selectedGrade]);

  // Synchronize with bidirectional pipeline store
  useEffect(() => {
    const handleUpdate = () => {
      setPipeline({ ...getPipelineState() });
    };
    window.addEventListener(PIPELINE_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(PIPELINE_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleAdministerMedication = (med: MedicationRequest) => {
    const note = nurseNoteInput[med.id]?.trim() || 'ป้อนยาตามปริมาณและเวลาที่ผู้ปกครองระบุเรียบร้อย วัดไข้ปกติ';
    const updated = recordMedicationAdministered({
      medication_id: med.id,
      administered_by: 'ครูพยาบาลวิชาชีพ พรทิพย์ สุขสวัสดิ์',
      nurse_note: note,
    });

    if (updated) {
      toast.success(
        isThai
          ? 'บันทึกการป้อนยาสำเร็จและส่งแจ้งเตือนไปยัง Parents Portal แล้ว'
          : 'Medication administered & synced to Parents Portal'
      );
    }
  };

  // Search candidate students when typing in modal
  useEffect(() => {
    if (!studentSearch.trim()) {
      setCandidateStudents([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/students?q=${encodeURIComponent(studentSearch)}&limit=10`);
        const data = await res.json();
        if (data.students) {
          setCandidateStudents(data.students);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [studentSearch]);

  const handleSaveVisit = async () => {
    if (!selectedStudent) {
      toast.error('กรุณาเลือกนักเรียน');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/health/infirmary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          symptoms: selectedSymptoms,
          temperature_celsius: temperature ? Number(temperature) : null,
          treatment_given: treatmentGiven,
          medication_given: medicationGiven,
          diagnosed_contagious_disease: contagiousDisease,
          rest_in_bed: restInBed,
          parent_contacted: parentContacted,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'DRUG_ALLERGY_RISK') {
          toast.error(data.message, { duration: 6000 });
          return;
        }
        throw new Error(data.error || 'Failed to save');
      }

      toast.success('บันทึกการเข้าห้องพยาบาลสำเร็จ');
      setIsModalOpen(false);
      // Reset
      setSelectedStudent(null);
      setStudentSearch('');
      setSelectedSymptoms([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Mark Check-Out (Left Infirmary)
  const handleMarkCheckOut = async (visitId: string) => {
    try {
      const nowTime = new Date().toTimeString().slice(0, 5);
      const res = await fetch('/api/health/infirmary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: visitId,
          time_left: nowTime,
          rest_in_bed: false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('บันทึกเวลากลับเข้าห้องเรียนเรียบร้อยแล้ว');
      fetchData();
    } catch (err: any) {
      toast.error('ไม่สามารถบันทึกเวลาออกได้: ' + err.message);
    }
  };

  // Quick Toggle Parent Contacted
  const handleToggleParentContacted = async (visitId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/health/infirmary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: visitId,
          parent_contacted: !currentStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(!currentStatus ? 'บันทึกการแจ้งผู้ปกครองแล้ว' : 'ยกเลิกสถานะการแจ้งผู้ปกครอง');
      fetchData();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // Delete Visit
  const handleDeleteVisit = async (visitId: string, studentName: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการเข้าห้องพยาบาลของ ${studentName}?`)) return;
    try {
      const res = await fetch(`/api/health/infirmary?id=${visitId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('ลบประวัติการเข้าห้องพยาบาลเรียบร้อยแล้ว');
      fetchData();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการลบ: ' + err.message);
    }
  };

  const tempEval = evaluateBodyTemperature(temperature ? Number(temperature) : undefined);

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
            <span className="text-rose-600 dark:text-rose-400">ห้องพยาบาล & ระบบเฝ้าระวังโรคระบาด (Infirmary Hub)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-2xl shadow-md shadow-rose-500/20">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                School Infirmary & Outbreak Early-Warning
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                บันทึกการเข้าห้องพยาบาล • ระบบตรวจจับการแพ้ยา (Allergy Guard) • เฝ้าระวังคลัสเตอร์โรคระบาดอัตโนมัติ
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedDays}
            onChange={e => setSelectedDays(Number(e.target.value))}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
          >
            <option value={7}>ย้อนหลัง 7 วัน (เกณฑ์โรคระบาด)</option>
            <option value={14}>ย้อนหลัง 14 วัน</option>
            <option value={30}>ย้อนหลัง 30 วัน</option>
          </select>

          <select
            value={selectedGrade}
            onChange={e => setSelectedGrade(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
          >
            <option value="all">ทุกระดับชั้น</option>
            <option value="อ.1">อนุบาล 1</option>
            <option value="อ.2">อนุบาล 2</option>
            <option value="อ.3">อนุบาล 3</option>
            <option value="ป.1">ประถมศึกษาปีที่ 1</option>
            <option value="ป.2">ประถมศึกษาปีที่ 2</option>
            <option value="ป.3">ประถมศึกษาปีที่ 3</option>
            <option value="ป.4">ประถมศึกษาปีที่ 4</option>
            <option value="ป.5">ประถมศึกษาปีที่ 5</option>
            <option value="ป.6">ประถมศึกษาปีที่ 6</option>
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" /> บันทึกนักเรียนป่วย
          </button>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
            title="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3 Infirmary Tabs Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-2xs gap-1.5">
        <button
          type="button"
          onClick={() => setInfirmaryTab('visits')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            infirmaryTab === 'visits'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>{isThai ? 'บันทึกห้องพยาบาล & เฝ้าระวังโรคระบาด' : 'Infirmary Visits & Outbreak Watch'}</span>
        </button>

        <button
          type="button"
          onClick={() => setInfirmaryTab('medication_queue')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            infirmaryTab === 'medication_queue'
              ? 'bg-[#7B1C3E] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>{isThai ? 'คิวฝากป้อนยาจากผู้ปกครอง' : 'Parent Medication Queue'}</span>
          {pipeline.medication_requests.filter((m) => m.status === 'ACTIVE').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950">
              {pipeline.medication_requests.filter((m) => m.status === 'ACTIVE').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setInfirmaryTab('incidents')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            infirmaryTab === 'incidents'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{isThai ? 'รายงานอุบัติเหตุ & การปฐมพยาบาล' : 'Incident Reports & Parent Ack'}</span>
          {pipeline.incidents.filter((i) => !i.parent_acknowledged).length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {pipeline.incidents.filter((i) => !i.parent_acknowledged).length}
            </span>
          )}
        </button>
      </div>

      {infirmaryTab === 'visits' && (
        <>
          {/* Outbreak Early-Warning Alert Banner (if outbreak cluster detected!) */}
      {outbreakAnalysis.hasOutbreak && (
        <div className="p-5 bg-rose-500 text-white rounded-3xl shadow-xl shadow-rose-500/25 border-2 border-rose-300 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <ShieldAlert className="w-7 h-7 text-white animate-bounce" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>แจ้งเตือนตรวจพบคลัสเตอร์การระบาดของโรคติดต่อในโรงเรียน!</span>
              </h2>
              <p className="text-xs sm:text-sm text-rose-100">
                ระบบตรวจพบผู้ป่วยเข้าเกณฑ์ในพื้นที่ห้องเรียนเดียวกันเกิน 3 รายในรอบ 7 วัน
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {outbreakAnalysis.alerts.map((alert, idx) => (
              <div key={idx} className="p-4 bg-white/10 rounded-2xl border border-white/20 space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-sm font-extrabold text-amber-200">{alert.diseaseNameTh}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white text-rose-700 font-black">
                    ห้อง {alert.classroomOrGrade}: พบ {alert.caseCount} ราย
                  </span>
                </div>
                <div className="space-y-1 text-white/90">
                  <strong className="block text-amber-100">แนวทางปฏิบัติตามมาตรฐานกรมควบคุมโรค:</strong>
                  {alert.actionRequired.map((act, i) => (
                    <p key={i}>• {act}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">เข้าห้องพยาบาล</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {stats.totalVisits || 0} <span className="text-xs font-normal text-slate-400">ครั้ง</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">ตรวจพบมีไข้ (&ge;37.5°C)</span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.feverCount || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">โรคติดต่อที่เฝ้าระวัง</span>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {stats.contagiousCount || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
            <Bed className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">นอนพักเตียงพยาบาล</span>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {stats.restInBedCount || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visits Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
          ประวัติการเข้าห้องพยาบาล (ย้อนหลัง {selectedDays} วัน)
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5 font-bold">วันที่ / เวลา</th>
                <th className="p-3.5 font-bold">ชื่อ - นามสกุล</th>
                <th className="p-3.5 font-bold">ชั้น</th>
                <th className="p-3.5 font-bold">อาการป่วย</th>
                <th className="p-3.5 font-bold text-center">อุณหภูมิ</th>
                <th className="p-3.5 font-bold">การรักษา / ยาที่จ่าย</th>
                <th className="p-3.5 font-bold text-center">โรคติดต่อ</th>
                <th className="p-3.5 font-bold text-center">แจ้ง ผปค.</th>
                <th className="p-3.5 font-bold text-center">การพัก / ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visits.map((v, i) => {
                const tempCheck = evaluateBodyTemperature(v.temperatureCelsius);
                const disease = CONTAGIOUS_DISEASES_MAP[v.diagnosedContagiousDisease];

                return (
                  <tr key={v.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 text-xs text-slate-500 whitespace-nowrap font-mono">
                      {v.visitDate} {v.visitTime ? `• ${v.visitTime.slice(0, 5)}` : ''}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">{v.studentName}</td>
                    <td className="p-3.5">{v.grade} {v.classroom ? `/${v.classroom}` : ''}</td>
                    <td className="p-3.5 max-w-xs truncate text-slate-700 dark:text-slate-300">
                      {v.symptoms.join(', ') || '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${tempCheck.badgeColor}`}>
                        {v.temperatureCelsius ? `${v.temperatureCelsius}°C` : '-'}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {v.medicationGiven || v.treatmentGiven || '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      {v.diagnosedContagiousDisease !== 'NONE' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-[11px]">
                          {disease?.nameTh || v.diagnosedContagiousDisease}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">ไม่มี</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => v.id && handleToggleParentContacted(v.id, v.parentContacted)}
                        title="คลิกเพื่อสลับสถานะการโทรแจ้งผู้ปกครอง"
                        className={`px-2 py-0.5 rounded-full font-bold text-xs transition-colors ${
                          v.parentContacted 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {v.parentContacted ? 'แจ้งผู้ปกครองแล้ว' : 'ยังไม่แจ้ง'}
                      </button>
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {v.restInBed && !v.timeLeft ? (
                          <button
                            onClick={() => v.id && handleMarkCheckOut(v.id)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                            title="กดเพื่อลงเวลากลับเข้าห้องเรียน"
                          >
                            <LogOut className="w-3 h-3" /> ออกห้องพยาบาล
                          </button>
                        ) : v.timeLeft ? (
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-500" /> กลับ {v.timeLeft.slice(0, 5)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}

                        {v.id && (
                          <button
                            onClick={() => handleDeleteVisit(v.id!, v.studentName || 'นักเรียน')}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-1"
                            title="ลบรายการ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Check-In Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl">
                  <HeartPulse className="w-5 h-5" />
                </span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  บันทึกการเข้าห้องพยาบาล
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student Search & Allergy Alert */}
            {!selectedStudent ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ค้นหานักเรียน (รหัส หรือ ชื่อ):
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="พิมพ์ชื่อ หรือ รหัสนักเรียน..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-rose-600"
                  />
                </div>

                {candidateStudents.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {candidateStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudent(s)}
                        className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center text-xs"
                      >
                        <div>
                          <strong className="text-slate-900 dark:text-white">{s.name}</strong>
                          <span className="text-slate-400 ml-2 font-mono">{s.student_id || s.id} ({s.grade})</span>
                        </div>
                        {s.allergies && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                            แพ้: {s.allergies}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <div>
                    <strong className="text-slate-900 dark:text-white text-sm">{selectedStudent.name}</strong>
                    <span className="text-slate-400 ml-2 font-mono">
                      {selectedStudent.student_id || selectedStudent.id} • {selectedStudent.grade}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    เปลี่ยนคน
                  </button>
                </div>

                {/* Drug Allergy Guard Alert! */}
                {selectedStudent.allergies ? (
                  <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-xl font-bold flex items-center gap-1.5 mt-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>คำเตือนประวัติแพ้ยา/อาหาร: {selectedStudent.allergies}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-600 font-medium">
                    ไม่มีประวัติการแพ้ยาที่บันทึกไว้ในทะเบียน
                  </div>
                )}
              </div>
            )}

            {/* Symptoms Checklist */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                อาการป่วยที่ตรวจพบ:
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                {COMMON_SYMPTOMS.map((sym, idx) => {
                  const isChecked = selectedSymptoms.includes(sym);
                  return (
                    <label
                      key={idx}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-medium ${
                        isChecked
                          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 text-rose-800 dark:text-rose-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) setSelectedSymptoms(p => [...p, sym]);
                          else setSelectedSymptoms(p => p.filter(s => s !== sym));
                        }}
                        className="rounded text-rose-600"
                      />
                      <span>{sym}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Temp & Medicine */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  อุณหภูมิร่างกาย (°C):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={e => setTemperature(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-600"
                  />
                  <span className={`px-2 py-1 rounded-xl text-[10px] font-bold border whitespace-nowrap ${tempEval.badgeColor}`}>
                    {tempEval.label}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  สงสัยโรคติดต่อ:
                </label>
                <select
                  value={contagiousDisease}
                  onChange={e => setContagiousDisease(e.target.value as ContagiousDiseaseType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-600"
                >
                  <option value="NONE">ไม่มีโรคติดต่อ</option>
                  <option value="HFMD">มือ เท้า ปาก (HFMD)</option>
                  <option value="RSV">เชื้อไวรัส RSV</option>
                  <option value="INFLUENZA">ไข้หวัดใหญ่ (Influenza)</option>
                  <option value="COVID">โควิด-19</option>
                  <option value="CHICKENPOX">อีสุกอีใส</option>
                  <option value="OTHER">โรคติดต่ออื่น ๆ</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ยาที่จ่ายให้นักเรียน:
                </label>
                <input
                  type="text"
                  value={medicationGiven}
                  onChange={e => setMedicationGiven(e.target.value)}
                  placeholder="เช่น พาราเซตามอล 250 มก., เกลือแร่ ORS (หรือระบุ: ไม่จ่ายยา)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-600"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restInBed}
                  onChange={e => setRestInBed(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>นอนพักเตียงพยาบาล</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parentContacted}
                  onChange={e => setParentContacted(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>โทรแจ้งผู้ปกครองแล้ว</span>
              </label>
            </div>

            {/* Action */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl text-xs sm:text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveVisit}
                disabled={isSaving || !selectedStudent}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกประวัติ'}
              </button>
            </div>

          </div>
        </div>
      )}
        </>
      )}

      {/* Tab 2: Parent Medication Administration Queue */}
      {infirmaryTab === 'medication_queue' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pill className="w-5 h-5 text-[#7B1C3E]" />
                  {isThai
                    ? 'คิวคำร้องฝากป้อนยาออนไลน์จากผู้ปกครอง (Parent Medication Requests)'
                    : 'Parent Medication Administration Queue'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isThai
                    ? 'ตรวจสอบประวัติแพ้ยาอัตโนมัติ (Drug Allergy Guard) และบันทึกเวลาป้อนยาซิงค์ไปยัง Parents Portal ทันที'
                    : 'Verified with Drug Allergy Guard and digital parent e-signatures'}
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {isThai
                  ? `รอป้อนยา ${pipeline.medication_requests.filter((m) => m.status === 'ACTIVE').length} รายการ`
                  : `${pipeline.medication_requests.filter((m) => m.status === 'ACTIVE').length} Active Requests`}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5 font-bold">{isThai ? 'นักเรียน / ชั้น' : 'Student / Grade'}</th>
                    <th className="p-3.5 font-bold">{isThai ? 'ชื่อยา / ขนาดยา' : 'Medication & Dosage'}</th>
                    <th className="p-3.5 font-bold">{isThai ? 'เวลาป้อน / มื้ออาหาร' : 'Schedule & Timing'}</th>
                    <th className="p-3.5 font-bold">{isThai ? 'อาการ / เหตุผล' : 'Reason'}</th>
                    <th className="p-3.5 font-bold text-center">{isThai ? 'การลงนามผู้ปกครอง' : 'Parent Signature'}</th>
                    <th className="p-3.5 font-bold text-center">{isThai ? 'สถานะ / การดำเนินการ' : 'Status & Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pipeline.medication_requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                        {isThai ? 'ไม่มีคำร้องฝากป้อนยาในขณะนี้' : 'No medication requests active'}
                      </td>
                    </tr>
                  ) : (
                    pipeline.medication_requests.map((med) => {
                      const isDone = med.status === 'ADMINISTERED_TODAY';
                      const child = pipeline.children.find((c) => c.id === med.student_id);
                      const hasAllergyRisk =
                        child?.allergies &&
                        child.allergies.toLowerCase() !== 'ไม่มี' &&
                        med.medication_name.toLowerCase().includes(child.allergies.toLowerCase());

                      return (
                        <tr
                          key={med.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">{med.student_name}</div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-300">
                              {med.grade_level}
                            </span>
                            {child?.allergies && (
                              <div className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3" />
                                <span>แพ้: {child.allergies}</span>
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            <div className="font-extrabold text-[#7B1C3E] dark:text-amber-300">
                              {med.medication_name}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                              {med.dosage}
                            </div>
                            {hasAllergyRisk && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                                ALLERGY RISK ALERT
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-mono text-xs text-slate-900 dark:text-white font-bold">
                              {med.schedule_times.join(', ')} น.
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold">
                              {med.meal_timing === 'AFTER_MEAL'
                                ? 'หลังอาหาร'
                                : med.meal_timing === 'BEFORE_MEAL'
                                ? 'ก่อนอาหาร'
                                : med.meal_timing === 'WITH_MEAL'
                                ? 'พร้อมอาหาร'
                                : 'เมื่อมีอาการ'}
                            </span>
                          </td>

                          <td className="p-3.5 max-w-xs">
                            <p className="text-xs text-slate-600 dark:text-slate-300">{med.reason}</p>
                            <span className="text-[10px] text-slate-400">ผู้ปกครอง: {med.guardian_name}</span>
                          </td>

                          <td className="p-3.5 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isThai ? 'ลงนามดิจิทัล' : 'Signed'}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-center">
                            {isDone ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {isThai ? 'ป้อนยาวันนี้แล้ว' : 'Administered'}
                                </span>
                                {med.last_administered_at && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {med.last_administered_at.slice(11, 16)} น.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5 min-w-[160px]">
                                <input
                                  type="text"
                                  value={nurseNoteInput[med.id] || ''}
                                  onChange={(e) =>
                                    setNurseNoteInput({ ...nurseNoteInput, [med.id]: e.target.value })
                                  }
                                  placeholder={isThai ? 'บันทึกอาการ/ผลการวัดไข้...' : 'Nurse observation note...'}
                                  className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAdministerMedication(med)}
                                  className="w-full px-3 py-1.5 bg-[#7B1C3E] hover:bg-[#631430] text-white text-xs font-bold rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{isThai ? 'ยืนยันป้อนยาแล้ว' : 'Mark Given'}</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Incidents & Parent Acknowledgement */}
      {infirmaryTab === 'incidents' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-600" />
                  {isThai
                    ? 'รายงานอุบัติเหตุ & การปฐมพยาบาล (Student Incidents & Parent Acknowledgement)'
                    : 'Incident Reports & Parent Acknowledgement'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isThai
                    ? 'ติดตามการรับทราบการปฐมพยาบาลของผู้ปกครองผ่าน Parents Portal แบบเรียลไทม์'
                    : 'Track parent digital acknowledgements in real-time'}
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                {isThai
                  ? `รายงานทั้งหมด ${pipeline.incidents.length} รายการ`
                  : `${pipeline.incidents.length} Total Incidents`}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5 font-bold">{isThai ? 'วัน/เวลา' : 'Date/Time'}</th>
                    <th className="p-3.5 font-bold">{isThai ? 'นักเรียน' : 'Student'}</th>
                    <th className="p-3.5 font-bold">{isThai ? 'สถานที่' : 'Location'}</th>
                    <th className="p-3.5 font-bold text-center">{isThai ? 'ระดับความรุนแรง' : 'Severity'}</th>
                    <th className="p-3.5 font-bold">{isThai ? 'เหตุการณ์และการปฐมพยาบาล' : 'Description & First Aid'}</th>
                    <th className="p-3.5 font-bold text-center">{isThai ? 'การรับทราบของผู้ปกครอง' : 'Parent Ack'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pipeline.incidents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                        {isThai ? 'ไม่มีรายงานอุบัติเหตุ' : 'No incidents recorded'}
                      </td>
                    </tr>
                  ) : (
                    pipeline.incidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {inc.incident_date} • {inc.incident_time} น.
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">{inc.student_name}</div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {inc.grade_level}
                          </span>
                        </td>
                        <td className="p-3.5 text-xs text-slate-600 dark:text-slate-300">{inc.location}</td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              inc.severity === 'CRITICAL'
                                ? 'bg-red-600 text-white'
                                : inc.severity === 'HIGH'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                : inc.severity === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            }`}
                          >
                            {inc.severity}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-sm">
                          <p className="text-xs text-slate-900 dark:text-white font-medium">{inc.description}</p>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            <strong>{isThai ? 'ปฐมพยาบาล: ' : 'First Aid: '}</strong>
                            {inc.first_aid_given}
                          </div>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          {inc.parent_acknowledged ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isThai ? 'ผู้ปกครองรับทราบแล้ว' : 'Acknowledged'}
                              </span>
                              {inc.acknowledged_by_name && (
                                <div className="text-[10px] text-slate-400">{inc.acknowledged_by_name}</div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse">
                              <Clock className="w-3.5 h-3.5" />
                              {isThai ? 'รอผู้ปกครองรับทราบ' : 'Awaiting Ack'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
