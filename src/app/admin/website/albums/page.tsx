'use client';

import { useState, useEffect, useRef } from 'react';
import { Album } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { uploadWebsiteFile } from '@/lib/supabase/storage';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Plus, X, Upload, Loader2, Edit, Trash2, Camera } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function AlbumsManager() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title_th: '',
    title_en: '',
    description_th: '',
    description_en: '',
    event_date: new Date().toISOString().split('T')[0],
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const loadAlbums = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) toast.error('ไม่สามารถโหลดอัลบั้มได้');
    else setAlbums(data as Album[]);
    setIsLoading(false);
  };

  useEffect(() => { loadAlbums(); }, []);

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
    const loadingToast = toast.loading('กำลังบันทึกอัลบั้ม...');

    try {
      let coverUrl = previewUrl;
      if (selectedFile) {
        coverUrl = await uploadWebsiteFile(selectedFile, 'albums');
      }

      const payload = {
        ...formData,
        cover_image_url: coverUrl || null,
      };

      if (editingId) {
        const { error } = await supabase.from('albums').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('อัปเดตอัลบั้มสำเร็จ', { id: loadingToast });
      } else {
        const { error } = await supabase.from('albums').insert([payload]);
        if (error) throw error;
        toast.success('สร้างอัลบั้มใหม่สำเร็จ', { id: loadingToast });
      }

      setShowModal(false);
      resetForm();
      loadAlbums();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด', { id: loadingToast, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบอัลบั้ม "${title}" และรูปภาพทั้งหมดภายในอัลบั้มนี้?`)) return;
    const loadingToast = toast.loading('กำลังลบข้อมูล...');
    try {
      // Supabase cascade delete should handle album_photos if foreign key is set up.
      // If not, we might need to delete photos first. Assuming cascade is on.
      const { error } = await supabase.from('albums').delete().eq('id', id);
      if (error) throw error;
      toast.success('ลบอัลบั้มสำเร็จ', { id: loadingToast });
      loadAlbums();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้', { id: loadingToast, description: err.message });
    }
  };

  const openEditModal = (a: Album) => {
    setEditingId(a.id);
    setFormData({
      title_th: a.title_th,
      title_en: a.title_en || '',
      description_th: a.description_th || '',
      description_en: a.description_en || '',
      event_date: a.event_date,
    });
    setPreviewUrl(a.cover_image_url || '');
    setSelectedFile(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ title_th: '', title_en: '', description_th: '', description_en: '', event_date: new Date().toISOString().split('T')[0] });
    setPreviewUrl('');
    setSelectedFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/20">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">ภาพกิจกรรม (Albums)</h1>
          <p className="text-foreground/60 text-sm mt-1">จัดการอัลบั้มและแกลลอรี่ภาพกิจกรรม</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" /> สร้างอัลบั้มใหม่
        </button>
      </div>

      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
          </div>
        ) : albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-foreground/40 space-y-4 bg-surface/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/20">
            <ImageIcon className="w-16 h-16 opacity-20" />
            <p className="text-sm font-medium">ยังไม่มีอัลบั้มภาพกิจกรรม</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {albums.map(a => (
              <div key={a.id} className="group bg-surface/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/20 overflow-hidden hover:shadow-md transition-all flex flex-col">
                <Link href={`/admin/website/albums/${a.id}`} className="block relative aspect-video bg-foreground/5 overflow-hidden">
                  {a.cover_image_url ? (
                    <Image src={a.cover_image_url} alt={a.title_th} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-foreground/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm transition-all transform translate-y-4 group-hover:translate-y-0">
                      จัดการรูปภาพ
                    </span>
                  </div>
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <Link href={`/admin/website/albums/${a.id}`} className="hover:text-primary transition-colors">
                    <h3 className="font-bold text-foreground/80 line-clamp-2 text-sm">{a.title_th}</h3>
                  </Link>
                  <p className="text-xs text-foreground/50 mt-1 mb-3">
                    {new Date(a.event_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                  
                  <div className="mt-auto flex justify-end gap-2 pt-3 border-t border-foreground/5">
                    <button onClick={() => openEditModal(a)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(a.id, a.title_th)} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
              className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-foreground/10 overflow-hidden my-8"
            >
              <div className="p-5 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02]">
                <h2 className="text-lg font-extrabold text-foreground">{editingId ? 'แก้ไขข้อมูลอัลบั้ม' : 'สร้างอัลบั้มใหม่'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-5">
                  
                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-2">ภาพปกอัลบั้ม (Optional)</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-video bg-foreground/5 rounded-2xl border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center relative overflow-hidden transition-colors"
                    >
                      {previewUrl ? (
                        <Image src={previewUrl} alt="Preview" fill className="object-cover" unoptimized />
                      ) : (
                        <>
                          <Camera className="w-8 h-8 text-foreground/40 mb-2" />
                          <span className="text-sm font-bold text-foreground/50">คลิกเพื่ออัปโหลดภาพปก</span>
                        </>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่ออัลบั้ม (TH) *</label>
                    <input type="text" required value={formData.title_th} onChange={e => setFormData({...formData, title_th: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่ออัลบั้ม (EN)</label>
                    <input type="text" value={formData.title_en} onChange={e => setFormData({...formData, title_en: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">วันที่จัดกิจกรรม *</label>
                    <input type="date" required value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">รายละเอียด</label>
                    <textarea rows={3} value={formData.description_th} onChange={e => setFormData({...formData, description_th: e.target.value})} className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm resize-none" placeholder="คำอธิบายอัลบั้ม (TH)" />
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
