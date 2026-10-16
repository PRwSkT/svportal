'use client';

import React, { useState } from 'react';
import { PP1StudentData } from '@/lib/academic/pp1-engine';
import { PrintAlignmentProfile, calculateCalibratedStyle, PRINT_CSS_A4_PORTRAIT } from '@/lib/academic/print-alignment';
import { Printer, Eye, Sliders, ChevronLeft, ChevronRight, FileText, CheckCircle2, FileDown } from 'lucide-react';
import { GarudaCrest } from '@/lib/documents/garuda-crest';
import { printDocumentViaSandbox, openDocumentPreviewInTab } from '@/lib/documents/print-service';

interface PP1ViewerProps {
  data: PP1StudentData;
  profile: PrintAlignmentProfile;
  onOpenCalibration: () => void;
}

export function PP1Viewer({ data, profile, onOpenCalibration }: PP1ViewerProps) {
  const [activePage, setActivePage] = useState<1 | 2>(1);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    if (sheetRef.current) {
      await printDocumentViaSandbox({
        title: `ปพ1_${data.studentId}_${data.fullNameTh}_หน้า${activePage}`,
        paperSize: 'A4_PORTRAIT',
        contentHtml: sheetRef.current.innerHTML
      });
    } else {
      window.print();
    }
  };

  const handlePreviewPdf = () => {
    if (sheetRef.current) {
      openDocumentPreviewInTab({
        title: `ปพ1_${data.studentId}_${data.fullNameTh}_หน้า${activePage}`,
        paperSize: 'A4_PORTRAIT',
        contentHtml: sheetRef.current.innerHTML
      });
    }
  };

  const isOverlay = profile.mode === 'OVERLAY';

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS_A4_PORTRAIT }} />

      {/* Control Bar (Hidden during Print) */}
      <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActivePage(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activePage === 1 
                  ? 'bg-white text-[#7B1C3E] shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              หน้า 1 (ผลการเรียนรายวิชา)
            </button>
            <button
              onClick={() => setActivePage(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activePage === 2 
                  ? 'bg-white text-[#7B1C3E] shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              หน้า 2 (สรุปผลการประเมิน & ลายมือชื่อ)
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border text-xs">
            <span className="text-slate-400">โหมด:</span>
            <span className={`font-bold ${isOverlay ? 'text-amber-600' : 'text-indigo-600'}`}>
              {isOverlay ? 'พิมพ์ทับกระดาษจริง (Overlay)' : 'พิมพ์ฉบับสำเนา (Full Copy)'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-mono text-[11px]">
              X:{profile.offsetXmm}mm Y:{profile.offsetYmm}mm
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreviewPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            title="บันทึก ปพ.1 หน้านี้เป็น PDF เวกเตอร์"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>บันทึก PDF</span>
          </button>
          <button
            type="button"
            onClick={onOpenCalibration}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>ปรับจูนพิกัดพิมพ์</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>สั่งพิมพ์หน้านี้ (Print)</span>
          </button>
        </div>
      </div>

      {/* A4 Sheet Container (210mm x 297mm) */}
      <div className="overflow-x-auto flex justify-center pb-8">
        <div 
          ref={sheetRef}
          className="print-page bg-white shadow-2xl border border-slate-300 text-slate-900 font-serif relative"
          style={{
            width: '210mm',
            minHeight: '297mm',
            boxSizing: 'border-box',
            fontFamily: '"Sarabun", "TH Sarabun New", serif'
          }}
        >
          {/* ================= PAGE 1 (FRONT) ================= */}
          {activePage === 1 && (
            <div className="relative w-full h-[297mm]">
              {/* Full Copy Background Elements */}
              {!isOverlay && (
                <>
                  {/* Outer Double Border */}
                  <div className="absolute inset-[10mm] border-2 border-slate-900 pointer-events-none p-1">
                    <div className="w-full h-full border border-slate-900"></div>
                  </div>

                  {/* Garuda Crest (Center Top) */}
                  <div className="absolute left-[105mm] top-[14mm] -translate-x-1/2 text-center">
                    <GarudaCrest widthMm={24} heightMm={24} className="mx-auto mb-1" />
                    <div className="text-sm font-bold tracking-tight">
                      ระเบียนแสดงผลการเรียนตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน (ปพ.1:บ)
                    </div>
                    <div className="text-xs text-slate-600">
                      ระดับประถมศึกษา (ช่วงชั้นที่ 1 - 2)
                    </div>
                  </div>

                  {/* School & Student Info Frame */}
                  <div className="absolute left-[15mm] top-[38mm] right-[15mm] text-xs space-y-1">
                    <div className="flex justify-between border-b pb-1">
                      <span>โรงเรียน{data.schoolName} อำเภอ{data.district} จังหวัด{data.province}</span>
                      <span>สังกัด{data.affiliation}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Dynamic Calibrated Overlay Data (Printed in both modes) */}
              
              {/* School & Student Data Values */}
              <div style={calculateCalibratedStyle({ leftMm: 15, topMm: 46, profile, baseFontSizePt: 10 })}>
                <strong>ชื่อ - สกุล:</strong> {data.fullNameTh} ({data.fullNameEn})
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 140, topMm: 46, profile, baseFontSizePt: 10 })}>
                <strong>เลขประจำตัว:</strong> <span className="font-mono">{data.studentId}</span>
              </div>

              <div style={calculateCalibratedStyle({ leftMm: 15, topMm: 52, profile, baseFontSizePt: 10 })}>
                <strong>เลขประจำตัวประชาชน:</strong> <span className="font-mono">{data.citizenId}</span>
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 140, topMm: 52, profile, baseFontSizePt: 10 })}>
                <strong>เกิดวันที่:</strong> {data.birthDateTh}
              </div>

              <div style={calculateCalibratedStyle({ leftMm: 15, topMm: 58, profile, baseFontSizePt: 10 })}>
                <strong>ชื่อบิดา:</strong> {data.fatherName}
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 80, topMm: 58, profile, baseFontSizePt: 10 })}>
                <strong>ชื่อมารดา:</strong> {data.motherName}
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 140, topMm: 58, profile, baseFontSizePt: 10 })}>
                <strong>สัญชาติ:</strong> {data.nationality}
              </div>

              {/* Subject Table Header */}
              {!isOverlay && (
                <div className="absolute left-[15mm] top-[66mm] right-[15mm]">
                  <table className="w-full border-collapse border border-slate-900 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-center font-bold">
                        <th className="border border-slate-900 p-1.5 w-16">รหัสวิชา</th>
                        <th className="border border-slate-900 p-1.5 text-left">รายวิชา (กลุ่มสาระการเรียนรู้)</th>
                        <th className="border border-slate-900 p-1.5 w-14">ชั่วโมง</th>
                        <th className="border border-slate-900 p-1.5 w-14">นก.</th>
                        <th className="border border-slate-900 p-1.5 w-16">ผลการเรียน</th>
                      </tr>
                    </thead>
                  </table>
                </div>
              )}

              {/* Basic Subjects Rows */}
              <div className="absolute left-[15mm] top-[76mm] right-[15mm]">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {!isOverlay && (
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={5} className="border border-slate-900 p-1">รายวิชาพื้นฐาน</td>
                      </tr>
                    )}
                    {data.basicSubjects.map((sub, idx) => (
                      <tr key={idx} className={!isOverlay ? 'border-b border-slate-300' : ''}>
                        <td className={`w-16 font-mono ${!isOverlay ? 'border border-slate-900 p-1 text-center' : 'p-1'}`}>{sub.courseCode}</td>
                        <td className={!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}>{sub.courseName}</td>
                        <td className={`w-14 text-center ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>{sub.hours}</td>
                        <td className={`w-14 text-center ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>{sub.credits.toFixed(1)}</td>
                        <td className={`w-16 text-center font-bold ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>{sub.grade}</td>
                      </tr>
                    ))}

                    {!isOverlay && (
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={5} className="border border-slate-900 p-1">รายวิชาเพิ่มเติม</td>
                      </tr>
                    )}
                    {data.additionalSubjects.map((sub, idx) => (
                      <tr key={`add_${idx}`} className={!isOverlay ? 'border-b border-slate-300' : ''}>
                        <td className={`w-16 font-mono ${!isOverlay ? 'border border-slate-900 p-1 text-center' : 'p-1'}`}>{sub.courseCode}</td>
                        <td className={!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}>{sub.courseName}</td>
                        <td className={`w-14 text-center ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>{sub.hours}</td>
                        <td className={`w-14 text-center ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>{sub.credits.toFixed(1)}</td>
                        <td className={`w-16 text-center font-bold ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>{sub.grade}</td>
                      </tr>
                    ))}

                    {!isOverlay && (
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={5} className="border border-slate-900 p-1">กิจกรรมพัฒนาผู้เรียน</td>
                      </tr>
                    )}
                    {data.activities.map((sub, idx) => (
                      <tr key={`act_${idx}`} className={!isOverlay ? 'border-b border-slate-300' : ''}>
                        <td className={`w-16 font-mono ${!isOverlay ? 'border border-slate-900 p-1 text-center' : 'p-1'}`}>{sub.courseCode}</td>
                        <td className={!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}>{sub.courseName}</td>
                        <td className={`w-14 text-center ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>{sub.hours}</td>
                        <td className={`w-14 text-center ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>-</td>
                        <td className={`w-16 text-center font-bold text-emerald-700 ${!isOverlay ? 'border border-slate-900 p-1' : 'p-1'}`}>{sub.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cumulative Hours & GPAX (Bottom of Page 1) */}
              <div style={calculateCalibratedStyle({ leftMm: 15, topMm: 270, profile, baseFontSizePt: 10 })}>
                รวมเวลาเรียนทั้งหมด: <strong>{data.totalHours}</strong> ชั่วโมง | จำนวนหน่วยกิตสะสม: <strong>{data.totalCredits.toFixed(1)}</strong> หน่วยกิต
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 140, topMm: 270, profile, baseFontSizePt: 11 })}>
                ผลการเรียนเฉลี่ยสะสม (GPAX): <strong className="text-base">{data.gpax.toFixed(2)}</strong>
              </div>
            </div>
          )}

          {/* ================= PAGE 2 (BACK) ================= */}
          {activePage === 2 && (
            <div className="relative w-full h-[297mm]">
              {!isOverlay && (
                <>
                  <div className="absolute inset-[10mm] border-2 border-slate-900 pointer-events-none p-1">
                    <div className="w-full h-full border border-slate-900"></div>
                  </div>

                  <div className="absolute left-[15mm] top-[18mm] right-[15mm] text-center border-b pb-2">
                    <h3 className="text-base font-bold">สรุปผลการประเมินและการตัดสินการจบหลักสูตร</h3>
                    <p className="text-xs text-slate-600">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑ (ฉบับปรับปรุง ๒๕๖๐)</p>
                  </div>
                </>
              )}

              {/* Assessment Section */}
              <div style={calculateCalibratedStyle({ leftMm: 18, topMm: 35, profile, baseFontSizePt: 11 })}>
                <strong>๑. ผลการประเมินคุณลักษณะอันพึงประสงค์ ๘ ประการ:</strong>
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 145, topMm: 35, profile, baseFontSizePt: 11 })}>
                <strong className="text-emerald-800">{data.desirableCharacteristics}</strong>
              </div>

              <div style={calculateCalibratedStyle({ leftMm: 18, topMm: 45, profile, baseFontSizePt: 11 })}>
                <strong>๒. ผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน:</strong>
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 145, topMm: 45, profile, baseFontSizePt: 11 })}>
                <strong className="text-emerald-800">{data.readingAnalyticalWriting}</strong>
              </div>

              <div style={calculateCalibratedStyle({ leftMm: 18, topMm: 55, profile, baseFontSizePt: 11 })}>
                <strong>๓. ผลการประเมินกิจกรรมพัฒนาผู้เรียน:</strong>
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 145, topMm: 55, profile, baseFontSizePt: 11 })}>
                <strong className="text-emerald-800">{data.activityResult}</strong>
              </div>

              {/* Graduation Criteria Decision */}
              <div style={calculateCalibratedStyle({ leftMm: 18, topMm: 72, profile, baseFontSizePt: 12 })}>
                <strong>การตัดสินผลการเรียน:</strong>
              </div>
              <div style={calculateCalibratedStyle({ leftMm: 65, topMm: 72, profile, baseFontSizePt: 12 })}>
                <strong className="text-[#7B1C3E]">{data.graduationStatus}</strong> ชั้นประถมศึกษาปีที่ ๖
              </div>

              <div style={calculateCalibratedStyle({ leftMm: 18, topMm: 82, profile, baseFontSizePt: 10 })}>
                อนุมัติผลการเรียน ณ วันที่: <strong>{data.graduationDateTh}</strong>
              </div>

              {/* Graduation Criteria Notes */}
              {!isOverlay && (
                <div className="absolute left-[18mm] top-[98mm] right-[18mm] p-4 bg-slate-50 border border-slate-300 rounded-lg text-xs space-y-2">
                  <h4 className="font-bold">เกณฑ์การตัดสินการจบระดับประถมศึกษา (สพฐ.):</h4>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                    <li>ผู้เรียนเรียนรายวิชาพื้นฐานและรายวิชาเพิ่มเติมครบถ้วนตามโครงสร้างเวลาเรียนที่กำหนด</li>
                    <li>ผู้เรียนต้องมีผลการประเมินรายวิชาพื้นฐานผ่านเกณฑ์ทุกรายวิชา</li>
                    <li>ผู้เรียนต้องได้รับการตัดสินผลการประเมินกิจกรรมพัฒนาผู้เรียน "ผ่าน" ทุกกิจกรรม</li>
                    <li>ผู้เรียนได้รับการประเมินการอ่าน คิดวิเคราะห์ และเขียน ในระดับ "ผ่าน" ขึ้นไป</li>
                    <li>ผู้เรียนได้รับการประเมินคุณลักษณะอันพึงประสงค์ ในระดับ "ผ่าน" ขึ้นไป</li>
                  </ol>
                </div>
              )}

              {/* Official Signatures Section */}
              <div style={calculateCalibratedStyle({ leftMm: 30, topMm: 215, profile, baseFontSizePt: 10, textAlign: 'center' })}>
                <div>ลงชื่อ..........................................................</div>
                <div className="mt-1 font-bold">({data.registrarName})</div>
                <div className="text-xs text-slate-500">นายทะเบียน</div>
                <div className="mt-1 text-xs">วันที่ {data.graduationDateTh}</div>
              </div>

              <div style={calculateCalibratedStyle({ leftMm: 125, topMm: 215, profile, baseFontSizePt: 10, textAlign: 'center' })}>
                <div>ลงชื่อ..........................................................</div>
                <div className="mt-1 font-bold">({data.directorName})</div>
                <div className="text-xs text-slate-500">ผู้อำนวยการโรงเรียน{data.schoolName}</div>
                <div className="mt-1 text-xs">วันที่ {data.graduationDateTh}</div>
              </div>

              {!isOverlay && (
                <div className="absolute left-[105mm] top-[245mm] -translate-x-1/2 text-center text-[10px] text-slate-400">
                  (ประทับตราสถานศึกษาประจำเล่ม)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
