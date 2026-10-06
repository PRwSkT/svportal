'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormDefinition } from '@/types';
import { getFormsList, createForm, toggleFormPublish, deleteForm } from './actions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Search, Filter, ExternalLink, QrCode,
  BarChart2, Edit3, Trash2, Copy, Check, Eye, Lock, Globe,
  Calendar, CheckCircle2, AlertCircle, Loader2, Sparkles, X, Download
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'general', label: 'ทั่วไป' },
  { id: 'admission', label: 'รับสมัครนักเรียน' },
  { id: 'activity', label: 'กิจกรรมโรงเรียน' },
  { id: 'survey', label: 'สำรวจความคิดเห็น' },
  { id: 'internal', label: 'งานภายในบุคลากร' },
];

export default function FormsAdminPage() {
  const router = useRouter();
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newAccessType, setNewAccessType] = useState<'public' | 'internal_all' | 'internal_teacher'>('public');
  const [newDesc, setNewDesc] = useState('');

  // QR Modal
  const [qrModalForm, setQrModalForm] = useState<FormDefinition | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const res = await getFormsList();
    if (res.success && res.data) {
      setForms(res.data);
    } else {
      toast.error('ไม่สามารถโหลดรายการฟอร์มได้', { description: res.error });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSlugGenerate = (title: string) => {
    setNewTitle(title);
    if (!newSlug || newSlug.startsWith('sv-form-')) {
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      setNewSlug(`sv-form-${randomSuffix}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('กรุณาระบุชื่อฟอร์ม');
      return;
    }
    if (!newSlug.trim()) {
      toast.error('กรุณาระบุ Slug สำหรับ URL');
      return;
    }

    setIsSubmitting(true);
    const res = await createForm({
      title_th: newTitle,
      slug: newSlug,
      category: newCategory,
      access_type: newAccessType,
      description_th: newDesc,
    });
    setIsSubmitting(false);

    if (res.success && res.data) {
      toast.success('สร้างฟอร์มสำเร็จ! กำลังเปิดหน้าสตูดิโอออกแบบ...');
      setShowCreateModal(false);
      router.push(`/admin/forms/${res.data.id}/edit`);
    } else {
      toast.error('สร้างฟอร์มไม่สำเร็จ', { description: res.error });
    }
  };

  const handleTogglePublish = async (form: FormDefinition) => {
    const nextState = !form.is_published;
    setForms(prev => prev.map(f => f.id === form.id ? { ...f, is_published: nextState } : f));
    const res = await toggleFormPublish(form.id, nextState);
    if (res.success) {
      toast.success(nextState ? 'เผยแพร่ฟอร์มเรียบร้อย' : 'ปิดการเผยแพร่ (เปลี่ยนเป็นแบบร่าง)');
    } else {
      toast.error('เกิดข้อผิดพลาด', { description: res.error });
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, is_published: form.is_published } : f));
    }
  };

  const handleDelete = async (form: FormDefinition) => {
    if (!confirm(`คุณต้องการลบฟอร์ม "${form.title?.th || form.slug}" ใช่หรือไม่? (ข้อมูลการตอบกลับทั้งหมดจะถูกลบด้วย)`)) {
      return;
    }

    const res = await deleteForm(form.id);
    if (res.success) {
      toast.success('ลบฟอร์มเรียบร้อยแล้ว');
      setForms(prev => prev.filter(f => f.id !== form.id));
    } else {
      toast.error('ลบไม่สำเร็จ', { description: res.error });
    }
  };

  const copyFormLink = (slug: string) => {
    const fullUrl = `${window.location.origin}/forms/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    toast.success('คัดลอกลิงก์ฟอร์มเรียบร้อยแล้ว');
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Filtered forms
  const filteredForms = forms.filter(form => {
    const matchSearch =
      (form.title?.th || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (form.title?.en || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.slug.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCategory = selectedCategory === 'all' || form.category === selectedCategory;

    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'published' && form.is_published) ||
      (statusFilter === 'draft' && !form.is_published);

    return matchSearch && matchCategory && matchStatus;
  });

  // Stats calculation
  const totalForms = forms.length;
  const publishedForms = forms.filter(f => f.is_published).length;
  const internalForms = forms.filter(f => f.access_type !== 'public').length;
  const totalResponses = forms.reduce((acc, f) => acc + (f.response_count || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#7B1C3E]/10 text-[#7B1C3E]">
                  <Sparkles className="w-3.5 h-3.5" />
                  SV-Forms Studio
                </span>
                <span className="text-xs text-slate-400 font-medium">โรงเรียนสมคิดวิทยา</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                ระบบจัดการและสร้างแบบฟอร์ม
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                สร้างแบบฟอร์มโรงเรียนมาตรฐาน CI รองรับระบบแปล 3 ภาษา (ไทย / English / 中文) เผยแพร่ภายนอกและภายใน
              </p>
            </div>

            <button
              onClick={() => {
                const randomSuffix = Math.random().toString(36).substring(2, 7);
                setNewTitle('');
                setNewSlug(`sv-form-${randomSuffix}`);
                setNewDesc('');
                setNewCategory('general');
                setNewAccessType('public');
                setShowCreateModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl font-medium shadow-sm transition-all hover:shadow active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              สร้างแบบฟอร์มใหม่
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">แบบฟอร์มทั้งหมด</span>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{totalForms}</div>
              <div className="text-xs text-slate-400 mt-0.5">ชุดฟอร์มในระบบ</div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-800">เปิดรับคำตอบอยู่</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-950 mt-2">{publishedForms}</div>
              <div className="text-xs text-emerald-700/80 mt-0.5">สถานะ เผยแพร่ (Published)</div>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-indigo-800">ฟอร์มเฉพาะภายใน</span>
                <Lock className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-indigo-950 mt-2">{internalForms}</div>
              <div className="text-xs text-indigo-700/80 mt-0.5">สำหรับครูและบุคลากร</div>
            </div>

            <div className="bg-[#7B1C3E]/5 border border-[#7B1C3E]/15 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#7B1C3E]">การตอบกลับสะสม</span>
                <BarChart2 className="w-4 h-4 text-[#7B1C3E]" />
              </div>
              <div className="text-2xl font-bold text-[#7B1C3E] mt-2">{totalResponses.toLocaleString()}</div>
              <div className="text-xs text-[#7B1C3E]/70 mt-0.5">ครั้งที่ผู้ตอบกรอกข้อมูล</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Filters and Search Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs mb-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อฟอร์ม หรือ URL slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all"
              />
            </div>

            {/* Category and Status Filters */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => setStatusFilter('published')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'published' ? 'bg-white shadow-xs text-emerald-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  เผยแพร่แล้ว
                </button>
                <button
                  onClick={() => setStatusFilter('draft')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'draft' ? 'bg-white shadow-xs text-amber-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  แบบร่าง
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Forms Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-8 h-8 text-[#7B1C3E] animate-spin mb-3" />
            <p className="text-slate-500 text-sm">กำลังโหลดรายการแบบฟอร์ม...</p>
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#7B1C3E]/5 flex items-center justify-center text-[#7B1C3E]">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">ยังไม่พบแบบฟอร์ม</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
              {searchQuery ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหาของคุณ' : 'เริ่มต้นสร้างแบบฟอร์มออนไลน์ฉบับแรกสำหรับโรงเรียนสมคิดวิทยา'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1C3E] text-white rounded-xl text-sm font-medium hover:bg-[#631430] transition-colors"
            >
              <Plus className="w-4 h-4" />
              สร้างแบบฟอร์มแรก
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredForms.map((form) => {
              const hasEn = Boolean(form.title?.en);
              const hasZh = Boolean(form.title?.zh);
              const isInternal = form.access_type !== 'public';

              return (
                <div
                  key={form.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        {CATEGORIES.find(c => c.id === form.category)?.label || form.category}
                      </span>

                      {/* Access type badge */}
                      {isInternal ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          <Lock className="w-3 h-3" />
                          {form.access_type === 'internal_teacher' ? 'เฉพาะครู' : 'เฉพาะบุคลากร'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/60">
                          <Globe className="w-3 h-3" />
                          สาธารณะ
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#7B1C3E] transition-colors">
                      {form.title?.th || 'แบบฟอร์มไม่มีชื่อ'}
                    </h3>

                    {/* Description or English title */}
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[32px]">
                      {form.description?.th || form.title?.en || 'ไม่มีคำอธิบายเพิ่มเติม'}
                    </p>

                    {/* Language badges */}
                    <div className="flex items-center gap-1.5 mt-3">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        🇹🇭 TH
                      </span>
                      {hasEn ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          🇬🇧 EN
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                          EN (ยังไม่แปล)
                        </span>
                      )}
                      {hasZh ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                          🇨🇳 ZH
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                          ZH (ยังไม่แปล)
                        </span>
                      )}
                    </div>

                    {/* Link Preview */}
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 mt-4 text-xs text-slate-600">
                      <span className="font-mono truncate mr-2 text-slate-500">
                        /forms/{form.slug}
                      </span>
                      <button
                        onClick={() => copyFormLink(form.slug)}
                        title="คัดลอกลิงก์"
                        className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                      >
                        {copiedSlug === form.slug ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div className="border-t border-slate-100 px-5 py-3.5 bg-slate-50/50 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      {/* Response Count link */}
                      <Link
                        href={`/admin/forms/${form.id}/responses`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#7B1C3E] transition-colors"
                      >
                        <BarChart2 className="w-4 h-4 text-[#7B1C3E]" />
                        <span>{form.response_count || 0} การตอบกลับ</span>
                      </Link>

                      {/* Status Toggle Switch */}
                      <button
                        onClick={() => handleTogglePublish(form)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          form.is_published
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${form.is_published ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                        {form.is_published ? 'เผยแพร่อยู่' : 'แบบร่าง'}
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {/* Edit in Builder */}
                      <Link
                        href={`/admin/forms/${form.id}/edit`}
                        title="แก้ไขแบบฟอร์ม (Form Builder)"
                        className="col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        แก้ไขฟอร์ม
                      </Link>

                      {/* QR Code */}
                      <button
                        onClick={() => setQrModalForm(form)}
                        title="เปิด QR Code สำหรับพิมพ์/แชร์"
                        className="inline-flex items-center justify-center p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-colors"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      {/* View Live */}
                      <a
                        href={`/forms/${form.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="เปิดดูหน้าฟอร์มจริง"
                        className="inline-flex items-center justify-center p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Delete option */}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleDelete(form)}
                        className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        ลบแบบฟอร์มนี้
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create New Form */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative"
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-[#7B1C3E]/10 text-[#7B1C3E]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">สร้างแบบฟอร์มใหม่</h3>
                  <p className="text-xs text-slate-500">กำหนดชื่อและประเภทการเข้าถึงฟอร์ม</p>
                </div>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อแบบฟอร์ม (ภาษาไทย) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น แบบฟอร์มลงทะเบียนกิจกรรมวันแม่แห่งชาติ"
                    value={newTitle}
                    onChange={(e) => handleSlugGenerate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL Slug (ชื่อต่อท้ายลิงก์) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-[#7B1C3E] focus-within:bg-white">
                    <span className="text-xs text-slate-400 font-mono">/forms/</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. mothers-day-2026"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                      className="w-full py-2.5 pl-1 bg-transparent text-xs font-mono focus:outline-none text-slate-800"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">ตัวอักษรภาษาอังกฤษตัวพิมพ์เล็ก ตัวเลข และขีดกลาง (-)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      หมวดหมู่
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                    >
                      <option value="general">ทั่วไป</option>
                      <option value="admission">รับสมัครนักเรียน</option>
                      <option value="activity">กิจกรรมโรงเรียน</option>
                      <option value="survey">สำรวจความคิดเห็น</option>
                      <option value="internal">งานภายในบุคลากร</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      กลุ่มผู้ตอบฟอร์ม
                    </label>
                    <select
                      value={newAccessType}
                      onChange={(e) => setNewAccessType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                    >
                      <option value="public">🌐 บุคคลภายนอก / ทั่วไป</option>
                      <option value="internal_all">🔒 บุคลากรทุกคน (@somkidvittaya.ac.th)</option>
                      <option value="internal_teacher">👨‍🏫 ครูผู้สอนเท่านั้น</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    คำอธิบายสั้นๆ (ถ้ามี)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="รายละเอียดชี้แจงผู้ตอบฟอร์ม..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        กำลังสร้าง...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        สร้างและเปิดสตูดิโอ
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: QR Code Generator & Sharing */}
      <AnimatePresence>
        {qrModalForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center relative"
            >
              <button
                onClick={() => setQrModalForm(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {qrModalForm.title?.th || 'QR Code สำหรับเข้าถึงฟอร์ม'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                สแกนด้วยสมาร์ทโฟนเพื่อเปิดแบบฟอร์มทันที
              </p>

              {/* QR Code Container */}
              <div className="mt-5 p-4 bg-white border border-slate-200 rounded-2xl shadow-inner inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    typeof window !== 'undefined' ? `${window.location.origin}/forms/${qrModalForm.slug}` : ''
                  )}&color=7B1C3E`}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto rounded-lg"
                />
              </div>

              <div className="text-xs font-mono text-slate-500 mt-3 break-all">
                /forms/{qrModalForm.slug}
              </div>

              <div className="flex flex-col gap-2 mt-5">
                <button
                  onClick={() => copyFormLink(qrModalForm.slug)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {copiedSlug === qrModalForm.slug ? 'คัดลอกลิงก์เรียบร้อยแล้ว!' : 'คัดลอกลิงก์ (Copy URL)'}
                </button>

                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                    typeof window !== 'undefined' ? `${window.location.origin}/forms/${qrModalForm.slug}` : ''
                  )}&color=7B1C3E`}
                  download={`qr-${qrModalForm.slug}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  ดาวน์โหลด QR Code ภาพคมชัด (PNG)
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
