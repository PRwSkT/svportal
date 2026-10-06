'use client';

import { useState, useEffect, useRef } from 'react';
import { Personnel, AppUser } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { insertRecord, updateRecord, deleteRecord, autoLinkAllPersonnelUsers } from '@/app/admin/website/actions';
import { uploadWebsiteFile } from '@/lib/supabase/storage';
import { compressImage } from '@/lib/image-compression';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserPlus, X, Check, Search, Upload, Loader2, Edit, Trash2, 
  Mail, Link2, Link2Off, RefreshCw, CheckCircle2, ShieldCheck, Filter 
} from 'lucide-react';
import Image from 'next/image';

export default function PersonnelManager() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [systemUsers, setSystemUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');

  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    position_th: '',
    position_en: '',
    category: 'teacher',
    email: '',
    user_id: null as string | null,
    bio_th: '',
    bio_en: '',
    sort_order: 1,
    is_active: true,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch personnel with app_users relation
      const { data: pData, error: pErr } = await supabase
        .from('personnel')
        .select('*')
        .order('category')
        .order('sort_order');

      if (pErr) throw pErr;

      // 2. Fetch app_users & auth emails via API
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const uData = await res.json();
        setSystemUsers(uData.users || []);
      }

      setPersonnel((pData || []) as Personnel[]);
    } catch (error: any) {
      toast.error('ไม่สามารถโหลดข้อมูลบุคลากรได้', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const handleSyncAccounts = async () => {
    setIsSyncing(true);
    const loadingToast = toast.loading('กำลังเชื่อมโยงข้อมูลบุคลากรกับอีเมลผู้ใช้งาน...');
    try {
      const res = await autoLinkAllPersonnelUsers();
      if (!res.success) throw new Error(res.error || 'เกิดข้อผิดพลาดในการเชื่อมโยง');
      
      toast.success(`เชื่อมโยงข้อมูลสำเร็จแล้ว ${res.data?.count || 0} บัญชี`, { id: loadingToast });
      await loadData();
    } catch (err: any) {
      toast.error('ไม่สามารถเชื่อมโยงข้อมูลได้', { id: loadingToast, description: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 30 * 1024 * 1024) {
        toast.error('ไฟล์มีขนาดเกิน 30MB กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 30MB');
        e.target.value = '';
        return;
      }

      const toastId = file.size > 2 * 1024 * 1024 ? toast.loading('กำลังปรับขนาดและปรับปรุงความคมชัดรูปภาพ...') : undefined;
      try {
        const optimizedFile = await compressImage(file);
        setSelectedFile(optimizedFile);
        setPreviewUrl(URL.createObjectURL(optimizedFile));
        if (toastId) toast.dismiss(toastId);
      } catch {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        if (toastId) toast.dismiss(toastId);
      }
    }
  };

  const handleSelectUserEmail = (email: string) => {
    const matchedUser = systemUsers.find(u => ((u as any).auth_users?.email || '').toLowerCase() === email.toLowerCase());
    setFormData(prev => ({
      ...prev,
      email: email,
      user_id: matchedUser ? matchedUser.id : null,
      name_th: prev.name_th || (matchedUser ? matchedUser.full_name : '')
    }));
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
        name_th: formData.name_th.trim(),
        name_en: formData.name_en.trim() || null,
        position_th: formData.position_th.trim(),
        position_en: formData.position_en.trim() || null,
        category: formData.category,
        email: formData.email.trim() ? formData.email.trim().toLowerCase() : null,
        user_id: formData.user_id,
        bio_th: formData.bio_th.trim() || null,
        bio_en: formData.bio_en.trim() || null,
        sort_order: Number(formData.sort_order) || 1,
        is_active: formData.is_active,
        image_url: imageUrl,
      };

      if (editingId) {
        const res = await updateRecord('personnel', editingId, payload);
        if (!res.success) throw new Error(res.error || 'ไม่สามารถอัปเดตข้อมูลได้');
        toast.success('อัปเดตข้อมูลสำเร็จ', { id: loadingToast });
      } else {
        const res = await insertRecord('personnel', payload);
        if (!res.success) throw new Error(res.error || 'ไม่สามารถเพิ่มบุคลากรได้');
        toast.success('เพิ่มบุคลากรสำเร็จ', { id: loadingToast });
      }

      setShowModal(false);
      resetForm();
      loadData();
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
      const res = await deleteRecord('personnel', id);
      if (!res.success) throw new Error(res.error || 'ไม่สามารถลบข้อมูลได้');
      toast.success('ลบข้อมูลสำเร็จ', { id: loadingToast });
      loadData();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้', { id: loadingToast, description: err.message });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const loadingToast = toast.loading('กำลังอัปเดตสถานะ...');
    try {
      const res = await updateRecord('personnel', id, { is_active: !currentStatus });
      if (!res.success) throw new Error(res.error || 'ไม่สามารถเปลี่ยนสถานะได้');
      toast.success('อัปเดตสถานะสำเร็จ', { id: loadingToast });
      loadData();
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
      email: p.email || '',
      user_id: p.user_id || null,
      bio_th: p.bio_th || '',
      bio_en: p.bio_en || '',
      sort_order: p.sort_order || 1,
      is_active: p.is_active,
    });
    setPreviewUrl(p.image_url);
    setSelectedFile(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name_th: '', 
      name_en: '', 
      position_th: '', 
      position_en: '', 
      category: 'teacher', 
      email: '',
      user_id: null,
      bio_th: '', 
      bio_en: '', 
      sort_order: personnel.length + 1, 
      is_active: true
    });
    setPreviewUrl('');
    setSelectedFile(null);
  };

  // Filtered personnel list
  const filteredPersonnel = personnel.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || 
      p.name_th.toLowerCase().includes(q) || 
      (p.name_en && p.name_en.toLowerCase().includes(q)) ||
      p.position_th.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q));

    const matchCategory = filterCategory === 'all' || p.category === filterCategory;
    const isLinked = Boolean(p.user_id || p.email);
    const matchLinked = filterLinked === 'all' || 
      (filterLinked === 'linked' && isLinked) || 
      (filterLinked === 'unlinked' && !isLinked);

    return matchQuery && matchCategory && matchLinked;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/20">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-primary">จัดการบุคลากร (Personnel)</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
              รวม {personnel.length} ท่าน
            </span>
          </div>
          <p className="text-foreground/60 text-sm mt-1">
            เชื่อมต่อข้อมูลบุคลากรบนหน้าเว็บไซต์และผูกกับอีเมลผู้ใช้ในระบบ SVPortal เข้าเป็นชุดข้อมูลเดียวกัน
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncAccounts}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 text-sm shadow-sm disabled:opacity-50"
            title="ตรวจสอบและเชื่อมโยงอีเมลกับบัญชีผู้ใช้ระบบให้อัตโนมัติ"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>ซิงค์เชื่อมโยงอีเมลอัตโนมัติ</span>
          </button>

          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95 text-sm"
          >
            <UserPlus className="w-4 h-4" /> เพิ่มบุคลากรใหม่
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-surface/80 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ, ตำแหน่ง, หรืออีเมล..."
            className="w-full bg-background border border-foreground/10 pl-10 pr-4 py-2 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/60 bg-foreground/5 px-2.5 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-foreground"
            >
              <option value="all">หมวดหมู่ทั้งหมด</option>
              <option value="executive">ผู้บริหาร (Executive)</option>
              <option value="teacher">ครูผู้สอน (Teacher)</option>
              <option value="staff">บุคลากรอื่นๆ (Staff)</option>
            </select>
          </div>

          {/* Account Link Filter */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/60 bg-foreground/5 px-2.5 py-1.5 rounded-xl">
            <Link2 className="w-3.5 h-3.5" />
            <select
              value={filterLinked}
              onChange={e => setFilterLinked(e.target.value as any)}
              className="bg-transparent outline-none cursor-pointer text-foreground"
            >
              <option value="all">สถานะบัญชีทั้งหมด</option>
              <option value="linked">ผูกกับอีเมล/บัญชีแล้ว</option>
              <option value="unlinked">ยังไม่ได้ผูกอีเมล</option>
            </select>
          </div>
        </div>
      </div>

      {/* Personnel Table */}
      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/20 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[750px]">
              <thead className="bg-foreground/[0.02] border-b border-foreground/5">
                <tr>
                  <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">รูปภาพ</th>
                  <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">ชื่อ-นามสกุล / ตำแหน่ง</th>
                  <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">อีเมล & บัญชี SVPortal</th>
                  <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">หมวดหมู่</th>
                  <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider">สถานะเว็บ</th>
                  <th className="p-4 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {filteredPersonnel.map(p => {
                  const isAccountLinked = Boolean(p.user_id);
                  const matchedUser = systemUsers.find(u => u.id === p.user_id || ((u as any).auth_users?.email || '').toLowerCase() === (p.email || '').toLowerCase());

                  return (
                    <tr key={p.id} className="hover:bg-foreground/[0.02] transition-colors">
                      {/* Photo */}
                      <td className="p-4">
                        <div className="w-12 h-14 rounded-xl bg-foreground/5 overflow-hidden relative border border-foreground/10 shadow-sm shrink-0">
                          {p.image_url ? (
                            <Image src={p.image_url} alt={p.name_th} fill className="object-cover" unoptimized />
                          ) : (
                            <Users className="w-6 h-6 text-foreground/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          )}
                        </div>
                      </td>

                      {/* Name & Position */}
                      <td className="p-4">
                        <p className="font-bold text-foreground/90 text-sm">{p.name_th}</p>
                        {p.name_en && <p className="text-xs text-foreground/50 font-normal">{p.name_en}</p>}
                        <p className="text-xs text-primary font-medium mt-0.5">{p.position_th}</p>
                      </td>

                      {/* Linked Email & SVPortal User */}
                      <td className="p-4">
                        {p.email ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                              <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="font-mono text-xs">{p.email}</span>
                            </div>
                            <div>
                              {isAccountLinked || matchedUser ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ผูกบัญชีผู้ใช้แล้ว
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  <Link2Off className="w-3 h-3 text-amber-500" /> รอสร้างบัญชีล็อกอิน
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-foreground/5 text-foreground/40 italic">
                            ยังไม่มีอีเมล
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                          p.category === 'executive' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : p.category === 'teacher' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-foreground/5 text-foreground/70 border border-foreground/10'
                        }`}>
                          {p.category === 'executive' ? 'ผู้บริหาร' : p.category === 'teacher' ? 'ครูผู้สอน' : 'บุคลากรทั่วไป'}
                        </span>
                      </td>

                      {/* Active Status */}
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleActive(p.id, p.is_active)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                            p.is_active 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200' 
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-200'
                          }`}
                        >
                          {p.is_active ? 'แสดงบนเว็บ' : 'ซ่อนไว้'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={() => openEditModal(p)} 
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id, p.name_th)} 
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center"
                          title="ลบข้อมูล"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredPersonnel.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-foreground/40 text-sm">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      ไม่พบข้อมูลบุคลากรที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface w-full max-w-2xl rounded-3xl shadow-2xl border border-foreground/10 overflow-hidden my-8 cursor-default"
            >
              <div className="p-5 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02] sticky top-0 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-foreground">{editingId ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่'}</h2>
                    <p className="text-xs text-foreground/50">เชื่อมโยงกับบัญชีและแสดงผลบนหน้าเว็บไซต์โรงเรียน</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="flex flex-col sm:flex-row gap-6">
                    {/* Photo Upload */}
                    <div className="w-full sm:w-1/3 flex flex-col items-center gap-3">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-[3/4] bg-foreground/5 rounded-2xl border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center relative overflow-hidden transition-colors shadow-inner"
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

                    {/* Inputs */}
                    <div className="flex-1 space-y-4">
                      {/* Email Linking Field */}
                      <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-2xl space-y-2">
                        <label className="block text-xs font-bold text-primary flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" /> อีเมลประจำตัว (ผูกกับบัญชี SVPortal)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            list="existing-emails"
                            value={formData.email}
                            onChange={e => handleSelectUserEmail(e.target.value)}
                            placeholder="name@somkidvittaya.ac.th"
                            className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm font-mono"
                          />
                          <datalist id="existing-emails">
                            {systemUsers.map(u => (
                              <option key={u.id} value={(u as any).auth_users?.email || ''}>
                                {u.full_name} ({(u as any).auth_users?.email})
                              </option>
                            ))}
                          </datalist>
                        </div>
                        <p className="text-[11px] text-foreground/50">
                          {formData.user_id 
                            ? '✅ เชื่อมโยงกับบัญชีผู้ใช้ในระบบแล้ว' 
                            : 'ระบุอีเมลโรงเรียนเพื่อผูกประวัติบุคลากรเข้ากับบัญชีล็อกอิน'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่อ-นามสกุล (TH) *</label>
                          <input 
                            type="text" 
                            required 
                            value={formData.name_th} 
                            onChange={e => setFormData({...formData, name_th: e.target.value})} 
                            className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" 
                            placeholder="เช่น นางสาว สมคิด วิทยา"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่อ-นามสกุล (EN)</label>
                          <input 
                            type="text" 
                            value={formData.name_en} 
                            onChange={e => setFormData({...formData, name_en: e.target.value})} 
                            className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" 
                            placeholder="e.g. Miss Somkid Wittaya"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ตำแหน่ง (TH) *</label>
                          <input 
                            type="text" 
                            required 
                            value={formData.position_th} 
                            onChange={e => setFormData({...formData, position_th: e.target.value})} 
                            className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" 
                            placeholder="เช่น ครูผู้สอน (แผนกประถม)"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ตำแหน่ง (EN)</label>
                          <input 
                            type="text" 
                            value={formData.position_en} 
                            onChange={e => setFormData({...formData, position_en: e.target.value})} 
                            className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" 
                            placeholder="e.g. Primary School Teacher"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">หมวดหมู่ *</label>
                          <select 
                            value={formData.category} 
                            onChange={e => setFormData({...formData, category: e.target.value})} 
                            className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm"
                          >
                            <option value="executive">ผู้บริหาร (Executive)</option>
                            <option value="teacher">ครูผู้สอน (Teacher)</option>
                            <option value="staff">บุคลากรอื่นๆ (Staff)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground/70 mb-1">ลำดับการแสดงผล</label>
                          <input 
                            type="number" 
                            min="1" 
                            required 
                            value={formData.sort_order} 
                            onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value) || 1})} 
                            className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm" 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-foreground/70 mb-1">ประวัติย่อ / ข้อมูลแนะนำตัว (TH)</label>
                        <textarea
                          rows={2}
                          value={formData.bio_th}
                          onChange={e => setFormData({...formData, bio_th: e.target.value})}
                          placeholder="รายละเอียดความเชี่ยวชาญหรือประวัติการศึกษา..."
                          className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-foreground/5">
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)} 
                      className="px-5 py-2 text-foreground/60 font-bold hover:bg-foreground/5 rounded-xl transition-colors text-sm"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all text-sm shadow-md"
                    >
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
