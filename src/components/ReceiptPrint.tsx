'use client';

import { forwardRef } from 'react';
import { FeeItem, Student } from '@/types';

type ReceiptPrintProps = {
  student: Student;
  receiptNumber: string;
  items: FeeItem[];
  totalAmount: number;
  paymentMethod: string;
  date: Date;
};

export const ReceiptPrint = forwardRef<HTMLDivElement, ReceiptPrintProps>(
  ({ student, receiptNumber, items, totalAmount, paymentMethod, date }, ref) => {
    
    const formattedDate = new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    const paymentMethodThai = {
      cash: 'เงินสด',
      qr: 'สแกน QR Code',
      transfer: 'โอนเงิน',
    }[paymentMethod] || paymentMethod;

    return (
      <div 
        ref={ref} 
        className="hidden print:block w-full max-w-[80mm] mx-auto text-black bg-white p-4 font-mono text-sm leading-relaxed"
      >
        <div className="text-center mb-4">
          <img src="/logo.png" alt="School Logo" className="w-12 h-12 mx-auto mb-2 grayscale" />
          <h1 className="font-bold text-lg">โรงเรียนสมคิดวิทยา</h1>
          <p className="text-xs">{formattedDate}</p>
          <h2 className="font-bold text-base mt-2 flex items-center justify-center gap-1">
            ใบเสร็จรับเงิน
            <img src="/SV-Portal.png" alt="SVPortal" className="h-3 ml-2 grayscale opacity-50" />
          </h2>
          <p className="text-sm">เลขที่: {receiptNumber}</p>
        </div>

        <div className="border-t border-dashed border-black my-2"></div>

        <div className="mb-4">
          <div className="flex justify-between">
            <span>ชื่อนักเรียน:</span>
            <span className="font-bold">{student.name}</span>
          </div>
          <div className="flex justify-between">
            <span>รหัสนักเรียน:</span>
            <span>{student.id}</span>
          </div>
          <div className="flex justify-between">
            <span>ชั้น:</span>
            <span>{student.grade || '-'}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-2"></div>

        <div className="mb-2">
          <p className="font-bold mb-1">รายการ:</p>
          {items.map((item, idx) => (
            <div key={item.id || idx} className="flex justify-between items-start mb-1 text-xs">
              <span className="flex-1 pr-2">{item.fee_type?.name || 'ค่าธรรมเนียม'}</span>
              <span>{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-black my-2"></div>

        <div className="mb-4">
          <div className="flex justify-between font-bold text-base">
            <span>รวม:</span>
            <span>{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span>วิธีชำระ:</span>
            <span>{paymentMethodThai}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-2"></div>

        <div className="mt-8 mb-4">
          <div className="flex justify-between items-end">
            <span>ผู้รับเงิน:</span>
            <span className="border-b border-black w-32 inline-block"></span>
          </div>
        </div>
        
        <div className="text-center text-xs mt-4">
          <p>ขอบคุณที่ใช้บริการ</p>
        </div>
      </div>
    );
  }
);

ReceiptPrint.displayName = 'ReceiptPrint';
