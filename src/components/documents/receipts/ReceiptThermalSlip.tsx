'use client';

import React from 'react';
import { FeeItem, Student } from '@/types';
import { DEFAULT_SCHOOL_IDENTITY } from '@/lib/documents/types';

export interface ReceiptThermalSlipProps {
  student: Student;
  receiptNumber: string;
  items: FeeItem[];
  totalAmount: number;
  paymentMethod: string;
  date: Date | string;
  rollWidth?: '80mm' | '58mm';
  cashierName?: string;
  notes?: string;
}

export function ReceiptThermalSlip({
  student,
  receiptNumber,
  items,
  totalAmount,
  paymentMethod,
  date,
  rollWidth = '80mm',
  cashierName = 'เจ้าหน้าที่การเงิน',
  notes
}: ReceiptThermalSlipProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formattedDate = new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);

  const paymentMethodThai: Record<string, string> = {
    cash: 'เงินสด',
    qr: 'สแกน QR Code',
    transfer: 'โอนเงิน',
    wallet: 'กระเป๋าเงินนักเรียน (e-Wallet)'
  };

  const is58 = rollWidth === '58mm';
  const widthPx = is58 ? '48mm' : '72mm';

  return (
    <div
      className="bg-white text-black p-3 mx-auto font-mono text-xs leading-tight"
      style={{
        width: widthPx,
        boxSizing: 'border-box',
        fontFamily: '"Sarabun", "Courier New", monospace'
      }}
    >
      {/* Header */}
      <div className="text-center pb-2 border-b border-dashed border-black">
        <img
          src="/logo2.png"
          alt="School Logo"
          className="h-10 w-auto mx-auto mb-1 grayscale object-contain"
        />
        <h2 className="font-bold text-sm tracking-tight">{DEFAULT_SCHOOL_IDENTITY.nameTh}</h2>
        <p className="text-[10px] text-slate-700">สลิปใบเสร็จรับเงินอย่างย่อ</p>
        <p className="text-[10px] text-slate-600">{formattedDate}</p>
        <p className="text-xs font-bold mt-1">เลขที่: {receiptNumber}</p>
      </div>

      {/* Student Profile */}
      <div className="py-2 border-b border-dashed border-black text-[11px] space-y-0.5">
        <div className="flex justify-between">
          <span className="text-slate-600">นักเรียน:</span>
          <span className="font-bold">{student.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">รหัส:</span>
          <span>{student.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">ชั้น:</span>
          <span>{student.grade || '-'}</span>
        </div>
      </div>

      {/* Items List */}
      <div className="py-2 border-b border-dashed border-black">
        <div className="font-bold mb-1 text-[11px] flex justify-between">
          <span>รายการ</span>
          <span>จำนวนเงิน</span>
        </div>
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="flex justify-between items-start text-[10px]">
              <span className="flex-1 pr-1 truncate">{item.fee_type?.name || 'ค่าธรรมเนียม'}</span>
              <span className="shrink-0 font-mono">
                {Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Total Amount & Payment Method */}
      <div className="py-2 border-b border-dashed border-black space-y-1">
        <div className="flex justify-between items-baseline font-bold text-sm">
          <span>รวมทั้งสิ้น:</span>
          <span className="font-black text-base">
            {Number(totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ฿
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-slate-600">ชำระโดย:</span>
          <span className="font-semibold">{paymentMethodThai[paymentMethod] || paymentMethod}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-slate-600">ผู้รับเงิน:</span>
          <span>{cashierName}</span>
        </div>
      </div>

      {/* Notes / Footer */}
      <div className="pt-2 text-center text-[9px] text-slate-600 space-y-0.5">
        {notes && <p className="italic">{notes}</p>}
        <p>ขอบคุณที่ใช้บริการโรงเรียนสมคิดวิทยา</p>
        <p className="font-sans text-[8px]">SVPortal Thermal Print Engine</p>
      </div>
    </div>
  );
}

/**
 * แปลง Thermal Slip เป็น HTML String สำหรับส่งเข้า iFrame Sandbox
 */
export function renderReceiptThermalHtml(props: ReceiptThermalSlipProps): string {
  const dateObj = typeof props.date === 'string' ? new Date(props.date) : props.date;
  const formattedDate = new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);

  const paymentMethodThai: Record<string, string> = {
    cash: 'เงินสด',
    qr: 'สแกน QR Code',
    transfer: 'โอนเงิน',
    wallet: 'กระเป๋าเงินนักเรียน (e-Wallet)'
  };

  const is58 = props.rollWidth === '58mm';
  const widthPx = is58 ? '48mm' : '72mm';

  const itemsHtml = props.items.map((item, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:11px;margin-bottom:2px;">
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:4px;">${item.fee_type?.name || 'ค่าธรรมเนียม'}</span>
      <span style="font-family:monospace;white-space:nowrap;">${Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
    </div>
  `).join('');

  return `
    <div style="width:${widthPx};margin:0 auto;padding:8px;font-family:'Sarabun','Courier New',monospace;color:#000;background:#fff;box-sizing:border-box;">
      <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
        <img src="/logo2.png" alt="Logo" style="height:36px;width:auto;margin:0 auto 4px auto;display:block;filter:grayscale(100%);" />
        <div style="font-weight:bold;font-size:13px;">${DEFAULT_SCHOOL_IDENTITY.nameTh}</div>
        <div style="font-size:10px;color:#475569;">สลิปใบเสร็จรับเงินอย่างย่อ</div>
        <div style="font-size:10px;color:#64748b;">${formattedDate}</div>
        <div style="font-size:12px;font-weight:bold;margin-top:4px;">เลขที่: ${props.receiptNumber}</div>
      </div>

      <div style="border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;font-size:11px;line-height:1.4;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#475569;">นักเรียน:</span>
          <span style="font-weight:bold;">${props.student.name}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#475569;">รหัส:</span>
          <span>${props.student.id}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#475569;">ชั้น:</span>
          <span>${props.student.grade || '-'}</span>
        </div>
      </div>

      <div style="border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:11px;margin-bottom:4px;">
          <span>รายการ</span>
          <span>จำนวนเงิน</span>
        </div>
        ${itemsHtml}
      </div>

      <div style="border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;line-height:1.5;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:bold;font-size:13px;">
          <span>รวมทั้งสิ้น:</span>
          <span style="font-size:15px;font-weight:800;">${Number(props.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;">
          <span style="color:#475569;">วิธีชำระ:</span>
          <span style="font-weight:bold;">${paymentMethodThai[props.paymentMethod] || props.paymentMethod}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;">
          <span style="color:#475569;">ผู้รับเงิน:</span>
          <span>${props.cashierName || 'เจ้าหน้าที่การเงิน'}</span>
        </div>
      </div>

      <div style="text-align:center;font-size:9px;color:#64748b;padding-top:4px;">
        <div>ขอบคุณที่ใช้บริการโรงเรียนสมคิดวิทยา</div>
        <div style="font-size:8px;margin-top:2px;">SVPortal Thermal Engine</div>
      </div>
    </div>
  `;
}
