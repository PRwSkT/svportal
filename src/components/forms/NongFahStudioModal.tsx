'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormField } from '@/types';
import { GeneratedFormDefinition } from '@/lib/ai/gemma';
import {
  Sparkles, X, Loader2, Check, ArrowRight, ShieldCheck,
  FileText, Plus, RefreshCw, AlertCircle, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface NongFahStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyForm: (
    generated: GeneratedFormDefinition,
    mode: 'replace' | 'append'
  ) => void;
}

const SAMPLE_PROMPTS = [
  'แบบฟอร์มลงทะเบียนสั่งซื้อชุดนักเรียน สมุด และอุปกรณ์การเรียน ภาคเรียนที่ 1',
  'แบบฟอร์มแจ้งการลาป่วยและลากิจของนักเรียน พร้อมแนบใบรับรองแพทย์',
  'แบบฟอร์มลงทะเบียนกิจกรรมทัศนศึกษา สำรวจการแพ้อาหาร และขอความยินยอมผู้ปกครอง',
  'แบบประเมินความพึงพอใจโครงการพัฒนาทักษะทางวิชาการและภาษาต่างประเทศ',
  'แบบฟอร์มรับสมัครนักเรียนใหม่ ระดับชั้นอนุบาลและประถมศึกษา',
];

export function NongFahStudioModal({
  isOpen,
  onClose,
  onApplyForm,
}: NongFahStudioModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedForm, setGeneratedForm] = useState<GeneratedFormDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const textToUse = (customPrompt || prompt).trim();
    if (!textToUse) {
      toast.error('กรุณาระบุรายละเอียดหรือวัตถุประสงค์ของแบบฟอร์ม');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/forms/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToUse }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'เกิดข้อผิดพลาดในการประมวลผล');
      }

      setGeneratedForm(json.data);
      toast.success('น้องฟ้าออกแบบโครงสร้างฟอร์มให้เรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Nong Fah Generation failed:', err);
      setError(err?.message || 'ไม่สามารถสร้างฟอร์มได้ กรุณาลองใหม่อีกครั้ง');
      toast.error('การสร้างฟอร์มไม่สำเร็จ', { description: err?.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = (mode: 'replace' | 'append') => {
    if (!generatedForm) return;
    onApplyForm(generatedForm, mode);
    toast.success(
      mode === 'replace'
        ? 'นำโครงสร้างฟอร์มจากน้องฟ้ามาแทนที่เรียบร้อย'
        : 'เพิ่มช่องคำถามจากน้องฟ้าต่อท้ายเรียบร้อย'
    );
    onClose();
    // reset state
    setGeneratedForm(null);
    setPrompt('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden text-slate-800"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-pink-50/30 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#7B1C3E] text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    น้องฟ้า (Nong Fah) - AI ผู้ช่วยสร้างแบบฟอร์ม
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    Gemma AI
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  ระบบผู้ช่วยอัจฉริยะโรงเรียนสมคิดวิทยา ออกแบบโครงสร้างและคำถามแบบฟอร์มให้อัตโนมัติ
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Input area */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ระบุความต้องการหรือวัตถุประสงค์ของแบบฟอร์ม
              </label>
              <div className="relative">
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="เช่น ต้องการสร้างแบบฟอร์มสั่งซื้อชุดพละและสมุดการบ้าน แบ่งหมวดหมู่เสื้อผ้าและอุปกรณ์การเรียน มีช่องระบุจำนวน และช่องแนบสลิปโอนเงิน..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white resize-none leading-relaxed"
                  disabled={isGenerating}
                />
              </div>

              {/* Sample Prompts */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                  ตัวอย่างคำสั่งที่พบบ่อย (คลิกเพื่อเลือก):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PROMPTS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPrompt(p);
                        handleGenerate(p);
                      }}
                      disabled={isGenerating}
                      className="text-[11px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#7B1C3E]/10 hover:text-[#7B1C3E] text-slate-600 border border-slate-200/80 transition-colors text-left cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">เกิดข้อผิดพลาดในการประมวลผล</div>
                  <div className="mt-0.5 text-rose-700">{error}</div>
                </div>
              </div>
            )}

            {/* Generated Form Preview */}
            {generatedForm && (
              <div className="border border-purple-200 bg-purple-50/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ออกแบบสำเร็จ
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {generatedForm.fields.length} ช่องรายการคำถาม
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGenerate()}
                    className="text-xs text-[#7B1C3E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>สร้างใหม่</span>
                  </button>
                </div>

                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {generatedForm.title?.th || 'แบบฟอร์ม'}
                  </div>
                  {generatedForm.description?.th && (
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {generatedForm.description.th}
                    </p>
                  )}
                </div>

                {/* Field List Preview */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {generatedForm.fields.map((f, i) => (
                    <div
                      key={f.field_key || i}
                      className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-800">
                            {f.label?.th || 'คำถาม'}
                          </span>
                          {f.is_required && <span className="text-rose-500 ml-1">*</span>}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                        {f.field_type}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Apply Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-purple-100">
                  <button
                    type="button"
                    onClick={() => handleApply('append')}
                    className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    <span>เพิ่มต่อท้ายฟอร์มเดิม (+{generatedForm.fields.length} ช่อง)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApply('replace')}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>แทนที่ฟอร์มทั้งหมดด้วยโครงสร้างนี้</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action */}
          {!generatedForm && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero-PII & Educational Governance</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-white cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || !prompt.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>น้องฟ้ากำลังออกแบบโครงสร้าง...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>ให้น้องฟ้าช่วยสร้างฟอร์ม</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
