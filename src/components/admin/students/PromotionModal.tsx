import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  AlertTriangle, 
  ArrowUpCircle, 
  RefreshCw, 
  GraduationCap, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Baby, 
  FileSpreadsheet,
  ListFilter
} from 'lucide-react';
import { toast } from 'sonner';

type PromotionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PromotionModal({ isOpen, onClose, onSuccess }: PromotionModalProps) {
  const [activeTab, setActiveTab] = useState<'phase_a' | 'phase_b'>('phase_a');
  const [confirmText, setConfirmText] = useState('');
  const [retainedInput, setRetainedInput] = useState('');
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [meta, setMeta] = useState<any>(null);

  // Load inspection statistics when modal opens
  useEffect(() => {
    if (!isOpen) return;
    async function loadMeta() {
      setIsLoadingMeta(true);
      try {
        const res = await fetch('/api/admin/students/promote?academic_year=2568');
        if (res.ok) {
          const d = await res.json();
          setMeta(d);
        }
      } catch (e) {
        console.error('Failed to load promotion inspection data:', e);
      } finally {
        setIsLoadingMeta(false);
      }
    }
    loadMeta();
  } , [isOpen]);

  // Phase A: Term 1 -> Term 2 Rollover
  const handleTermRollover = async () => {
    setIsProcessing(true);
    const toastId = toast.loading('กำลังประมวลผลการปิดภาคเรียนที่ 1 และเปิดภาคเรียนที่ 2...');
    try {
      const res = await fetch('/api/admin/students/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'term_rollover', academic_year: '2568' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการเปลี่ยนภาคเรียน');

      toast.success(data.message || 'เปิดภาคเรียนที่ 2 เรียบร้อยแล้ว', { id: toastId });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('ล้มเหลว', { id: toastId, description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Phase B: Year-End Promotion
  const handleYearPromotion = async () => {
    if (confirmText !== 'ยืนยันเลื่อนชั้น') {
      toast.error('กรุณาพิมพ์ข้อความยืนยันให้ถูกต้อง');
      return;
    }

    const retainedList = retainedInput
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    setIsProcessing(true);
    const toastId = toast.loading('กำลังประมวลผลการเลื่อนชั้นและจัดเก็บประวัติ ปพ.1 ย้อนหลัง...');
    try {
      const res = await fetch('/api/admin/students/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'year_promotion',
          academic_year: '2568',
          retained_student_ids: retainedList
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการเลื่อนชั้น');

      toast.success(data.message || `เลื่อนชั้นสำเร็จ! (${data.updated} คน)`, { id: toastId });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('ล้มเหลว', { id: toastId, description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const phaseA = meta?.phase_a_term_rollover;
  const phaseB = meta?.phase_b_year_promotion;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center">
              <ArrowUpCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                ระบบส่งต่อและเลื่อนชั้นการศึกษา (2-Phase Rollover Engine)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                โรงเรียนสมคิดวิทยา • ปิดภาคเรียนที่ 1 / เลื่อนชั้นประจำปีการศึกษา
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Phase Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('phase_a')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'phase_a'
                ? 'bg-white dark:bg-slate-800 text-[#7B1C3E] dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>เฟส A: ปิดภาคเรียนที่ 1 -&gt; ภาคเรียนที่ 2</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('phase_b')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'phase_b'
                ? 'bg-white dark:bg-slate-800 text-[#7B1C3E] dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>เฟส B: เลื่อนชั้นสิ้นปีการศึกษา (ปพ.1)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {isLoadingMeta ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>กำลังตรวจสอบความพร้อมของข้อมูลผลการเรียนและทะเบียนนักเรียน...</span>
            </div>
          ) : activeTab === 'phase_a' ? (
            /* Phase A: Term 1 -> Term 2 Rollover */
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 rounded-2xl flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                  <p className="font-bold text-sm">การปิดภาคเรียนที่ 1 และเปิดภาคเรียนที่ 2</p>
                  <p>ระบบจะสลับภาคเรียนที่ใช้งานโดย <strong>ไม่ปรับเปลี่ยนชั้นเรียนของนักเรียน</strong></p>
                  <p>ช่วยส่งผ่านข้อมูลคะแนนเก็บ ตรวจสอบสมุด ปพ.5 และสร้างคิวสอบแก้ตัว (0/ร/มส) สำหรับจัดสอนซ่อมเสริม</p>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block mb-1">สมุด ปพ.5 ภาคเรียนที่ 1</span>
                  <strong className="text-base text-slate-900 dark:text-white font-black">
                    {phaseA?.locked_gradebooks ?? 0} / {phaseA?.total_gradebooks ?? 0} เล่ม
                  </strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {phaseA?.pending_gradebooks > 0 
                      ? `(ยังรออนุมัติอีก ${phaseA?.pending_gradebooks} เล่ม)`
                      : 'อนุมัติครบทุกเล่มแล้ว'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block mb-1">คิวซ่อมเสริม (0 / ร / มส / ขส)</span>
                  <strong className={`text-base font-black ${
                    (phaseA?.remediation_queue_count || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {phaseA?.remediation_queue_count ?? 0} รายการ
                  </strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {(phaseA?.remediation_queue_count || 0) > 0 
                      ? 'รอผลสอบแก้ตัวในภาคเรียนที่ 2' 
                      : 'นักเรียนผ่านเกณฑ์ครบทุกคน'}
                  </p>
                </div>
              </div>

              {/* Remediation Queue Preview if any */}
              {phaseA?.remediation_queue && phaseA.remediation_queue.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ListFilter className="w-3.5 h-3.5" />
                    รายชื่อนักเรียนที่ต้องติดตามซ่อมเสริม ({phaseA.remediation_queue.length} รายการ):
                  </label>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 space-y-1.5 text-xs">
                    {phaseA.remediation_queue.map((item: any, i: number) => (
                      <div key={item.id || i} className="flex items-center justify-between py-1 border-b border-amber-200/40 last:border-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.student?.name || item.student_id} ({item.student?.grade || '-'})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px]">{item.gradebook?.course?.name_th || 'วิชา'}</span>
                          <span className="px-2 py-0.5 rounded font-black text-rose-700 bg-rose-100">
                            {item.final_grade}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Phase B: Year-End Promotion */
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-bold text-sm">ข้อควรระวัง: การเลื่อนชั้นสิ้นปีการศึกษา</p>
                  <p>ระบบจะทำการประมวลผลเลื่อนระดับชั้นทั้งโรงเรียน พร้อม <strong>บันทึกประวัติ ปพ.1 ย้อนหลัง</strong> ลงตารางประวัติผลการเรียน:</p>
                  <ul className="list-disc pl-4 space-y-0.5 mt-1 text-[11px]">
                    <li>เนอสเซอรี่ / บริบาล / เตรียมอนุบาล -&gt; อ.1</li>
                    <li>อนุบาล 1-2 เลื่อนขึ้น 1 ชั้น (อ.1 -&gt; อ.2, อ.2 -&gt; อ.3)</li>
                    <li>อนุบาล 3 -&gt; ประถมศึกษาปีที่ 1 (ป.1)</li>
                    <li>ประถมศึกษาปีที่ 1-5 เลื่อนขึ้น 1 ชั้น (ป.1 -&gt; ป.2 ... ป.5 -&gt; ป.6)</li>
                    <li>ประถมศึกษาปีที่ 6 (ป.6) -&gt; ปรับสถานะเป็น <strong>สำเร็จการศึกษา</strong></li>
                    <li>แปลงรหัสนักเรียนเข้าใหม่ชั่วคราว (E-xxxx) เป็นรหัสนักเรียนทางการ</li>
                  </ul>
                </div>
              </div>

              {/* Demographics Summary */}
              <div className="grid grid-cols-3 gap-2.5 text-xs text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px]">นักเรียนทั้งหมด</span>
                  <strong className="text-base font-black text-slate-900 dark:text-white">
                    {phaseB?.total_active_students ?? 0} คน
                  </strong>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px]">ป.6 สำเร็จการศึกษา</span>
                  <strong className="text-base font-black text-purple-600 dark:text-purple-400">
                    {phaseB?.p6_graduating ?? 0} คน
                  </strong>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px]">รหัสชั่วคราว E-xxxx</span>
                  <strong className="text-base font-black text-blue-600 dark:text-blue-400">
                    {phaseB?.e_students ?? 0} คน
                  </strong>
                </div>
              </div>

              {/* Retained Students Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  รายชื่อรหัสนักเรียนซ้ำชั้น (ไม่เลื่อนระดับ) [คั่นด้วยเครื่องหมายจุลภาค , หรือขึ้นบรรทัดใหม่]
                </label>
                <textarea
                  rows={2}
                  value={retainedInput}
                  onChange={(e) => setRetainedInput(e.target.value)}
                  placeholder="เช่น 10105, 10204 (เว้นว่างหากเลื่อนชั้นทุกคน)"
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                />
              </div>

              {/* Confirmation Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  พิมพ์คำว่า <span className="text-[#7B1C3E] font-black bg-[#7B1C3E]/10 px-2 py-0.5 rounded">ยืนยันเลื่อนชั้น</span> เพื่อดำเนินการ
                </label>
                <input 
                  type="text" 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="ยืนยันเลื่อนชั้น"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 font-bold text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            ยกเลิก
          </button>

          {activeTab === 'phase_a' ? (
            <button 
              type="button"
              onClick={handleTermRollover}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-2.5 font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              ดำเนินการเปิดภาคเรียนที่ 2
            </button>
          ) : (
            <button 
              type="button"
              onClick={handleYearPromotion}
              disabled={confirmText !== 'ยืนยันเลื่อนชั้น' || isProcessing}
              className="flex items-center gap-2 px-6 py-2.5 font-bold text-xs text-white bg-[#7B1C3E] hover:bg-[#631430] disabled:opacity-40 disabled:bg-slate-300 dark:disabled:bg-slate-700 rounded-xl shadow-md transition-all cursor-pointer"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowUpCircle className="w-4 h-4" />
              )}
              ดำเนินการเลื่อนชั้นทั้งโรงเรียน
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
