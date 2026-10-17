'use client';

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  Archive, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { AcademicExam } from '@/types/academic';

interface ExamDeleteConfirmModalProps {
  isOpen: boolean;
  exam: AcademicExam | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function ExamDeleteConfirmModal({
  isOpen,
  exam,
  onClose,
  onDeleted
}: ExamDeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [forceConfirmed, setForceConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !exam) return null;

  const hasSubmissions = (exam.submissions_count || 0) > 0;

  const handleArchive = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`/api/academic/exams/${exam.id}?action=archive`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'ไม่สามารถจัดเก็บข้อสอบได้');
      }
      onDeleted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการจัดเก็บข้อสอบ');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (isForce: boolean = false) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const url = `/api/academic/exams/${exam.id}${isForce ? '?force=true' : ''}`;
      const res = await fetch(url, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.blocked) {
          setErrorMessage(data.message);
          return;
        }
        throw new Error(data.message || data.error || 'ไม่สามารถลบข้อสอบได้');
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการลบข้อสอบ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">ยืนยันการลบหรือจัดเก็บข้อสอบ</h3>
              <p className="text-xs text-rose-300">ระบบรักษาความปลอดภัยและป้องกันข้อมูลสูญหาย</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-rose-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
            <div className="text-xs text-stone-500 mb-1">
              วิชา: {exam.course?.name_th || 'ไม่ระบุ'} ({exam.course?.course_code || '-'})
            </div>
            <h4 className="font-bold text-stone-900 text-base">{exam.title}</h4>
            <div className="flex items-center gap-3 text-xs text-stone-600 mt-2">
              <span>ปีการศึกษา {exam.academic_year}</span>
              <span>ภาคเรียนที่ {exam.term}</span>
              <span>จำนวน {exam.total_questions} ข้อ</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 leading-relaxed">
              {errorMessage}
            </div>
          )}

          {hasSubmissions ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-xs text-amber-900">ตรวจพบประวัติผลการสอบของนักเรียน</h5>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    ข้อสอบชุดนี้มีการส่งกระดาษคำตอบและบันทึกคะแนนแล้ว{' '}
                    <strong className="underline font-bold">{exam.submissions_count} รายการ</strong>
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200/80">
                <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={forceConfirmed}
                    onChange={(e) => setForceConfirmed(e.target.checked)}
                    className="rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>ฉันเข้าใจว่าการลบถาวรจะลบผลคะแนนสอบของนักเรียนทั้งหมดด้วย</span>
                </label>
              </div>
            </div>
          ) : (
            <p className="text-xs text-stone-600 leading-relaxed">
              ข้อสอบชุดนี้ยังไม่มีผลการสอบของนักเรียน คุณสามารถลบออกจากระบบได้อย่างปลอดภัย หรือเลือกจัดเก็บในคลังหากต้องการนำมาอ้างอิงภายหลัง
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-stone-600 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 transition-colors"
          >
            ยกเลิก
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Archive Button (Recommended if submissions exist) */}
            <button
              type="button"
              onClick={handleArchive}
              disabled={loading}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-200 hover:bg-stone-300 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Archive className="w-4 h-4 text-stone-600" />
              จัดเก็บในคลัง (Archive)
            </button>

            {/* Permanent Delete Button */}
            <button
              type="button"
              onClick={() => handleDelete(hasSubmissions && forceConfirmed)}
              disabled={loading || (hasSubmissions && !forceConfirmed)}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {hasSubmissions ? 'ลบถาวรแบบบังคับ' : 'ลบข้อสอบถาวร'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
