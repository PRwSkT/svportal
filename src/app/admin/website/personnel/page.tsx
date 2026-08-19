'use client';

import { useState, useEffect, useRef } from 'react';
import { Personnel } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { uploadWebsiteFile } from '@/lib/supabase/storage';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, X, Check, Search, Upload, Loader2, Edit, Trash2 } from 'lucide-react';
import Image from 'next/image';

export default function PersonnelManager() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    position_th: '',
    position_en: '',
    category: 'executive',
    bio_th: '',
    bio_en: '',
    sort_order: 1,
    is_active: true,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const loadPersonnel = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('personnel')
      .select('*')
      .order('category')
      .order('sort_order');

    if (error) {
      toast.error('ไม่สามารถโหลดข้อมูลบุคลากรได้', { description: error.message });
    } else {
      setPersonnel(data as Personnel[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPersonnel();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading('กำลังบันทึกข้อมูล...');

    try {
      let imageUrl = previewUrl;

      // Upload new image if selected
      if (selectedFile) {
        imageUrl = await uploadWebsiteFile(selectedFile, 'personnel');
      }

      if (!editingId && !imageUrl) {
        throw new Error('กรุณาอัปโหลดรูปภาพ');
      }

      const payload = {
        ...formData,
        image_url: imageUrl,
      };

      if (editingId) {
        const { error } = await supabase.from('personnel').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('อัปเดตข้อมูลสำเร็จ', { id: loadingToast });
      } else {
        const { error } = await supabase.from('personnel').insert([payload]);
        if (error) throw error;
        toast.success('เพิ่มบุคลากรสำเร็จ', { id: loadingToast });
      }

      setShowModal(false);
      resetForm();
      loadPersonnel();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด', { id: loadingToast, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${name}?`)) return;
    
    const loadingToast = toast.loading('กำลังลบข้อมูล...');
    try {
      const { error } = await supabase.from('personnel').delete().eq('id', id);
      if (error) throw error;
      toast.success('ลบข้อมูลสำเร็จ', { id: loadingToast });
      loadPersonnel();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้', { id: loadingToast, description: err.message });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const loadingToast = toast.loading('กำลังอัปเดตสถานะ...');
    try {
      const { error } = await supabase.from('personnel').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      toast.success('อัปเดตสถานะสำเร็จ', { id: loadingToast });
      loadPersonnel();
    } catch (err: any) {
      toast.error('ไม่สามารถอัปเดตสถานะได้', { id: loadingToast, description: err.message });
    }
  };

  const openEditModal = (p: Personnel) => {
    setEditingId(p.id);
    setFormData({
      name_th: p.name_th,
      name_en: p.name_en || '',
      position_th: p.position_th,
      position_en: p.position_en || '',
      category: p.category,
      bio_th: p.bio_th || '',
      bio_en: p.bio_en || '',
      sort_order: p.sort_order,
      is_active: p.is_active,
    });
    setPreviewUrl(p.image_url);
    setSelectedFile(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name_th: '', name_en: '', position_th: '', position_en: '', category: 'executive', bio_th: '', bio_en: '', sort_order: 1, is_active: true
    });
    setPreviewUrl('');
    setSelectedFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/20">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">จัดการบุคลากร (Personnel)</h1>
          <p className="text-foreground/60 text-sm mt-1">เพิ่ม แก้ไข หรือลบข้อมูลผู้บริหารและครูบนเว็บไซต์</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95 text-sm"
        >
          <UserPlus className="w-4 h-4" /> เพิ่มบุคลากร
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
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">รูปภาพ</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">ชื่อ-นามสกุล / ตำแหน่ง</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">หมวดหมู่</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">สถานะ</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {personnel.map(p => (
                <tr key={p.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="w-12 h-12 rounded-xl bg-foreground/5 overflow-hidden relative border border-foreground/10">
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name_th} fill className="object-cover" unoptimized />
                      ) : (
                        <Users className="w-6 h-6 text-foreground/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-foreground/80 text-sm">{p.name_th}</p>
                    <p className="text-xs text-foreground/50 mt-0.5">{p.position_th}</p>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-foreground/5 text-foreground/70">
                      {p.category === 'executive' ? 'ผู้บริหาร' : p.category === 'teacher' ? 'ครูผู้สอน' : 'บุคลากรอื่นๆ'}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleActive(p.id, p.is_active)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                        p.is_active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {p.is_active ? 'แสดงผล' : 'ซ่อน'}
                    </button>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => openEditModal(p)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id, p.name_th)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {personnel.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-foreground/40 text-sm">ไม่พบข้อมูลบุคลากร</td>
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
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-2xl rounded-3xl shadow-2xl border border-foreground/10 overflow-hidden my-8"
            >
              <div className="p-5 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02] sticky top-0 z-10">
                <h2 className="text-lg font-extrabold text-foreground">{editingId ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="flex gap-6">
                    <div className="w-1/3 flex flex-col items-center gap-3">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-[3/4] bg-foreground/5 rounded-2xl border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center relative overflow-hidden transition-colors"
                      >
                        {previewUrl ? (
                          <Image src={previewUrl} alt="Preview" fill className="object-cover" unoptimized />
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-foreground/40 mb-2" />
                            <span className="text-xs font-bold text-foreground/50">อัปโหลดรูปภาพ</span>
                          </>
                        )}
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                      <p className="text-[10px] text-foreground/40 text-center">แนะนำรูปแนวตั้ง อัตราส่วน 3:4 พื้นหลังโปร่งใสหรือสีพื้น</p>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่อ-นามสกุล (TH) *</label>
                          <input type="text" required value={formData.name_th} onChange={e => setFormData({...formData, name_th: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่อ-นามสกุล (EN)</label>
                          <input type="text" value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ตำแหน่ง (TH) *</label>
                          <input type="text" required value={formData.position_th} onChange={e => setFormData({...formData, position_th: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ตำแหน่ง (EN)</label>
                          <input type="text" value={formData.position_en} onChange={e => setFormData({...formData, position_en: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">หมวดหมู่ *</label>
                          <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm appearance-none">
                            <option value="executive">ผู้บริหาร (Executive)</option>
                            <option value="teacher">ครูผู้สอน (Teacher)</option>
                            <option value="staff">บุคลากรอื่นๆ (Staff)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ลำดับการแสดงผล</label>
                          <input type="number" min="1" required value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                        </div>
                      </div>
                    </div>
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
