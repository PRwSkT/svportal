'use client';

import React, { useRef } from 'react';
import { Printer, X, MapPin, ExternalLink, ShieldCheck, Heart, User, Calendar, FileDown } from 'lucide-react';
import { HomeVisitRecord, getGoogleMapsUrl } from '@/lib/pastoral/home-visit';
import { printDocumentViaSandbox, openDocumentPreviewInTab } from '@/lib/documents/print-service';

interface HomeVisitPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: HomeVisitRecord | null;
  student: {
    id: string;
    student_id?: string;
    name: string;
    grade?: string;
    classroom?: string;
  } | null;
  schoolName?: string;
}

export default function HomeVisitPrintModal({
  isOpen,
  onClose,
  visit,
  student,
  schoolName = 'โรงเรียนสมคิดวิทยา'
}: HomeVisitPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  if (!isOpen || !visit || !student) return null;

  const mapsUrl = getGoogleMapsUrl(visit.gpsLat, visit.gpsLng);

  const handlePrint = async () => {
    if (!printRef.current) return;
    await printDocumentViaSandbox({
      title: `แบบบันทึกเยี่ยมบ้าน_${student.name}`,
      paperSize: 'A4_PORTRAIT',
      contentHtml: printRef.current.innerHTML
    });
  };

  const handlePreviewPdf = () => {
    if (!printRef.current) return;
    openDocumentPreviewInTab({
      title: `แบบบันทึกเยี่ยมบ้าน_${student.name}`,
      paperSize: 'A4_PORTRAIT',
      contentHtml: printRef.current.innerHTML
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:max-w-none print:max-h-none print:overflow-visible">
        
        {/* Action Bar (hidden when printing) */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <Printer className="w-5 h-5" />
            </span>
            <h3 className="font-extrabold text-slate-800 dark:text-white text-base sm:text-lg">
              แบบบันทึกการเยี่ยมบ้านนักเรียน (พิมพ์รายงานทางการ)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreviewPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl shadow-xs transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> บันทึก PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" /> สั่งพิมพ์ (Print)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (A4 Style) */}
        <div ref={printRef} className="p-8 sm:p-12 text-slate-900 bg-white font-sans text-sm leading-relaxed print:p-6 print:m-0">
          
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
              {schoolName}
            </h1>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 mt-1">
              แบบบันทึกการเยี่ยมบ้านนักเรียน ตามระบบการดูแลช่วยเหลือนักเรียน
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ภาคเรียนที่ {visit.term} ปีการศึกษา {visit.academicYear}
            </p>
          </div>

          {/* Student Info Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs sm:text-sm">
            <div>
              <span className="text-slate-500 block text-xs">ชื่อ - นามสกุล นักเรียน:</span>
              <strong className="text-slate-900 font-semibold">{student.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">รหัสนักเรียน:</span>
              <strong className="text-slate-900 font-semibold">{student.student_id || student.id}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">ระดับชั้นเรียน:</span>
              <strong className="text-slate-900 font-semibold">{student.grade || '-'} {student.classroom ? `ห้อง ${student.classroom}` : ''}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">วันที่ตรวจเยี่ยม:</span>
              <strong className="text-slate-900 font-semibold">{visit.visitDate || '-'}</strong>
            </div>
          </div>

          {/* Visit Details Section */}
          <div className="space-y-4 mb-6 text-xs sm:text-sm">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">ครูผู้ตรวจเยี่ยม:</span>
                <p className="text-slate-900">{visit.visitorTeacherName || 'ครูประจำชั้น'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">ผู้ปกครองที่ได้พบในการเยี่ยมบ้าน:</span>
                <p className="text-slate-900">{visit.guardianMet || '-'}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">สถานที่ / ที่อยู่ตามที่ตรวจเยี่ยม:</span>
              <p className="text-slate-900">{visit.addressVisited || 'ตามที่อยู่ในทะเบียนนักเรียน'}</p>
              {visit.gpsLat && visit.gpsLng && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>พิกัด GPS: {visit.gpsLat.toFixed(6)}, {visit.gpsLng.toFixed(6)}</span>
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-1 print:hidden">
                      เปิดดูใน Google Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">สภาพแวดล้อมที่พักอาศัย:</span>
                <p className="text-slate-900">{visit.livingEnvironment || '-'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">ความสัมพันธ์ในครอบครัว:</span>
                <p className="text-slate-900">{visit.familyRelationship || '-'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">สถานภาพทางเศรษฐกิจ:</span>
                <p className="text-slate-900">{visit.economicStatus || '-'}</p>
              </div>
            </div>

            {/* Risk Issues */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">ประเด็นความเสี่ยง / ข้อควรระวังที่ตรวจพบ:</span>
              {visit.riskIssues && visit.riskIssues.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-slate-800">
                  {visit.riskIssues.map((issue, idx) => (
                    <li key={idx} className="font-medium text-rose-700">{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-emerald-700 font-medium">ไม่พบประเด็นความเสี่ยงที่มีนัยสำคัญ ครอบครัวมีความพร้อมในการดูแล</p>
              )}
            </div>

            {/* AI Summary / Teacher Official Synthesis */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-300">
              <span className="font-bold text-slate-900 block mb-2 text-sm">
                สรุปผลการเยี่ยมบ้านและการให้คำปรึกษาแนะแนว:
              </span>
              <p className="whitespace-pre-line text-slate-800 leading-relaxed">
                {visit.aiSummary || visit.audioTranscript || 'ไม่มีบันทึกสรุปเพิ่มเติม'}
              </p>
            </div>

            {/* Photos if any */}
            {visit.photos && visit.photos.length > 0 && (
              <div className="pt-2">
                <span className="font-bold text-slate-700 block mb-2 text-xs">ภาพถ่ายบรรยากาศการเยี่ยมบ้าน:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {visit.photos.map((p, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden p-1 bg-white">
                      <img src={p.url} alt={`Visit photo ${idx + 1}`} className="w-full h-32 object-cover rounded" />
                      {p.caption && <p className="text-[11px] text-slate-600 mt-1 text-center">{p.caption}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Signatures Block */}
          <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <div className="h-14 border-b border-dashed border-slate-400 mx-auto w-40 flex items-end justify-center pb-1">
                {visit.guardianSignatureUrl ? (
                  <img src={visit.guardianSignatureUrl} alt="Signature" className="max-h-12" />
                ) : null}
              </div>
              <p className="mt-2 font-bold text-slate-800">({visit.guardianMet || 'ผู้ปกครองนักเรียน'})</p>
              <p className="text-slate-500">ผู้ให้ข้อมูล / ผู้ปกครอง</p>
            </div>

            <div>
              <div className="h-14 border-b border-dashed border-slate-400 mx-auto w-40 flex items-end justify-center pb-1"></div>
              <p className="mt-2 font-bold text-slate-800">({visit.visitorTeacherName || '...........................................'})</p>
              <p className="text-slate-500">ครูผู้เยี่ยมบ้าน</p>
            </div>

            <div>
              <div className="h-14 border-b border-dashed border-slate-400 mx-auto w-40 flex items-end justify-center pb-1"></div>
              <p className="mt-2 font-bold text-slate-800">(...........................................)</p>
              <p className="text-slate-500">หัวหน้าฝ่ายกิจการนักเรียน / ผู้อำนวยการ</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
