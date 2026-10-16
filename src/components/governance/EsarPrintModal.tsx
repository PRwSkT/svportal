'use client';

import React from 'react';
import { Printer, X, Award, BookOpen, CheckCircle2, TrendingUp, Users, Building } from 'lucide-react';
import { EsarReportDocument } from '@/lib/governance/esar-aggregator';

interface EsarPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: EsarReportDocument | null;
}

export default function EsarPrintModal({
  isOpen,
  onClose,
  report
}: EsarPrintModalProps) {
  if (!isOpen || !report) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:max-w-none print:max-h-none print:overflow-visible">
        
        {/* Modal Action Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-white text-base sm:text-lg">
                รายงานการประเมินตนเองของสถานศึกษา (e-SAR เล่มทางการ)
              </h3>
              <p className="text-xs text-slate-500">
                ปีการศึกษา {report.academicYear} • อิงโครงสร้างมาตรฐาน สช. / สมศ.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
            >
              <Printer className="w-4 h-4" /> สั่งพิมพ์ / ส่งออก PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document (e-SAR Book Format) */}
        <div className="p-8 sm:p-14 text-slate-900 bg-white font-sans text-sm leading-relaxed print:p-8 space-y-10">
          
          {/* Cover Page Header */}
          <div className="text-center border-b-2 border-slate-900 pb-8 space-y-3">
            <div className="inline-block p-4 bg-purple-50 rounded-3xl border border-purple-200 mb-2">
              <Award className="w-12 h-12 text-purple-700 mx-auto" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              รายงานการประเมินตนเองของสถานศึกษา (Self-Assessment Report: SAR)
            </h1>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              {report.schoolName} (รหัสสถานศึกษา: {report.schoolCode})
            </h2>
            <p className="text-sm font-semibold text-purple-800">
              ระดับการศึกษาขั้นพื้นฐาน • ประจำปีการศึกษา {report.academicYear}
            </p>
            <p className="text-xs text-slate-500">
              สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช.) • กระทรวงศึกษาธิการ
            </p>
          </div>

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
              <span className="p-1.5 bg-slate-100 rounded-lg"><Building className="w-4 h-4 text-slate-700" /></span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                ส่วนที่ 1: ข้อมูลพื้นฐานของสถานศึกษา (General Information)
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm">
              <div>
                <span className="text-slate-500 block text-xs">จำนวนนักเรียนทั้งหมด:</span>
                <strong className="text-slate-900 font-extrabold text-base">{report.part1.totalStudents} คน</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">แยกตามเพศ (ช/ญ):</span>
                <strong className="text-slate-900 font-semibold">ชาย {report.part1.maleStudents} / หญิง {report.part1.femaleStudents} คน</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">จำนวนห้องเรียน:</span>
                <strong className="text-slate-900 font-semibold">{report.part1.totalClassrooms} ห้องเรียน</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">ครูมีใบอนุญาตคุรุสภา:</span>
                <strong className="text-emerald-700 font-extrabold">{report.part1.licensedTeacherPercent.toFixed(1)}% (ครบ 100%)</strong>
              </div>
            </div>

            {/* Grade breakdown table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 p-2 text-left">ระดับชั้นเรียน</th>
                    <th className="border border-slate-300 p-2 text-center">จำนวนห้อง</th>
                    <th className="border border-slate-300 p-2 text-right">ชาย (คน)</th>
                    <th className="border border-slate-300 p-2 text-right">หญิง (คน)</th>
                    <th className="border border-slate-300 p-2 text-right">รวม (คน)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.part1.gradeBreakdown.map((g, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 p-2 font-medium">{g.gradeName}</td>
                      <td className="border border-slate-300 p-2 text-center">{g.roomCount}</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">{g.maleCount}</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">{g.femaleCount}</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-bold">{g.totalCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Three Quality Standards */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
              <span className="p-1.5 bg-purple-50 rounded-lg"><Award className="w-4 h-4 text-purple-700" /></span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                ส่วนที่ 2: ผลการประเมินตนเองตามมาตรฐานการศึกษาขั้นพื้นฐาน (3 มาตรฐาน)
              </h3>
            </div>

            {/* Standard 1 */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  {report.part2.standard1.title}
                </h4>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-900 font-black text-xs border border-purple-200">
                  ระดับคุณภาพ: {report.part2.standard1.overallRating}
                </span>
              </div>

              {/* Subject Achievements Table */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">
                  1.1 ผลสัมฤทธิ์ทางวิชาการใน 8 กลุ่มสาระการเรียนรู้ (นักเรียนที่มีผลการเรียน 3.00 ขึ้นไป):
                </span>
                <table className="w-full text-xs border border-slate-300 border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 p-2 text-left">กลุ่มสาระการเรียนรู้</th>
                      <th className="border border-slate-300 p-2 text-center">นักเรียนทั้งหมด</th>
                      <th className="border border-slate-300 p-2 text-center">ได้เกรด &ge; 3.00</th>
                      <th className="border border-slate-300 p-2 text-center">ร้อยละที่ได้</th>
                      <th className="border border-slate-300 p-2 text-center">ค่าเป้าหมาย</th>
                      <th className="border border-slate-300 p-2 text-center">ผลเทียบเป้าหมาย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.part2.standard1.academicAchievements.map((ach, idx) => (
                      <tr key={idx}>
                        <td className="border border-slate-300 p-2 font-medium">{ach.subjectName}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono">{ach.totalStudents}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono">{ach.grade3PlusCount}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">{ach.grade3PlusPercent.toFixed(1)}%</td>
                        <td className="border border-slate-300 p-2 text-center font-mono">{ach.targetPercent.toFixed(1)}%</td>
                        <td className={`border border-slate-300 p-2 text-center font-bold ${
                          ach.resultComparison === 'BELOW_TARGET' ? 'text-rose-600' : 'text-emerald-700'
                        }`}>
                          {ach.resultComparison === 'BELOW_TARGET'
                            ? 'ต่ำกว่าเป้าหมาย'
                            : ach.resultComparison === 'EXCEEDED'
                            ? 'สูงกว่าเป้าหมาย'
                            : 'บรรลุเป้าหมาย'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Health, Desirable & Mental stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">คุณลักษณะอันพึงประสงค์ (ดี-ดีเยี่ยม):</span>
                  <strong className="text-emerald-700 text-sm font-black">{report.part2.standard1.desirableCharacteristicsPassPercent}%</strong>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">ภาวะโภชนาการสมส่วน (กรมอนามัย):</span>
                  <strong className="text-emerald-700 text-sm font-black">{report.part2.standard1.normalNutritionPercent}%</strong>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">สุขภาพจิตพฤติกรรมปกติ (SDQ 360°):</span>
                  <strong className="text-emerald-700 text-sm font-black">{report.part2.standard1.normalSdqPercent}%</strong>
                </div>
              </div>
            </div>

            {/* Standard 2 & 3 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-slate-900">{report.part2.standard2.title}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold text-[10px]">
                    {report.part2.standard2.overallRating}
                  </span>
                </div>
                <p className="text-slate-700">
                  • การประชุมคณะกรรมการบริหารโรงเรียน (ม.30): ครบถ้วน {report.part2.standard2.boardMeetingsHeld} ครั้ง/ปี
                </p>
                <p className="text-slate-700">
                  • ชั่วโมงการพัฒนาวิชาชีพครูเฉลี่ย (CPD): {report.part2.standard2.averageCpdHoursPerTeacher} ชม./คน/ปี
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-slate-900">{report.part2.standard3.title}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold text-[10px]">
                    {report.part2.standard3.overallRating}
                  </span>
                </div>
                <p className="text-slate-700">
                  • การจัดการเรียนรู้เชิงรุก (Active Learning): {report.part2.standard3.activeLearningPercent}%
                </p>
                <p className="text-slate-700">
                  • การวัดและประเมินผลตามสภาพจริงด้วยระบบดิจิทัล SVPortal
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Strengths & Development Plan */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
              <span className="p-1.5 bg-slate-100 rounded-lg"><TrendingUp className="w-4 h-4 text-slate-700" /></span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                ส่วนที่ 3: จุดเด่นและแนวทางการพัฒนาในอนาคต (Future Plan)
              </h3>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <strong className="block text-slate-900 font-bold">จุดเด่นของสถานศึกษา:</strong>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                {report.part3.strengths.map((str, idx) => (
                  <li key={idx}>{str}</li>
                ))}
              </ul>

              <strong className="block text-slate-900 font-bold pt-2">ทิศทางการพัฒนาในอนาคต:</strong>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                {report.part3.futureDevelopmentPlan.map((plan, idx) => (
                  <li key={idx}>{plan}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Signature Sign-Off Block */}
          <div className="mt-12 pt-8 border-t border-slate-400 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="h-16 border-b border-dashed border-slate-400 mx-auto w-48"></div>
              <p className="mt-2 font-bold text-slate-800">(.........................................................)</p>
              <p className="text-slate-500">ประธานคณะกรรมการประเมินตนเองของสถานศึกษา</p>
            </div>
            <div>
              <div className="h-16 border-b border-dashed border-slate-400 mx-auto w-48"></div>
              <p className="mt-2 font-bold text-slate-800">(.........................................................)</p>
              <p className="text-slate-500">ผู้อำนวยการ {report.schoolName}</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
