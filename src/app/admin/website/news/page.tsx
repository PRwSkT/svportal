'use client';

import { useState, useEffect, useRef } from 'react';
import { News } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { insertRecord, updateRecord, deleteRecord } from '@/app/admin/website/actions';
import { uploadWebsiteFile } from '@/lib/supabase/storage';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, X, Upload, Loader2, Edit, Trash2 } from 'lucide-react';
import Image from 'next/image';

export default function NewsManager() {
  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title_th: '',
    title_en: '',
    content_th: '',
    content_en: '',
    is_published: true,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const loadNews = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) toast.error('ไม่สามารถโหลดข้อมูลข่าวสารได้');
    else setNews(data as News[]);
    setIsLoading(false);
  };

  useEffect(() => { loadNews(); }, []);

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
    const loadingToast = toast.loading('กำลังบันทึกข่าวสาร...');

    try {
      let coverUrl = previewUrl;
      if (selectedFile) {
        coverUrl = await uploadWebsiteFile(selectedFile, 'news');
      }

      const payload = {
        ...formData,
        cover_image_url: coverUrl || null,
        published_at: formData.is_published ? new Date().toISOString() : null,
      };

      if (editingId) {
        await updateRecord('news', editingId, payload);
        
        toast.success('อัปเดตข่าวสารสำเร็จ', { id: loadingToast });
      } else {
        await insertRecord('news', payload);
        
        toast.success('เพิ่มข่าวสารสำเร็จ', { id: loadingToast });
      }

      setShowModal(false);
      resetForm();
      loadNews();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด', { id: loadingToast, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข่าว "${title}"?`)) return;
    const loadingToast = toast.loading('กำลังลบข้อมูล...');
    try {
      await deleteRecord('news', id);
      
      toast.success('ลบข้อมูลสำเร็จ', { id: loadingToast });
      loadNews();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้', { id: loadingToast, description: err.message });
    }
  };

  const openEditModal = (n: News) => {
    setEditingId(n.id);
    setFormData({
      title_th: n.title_th,
      title_en: n.title_en || '',
      content_th: n.content_th,
      content_en: n.content_en || '',
      is_published: n.is_published,
    });
    setPreviewUrl(n.cover_image_url || '');
    setSelectedFile(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ title_th: '', title_en: '', content_th: '', content_en: '', is_published: true });
    setPreviewUrl('');
    setSelectedFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/20">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">จัดการข่าวสาร (News)</h1>
          <p className="text-foreground/60 text-sm mt-1">เพิ่ม แก้ไข หรือลบประกาศข่าวสารบนหน้าเว็บไซต์</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" /> เพิ่มข่าวสารใหม่
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
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider w-24">รูปปก</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">หัวข้อข่าว</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">วันที่สร้าง</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">สถานะ</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {news.map(n => (
                <tr key={n.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="w-16 h-12 rounded-lg bg-foreground/5 overflow-hidden relative border border-foreground/10">
                      {n.cover_image_url ? (
                        <Image src={n.cover_image_url} alt={n.title_th} fill className="object-cover" unoptimized />
                      ) : (
                        <FileText className="w-5 h-5 text-foreground/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-foreground/80 text-sm line-clamp-1">{n.title_th}</p>
                    <p className="text-xs text-foreground/50 mt-0.5 line-clamp-1">{n.content_th.substring(0, 50)}...</p>
                  </td>
                  <td className="p-4 text-xs text-foreground/60">
                    {new Date(n.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                      n.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {n.is_published ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => openEditModal(n)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(n.id, n.title_th)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {news.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-foreground/40 text-sm">ไม่พบข้อมูลข่าวสาร</td>
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
              className="bg-surface w-full max-w-4xl rounded-3xl shadow-2xl border border-foreground/10 overflow-hidden my-8"
            >
              <div className="p-5 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02] sticky top-0 z-10">
                <h2 className="text-lg font-extrabold text-foreground">{editingId ? 'แก้ไขข่าวสาร' : 'สร้างข่าวสารใหม่'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-6">
                  
                  {/* Image Upload */}
                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-2">ภาพปกข่าว (Optional)</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 bg-foreground/5 rounded-2xl border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center relative overflow-hidden transition-colors"
                    >
                      {previewUrl ? (
                        <Image src={previewUrl} alt="Preview" fill className="object-cover" unoptimized />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-foreground/40 mb-2" />
                          <span className="text-sm font-bold text-foreground/50">คลิกเพื่ออัปโหลดภาพปก</span>
                        </>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground/70 mb-1">หัวข้อข่าว (ภาษาไทย) *</label>
                        <input type="text" required value={formData.title_th} onChange={e => setFormData({...formData, title_th: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground/70 mb-1">รายละเอียดข่าว (ภาษาไทย) *</label>
                        <textarea required rows={8} value={formData.content_th} onChange={e => setFormData({...formData, content_th: e.target.value})} className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm resize-none" />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground/70 mb-1">หัวข้อข่าว (English)</label>
                        <input type="text" value={formData.title_en} onChange={e => setFormData({...formData, title_en: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground/70 mb-1">รายละเอียดข่าว (English)</label>
                        <textarea rows={8} value={formData.content_en} onChange={e => setFormData({...formData, content_en: e.target.value})} className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm resize-none" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="is_published" 
                      checked={formData.is_published}
                      onChange={e => setFormData({...formData, is_published: e.target.checked})}
                      className="w-4 h-4 text-primary rounded border-foreground/20 focus:ring-primary"
                    />
                    <label htmlFor="is_published" className="text-sm font-bold text-foreground/80 cursor-pointer">เผยแพร่ทันที (แสดงบนเว็บไซต์)</label>
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
