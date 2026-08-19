'use client';

import { useState, useEffect, useRef } from 'react';
import { Document as DocType } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { uploadWebsiteFile } from '@/lib/supabase/storage';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { FileBox, Plus, X, Upload, Loader2, Edit, Trash2, FileText, Download } from 'lucide-react';

export default function DocumentsManager() {
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title_th: '',
    title_en: '',
    category: 'form',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const loadDocuments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) toast.error('ไม่สามารถโหลดข้อมูลเอกสารได้');
    else setDocuments(data as DocType[]);
    setIsLoading(false);
  };

  useEffect(() => { loadDocuments(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading('กำลังบันทึกเอกสาร...');

    try {
      if (!editingId && !selectedFile) {
        throw new Error('กรุณาเลือกไฟล์เอกสาร');
      }

      let payload: any = { ...formData };

      if (selectedFile) {
        const fileUrl = await uploadWebsiteFile(selectedFile, 'documents');
        const fileExt = selectedFile.name.split('.').pop() || '';
        payload.file_url = fileUrl;
        payload.file_type = fileExt.toLowerCase();
        payload.file_size_bytes = selectedFile.size;
      }

      if (editingId) {
        const { error } = await supabase.from('documents').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('อัปเดตเอกสารสำเร็จ', { id: loadingToast });
      } else {
        const { error } = await supabase.from('documents').insert([payload]);
        if (error) throw error;
        toast.success('เพิ่มเอกสารสำเร็จ', { id: loadingToast });
      }

      setShowModal(false);
      resetForm();
      loadDocuments();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด', { id: loadingToast, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบเอกสาร "${title}"?`)) return;
    const loadingToast = toast.loading('กำลังลบข้อมูล...');
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      toast.success('ลบข้อมูลสำเร็จ', { id: loadingToast });
      loadDocuments();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้', { id: loadingToast, description: err.message });
    }
  };

  const openEditModal = (d: DocType) => {
    setEditingId(d.id);
    setFormData({
      title_th: d.title_th,
      title_en: d.title_en || '',
      category: d.category,
    });
    setSelectedFile(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ title_th: '', title_en: '', category: 'form' });
    setSelectedFile(null);
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/20">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">เอกสารดาวน์โหลด (Documents)</h1>
          <p className="text-foreground/60 text-sm mt-1">จัดการแบบฟอร์ม ระเบียบการ หรือเอกสารสำหรับดาวน์โหลด</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" /> เพิ่มเอกสาร
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
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">ชื่อเอกสาร</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">หมวดหมู่</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">ชนิดไฟล์ / ขนาด</th>
                <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {documents.map(d => (
                <tr key={d.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground/80 text-sm">{d.title_th}</p>
                      <p className="text-xs text-foreground/50 mt-0.5">{d.title_en}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-foreground/5 text-foreground/70">
                      {d.category === 'form' ? 'แบบฟอร์ม' : d.category === 'policy' ? 'ระเบียบการ' : 'อื่นๆ'}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-medium text-foreground/60 uppercase">
                    {d.file_type} <span className="lowercase text-foreground/40 font-normal">({formatBytes(d.file_size_bytes)})</span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="inline-block p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                      <Download className="w-4 h-4" />
                    </a>
                    <button onClick={() => openEditModal(d)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(d.id, d.title_th)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-foreground/40 text-sm">ไม่พบเอกสาร</td>
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
                <h2 className="text-lg font-extrabold text-foreground">{editingId ? 'แก้ไขเอกสาร' : 'เพิ่มเอกสารใหม่'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-4">
                  
                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-2">ไฟล์เอกสาร {editingId ? '(หากต้องการเปลี่ยน)' : '*'}</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-8 bg-foreground/5 rounded-2xl border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center transition-colors"
                    >
                      {selectedFile ? (
                        <div className="text-center">
                          <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
                          <span className="text-sm font-bold text-foreground/80">{selectedFile.name}</span>
                          <p className="text-xs text-foreground/50 mt-1">{formatBytes(selectedFile.size)}</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-foreground/40 mb-2" />
                          <span className="text-sm font-bold text-foreground/50">คลิกเพื่ออัปโหลดไฟล์ (PDF, DOCX)</span>
                        </>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่อเอกสาร (TH) *</label>
                    <input type="text" required value={formData.title_th} onChange={e => setFormData({...formData, title_th: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่อเอกสาร (EN)</label>
                    <input type="text" value={formData.title_en} onChange={e => setFormData({...formData, title_en: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">หมวดหมู่ *</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm appearance-none">
                      <option value="form">แบบฟอร์ม (Form)</option>
                      <option value="policy">ระเบียบการ (Policy)</option>
                      <option value="other">อื่นๆ (Other)</option>
                    </select>
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
