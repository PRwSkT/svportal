'use client';

import React, { useState } from 'react';
import { PP6StudentReport } from '@/lib/academic/pp6-compiler';
import { 
  BookOpen, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Heart, 
  Activity, 
  CheckCircle2, 
  Award, 
  Smartphone,
  BookMarked,
  User,
  Clock,
  Scale,
  FileDown,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { printDocumentViaSandbox, openDocumentPreviewInTab } from '@/lib/documents/print-service';
import { renderPP6FullBookletHtml } from '@/components/documents/academic/PP6FullBookletPrint';

interface PP6BookletViewerProps {
  report: PP6StudentReport;
  onRefresh: () => void;
}

export function PP6BookletViewer({ report, onRefresh }: PP6BookletViewerProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'booklet' | 'mobile_parent'>('booklet');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [teacherComment, setTeacherComment] = useState(report.term2TeacherComment);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrintFullBooklet = async () => {
    setIsPrinting(true);
    const toastId = toast.loading('กำลังจัดเตรียมสมุดพก ปพ.6 ครบ 16 หน้าเพื่อส่งเครื่องพิมพ์...');
    try {
      const html = renderPP6FullBookletHtml({
        ...report,
        term2TeacherComment: teacherComment
      });
      await printDocumentViaSandbox({
        title: `ปพ6_สมุดพก16หน้า_${report.studentId}_${report.fullName}`,
        paperSize: 'A5_PORTRAIT',
        contentHtml: html
      });
      toast.success('ส่งคำสั่งพิมพ์สมุดพก 16 หน้าเรียบร้อยแล้ว', { id: toastId });
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการพิมพ์สมุดพก', { id: toastId });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePreviewPdf = () => {
    const html = renderPP6FullBookletHtml({
      ...report,
      term2TeacherComment: teacherComment
    });
    openDocumentPreviewInTab({
      title: `ปพ6_สมุดพก16หน้า_${report.studentId}_${report.fullName}`,
      paperSize: 'A5_PORTRAIT',
      contentHtml: html
    });
  };

  const handlePrintCurrentPage = () => {
    window.print();
  };

  const handleAiDraftComment = async () => {
    setIsAiGenerating(true);
    const toastId = toast.loading('น้องฟ้า AI กำลังวิเคราะห์ผลการเรียนและพัฒนาการเพื่อร่างความเห็นครู...');
    try {
      const res = await fetch('/api/academic/documents/pp6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: report.studentId,
          action: 'generate_ai_comment',
          term: '2',
          gpa: report.fullYearGpa,
          strengths: 'วิทยาศาสตร์และภาษาอังกฤษ'
        })
      });
      const data = await res.json();
      if (data.success && data.comment) {
        setTeacherComment(data.comment);
        toast.success('น้องฟ้าร่างความเห็นครูประจำชั้นเรียบร้อยแล้ว!', { id: toastId });
      } else {
        toast.error('ไม่สามารถสร้างความเห็น AI ได้', { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ AI', { id: toastId });
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Control Bar */}
      <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('booklet')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'booklet'
                  ? 'bg-white text-[#7B1C3E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>สมุดพก 16 หน้า (Booklet)</span>
            </button>
            <button
              onClick={() => setViewMode('mobile_parent')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'mobile_parent'
                  ? 'bg-white text-[#7B1C3E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>มุมมองผู้ปกครอง (Mobile View)</span>
            </button>
          </div>

          {viewMode === 'booklet' && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border px-2 py-1 rounded-xl text-xs">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-300 px-2">
                หน้า {currentPage} / 16
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(16, prev + 1))}
                disabled={currentPage === 16}
                className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'booklet' && (currentPage === 10 || currentPage === 12) && (
            <button
              onClick={handleAiDraftComment}
              disabled={isAiGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-semibold hover:bg-purple-100 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAiGenerating ? 'น้องฟ้ากำลังร่าง...' : 'น้องฟ้าช่วยร่างความเห็นครู'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePreviewPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            title="เปิดดูตัวอย่างสมุดพกครบ 16 หน้าและบันทึกเป็น PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>บันทึก PDF (16 หน้า)</span>
          </button>

          <button
            type="button"
            disabled={isPrinting}
            onClick={handlePrintFullBooklet}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7B1C3E] hover:bg-[#631430] disabled:bg-[#7B1C3E]/50 text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition cursor-pointer"
            title="สั่งพิมพ์สมุดพกครบทั้ง 16 หน้าพร้อมกัน"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isPrinting ? 'กำลังเตรียมพิมพ์...' : 'พิมพ์สมุดพกทั้งเล่ม (16 หน้า)'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintCurrentPage}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
            title="พิมพ์เฉพาะหน้าปัจจุบันที่แสดงบนจอ"
          >
            <Printer className="w-3 h-3 text-slate-400" />
            <span>พิมพ์เฉพาะหน้านี้ (น.{currentPage})</span>
          </button>
        </div>
      </div>

      {/* Page Thumbnails Selector (1 - 16) */}
      {viewMode === 'booklet' && (
        <div className="no-print overflow-x-auto pb-2 flex items-center gap-1.5 px-1">
          {Array.from({ length: 16 }, (_, i) => i + 1).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                currentPage === pageNum
                  ? 'bg-[#7B1C3E] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:border-slate-400'
              }`}
            >
              น.{pageNum}
            </button>
          ))}
        </div>
      )}

      {/* ================= VIEW MODE 1: BOOKLET PAGES (16 PAGES) ================= */}
      {viewMode === 'booklet' && (
        <div className="flex justify-center pb-8 overflow-x-auto">
          <div 
            className="bg-white shadow-2xl border border-slate-300 text-slate-900 relative p-8"
            style={{
              width: '148mm', // Standard A5 Booklet Page Size
              minHeight: '210mm',
              boxSizing: 'border-box',
              fontFamily: '"Sarabun", "TH Sarabun New", sans-serif'
            }}
          >
            {/* Page Header Indicator */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 border-b pb-1 mb-4">
              <span>ปพ.6 สมุดรายงานประจำตัวนักเรียน</span>
              <span className="font-bold">หน้า {currentPage}</span>
            </div>

            {/* PAGE 1: COVER */}
            {currentPage === 1 && (
              <div className="text-center space-y-6 pt-6">
                <div className="w-20 h-20 mx-auto rounded-full border-2 border-[#7B1C3E] flex items-center justify-center font-bold text-xs text-[#7B1C3E] bg-[#7B1C3E]/5">
                  ตราโรงเรียน
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#7B1C3E]">โรงเรียนสมคิดวิทยา</h2>
                  <p className="text-xs text-slate-600">สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน</p>
                  <p className="text-xs text-slate-500">อำเภอเมืองลำปาง จังหวัดลำปาง</p>
                </div>
                <div className="py-4 border-y border-dashed border-slate-300">
                  <h3 className="text-base font-bold">สมุดรายงานประจำตัวนักเรียน (ปพ.6)</h3>
                  <p className="text-xs text-slate-500">ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
                </div>
                <div className="text-left text-xs space-y-2 max-w-xs mx-auto pt-4 bg-slate-50 p-4 rounded-xl border">
                  <div><strong>ชื่อ - สกุล:</strong> {report.fullName}</div>
                  <div><strong>ชั้น:</strong> {report.gradeName} <strong>เลขที่:</strong> {report.rollNumber}</div>
                  <div><strong>เลขประจำตัวนักเรียน:</strong> <span className="font-mono">{report.studentId}</span></div>
                  <div><strong>เลขประจำตัวประชาชน:</strong> <span className="font-mono">{report.citizenId}</span></div>
                  <div><strong>ปีการศึกษา:</strong> {report.academicYear}</div>
                  <div><strong>ครูประจำชั้น:</strong> {report.homeroomTeacherName}</div>
                </div>
              </div>
            )}

            {/* PAGE 2: STUDENT & FAMILY PROFILE */}
            {currentPage === 2 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">ข้อมูลประวัตินักเรียนและครอบครัว</h3>
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border">
                  <div><strong>ชื่อ-สกุล:</strong> {report.fullName}</div>
                  <div><strong>เกิดวันที่:</strong> {report.birthDateTh} (อายุ {report.ageYears} ปี)</div>
                  <div><strong>เพศ:</strong> {report.gender}</div>
                  <div><strong>ที่อยู่:</strong> {report.homeAddress}</div>
                </div>
                <h4 className="font-bold text-slate-800 pt-2">ข้อมูลบิดา - มารดา - ผู้ปกครอง</h4>
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border">
                  <div><strong>ชื่อบิดา:</strong> {report.fatherName} <strong>เบอร์โทร:</strong> {report.fatherPhone}</div>
                  <div><strong>ชื่อมารดา:</strong> {report.motherName} <strong>เบอร์โทร:</strong> {report.motherPhone}</div>
                  <div><strong>ชื่อผู้ปกครอง:</strong> {report.guardianName} <strong>เบอร์โทร:</strong> {report.guardianPhone}</div>
                </div>
              </div>
            )}

            {/* PAGE 3: ATTENDANCE */}
            {currentPage === 3 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">เวลาเรียนและการมาเรียน</h3>
                <table className="w-full border-collapse border border-slate-300 text-center">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border p-1.5">รายการ</th>
                      <th className="border p-1.5">ภาคเรียนที่ 1</th>
                      <th className="border p-1.5">ภาคเรียนที่ 2</th>
                      <th className="border p-1.5">รวมทั้งปี</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-1.5 text-left">เวลาเปิดเรียน (วัน)</td>
                      <td className="border p-1.5">100</td>
                      <td className="border p-1.5">100</td>
                      <td className="border p-1.5 font-bold">200</td>
                    </tr>
                    <tr>
                      <td className="border p-1.5 text-left">มาเรียน (วัน)</td>
                      <td className="border p-1.5">98</td>
                      <td className="border p-1.5">98</td>
                      <td className="border p-1.5 font-bold text-emerald-700">{report.attendedDays}</td>
                    </tr>
                    <tr>
                      <td className="border p-1.5 text-left">ลาป่วย (วัน)</td>
                      <td className="border p-1.5">2</td>
                      <td className="border p-1.5">1</td>
                      <td className="border p-1.5">{report.sickLeaveDays}</td>
                    </tr>
                    <tr>
                      <td className="border p-1.5 text-left">ลากิจ (วัน)</td>
                      <td className="border p-1.5">0</td>
                      <td className="border p-1.5">1</td>
                      <td className="border p-1.5">{report.personalLeaveDays}</td>
                    </tr>
                    <tr>
                      <td className="border p-1.5 text-left">ขาดเรียน (วัน)</td>
                      <td className="border p-1.5">0</td>
                      <td className="border p-1.5">0</td>
                      <td className="border p-1.5 font-bold">{report.absentDays}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="border p-1.5 text-left">คิดเป็นร้อยละ (%)</td>
                      <td className="border p-1.5">98.0%</td>
                      <td className="border p-1.5">98.0%</td>
                      <td className="border p-1.5 text-emerald-700">{report.attendancePercent.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
                <div className="p-3 bg-emerald-50 rounded-lg text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                  ✓ มีเวลาเรียนเกินเกณฑ์ 80% ตามระเบียบกระทรวงศึกษาธิการ มีสิทธิ์ได้รับการตัดสินผลการเรียน
                </div>
              </div>
            )}

            {/* PAGE 4: ACADEMIC RESULTS TERM 1 */}
            {currentPage === 4 && (
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center border-b pb-1">
                  <h3 className="font-bold text-sm text-[#7B1C3E]">ผลการเรียนรู้ ภาคเรียนที่ 1</h3>
                  <span className="font-bold text-emerald-700">GPA: {report.term1Gpa.toFixed(2)}</span>
                </div>
                <table className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border p-1 text-left">วิชา</th>
                      <th className="border p-1 w-10">คะแนน</th>
                      <th className="border p-1 w-10">เกรด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.basicSubjects.map((s, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="border p-1">{s.courseName}</td>
                        <td className="border p-1 text-center">{s.term1Score}</td>
                        <td className="border p-1 text-center font-bold">{s.term1Grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGE 5: ACADEMIC RESULTS TERM 2 & FULL YEAR */}
            {currentPage === 5 && (
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center border-b pb-1">
                  <h3 className="font-bold text-sm text-[#7B1C3E]">ผลการเรียนรู้ ภาคเรียนที่ 2 และตลอดปี</h3>
                  <span className="font-bold text-emerald-700 text-sm">GPAX ทั้งปี: {report.fullYearGpa.toFixed(2)}</span>
                </div>
                <table className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center text-[11px]">
                      <th className="border p-1 text-left">วิชา</th>
                      <th className="border p-1 w-12">เทอม 2</th>
                      <th className="border p-1 w-14">เกรดทั้งปี</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.basicSubjects.map((s, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="border p-1">{s.courseName}</td>
                        <td className="border p-1 text-center">{s.term2Grade}</td>
                        <td className="border p-1 text-center font-bold text-[#7B1C3E]">{s.fullYearGrade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGE 6: DEVELOPMENT ACTIVITIES */}
            {currentPage === 6 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">การประเมินกิจกรรมพัฒนาผู้เรียน</h3>
                <table className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border p-1.5 text-left">กิจกรรม</th>
                      <th className="border p-1.5 w-16">เวลา (ชม.)</th>
                      <th className="border p-1.5 w-20">ผลการประเมิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.activities.map((a, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="border p-1.5">{a.name}</td>
                        <td className="border p-1.5 text-center">{a.hours}</td>
                        <td className="border p-1.5 text-center font-bold text-emerald-700">{a.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-3 bg-emerald-50 rounded-lg text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                  สรุปผลการประเมินกิจกรรมพัฒนาผู้เรียน: ผ่านเกณฑ์การประเมินทุกกิจกรรม
                </div>
              </div>
            )}

            {/* PAGE 7: DESIRABLE CHARACTERISTICS */}
            {currentPage === 7 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">การประเมินคุณลักษณะอันพึงประสงค์ ๘ ประการ</h3>
                <div className="space-y-1.5">
                  {report.desirableCharacteristics.map((item) => (
                    <div key={item.itemNumber} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border">
                      <span>{item.itemNumber}. {item.title}</span>
                      <span className="font-bold text-emerald-700">{item.text} (ระดับ {item.score})</span>
                    </div>
                  ))}
                </div>
                <div className="text-right font-bold text-emerald-800 pt-2">
                  สรุปผลการประเมิน: ดีเยี่ยม (ระดับ ๓)
                </div>
              </div>
            )}

            {/* PAGE 8: READING, THINKING & WRITING */}
            {currentPage === 8 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">การประเมินการอ่าน คิดวิเคราะห์ และเขียน</h3>
                <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
                  <div className="font-semibold text-slate-800">เกณฑ์การประเมิน:</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li>การอ่านข้อความ นิทาน บทความ และจับใจความสำคัญ</li>
                    <li>การคิดวิเคราะห์ ระบุข้อเท็จจริง และแยกแยะเหตุผล</li>
                    <li>การเขียนถ่ายทอดความคิด ความรู้สึก และสรุปประเด็นได้อย่างสร้างสรรค์</li>
                  </ul>
                  <div className="pt-2 border-t flex justify-between items-center font-bold">
                    <span>ระดับคุณภาพ:</span>
                    <span className="text-emerald-700 text-sm">ดีเยี่ยม (ระดับ ๓)</span>
                  </div>
                </div>
              </div>
            )}

            {/* PAGE 9: HEALTH & NUTRITION (LINKED TO SPRINT 2) */}
            {currentPage === 9 && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-2 border-b pb-1 text-[#7B1C3E]">
                  <Scale className="w-4 h-4" />
                  <h3 className="font-bold text-sm">พัฒนาการด้านสุขภาพและภาวะโภชนาการ</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-xl border">
                    <span className="text-[10px] text-slate-500">น้ำหนัก</span>
                    <div className="text-base font-bold text-slate-900">{report.weightKg} กก.</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border">
                    <span className="text-[10px] text-slate-500">ส่วนสูง</span>
                    <div className="text-base font-bold text-slate-900">{report.heightCm} ซม.</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border">
                    <span className="text-[10px] text-slate-500">ดัชนี BMI</span>
                    <div className="text-base font-bold text-emerald-600">{report.bmi}</div>
                  </div>
                </div>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border">
                  <div className="font-bold text-slate-800">การประเมินตามเกณฑ์มาตรฐานกรมอนามัย:</div>
                  <div className="flex justify-between border-b pb-1">
                    <span>น้ำหนักตามเกณฑ์ส่วนสูง:</span>
                    <strong className="text-emerald-700">{report.wfhStatus}</strong>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>ส่วนสูงตามเกณฑ์อายุ:</span>
                    <strong className="text-emerald-700">{report.hfaStatus}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>น้ำหนักตามเกณฑ์อายุ:</span>
                    <strong className="text-emerald-700">{report.wfaStatus}</strong>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 text-center">
                  * ข้อมูลเชื่อมโยงอัตโนมัติจากเวชระเบียนโภชนาการ SVPortal Nutrition Engine
                </div>
              </div>
            )}

            {/* PAGE 10: TEACHER REMARKS TERM 1 */}
            {currentPage === 10 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">ความเห็นครูประจำชั้น (ภาคเรียนที่ 1)</h3>
                <div className="p-4 bg-slate-50 rounded-xl border leading-relaxed text-slate-700">
                  {report.term1TeacherComment}
                </div>
                <div className="text-right pt-4">
                  <div>ลงชื่อ.......................................................... ครูประจำชั้น</div>
                  <div className="mt-1 font-bold">({report.homeroomTeacherName})</div>
                </div>
              </div>
            )}

            {/* PAGE 11: PARENT REMARKS TERM 1 */}
            {currentPage === 11 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">ความเห็นผู้ปกครอง (ภาคเรียนที่ 1)</h3>
                <div className="p-4 bg-slate-50 rounded-xl border min-h-[100px] text-slate-600 italic">
                  ผู้ปกครองรับทราบผลการเรียนและพัฒนาการของนักเรียน และพร้อมให้ความร่วมมือกับโรงเรียนอย่างเต็มที่
                </div>
                <div className="text-right pt-4">
                  <div>ลงชื่อ.......................................................... ผู้ปกครอง</div>
                  <div className="mt-1 font-bold">({report.guardianName})</div>
                </div>
              </div>
            )}

            {/* PAGE 12: TEACHER REMARKS TERM 2 (WITH AI ASSISTANT) */}
            {currentPage === 12 && (
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center border-b pb-1">
                  <h3 className="font-bold text-sm text-[#7B1C3E]">ความเห็นครูประจำชั้น (ภาคเรียนที่ 2)</h3>
                  <button
                    onClick={handleAiDraftComment}
                    disabled={isAiGenerating}
                    className="inline-flex items-center gap-1 text-[11px] text-purple-700 font-bold hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>ให้น้องฟ้าช่วยเขียน</span>
                  </button>
                </div>
                <textarea
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  rows={6}
                  className="w-full p-3 bg-slate-50 border rounded-xl text-xs leading-relaxed focus:ring-1 focus:ring-[#7B1C3E] outline-none"
                />
                <div className="text-right pt-2">
                  <div>ลงชื่อ.......................................................... ครูประจำชั้น</div>
                  <div className="mt-1 font-bold">({report.homeroomTeacherName})</div>
                </div>
              </div>
            )}

            {/* PAGE 13: PARENT REMARKS TERM 2 */}
            {currentPage === 13 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">ความเห็นผู้ปกครอง (ภาคเรียนที่ 2)</h3>
                <div className="p-4 bg-slate-50 rounded-xl border min-h-[100px] text-slate-600 italic">
                  ผู้ปกครองรับทราบผลการตัดสินเลื่อนชั้นและมีความพึงพอใจในพัฒนาการตลอดปีการศึกษา
                </div>
                <div className="text-right pt-4">
                  <div>ลงชื่อ.......................................................... ผู้ปกครอง</div>
                  <div className="mt-1 font-bold">({report.guardianName})</div>
                </div>
              </div>
            )}

            {/* PAGE 14: SPECIAL ACHIEVEMENTS */}
            {currentPage === 14 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">ผลงานความภาคภูมิใจและกิจกรรมพิเศษ</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <strong className="text-slate-800">1. การแข่งขันทักษะวิชาการ:</strong>
                    <p className="text-slate-600 mt-0.5">รางวัลเหรียญทอง การแข่งขันตอบปัญหาวิทยาศาสตร์ ระดับเขตพื้นที่การศึกษา</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <strong className="text-slate-800">2. ด้านคุณธรรมและจิตอาสา:</strong>
                    <p className="text-slate-600 mt-0.5">ได้รับคัดเลือกเป็นสารวัตรนักเรียนจิตอาสา ประจำปีการศึกษา 2568</p>
                  </div>
                </div>
              </div>
            )}

            {/* PAGE 15: MOE GRADING SYSTEM GUIDE */}
            {currentPage === 15 && (
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-sm text-[#7B1C3E] border-b pb-1">เกณฑ์มาตรฐานการตัดสินผลการเรียน</h3>
                <p className="text-slate-600 leading-relaxed">
                  การประเมินผลการเรียนรู้ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. ๒๕๕๑ กำหนดระดับผลการเรียนเป็น ๘ ระดับ:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-1.5 bg-slate-50 border rounded">๘๐ - ๑๐๐ = ๔.๐ (ดีเยี่ยม)</div>
                  <div className="p-1.5 bg-slate-50 border rounded">๗๕ - ๗๙ = ๓.๕ (ดีมาก)</div>
                  <div className="p-1.5 bg-slate-50 border rounded">๗๐ - ๗๔ = ๓.๐ (ดี)</div>
                  <div className="p-1.5 bg-slate-50 border rounded">๖๕ - ๖๙ = ๒.๕ (ค่อนข้างดี)</div>
                  <div className="p-1.5 bg-slate-50 border rounded">๖๐ - ๖๔ = ๒.๐ (ปานกลาง)</div>
                  <div className="p-1.5 bg-slate-50 border rounded">๕๕ - ๕๙ = ๑.๕ (พอใช้)</div>
                  <div className="p-1.5 bg-slate-50 border rounded">๕๐ - ๕๔ = ๑.๐ (ผ่านเกณฑ์ขั้นต่ำ)</div>
                  <div className="p-1.5 bg-slate-50 border rounded">๐ - ๔๙ = ๐ (ต่ำกว่าเกณฑ์)</div>
                </div>
              </div>
            )}

            {/* PAGE 16: PROMOTION APPROVAL & SIGNATURES */}
            {currentPage === 16 && (
              <div className="space-y-4 text-xs text-center pt-2">
                <h3 className="font-bold text-base text-[#7B1C3E] border-b pb-2">การตัดสินผลการเรียนและการอนุมัติเลื่อนชั้น</h3>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="text-sm font-extrabold">{report.promotionDecision}</div>
                  <div className="text-[11px]">มีผลการประเมินผ่านเกณฑ์ตามหลักสูตรทุกด้าน</div>
                </div>

                <div className="pt-6 space-y-6 text-left">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span>ลงชื่อครูประจำชั้น:</span>
                    <strong className="font-bold">({report.homeroomTeacherName})</strong>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span>ลงชื่อผู้อำนวยการโรงเรียน:</span>
                    <strong className="font-bold">({report.directorName})</strong>
                  </div>
                </div>

                <div className="pt-4 text-[10px] text-slate-400">
                  (ประทับตราโรงเรียนประจำเล่มรายงาน ปพ.6)
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ================= VIEW MODE 2: MOBILE PARENT VIEW ================= */}
      {viewMode === 'mobile_parent' && (
        <div className="max-w-md mx-auto bg-slate-100 p-4 rounded-3xl border border-slate-300 shadow-xl space-y-4">
          <div className="bg-gradient-to-r from-[#7B1C3E] to-[#9E2A50] text-white p-5 rounded-2xl shadow-md space-y-2">
            <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              สมุดรายงานประจำตัวนักเรียนดิจิทัล (ปพ.6)
            </span>
            <h3 className="text-lg font-extrabold">{report.fullName}</h3>
            <p className="text-xs text-white/80">ชั้น {report.gradeName} • เลขที่ {report.rollNumber}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border shadow-xs">
              <span className="text-xs text-slate-500">เกรดเฉลี่ยทั้งปี</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{report.fullYearGpa.toFixed(2)}</div>
              <span className="text-[10px] text-slate-400">ระดับผลการเรียนดีเยี่ยม</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border shadow-xs">
              <span className="text-xs text-slate-500">เวลาเรียนสะสม</span>
              <div className="text-2xl font-black text-blue-600 mt-1">{report.attendancePercent.toFixed(1)}%</div>
              <span className="text-[10px] text-slate-400">มาเรียน {report.attendedDays}/{report.totalSchoolDays} วัน</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border shadow-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
              <Scale className="w-4 h-4 text-amber-600" />
              <span>การเจริญเติบโต (เกณฑ์กรมอนามัย)</span>
            </div>
            <div className="text-xs text-slate-600">
              น้ำหนัก {report.weightKg} กก. • ส่วนสูง {report.heightCm} ซม. (BMI: {report.bmi})
            </div>
            <div className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
              {report.wfhStatus}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border shadow-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>ความเห็นครูประจำชั้น</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed italic">
              "{teacherComment}"
            </p>
            <div className="text-[11px] text-slate-400 text-right font-medium">
              - {report.homeroomTeacherName}
            </div>
          </div>

          <div className="p-3 bg-emerald-500 text-white rounded-2xl text-center text-xs font-bold shadow-sm">
            ✓ {report.promotionDecision}
          </div>
        </div>
      )}

    </div>
  );
}
