'use client';

import React, { useState } from 'react';
import { PP3ReportSummary, PP3GraduateRecord } from '@/lib/academic/pp3-orss';
import { 
  FileSpreadsheet, 
  Printer, 
  Search, 
  CheckCircle2, 
  Users, 
  Award, 
  ArrowUpRight, 
  ShieldCheck,
  TrendingUp,
  Download,
  FileDown
} from 'lucide-react';
import { toast } from 'sonner';
import { printDocumentViaSandbox, openDocumentPreviewInTab } from '@/lib/documents/print-service';

interface PP3OrssTableProps {
  summary: PP3ReportSummary;
  onRefresh: () => void;
}

export function PP3OrssTable({ summary, onRefresh }: PP3OrssTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    const toastId = toast.loading('กำลังสร้างไฟล์ Excel ตามเทมเพลตมาตรฐาน OPEC ORSS...');
    try {
      const res = await fetch(`/api/academic/documents/pp3?mode=excel&academic_year=${summary.academicYear}`);
      if (!res.ok) throw new Error('ส่งออกไฟล์ล้มเหลว');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OPEC_ORSS_PP3_${summary.schoolId}_${summary.academicYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success('ดาวน์โหลดไฟล์ Excel สำหรับนำเข้า ORSS สช. เรียบร้อยแล้ว!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const generateLedgerHtml = () => {
    const rowsHtml = summary.records.map((r, i) => `
      <tr>
        <td style="text-align: center; border: 1px solid #000; padding: 4px;">${i + 1}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 4px; font-family: monospace;">${r.studentId}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 4px; font-family: monospace;">${r.citizenId}</td>
        <td style="border: 1px solid #000; padding: 4px;">${r.fullName}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 4px;">${r.gender}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 4px;">${r.birthDateTh}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 4px; font-weight: bold;">${r.gpax.toFixed(2)}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 4px; font-size: 11px;">${r.pp1Number}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 4px; font-size: 11px;">${r.pp2Number}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 4px; font-size: 11px;">${r.status}</td>
      </tr>
    `).join('');

    return `
      <div style="font-family:'Sarabun','TH Sarabun New',sans-serif;padding:8px;background:#fff;color:#000;">
        <div style="text-align:center;margin-bottom:16px;">
          <h2 style="margin:0 0 4px 0;font-size:16px;font-weight:bold;">แบบรายงานผู้สำเร็จการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน (ปพ.3:บ)</h2>
          <div><strong>โรงเรียน${summary.schoolName}</strong> อำเภอ${summary.district} จังหวัด${summary.province}</div>
          <div style="font-size:12px;">สังกัดสำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (รหัสสถานศึกษา: ${summary.schoolId}) ปีการศึกษา ${summary.academicYear}</div>
          <div style="font-size:11px;margin-top:4px;color:#475569;">อนุมัติการจบการศึกษา ณ วันที่ ${summary.graduationDateTh} | จำนวนผู้สำเร็จการศึกษาทั้งสิ้น ${summary.totalGraduates} คน (ชาย ${summary.maleCount} คน, หญิง ${summary.femaleCount} คน)</div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f1f5f9;font-weight:bold;">
              <th style="border:1px solid #000;padding:6px;width:35px;">ลำดับ</th>
              <th style="border:1px solid #000;padding:6px;width:75px;">เลขประจำตัว</th>
              <th style="border:1px solid #000;padding:6px;width:115px;">เลขประจำตัวประชาชน</th>
              <th style="border:1px solid #000;padding:6px;text-align:left;">ชื่อ - ชื่อสกุล</th>
              <th style="border:1px solid #000;padding:6px;width:45px;">เพศ</th>
              <th style="border:1px solid #000;padding:6px;width:95px;">วันเดือนปีเกิด</th>
              <th style="border:1px solid #000;padding:6px;width:55px;">GPAX</th>
              <th style="border:1px solid #000;padding:6px;width:110px;">เลขที่ ปพ.1</th>
              <th style="border:1px solid #000;padding:6px;width:100px;">เลขที่ ปพ.2</th>
              <th style="border:1px solid #000;padding:6px;width:90px;">การตัดสิน</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top:24px;display:flex;justify-content:space-around;text-align:center;font-size:11px;">
          <div>
            <div>ลงชื่อ.......................................................... ผู้จัดทำรายงาน</div>
            <div style="margin-top:4px;font-weight:bold;">( ${summary.registrarName} )</div>
            <div style="color:#64748b;">นายทะเบียน</div>
          </div>
          <div>
            <div>ลงชื่อ.......................................................... ผู้รับรองรายงาน</div>
            <div style="margin-top:4px;font-weight:bold;">( ${summary.directorName} )</div>
            <div style="color:#64748b;">ผู้อำนวยการโรงเรียน${summary.schoolName}</div>
          </div>
        </div>
      </div>
    `;
  };

  const handlePrintLedger = async () => {
    const html = generateLedgerHtml();
    await printDocumentViaSandbox({
      title: `แบบรายงานผู้สำเร็จการศึกษา_ปพ3_${summary.academicYear}`,
      paperSize: 'A4_LANDSCAPE',
      contentHtml: html
    });
  };

  const handlePreviewPdf = () => {
    const html = generateLedgerHtml();
    openDocumentPreviewInTab({
      title: `แบบรายงานผู้สำเร็จการศึกษา_ปพ3_${summary.academicYear}`,
      paperSize: 'A4_LANDSCAPE',
      contentHtml: html
    });
  };

  const filteredRecords = summary.records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.studentId.includes(q) ||
      r.citizenId.includes(q) ||
      r.fullName.toLowerCase().includes(q) ||
      r.pp1Number.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* 4 Quick Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#7B1C3E]/10 flex items-center justify-center text-[#7B1C3E] shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500">ผู้สำเร็จการศึกษา ป.6</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.totalGraduates} คน
            </div>
            <span className="text-[11px] text-slate-400">
              ชาย {summary.maleCount} • หญิง {summary.femaleCount}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500">เกรดเฉลี่ยเฉลี่ย (GPAX)</span>
            <div className="text-2xl font-bold text-emerald-600">
              {summary.averageGpax.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400">
              สูงสุด {summary.highestGpax.toFixed(2)} • ต่ำสุด {summary.lowestGpax.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500">สถานะรายงาน สช. ORSS</span>
            <div className="text-base font-bold text-purple-700 dark:text-purple-300">
              พร้อมส่งออก 100%
            </div>
            <span className="text-[11px] text-slate-400">
              ปีการศึกษา {summary.academicYear}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500">วันที่อนุมัติการจบ</span>
            <div className="text-base font-bold text-blue-700 dark:text-blue-300">
              {summary.graduationDateTh}
            </div>
            <span className="text-[11px] text-slate-400">
              ผอ. {summary.directorName}
            </span>
          </div>
        </div>
      </div>

      {/* Action & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, รหัสนักเรียน, หรือเลขบัตรประชาชน..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handlePreviewPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            title="บันทึกเล่ม ปพ.3 เป็นไฟล์ PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>บันทึก PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrintLedger}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>พิมพ์เล่ม ปพ.3 (A4 แนวนอน)</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออกไฟล์ ORSS (.xlsx) 1-Click'}</span>
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                <th className="py-3 px-3">เลขประจำตัว</th>
                <th className="py-3 px-3">เลขประจำตัวประชาชน</th>
                <th className="py-3 px-3">ชื่อ - สกุล</th>
                <th className="py-3 px-3 text-center">เพศ</th>
                <th className="py-3 px-3">วันเกิด</th>
                <th className="py-3 px-3 text-center">GPAX</th>
                <th className="py-3 px-3">เลขที่ ปพ.1</th>
                <th className="py-3 px-3">เลขที่ ปพ.2</th>
                <th className="py-3 px-3 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.map((r) => (
                <tr key={r.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400">{r.sequenceNumber}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">{r.studentId}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{r.citizenId}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{r.fullName}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      r.gender === 'ชาย' ? 'bg-sky-50 text-sky-700' : 'bg-pink-50 text-pink-700'
                    }`}>
                      {r.gender}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{r.birthDateTh}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 dark:text-emerald-400">{r.gpax.toFixed(2)}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{r.pp1Number}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{r.pp2Number}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{r.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
