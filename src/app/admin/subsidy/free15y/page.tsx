'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  DollarSign, 
  PenTool, 
  Printer, 
  CheckCircle2, 
  Clock, 
  Search, 
  ChevronLeft, 
  RefreshCw, 
  FileText, 
  ShieldCheck, 
  Download,
  Users,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateDisbursementAmount, formatThaiBahtText } from '@/lib/subsidy/free15y';
import Free15ySignatureModal from '@/components/subsidy/Free15ySignatureModal';
import FormOr11PrintModal from '@/components/subsidy/FormOr11PrintModal';
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_TERM } from '@/lib/constants/school';

interface StudentRow {
  id: string;
  student_id?: string;
  name: string;
  grade: string;
  classroom?: string;
  student_parents?: { name?: string; relationship?: string; id_card?: string }[];
}

export default function Free15yManagementPage() {
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [academicYear, setAcademicYear] = useState<string>(DEFAULT_ACADEMIC_YEAR);
  const [term, setTerm] = useState<string>(DEFAULT_TERM);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ totalStudents: 0, signedCount: 0, totalDisbursed: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [signatureModalOpen, setSignatureModalOpen] = useState<boolean>(false);
  const [selectedStudentForSign, setSelectedStudentForSign] = useState<StudentRow | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [selectedDisbursementForPrint, setSelectedDisbursementForPrint] = useState<any | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/subsidy/free15y?grade=${selectedGrade}&academicYear=${academicYear}&term=${term}`);
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students || []);
        setDisbursements(data.disbursements || []);
        setStats(data.stats || {});
      } else {
        toast.error(data.error || 'Failed to load free 15y data');
      }
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดข้อมูลเงินอุดหนุนเรียนฟรี 15 ปีได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedGrade, academicYear, term]);

  const filteredStudents = students.filter(s => {
    return s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (s.student_id && s.student_id.includes(searchQuery)) ||
           s.id.includes(searchQuery);
  });

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
            <span className="text-emerald-700 dark:text-emerald-400">เงินอุดหนุนเรียนฟรี 15 ปี (แบบ อร.1/1)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-md shadow-emerald-600/20">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                เงินอุดหนุนเรียนฟรี 15 ปี (แบบ อร.1/1)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                ระบบลงลายมือชื่อดิจิทัลรับเงินสด (ค่าเครื่องแบบและอุปกรณ์การเรียน) รองรับการตรวจ สตง. 100%
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
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">เทอม:</span>
            <select
              value={term}
              onChange={e => setTerm(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="1">1 (เครื่องแบบ+อุปกรณ์)</option>
              <option value="2">2 (อุปกรณ์)</option>
            </select>
          </div>

          <select
            value={selectedGrade}
            onChange={e => setSelectedGrade(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">ทุกระดับชั้น (All Classes)</option>
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
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
            title="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">นักเรียนทั้งหมด</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {stats.totalStudents || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">เซ็นรับเงินแล้ว</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.signedCount || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">รอผู้ปกครองลงนาม</span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.pendingCount || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">ยอดจ่ายเงินสดรวม</span>
            <div className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-400">
              {(stats.totalDisbursed || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">บาท</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Student List Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัสนักเรียน หรือ ชื่อ - สกุล..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5 font-bold">รหัส</th>
                <th className="p-3.5 font-bold">ชื่อ - นามสกุล</th>
                <th className="p-3.5 font-bold">ชั้นเรียน</th>
                <th className="p-3.5 font-bold text-right">ค่าเครื่องแบบ</th>
                <th className="p-3.5 font-bold text-right">ค่าอุปกรณ์</th>
                <th className="p-3.5 font-bold text-right">ยอดรับสดรวม</th>
                <th className="p-3.5 font-bold text-center">สถานะลายเซ็น</th>
                <th className="p-3.5 font-bold text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map(student => {
                const disburseRecord = disbursements.find(d => d.student_id === student.id);
                const amounts = calculateDisbursementAmount(student.grade, term);
                const isSigned = Boolean(disburseRecord?.signature_data);

                return (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-slate-500">{student.student_id || student.id}</td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">{student.name}</td>
                    <td className="p-3.5">{student.grade} {student.classroom ? `/${student.classroom}` : ''}</td>
                    <td className="p-3.5 text-right font-mono text-slate-600 dark:text-slate-300">
                      {amounts.uniformAmount} บ.
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-600 dark:text-slate-300">
                      {amounts.stationeryAmount} บ.
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {amounts.totalCashDisbursement} บ.
                    </td>
                    <td className="p-3.5 text-center">
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> เซ็นแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold text-xs">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> รอลงนาม
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedStudentForSign(student);
                            setSignatureModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 text-xs transition-all active:scale-95"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>{isSigned ? 'เซ็นใหม่' : 'ลงลายมือชื่อ'}</span>
                        </button>

                        {isSigned && (
                          <button
                            onClick={() => {
                              setSelectedDisbursementForPrint({
                                studentName: student.name,
                                studentId: student.student_id || student.id,
                                grade: student.grade,
                                classroom: student.classroom,
                                academicYear,
                                term,
                                uniformAmount: disburseRecord.uniform_amount,
                                stationeryAmount: disburseRecord.stationery_amount,
                                totalAmount: disburseRecord.total_amount,
                                recipientName: disburseRecord.recipient_name,
                                recipientRelation: disburseRecord.recipient_relation,
                                recipientCitizenId: disburseRecord.recipient_citizen_id,
                                signatureData: disburseRecord.signature_data,
                                disbursedAt: disburseRecord.disbursed_at,
                                disbursedBy: disburseRecord.disbursed_by
                              });
                              setPrintModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all"
                            title="พิมพ์แบบ อร.1/1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>พิมพ์ อร.1/1</span>
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

      {/* Signature Modal */}
      <Free15ySignatureModal
        isOpen={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        student={selectedStudentForSign}
        academicYear={academicYear}
        term={term}
        onSuccess={fetchData}
      />

      {/* Printable Modal */}
      <FormOr11PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        disbursement={selectedDisbursementForPrint}
      />

    </div>
  );
}
