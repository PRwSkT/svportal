'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';
import { formatThaiBahtText } from '@/lib/subsidy/free15y';

interface FormOr11PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  disbursement: {
    studentName: string;
    studentId?: string;
    grade: string;
    classroom?: string;
    academicYear: string;
    term: string;
    uniformAmount: number;
    stationeryAmount: number;
    totalAmount: number;
    recipientName: string;
    recipientRelation: string;
    recipientCitizenId?: string;
    signatureData: string;
    disbursedAt?: string;
    disbursedBy?: string;
  } | null;
  schoolName?: string;
}

export default function FormOr11PrintModal({
  isOpen,
  onClose,
  disbursement,
  schoolName = 'โรงเรียนสมคิดวิทยา'
}: FormOr11PrintModalProps) {
  if (!isOpen || !disbursement) return null;

  const bahtText = formatThaiBahtText(disbursement.totalAmount);
  const printDate = disbursement.disbursedAt 
    ? new Date(disbursement.disbursedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:max-w-none print:max-h-none print:overflow-visible">
        
        {/* Modal Top Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <Printer className="w-5 h-5" />
            </span>
            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
              แบบ อร.1/1 (หลักฐานการจ่ายเงินสดเรียนฟรี 15 ปี)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
            >
              <Printer className="w-4 h-4" /> สั่งพิมพ์ / บันทึกเป็น PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Form อร.1/1 */}
        <div className="p-8 sm:p-12 text-slate-900 bg-white font-sans text-sm leading-relaxed print:p-6 print:m-0">
          
          <div className="text-right text-xs font-bold text-slate-500 mb-2">
            แบบ อร.1/1
          </div>

          <div className="text-center border-b border-slate-800 pb-4 mb-6">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
              ใบสำคัญรับเงิน / หลักฐานการจ่ายเงินสด
            </h1>
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 mt-1">
              โครงการสนับสนุนค่าใช้จ่ายในการจัดการศึกษาตั้งแต่ระดับอนุบาลจนจบการศึกษาขั้นพื้นฐาน (เรียนฟรี 15 ปี)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              {schoolName} • ภาคเรียนที่ {disbursement.term} ปีการศึกษา {disbursement.academicYear}
            </p>
          </div>

          <div className="text-right text-xs mb-4">
            วันที่จ่ายเงิน: <strong>{printDate}</strong>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 space-y-2 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">ข้าพเจ้า: </span>
                <strong className="text-slate-900 font-semibold">{disbursement.recipientName}</strong>
              </div>
              <div>
                <span className="text-slate-500">เลขประจำตัวประชาชน: </span>
                <strong className="text-slate-900 font-mono">{disbursement.recipientCitizenId || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">เกี่ยวข้องเป็น: </span>
                <strong className="text-slate-900 font-semibold">{disbursement.recipientRelation}</strong>
              </div>
              <div>
                <span className="text-slate-500">ของนักเรียนชื่อ: </span>
                <strong className="text-slate-900 font-semibold">{disbursement.studentName}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500">ระดับชั้นเรียน: </span>
                <strong className="text-slate-900 font-semibold">
                  {disbursement.grade} {disbursement.classroom ? `ห้อง ${disbursement.classroom}` : ''}
                </strong>
                <span className="text-slate-500 ml-3">รหัสนักเรียน: </span>
                <strong className="text-slate-900 font-mono">{disbursement.studentId || '-'}</strong>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-800 mb-4">
            ได้รับเงินอุดหนุนจากทางราชการ ผ่านทาง {schoolName} ดังรายการต่อไปนี้:
          </p>

          {/* Table */}
          <table className="w-full text-xs sm:text-sm border-collapse border border-slate-300 mb-6">
            <thead>
              <tr className="bg-slate-100 text-slate-800">
                <th className="border border-slate-300 p-2 text-center w-16">ลำดับ</th>
                <th className="border border-slate-300 p-2 text-left">รายการเงินอุดหนุน</th>
                <th className="border border-slate-300 p-2 text-right w-36">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 p-2 text-center">1</td>
                <td className="border border-slate-300 p-2">ค่าเครื่องแบบนักเรียน (จัดซื้อปีละ 1 ครั้ง ภาคเรียนที่ 1)</td>
                <td className="border border-slate-300 p-2 text-right font-mono">{disbursement.uniformAmount.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 text-center">2</td>
                <td className="border border-slate-300 p-2">ค่าอุปกรณ์การเรียน (จัดซื้อภาคเรียนที่ {disbursement.term})</td>
                <td className="border border-slate-300 p-2 text-right font-mono">{disbursement.stationeryAmount.toLocaleString()}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="border border-slate-300 p-2 text-center" colSpan={2}>
                  รวมเป็นเงินทั้งสิ้น ({bahtText})
                </td>
                <td className="border border-slate-300 p-2 text-right font-mono text-sm">
                  {disbursement.totalAmount.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="text-xs text-slate-600 leading-relaxed mb-8">
            ข้าพเจ้าได้รับเงินจำนวนดังกล่าวข้างต้นไว้ถูกต้องเรียบร้อยแล้ว และขอรับรองว่าจะนำเงินนี้ไปจัดซื้อเครื่องแบบนักเรียนและอุปกรณ์การเรียนให้แก่นักเรียนเพื่อประโยชน์ในการจัดการศึกษาตามวัตถุประสงค์ของทางราชการอย่างแท้จริง
          </p>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="h-16 border-b border-dashed border-slate-400 mx-auto w-48 flex items-end justify-center pb-1">
                {disbursement.signatureData ? (
                  <img src={disbursement.signatureData} alt="Signature" className="max-h-14" />
                ) : null}
              </div>
              <p className="mt-2 font-bold text-slate-800">ลงชื่อ ({disbursement.recipientName})</p>
              <p className="text-slate-500">ผู้ปกครอง / ผู้รับเงิน</p>
            </div>

            <div>
              <div className="h-16 border-b border-dashed border-slate-400 mx-auto w-48 flex items-end justify-center pb-1"></div>
              <p className="mt-2 font-bold text-slate-800">ลงชื่อ ({disbursement.disbursedBy || 'เจ้าหน้าที่การเงิน'})</p>
              <p className="text-slate-500">เจ้าหน้าที่การเงิน / ผู้จ่ายเงิน</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
