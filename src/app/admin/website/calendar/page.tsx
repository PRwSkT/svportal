'use client';

import { useState, useEffect } from 'react';
import { CalendarEvent } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { insertRecord, updateRecord, deleteRecord } from '@/app/admin/website/actions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Plus, X, Loader2, Edit, Trash2 } from 'lucide-react';

export default function CalendarManager() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title_th: '',
    title_en: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    category: 'academic',
    is_holiday: false,
  });

  const supabase = createClient();

  const loadEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) toast.error('ไม่สามารถโหลดปฏิทินได้');
    else setEvents(data as CalendarEvent[]);
    setIsLoading(false);
  };

  useEffect(() => { loadEvents(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading('กำลังบันทึกกิจกรรม...');

    try {
      const payload = {
        ...formData,
        end_date: formData.end_date || null,
      };

      if (editingId) {
        await updateRecord('calendar_events', editingId, payload);
        
        toast.success('อัปเดตกิจกรรมสำเร็จ', { id: loadingToast });
      } else {
        await insertRecord('calendar_events', payload);
        
        toast.success('เพิ่มกิจกรรมสำเร็จ', { id: loadingToast });
      }

      setShowModal(false);
      resetForm();
      loadEvents();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด', { id: loadingToast, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบกิจกรรม "${title}"?`)) return;
    const loadingToast = toast.loading('กำลังลบข้อมูล...');
    try {
      await deleteRecord('calendar_events', id);
      
      toast.success('ลบข้อมูลสำเร็จ', { id: loadingToast });
      loadEvents();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้', { id: loadingToast, description: err.message });
    }
  };

  const openEditModal = (e: CalendarEvent) => {
    setEditingId(e.id);
    setFormData({
      title_th: e.title_th,
      title_en: e.title_en || '',
      start_date: e.start_date,
      end_date: e.end_date || '',
      category: e.category,
      is_holiday: e.is_holiday,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ title_th: '', title_en: '', start_date: new Date().toISOString().split('T')[0], end_date: '', category: 'academic', is_holiday: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/20">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">ปฏิทินกิจกรรม (Calendar)</h1>
          <p className="text-foreground/60 text-sm mt-1">จัดการปฏิทินวิชาการและวันหยุดต่างๆ</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" /> เพิ่มกิจกรรม
        </button>
      </div>

      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/20 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-foreground/[0.02] border-b border-foreground/5">
              <tr>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">วันที่</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">หัวข้อกิจกรรม</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">หมวดหมู่</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {events.map(e => (
                <tr key={e.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-foreground/80 text-sm">
                      {new Date(e.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {e.end_date && ` - ${new Date(e.end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-foreground/80 text-sm">{e.title_th}</p>
                    <p className="text-xs text-foreground/50 mt-0.5">{e.title_en}</p>
                  </td>
                  <td className="p-4 space-x-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-foreground/5 text-foreground/70">
                      {e.category === 'academic' ? 'วิชาการ' : e.category === 'activity' ? 'กิจกรรม' : 'อื่นๆ'}
                    </span>
                    {e.is_holiday && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-800">
                        วันหยุด
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => openEditModal(e)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(e.id, e.title_th)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-foreground/40 text-sm">ไม่พบกิจกรรม</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-foreground/10 overflow-hidden"
            >
              <div className="p-5 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02]">
                <h2 className="text-lg font-extrabold text-foreground">{editingId ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-4">
                  
                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">หัวข้อกิจกรรม (TH) *</label>
                    <input type="text" required value={formData.title_th} onChange={e => setFormData({...formData, title_th: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">หัวข้อกิจกรรม (EN)</label>
                    <input type="text" value={formData.title_en} onChange={e => setFormData({...formData, title_en: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-foreground/70 mb-1">วันที่เริ่มต้น *</label>
                      <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-foreground/70 mb-1">วันที่สิ้นสุด (ถ้ามี)</label>
                      <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">หมวดหมู่ *</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm appearance-none">
                      <option value="academic">วิชาการ (Academic)</option>
                      <option value="activity">กิจกรรม (Activity)</option>
                      <option value="other">อื่นๆ (Other)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox" 
                      id="is_holiday" 
                      checked={formData.is_holiday}
                      onChange={e => setFormData({...formData, is_holiday: e.target.checked})}
                      className="w-4 h-4 text-primary rounded border-foreground/20 focus:ring-primary"
                    />
                    <label htmlFor="is_holiday" className="text-sm font-bold text-red-600 cursor-pointer">กำหนดให้เป็นวันหยุดโรงเรียน</label>
                  </div>

                  <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-foreground/5">
                    <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-foreground/60 font-bold hover:bg-foreground/5 rounded-xl transition-colors text-sm">ยกเลิก</button>
                    <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all text-sm shadow-md">
                      {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
