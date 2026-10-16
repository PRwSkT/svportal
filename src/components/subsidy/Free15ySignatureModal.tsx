'use client';

import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool, ShieldCheck, DollarSign } from 'lucide-react';
import { calculateDisbursementAmount, formatThaiBahtText } from '@/lib/subsidy/free15y';
import { toast } from 'sonner';

interface Free15ySignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    student_id?: string;
    name: string;
    grade: string;
    classroom?: string;
    student_parents?: {
      name?: string;
      prefix?: string;
      first_name?: string;
      last_name?: string;
      relationship?: string;
      id_card?: string;
      citizen_id?: string;
    }[];
  } | null;
  academicYear: string;
  term: string;
  onSuccess: () => void;
}

export default function Free15ySignatureModal({
  isOpen,
  onClose,
  student,
  academicYear,
  term,
  onSuccess
}: Free15ySignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientRelation, setRecipientRelation] = useState('มารดา');
  const [recipientCitizenId, setRecipientCitizenId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default parent name if available
  useEffect(() => {
    if (student) {
      const parent = student.student_parents?.[0];
      const fullParentName = parent?.name || (parent?.first_name ? `${parent.prefix || ''}${parent.first_name} ${parent.last_name || ''}`.trim() : '');
      setRecipientName(fullParentName);
      setRecipientRelation(parent?.relationship || 'มารดา');
      setRecipientCitizenId(parent?.id_card || parent?.citizen_id || '');
      clearCanvas();
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const amounts = calculateDisbursementAmount(student.grade, term);
  const bahtText = formatThaiBahtText(amounts.totalCashDisbursement);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = async () => {
    if (!recipientName.trim()) {
      toast.error('กรุณาระบุชื่อผู้ปกครองผู้รับเงิน');
      return;
    }
    if (!hasSignature) {
      toast.error('กรุณาลงลายมือชื่อบนช่องเซ็น');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureData = canvas.toDataURL('image/png');

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/subsidy/free15y', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.id,
          grade: student.grade,
          academic_year: academicYear,
          term: term,
          recipient_name: recipientName,
          recipient_relation: recipientRelation,
          recipient_citizen_id: recipientCitizenId,
          signature_data: signatureData
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save disbursement');

      toast.success('บันทึกลายเซ็นรับเงินเรียนฟรี 15 ปี (แบบ อร.1/1) สำเร็จ');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกล้มเหลว');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <PenTool className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
                ลงลายมือชื่อรับเงินเรียนฟรี 15 ปี (แบบ อร.1/1)
              </h3>
              <p className="text-xs text-slate-500">
                ภาคเรียนที่ {term} ปีการศึกษา {academicYear}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student & Cash Calculation Box */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">นักเรียน:</span>
            <strong className="text-slate-900 dark:text-white text-sm">{student.name}</strong>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">ระดับชั้น:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{student.grade} {student.classroom ? `ห้อง ${student.classroom}` : ''}</span>
          </div>
          
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block">ค่าเครื่องแบบ:</span>
              <strong className="text-slate-900 dark:text-white">{amounts.uniformAmount} บาท</strong>
            </div>
            <div>
              <span className="text-slate-500 block">ค่าอุปกรณ์การเรียน:</span>
              <strong className="text-slate-900 dark:text-white">{amounts.stationeryAmount} บาท</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              ยอดเงินสดที่ได้รับสุทธิ:
            </span>
            <div className="text-right">
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                {amounts.totalCashDisbursement.toLocaleString()} บาท
              </span>
              <span className="block text-[10px] text-slate-500">({bahtText})</span>
            </div>
          </div>
        </div>

        {/* Recipient Input Fields */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              ชื่อ - สกุล ผู้ปกครองผู้รับเงิน:
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="ระบุชื่อ - นามสกุล ผู้ปกครอง"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ความสัมพันธ์กับนักเรียน:
              </label>
              <select
                value={recipientRelation}
                onChange={e => setRecipientRelation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-emerald-600"
              >
                <option value="มารดา">มารดา</option>
                <option value="บิดา">บิดา</option>
                <option value="ปู่/ย่า/ตา/ยาย">ปู่/ย่า/ตา/ยาย</option>
                <option value="ผู้ปกครองตามกฎหมาย">ผู้ปกครองตามกฎหมาย</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                เลขประจำตัวประชาชน:
              </label>
              <input
                type="text"
                value={recipientCitizenId}
                onChange={e => setRecipientCitizenId(e.target.value)}
                placeholder="เลข 13 หลัก (ถ้ามี)"
                maxLength={13}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Digital Signature Canvas */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <PenTool className="w-3.5 h-3.5 text-emerald-600" />
              ลายมือชื่อผู้รับเงิน (เซ็นด้วยนิ้วหรือปากกา Stylus):
            </label>
            <button
              type="button"
              onClick={clearCanvas}
              className="text-xs text-rose-600 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> ล้างลายเซ็น
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white overflow-hidden touch-none relative">
            <canvas
              ref={canvasRef}
              width={450}
              height={140}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-32 cursor-crosshair block"
            />
            {!hasSignature && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs font-semibold">
                แตะเพื่อลงลายมือชื่อที่นี่
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs sm:text-sm"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
          >
            <Check className="w-4 h-4" /> {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกลายเซ็นรับเงิน'}
          </button>
        </div>

      </div>
    </div>
  );
}
