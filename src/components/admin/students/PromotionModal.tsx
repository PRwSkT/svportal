import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';

type PromotionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PromotionModal({ isOpen, onClose, onSuccess }: PromotionModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  const handlePromote = async () => {
    if (confirmText !== 'ยืนยันเลื่อนชั้น') {
      toast.error('กรุณาพิมพ์ข้อความยืนยันให้ถูกต้อง');
      return;
    }

    setIsPromoting(true);
    const toastId = toast.loading('กำลังประมวลผลการเลื่อนชั้นทั้งโรงเรียน...');
    try {
      const res = await fetch('/api/admin/students/promote', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการเลื่อนชั้น');
      
      toast.success(`เลื่อนชั้นสำเร็จ! (${data.updated} คน)`, { id: toastId });
      onSuccess();
    } catch (err: any) {
      toast.error('ล้มเหลว', { id: toastId, description: err.message });
    } finally {
      setIsPromoting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-surface border border-foreground/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-foreground/5 bg-foreground/[0.02]">
          <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
            <ArrowUpCircle className="w-6 h-6" />
            เลื่อนชั้นประจำปีการศึกษา
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-foreground/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-foreground/50" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-orange-600 dark:text-orange-400 text-sm space-y-2">
              <p className="font-bold text-base">คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              <p>ระบบจะทำการเลื่อนชั้นนักเรียนที่ <strong>กำลังศึกษาอยู่</strong> ทั้งโรงเรียนโดยอัตโนมัติ:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>ระดับอนุบาล จะเลื่อนขึ้น 1 ชั้น (เช่น อ.1/1 ➡️ อ.2/1, อ.3 ➡️ ป.1)</li>
                <li>ระดับประถม จะเลื่อนขึ้น 1 ชั้น (เช่น ป.1/2 ➡️ ป.2/2)</li>
                <li>นักเรียนชั้น ป.6 จะถูกปรับสถานะเป็น <strong>สำเร็จการศึกษา</strong></li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-foreground/70 mb-2">
              พิมพ์คำว่า <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">ยืนยันเลื่อนชั้น</span> เพื่อดำเนินการ
            </label>
            <input 
              type="text" 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ยืนยันเลื่อนชั้น"
              className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground transition-all"
            />
          </div>
        </div>

        <div className="p-6 border-t border-foreground/5 bg-foreground/[0.02] flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 font-bold text-foreground/60 hover:bg-foreground/5 rounded-xl transition-all"
          >
            ยกเลิก
          </button>
          <button 
            onClick={handlePromote}
            disabled={confirmText !== 'ยืนยันเลื่อนชั้น' || isPromoting}
            className="flex items-center gap-2 px-6 py-3 font-bold text-white bg-primary disabled:opacity-50 disabled:bg-foreground/20 rounded-xl transition-all hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            {isPromoting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <ArrowUpCircle className="w-5 h-5" />
            )}
            ดำเนินการเลื่อนชั้น
          </button>
        </div>
      </motion.div>
    </div>
  );
}
