'use client';

import React from 'react';
import { FeeItem, Student } from '@/types';
import { DEFAULT_SCHOOL_IDENTITY } from '@/lib/documents/types';
import { formatThaiBahtText } from '@/lib/subsidy/free15y';

export interface ReceiptA4OfficialProps {
  student: Student;
  receiptNumber: string;
  bookNumber?: string;
  items: FeeItem[];
  totalAmount: number;
  paymentMethod: string;
  date: Date | string;
  academicYear?: string;
  term?: string;
  cashierName?: string;
}

export function ReceiptA4Official({
  student,
  receiptNumber,
  bookNumber = '01',
  items,
  totalAmount,
  paymentMethod,
  date,
  academicYear = '2568',
  term = '1',
  cashierName = 'เจ้าหน้าที่การเงิน'
}: ReceiptA4OfficialProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formattedDate = new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);

  const paymentMethodThai: Record<string, string> = {
    cash: 'เงินสด',
    qr: 'สแกน QR Code (พร้อมเพย์)',
    transfer: 'โอนเงินผ่านบัญชีธนาคาร',
    wallet: 'หักจากกระเป๋าเงินนักเรียน'
  };

  const bahtText = formatThaiBahtText(totalAmount);

  return (
    <div 
      className="bg-white text-slate-900 mx-auto p-10 font-serif leading-relaxed"
      style={{
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box',
        fontFamily: '"Sarabun", "TH Sarabun New", serif'
      }}
    >
      {/* Outer Border (Double Frame for Official Documents) */}
      <div className="border-2 border-slate-900 p-6 h-full flex flex-col justify-between" style={{ minHeight: '270mm' }}>
        <div>
          {/* Header Band: School Crest & School Information */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
            <div className="flex items-center gap-4">
              <img 
                src="/logo2.png" 
                alt="ตราโรงเรียนสมคิดวิทยา" 
                className="w-20 h-20 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {DEFAULT_SCHOOL_IDENTITY.nameTh}
                </h1>
                <p className="text-xs text-slate-600 font-sans">
                  {DEFAULT_SCHOOL_IDENTITY.nameEn}
                </p>
                <p className="text-[12px] text-slate-700 mt-1">
                  ใบอนุญาตจัดตั้งเลขที่: <span className="font-semibold">{DEFAULT_SCHOOL_IDENTITY.licenseNumber}</span> • เลขประจำตัวผู้เสียภาษี: <span className="font-mono font-semibold">{DEFAULT_SCHOOL_IDENTITY.taxId}</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  {DEFAULT_SCHOOL_IDENTITY.addressTh} • โทรศัพท์: {DEFAULT_SCHOOL_IDENTITY.phone}
                </p>
              </div>
            </div>

            {/* Document Title & Numbering */}
            <div className="text-right shrink-0">
              <div className="inline-block border-2 border-slate-900 px-4 py-1 text-center bg-slate-50 mb-2">
                <span className="text-base font-extrabold tracking-wide">ใบเสร็จรับเงิน</span>
                <span className="block text-[10px] text-slate-500 font-sans">OFFICIAL RECEIPT</span>
              </div>
              <div className="text-xs space-y-0.5">
                <div><strong>เล่มที่ (Book No.):</strong> <span className="font-mono">{bookNumber}</span></div>
                <div><strong>เลขที่ (Receipt No.):</strong> <span className="font-mono font-bold text-sm text-[#7B1C3E]">{receiptNumber}</span></div>
                <div><strong>วันที่ (Date):</strong> <span>{formattedDate}</span></div>
              </div>
            </div>
          </div>

          {/* Student & Payer Information Box */}
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4 text-xs">
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div>
                <span className="text-slate-500">ได้รับเงินจาก (Received from):</span>{' '}
                <strong className="text-slate-900 text-sm">{student.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">รหัสประจำตัวนักเรียน (Student ID):</span>{' '}
                <strong className="font-mono text-slate-900">{student.id}</strong>
              </div>
              <div>
                <span className="text-slate-500">เลขประจำตัวประชาชน (Citizen ID):</span>{' '}
                <strong className="font-mono text-slate-900">{student.citizen_id || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">ระดับชั้น / ห้องเรียน (Grade / Room):</span>{' '}
                <strong className="text-slate-900">{student.grade || '-'}</strong>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">ภาคเรียน / ปีการศึกษา (Term / Academic Year):</span>{' '}
                <strong className="text-slate-900">ภาคเรียนที่ {term} ปีการศึกษา {academicYear}</strong>
              </div>
            </div>
          </div>

          {/* Table of Fee Items */}
          <table className="w-full border-collapse border border-slate-900 text-xs mb-4">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900 text-center font-bold">
                <th className="border-r border-slate-900 p-2 w-12">ลำดับ</th>
                <th className="border-r border-slate-900 p-2 text-left">รายการค่าธรรมเนียมการศึกษาและค่าบริการ (Description)</th>
                <th className="border-r border-slate-900 p-2 w-20">จำนวน</th>
                <th className="border-r border-slate-900 p-2 w-28 text-right">ราคาต่อหน่วย</th>
                <th className="p-2 w-32 text-right">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-slate-200">
                  <td className="border-r border-slate-900 p-2 text-center">{idx + 1}</td>
                  <td className="border-r border-slate-900 p-2">
                    <span className="font-semibold text-slate-900">
                      {item.fee_type?.name || 'ค่าธรรมเนียมการศึกษา'}
                    </span>
                  </td>
                  <td className="border-r border-slate-900 p-2 text-center">1</td>
                  <td className="border-r border-slate-900 p-2 text-right font-mono">
                    {Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-right font-mono font-semibold">
                    {Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {/* Empty rows filler to make a standard official receipt height */}
              {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, fIdx) => (
                <tr key={`filler-${fIdx}`} className="border-b border-slate-200 h-7">
                  <td className="border-r border-slate-900"></td>
                  <td className="border-r border-slate-900"></td>
                  <td className="border-r border-slate-900"></td>
                  <td className="border-r border-slate-900"></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Grand Total Row */}
              <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                <td colSpan={2} className="border-r border-slate-900 p-2.5 text-center">
                  <span className="text-slate-600 font-normal">จำนวนเงินรวมทั้งสิ้น (ตัวอักษร):</span>{' '}
                  <span className="text-slate-900 font-bold text-sm">({bahtText})</span>
                </td>
                <td colSpan={2} className="border-r border-slate-900 p-2.5 text-right font-bold">
                  รวมเงินทั้งสิ้น (Grand Total):
                </td>
                <td className="p-2.5 text-right font-mono font-black text-sm text-[#7B1C3E]">
                  {Number(totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Payment Method Details */}
          <div className="text-xs text-slate-700 flex items-center justify-between mb-6 px-1">
            <div>
              <span>วิธีการชำระเงิน: </span>
              <strong className="text-slate-900">
                {paymentMethodThai[paymentMethod] || paymentMethod}
              </strong>
            </div>
            <div className="text-slate-500 italic text-[11px]">
              * เอกสารนี้ใช้เป็นหลักฐานการเบิกเงินสวัสดิการการศึกษาบุตรตามระเบียบกระทรวงการคลังได้
            </div>
          </div>
        </div>

        {/* Bottom Section: Signatures & Official Stamp */}
        <div className="border-t border-dashed border-slate-300 pt-6">
          <div className="grid grid-cols-2 gap-8 text-center text-xs">
            {/* Cashier Signature */}
            <div className="space-y-1">
              <div className="h-14 border-b border-dotted border-slate-400 w-48 mx-auto flex items-end justify-center pb-1 text-slate-400">
                (ลงชื่อผ่านระบบอิเล็กทรอนิกส์)
              </div>
              <p className="font-bold text-slate-900 pt-1">({cashierName})</p>
              <p className="text-slate-500">เจ้าหน้าที่การเงิน / ผู้รับเงิน</p>
            </div>

            {/* Principal Signature & Seal */}
            <div className="space-y-1">
              <div className="h-14 border-b border-dotted border-slate-400 w-48 mx-auto flex items-end justify-center pb-1 text-slate-400">
                (ลงชื่อผ่านระบบอิเล็กทรอนิกส์)
              </div>
              <p className="font-bold text-slate-900 pt-1">({DEFAULT_SCHOOL_IDENTITY.directorName})</p>
              <p className="text-slate-500">{DEFAULT_SCHOOL_IDENTITY.directorPosition}</p>
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] text-slate-400 border-t pt-2 flex justify-between items-center">
            <span>เอกสารออกโดยระบบบริหารสถานศึกษา SVPortal โรงเรียนสมคิดวิทยา</span>
            <span className="font-mono">พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * แปลง Component เป็น HTML String ที่พร้อมสำหรับส่งเข้า iFrame Print Sandbox
 */
export function renderReceiptA4OfficialHtml(props: ReceiptA4OfficialProps): string {
  const dateObj = typeof props.date === 'string' ? new Date(props.date) : props.date;
  const formattedDate = new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);

  const bahtText = formatThaiBahtText(props.totalAmount);
  const paymentMethodThai: Record<string, string> = {
    cash: 'เงินสด',
    qr: 'สแกน QR Code (พร้อมเพย์)',
    transfer: 'โอนเงินผ่านบัญชีธนาคาร',
    wallet: 'หักจากกระเป๋าเงินนักเรียน'
  };

  const itemRowsHtml = props.items.map((item, idx) => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="border-right:1px solid #0f172a;padding:8px;text-align:center;">${idx + 1}</td>
      <td style="border-right:1px solid #0f172a;padding:8px;font-weight:600;">${item.fee_type?.name || 'ค่าธรรมเนียมการศึกษา'}</td>
      <td style="border-right:1px solid #0f172a;padding:8px;text-align:center;">1</td>
      <td style="border-right:1px solid #0f172a;padding:8px;text-align:right;font-family:monospace;">${Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td style="padding:8px;text-align:right;font-family:monospace;font-weight:bold;">${Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  return `
    <div style="width:210mm;min-height:297mm;box-sizing:border-box;padding:32px;background:#fff;color:#0f172a;font-family:'Sarabun','TH Sarabun New',sans-serif;">
      <div style="border:2px solid #0f172a;padding:24px;min-height:265mm;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
        <div>
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <img src="/logo2.png" alt="ตราโรงเรียน" style="width:72px;height:72px;object-fit:contain;" />
              <div>
                <h1 style="font-size:18px;font-weight:bold;margin:0 0 2px 0;color:#0f172a;">${DEFAULT_SCHOOL_IDENTITY.nameTh}</h1>
                <p style="font-size:11px;color:#64748b;margin:0 0 4px 0;">${DEFAULT_SCHOOL_IDENTITY.nameEn}</p>
                <p style="font-size:11px;color:#334155;margin:0;">ใบอนุญาตจัดตั้งเลขที่: <b>${DEFAULT_SCHOOL_IDENTITY.licenseNumber}</b> • เลขประจำตัวผู้เสียภาษี: <b>${DEFAULT_SCHOOL_IDENTITY.taxId}</b></p>
                <p style="font-size:11px;color:#64748b;margin:2px 0 0 0;">${DEFAULT_SCHOOL_IDENTITY.addressTh} • โทรศัพท์: ${DEFAULT_SCHOOL_IDENTITY.phone}</p>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="border:2px solid #0f172a;padding:4px 16px;display:inline-block;background:#f8fafc;margin-bottom:8px;">
                <span style="font-size:16px;font-weight:800;display:block;">ใบเสร็จรับเงิน</span>
                <span style="font-size:9px;color:#64748b;">OFFICIAL RECEIPT</span>
              </div>
              <div style="font-size:12px;line-height:1.6;">
                <div>เล่มที่: <span style="font-family:monospace;">${props.bookNumber || '01'}</span></div>
                <div>เลขที่: <span style="font-family:monospace;font-weight:bold;color:#7B1C3E;font-size:14px;">${props.receiptNumber}</span></div>
                <div>วันที่: <span>${formattedDate}</span></div>
              </div>
            </div>
          </div>

          <!-- Student Profile -->
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:12px;margin-bottom:16px;font-size:12px;">
            <table style="width:100%;border:none;">
              <tr>
                <td style="width:50%;padding:4px 0;border:none;">ได้รับเงินจาก: <strong style="font-size:13px;">${props.student.name}</strong></td>
                <td style="width:50%;padding:4px 0;border:none;">รหัสนักเรียน: <strong style="font-family:monospace;">${props.student.id}</strong></td>
              </tr>
              <tr>
                <td style="padding:4px 0;border:none;">เลขประจำตัวประชาชน: <strong style="font-family:monospace;">${props.student.citizen_id || '-'}</strong></td>
                <td style="padding:4px 0;border:none;">ระดับชั้น/ห้อง: <strong>${props.student.grade || '-'}</strong></td>
              </tr>
              <tr>
                <td colspan="2" style="padding:4px 0;border:none;">ภาคเรียน / ปีการศึกษา: <strong>ภาคเรียนที่ ${props.term || '1'} ปีการศึกษา ${props.academicYear || '2568'}</strong></td>
              </tr>
            </table>
          </div>

          <!-- Table -->
          <table style="width:100%;border-collapse:collapse;border:1px solid #0f172a;font-size:12px;margin-bottom:16px;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:1px solid #0f172a;text-align:center;font-weight:bold;">
                <th style="border-right:1px solid #0f172a;padding:8px;width:40px;">ลำดับ</th>
                <th style="border-right:1px solid #0f172a;padding:8px;text-align:left;">รายการค่าธรรมเนียมการศึกษาและค่าบริการ</th>
                <th style="border-right:1px solid #0f172a;padding:8px;width:60px;">จำนวน</th>
                <th style="border-right:1px solid #0f172a;padding:8px;width:100px;text-align:right;">ราคาต่อหน่วย</th>
                <th style="padding:8px;width:120px;text-align:right;">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid #0f172a;background:#f8fafc;font-weight:bold;">
                <td colspan="2" style="border-right:1px solid #0f172a;padding:10px;text-align:center;">
                  <span style="color:#64748b;font-weight:normal;">จำนวนเงินรวมทั้งสิ้น (ตัวอักษร):</span> <strong>(${bahtText})</strong>
                </td>
                <td colspan="2" style="border-right:1px solid #0f172a;padding:10px;text-align:right;">รวมเงินทั้งสิ้น:</td>
                <td style="padding:10px;text-align:right;font-family:monospace;font-size:14px;color:#7B1C3E;font-weight:800;">
                  ${Number(props.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style="font-size:12px;display:flex;justify-content:space-between;margin-bottom:24px;">
            <div>วิธีการชำระเงิน: <strong>${paymentMethodThai[props.paymentMethod] || props.paymentMethod}</strong></div>
            <div style="color:#64748b;font-style:italic;font-size:11px;">* เอกสารนี้ใช้เป็นหลักฐานการเบิกเงินสวัสดิการการศึกษาบุตรตามระเบียบกระทรวงการคลังได้</div>
          </div>
        </div>

        <!-- Footer Signatures -->
        <div style="border-top:1px dashed #cbd5e1;padding-top:24px;">
          <table style="width:100%;border:none;text-align:center;font-size:12px;">
            <tr>
              <td style="width:50%;border:none;padding:8px;">
                <div style="height:48px;border-bottom:1px dotted #94a3b8;width:180px;margin:0 auto 6px auto;display:flex;align-items:flex-end;justify-content:center;color:#94a3b8;font-size:11px;">(ลงชื่อผ่านระบบอิเล็กทรอนิกส์)</div>
                <div style="font-weight:bold;">(${props.cashierName || 'เจ้าหน้าที่การเงิน'})</div>
                <div style="color:#64748b;font-size:11px;">เจ้าหน้าที่การเงิน / ผู้รับเงิน</div>
              </td>
              <td style="width:50%;border:none;padding:8px;">
                <div style="height:48px;border-bottom:1px dotted #94a3b8;width:180px;margin:0 auto 6px auto;display:flex;align-items:flex-end;justify-content:center;color:#94a3b8;font-size:11px;">(ลงชื่อผ่านระบบอิเล็กทรอนิกส์)</div>
                <div style="font-weight:bold;">(${DEFAULT_SCHOOL_IDENTITY.directorName})</div>
                <div style="color:#64748b;font-size:11px;">${DEFAULT_SCHOOL_IDENTITY.directorPosition}</div>
              </td>
            </tr>
          </table>

          <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;">
            <span>เอกสารออกโดยระบบบริหารสถานศึกษา SVPortal โรงเรียนสมคิดวิทยา</span>
            <span>พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
