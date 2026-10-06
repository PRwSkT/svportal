'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FormDefinition, FormField, FormFieldType, FormFieldOption, SupportedLang
} from '@/types';
import { getFormWithFields, saveFormStudio, toggleFormPublish } from '@/app/admin/forms/actions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Sparkles, Eye, Settings, Plus, Trash2,
  Copy, ChevronUp, ChevronDown, Check, Globe, HelpCircle,
  FileText, AlignLeft, Hash, CheckSquare, CircleDot, ChevronDownSquare,
  Calendar, Clock, Upload, Star, Heading, Loader2, ExternalLink,
  ShieldCheck, AlertCircle, RefreshCw, X, LayoutTemplate
} from 'lucide-react';

const FIELD_TEMPLATES: {
  type: FormFieldType;
  title: string;
  icon: any;
  defaultLabel: { th: string; en: string; zh: string };
  defaultOptions?: FormFieldOption[];
}[] = [
  {
    type: 'text',
    title: 'ข้อความสั้น',
    icon: FileText,
    defaultLabel: { th: 'คำถามข้อความสั้น', en: 'Short Text Question', zh: '简答题' }
  },
  {
    type: 'textarea',
    title: 'ข้อความยาว (ย่อหน้า)',
    icon: AlignLeft,
    defaultLabel: { th: 'คำถามข้อความยาว', en: 'Long Paragraph Question', zh: '段落问答' }
  },
  {
    type: 'number',
    title: 'ตัวเลข',
    icon: Hash,
    defaultLabel: { th: 'ระบุจำนวน / ตัวเลข', en: 'Number / Amount', zh: '数字' }
  },
  {
    type: 'radio',
    title: 'เลือกได้ข้อเดียว (Radio)',
    icon: CircleDot,
    defaultLabel: { th: 'เลือกคำตอบที่ถูกต้อง 1 ข้อ', en: 'Select One Option', zh: '单选题' },
    defaultOptions: [
      { value: 'opt_1', label: { th: 'ตัวเลือกที่ 1', en: 'Option 1', zh: '选项 1' } },
      { value: 'opt_2', label: { th: 'ตัวเลือกที่ 2', en: 'Option 2', zh: '选项 2' } }
    ]
  },
  {
    type: 'checkbox',
    title: 'เลือกได้หลายข้อ (Checkbox)',
    icon: CheckSquare,
    defaultLabel: { th: 'เลือกได้มากกว่า 1 คำตอบ', en: 'Select Multiple Options', zh: '多选题' },
    defaultOptions: [
      { value: 'opt_1', label: { th: 'ตัวเลือก ก', en: 'Option A', zh: '选项 A' } },
      { value: 'opt_2', label: { th: 'ตัวเลือก ข', en: 'Option B', zh: '选项 B' } },
      { value: 'opt_3', label: { th: 'ตัวเลือก ค', en: 'Option C', zh: '选项 C' } }
    ]
  },
  {
    type: 'select',
    title: 'เมนูเลือก (Dropdown)',
    icon: ChevronDownSquare,
    defaultLabel: { th: 'กรุณาเลือกจากรายการ', en: 'Please select from list', zh: '下拉选择' },
    defaultOptions: [
      { value: 'opt_1', label: { th: 'รายการที่ 1', en: 'Item 1', zh: '项目 1' } },
      { value: 'opt_2', label: { th: 'รายการที่ 2', en: 'Item 2', zh: '项目 2' } }
    ]
  },
  {
    type: 'date',
    title: 'วันที่',
    icon: Calendar,
    defaultLabel: { th: 'เลือกวันที่', en: 'Select Date', zh: '选择日期' }
  },
  {
    type: 'time',
    title: 'เวลา',
    icon: Clock,
    defaultLabel: { th: 'เลือกเวลา', en: 'Select Time', zh: '选择时间' }
  },
  {
    type: 'file_upload',
    title: 'อัปโหลดไฟล์ / สลิปโอนเงิน',
    icon: Upload,
    defaultLabel: { th: 'แนบหลักฐาน / ภาพถ่าย / สลิปโอนเงิน', en: 'Attach File / Slip Receipt', zh: '上传凭证/文件' }
  },
  {
    type: 'rating',
    title: 'ระดับความพึงพอใจ (1-5 ดาว)',
    icon: Star,
    defaultLabel: { th: 'ระดับความพึงพอใจโดยรวม', en: 'Overall Satisfaction Rating', zh: '满意度评分' }
  },
  {
    type: 'section_header',
    title: 'หัวข้อแบ่งส่วน (Section)',
    icon: Heading,
    defaultLabel: { th: 'ส่วนที่: ข้อมูลเพิ่มเติม', en: 'Section: Additional Information', zh: '部分：补充信息' }
  }
];

export default function FormEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const formId = resolvedParams.id;
  const router = useRouter();

  const [form, setForm] = useState<FormDefinition | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [activeLang, setActiveLang] = useState<SupportedLang>('th');
  const [activeTab, setActiveTab] = useState<'fields' | 'settings'>('fields');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load Form Data
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await getFormWithFields(formId);
      if (res.success && res.data) {
        setForm(res.data.form);
        setFields(res.data.fields);
      } else {
        toast.error('ไม่สามารถเปิดแบบฟอร์มได้', { description: res.error });
        router.push('/admin/forms');
      }
      setIsLoading(false);
    }
    load();
  }, [formId, router]);

  // Mark changes
  const notifyChange = () => setHasUnsavedChanges(true);

  // Field Management
  const addField = (template: typeof FIELD_TEMPLATES[0]) => {
    if (!form) return;
    const newFieldKey = `field_${Date.now().toString(36)}`;
    const newField: FormField = {
      id: crypto.randomUUID(),
      form_id: form.id,
      field_key: newFieldKey,
      label: { ...template.defaultLabel },
      help_text: { th: '', en: '', zh: '' },
      field_type: template.type,
      is_required: template.type !== 'section_header',
      sort_order: fields.length,
      width: 'full',
      options: template.defaultOptions ? JSON.parse(JSON.stringify(template.defaultOptions)) : null,
    };
    setFields([...fields, newField]);
    notifyChange();
    toast.success(`เพิ่มช่อง "${template.title}" เรียบร้อย`);
  };

  const removeField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    setFields(updated);
    notifyChange();
  };

  const duplicateField = (index: number) => {
    const target = fields[index];
    const duplicated: FormField = {
      ...JSON.parse(JSON.stringify(target)),
      id: crypto.randomUUID(),
      field_key: `field_${Date.now().toString(36)}`,
      sort_order: index + 1,
    };
    const updated = [...fields];
    updated.splice(index + 1, 0, duplicated);
    setFields(updated);
    notifyChange();
    toast.success('คัดลอกช่องคำถามเรียบร้อย');
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFields(updated);
    notifyChange();
  };

  const updateField = (index: number, patch: Partial<FormField>) => {
    setFields(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
    notifyChange();
  };

  const updateFieldLabel = (index: number, text: string) => {
    setFields(prev => {
      const copy = [...prev];
      const cur = copy[index].label || { th: '' };
      copy[index].label = { ...cur, [activeLang]: text };
      return copy;
    });
    notifyChange();
  };

  const updateFieldHelpText = (index: number, text: string) => {
    setFields(prev => {
      const copy = [...prev];
      const cur = copy[index].help_text || { th: '' };
      copy[index].help_text = { ...cur, [activeLang]: text };
      return copy;
    });
    notifyChange();
  };

  // Option Management
  const addOption = (fieldIndex: number) => {
    setFields(prev => {
      const copy = [...prev];
      const curOpts = copy[fieldIndex].options || [];
      const optNum = curOpts.length + 1;
      const newOpt: FormFieldOption = {
        value: `opt_${Date.now().toString(36)}`,
        label: {
          th: `ตัวเลือกที่ ${optNum}`,
          en: `Option ${optNum}`,
          zh: `选项 ${optNum}`,
        },
      };
      copy[fieldIndex].options = [...curOpts, newOpt];
      return copy;
    });
    notifyChange();
  };

  const updateOptionLabel = (fieldIndex: number, optIndex: number, text: string) => {
    setFields(prev => {
      const copy = [...prev];
      const curOpts = [...(copy[fieldIndex].options || [])];
      curOpts[optIndex].label = {
        ...curOpts[optIndex].label,
        [activeLang]: text,
      };
      copy[fieldIndex].options = curOpts;
      return copy;
    });
    notifyChange();
  };

  const removeOption = (fieldIndex: number, optIndex: number) => {
    setFields(prev => {
      const copy = [...prev];
      const curOpts = (copy[fieldIndex].options || []).filter((_, i) => i !== optIndex);
      copy[fieldIndex].options = curOpts;
      return copy;
    });
    notifyChange();
  };

  // Save changes
  const handleSave = async () => {
    if (!form) return;
    setIsSaving(true);
    try {
      const res = await saveFormStudio(form.id, form, fields);
      if (res.success) {
        toast.success('บันทึกการเปลี่ยนแปลงทั้งหมดเรียบร้อยแล้ว');
        setHasUnsavedChanges(false);
      } else {
        toast.error('บันทึกไม่สำเร็จ', { description: res.error });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // AI Auto-Translation Action
  const handleAITranslate = async () => {
    if (!form) return;
    if (!form.title?.th) {
      toast.error('กรุณาระบุชื่อฟอร์มภาษาไทยก่อนดำเนินการแปล');
      return;
    }

    setIsTranslating(true);
    const toastId = toast.loading('กำลังใช้ AI แปลฟอร์มเป็นภาษาอังกฤษและภาษาจีน (EN & 中文)...');

    try {
      const res = await fetch('/api/admin/forms/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          thank_you_title: form.thank_you_title,
          thank_you_message: form.thank_you_message,
          fields: fields,
        }),
      });

      if (!res.ok) {
        throw new Error('การแปลภาษาล้มเหลว');
      }

      const data = await res.json();

      if (data.success) {
        setForm(prev => prev ? ({
          ...prev,
          title: data.title,
          description: data.description,
          thank_you_title: data.thank_you_title,
          thank_you_message: data.thank_you_message,
        }) : null);

        setFields(data.fields);
        setHasUnsavedChanges(true);
        toast.success('แปลภาษาอัตโนมัติสำเร็จ! ตรวจสอบที่แท็บ 🇬🇧 EN และ 🇨🇳 ZH ได้ทันที', { id: toastId });
      } else {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err: any) {
      toast.error('แปลภาษาไม่สำเร็จ', { description: err.message, id: toastId });
    } finally {
      setIsTranslating(false);
    }
  };

  // Toggle Publish
  const handleTogglePublish = async () => {
    if (!form) return;
    const nextState = !form.is_published;
    setForm({ ...form, is_published: nextState });
    const res = await toggleFormPublish(form.id, nextState);
    if (res.success) {
      toast.success(nextState ? 'เผยแพร่ฟอร์มเรียบร้อยแล้ว' : 'ปิดการเผยแพร่ (เปลี่ยนเป็นแบบร่าง)');
    } else {
      toast.error('เปลี่ยนสถานะไม่สำเร็จ', { description: res.error });
      setForm({ ...form, is_published: form.is_published });
    }
  };

  if (isLoading || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#7B1C3E] animate-spin" />
          <p className="text-sm font-medium text-slate-600">กำลังโหลดข้อมูลสตูดิโอแบบฟอร์ม...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/forms"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              title="กลับไปหน้ารวมฟอร์ม"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight max-w-md truncate">
                  {form.title?.th || 'แบบฟอร์มไม่มีชื่อ'}
                </h1>
                <button
                  onClick={handleTogglePublish}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    form.is_published
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {form.is_published ? 'เผยแพร่อยู่' : 'แบบร่าง'}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                <span>/forms/{form.slug}</span>
                {hasUnsavedChanges && (
                  <span className="text-amber-600 font-sans font-semibold">● ยังไม่ได้บันทึก</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* AI Translate Button */}
            <button
              onClick={handleAITranslate}
              disabled={isTranslating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  กำลังแปลด้วย AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  ✨ แปล 3 ภาษาด้วย AI
                </>
              )}
            </button>

            {/* View Live Form */}
            <a
              href={`/forms/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <Eye className="w-4 h-4" />
              ดูหน้าฟอร์มจริง
            </a>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:shadow disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  บันทึกแบบฟอร์ม
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sub-bar: Language Switcher Tabs & Studio Views */}
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
          {/* View Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('fields')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'fields'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              จัดการช่องคำถาม ({fields.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              ตั้งค่าฟอร์ม & สิทธิ์
            </button>
          </div>

          {/* Active Language Switcher for Builder */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">แก้ไขข้อความในภาษา:</span>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                onClick={() => setActiveLang('th')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLang === 'th'
                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇹🇭 ไทย (TH)
              </button>
              <button
                onClick={() => setActiveLang('en')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLang === 'en'
                    ? 'bg-[#1B3A6B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇬🇧 English (EN)
              </button>
              <button
                onClick={() => setActiveLang('zh')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLang === 'zh'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇨🇳 中文 (ZH)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Workspace Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {activeTab === 'settings' ? (
          /* Form Settings View */
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">ตั้งค่าแบบฟอร์ม (Form Settings)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                กำหนดคุณสมบัติทั่วไป การเข้าถึง และข้อความหลังจากผู้ตอบส่งแบบฟอร์ม
              </p>
            </div>

            {/* Title in current language */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อแบบฟอร์ม ({activeLang.toUpperCase()}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.title?.[activeLang] || ''}
                onChange={(e) => {
                  setForm({
                    ...form,
                    title: { ...form.title, [activeLang]: e.target.value },
                  });
                  notifyChange();
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                placeholder="ระบุชื่อแบบฟอร์ม..."
              />
            </div>

            {/* Description in current language */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                คำชี้แจง / รายละเอียด ({activeLang.toUpperCase()})
              </label>
              <textarea
                rows={3}
                value={form.description?.[activeLang] || ''}
                onChange={(e) => {
                  setForm({
                    ...form,
                    description: { ...(form.description || { th: '' }), [activeLang]: e.target.value },
                  });
                  notifyChange();
                }}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white resize-none"
                placeholder="ระบุคำชี้แจงสำหรับผู้ตอบแบบฟอร์ม..."
              />
            </div>

            {/* URL Slug & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Slug
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-[#7B1C3E] focus-within:bg-white">
                  <span className="text-xs text-slate-400 font-mono">/forms/</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => {
                      setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') });
                      notifyChange();
                    }}
                    className="w-full py-2.5 pl-1 bg-transparent text-xs font-mono focus:outline-none text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมวดหมู่
                </label>
                <select
                  value={form.category}
                  onChange={(e) => {
                    setForm({ ...form, category: e.target.value });
                    notifyChange();
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                >
                  <option value="general">ทั่วไป</option>
                  <option value="admission">รับสมัครนักเรียน</option>
                  <option value="activity">กิจกรรมโรงเรียน</option>
                  <option value="survey">สำรวจความคิดเห็น</option>
                  <option value="internal">งานภายในบุคลากร</option>
                </select>
              </div>
            </div>

            {/* Access Type & Limitations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  กลุ่มผู้มีสิทธิ์ตอบฟอร์ม
                </label>
                <select
                  value={form.access_type}
                  onChange={(e) => {
                    setForm({ ...form, access_type: e.target.value as any });
                    notifyChange();
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                >
                  <option value="public">🌐 บุคคลภายนอก / ทั่วไป (ผู้ปกครอง, ประชาชน)</option>
                  <option value="internal_all">🔒 บุคลากรทุกคน (@somkidvittaya.ac.th)</option>
                  <option value="internal_teacher">👨‍🏫 ครูผู้สอนเท่านั้น</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำกัดจำนวนการตอบสูงสุด (Max Responses)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="ไม่จำกัด (เว้นว่างไว้)"
                  value={form.max_responses || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    setForm({ ...form, max_responses: val });
                    notifyChange();
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                />
              </div>
            </div>

            {/* Thank You Page Customization */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">ข้อความหน้าส่งฟอร์มสำเร็จ (Thank You Screen)</h3>
                <p className="text-xs text-slate-500">แสดงผลหลังจากผู้ตอบกดส่งแบบฟอร์มเรียบร้อย</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หัวข้อสำเร็จ ({activeLang.toUpperCase()})
                </label>
                <input
                  type="text"
                  value={form.thank_you_title?.[activeLang] || ''}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      thank_you_title: { ...(form.thank_you_title || { th: '' }), [activeLang]: e.target.value },
                    });
                    notifyChange();
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                  placeholder="เช่น ขอบคุณสำหรับการส่งข้อมูล"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ข้อความชี้แจง ({activeLang.toUpperCase()})
                </label>
                <textarea
                  rows={2}
                  value={form.thank_you_message?.[activeLang] || ''}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      thank_you_message: { ...(form.thank_you_message || { th: '' }), [activeLang]: e.target.value },
                    });
                    notifyChange();
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white resize-none"
                  placeholder="เช่น โรงเรียนสมคิดวิทยาได้รับข้อมูลของท่านเรียบร้อยแล้ว"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        ) : (
          /* Fields Designer Canvas */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Field Toolbox (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs sticky top-28">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-[#7B1C3E]" />
                <h3 className="text-sm font-bold text-slate-900">เพิ่มช่องคำถาม (Add Fields)</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                คลิกเลือกประเภทคำถามที่ต้องการเพิ่มลงในแบบฟอร์ม
              </p>

              <div className="space-y-1.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
                {FIELD_TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  return (
                    <button
                      key={tmpl.type}
                      onClick={() => addField(tmpl)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-[#7B1C3E]/30 bg-slate-50 hover:bg-[#7B1C3E]/5 text-left transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 group-hover:text-[#7B1C3E] group-hover:border-[#7B1C3E]/30 transition-colors shrink-0 shadow-2xs">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 group-hover:text-[#7B1C3E] transition-colors">
                          {tmpl.title}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Canvas / Fields List (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Header card preview */}
              <div className="bg-white rounded-2xl border-t-4 border-t-[#7B1C3E] border border-slate-200 p-6 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#7B1C3E] mb-1">
                  <span>โรงเรียนสมคิดวิทยา (Somkidvittaya School)</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {form.title?.[activeLang] || form.title?.th || 'แบบฟอร์มไม่มีชื่อ'}
                </h2>
                {form.description?.[activeLang] && (
                  <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed">
                    {form.description[activeLang]}
                  </p>
                )}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>กำลังดูและแก้ไขในภาษา: <strong className="text-slate-700 font-bold">{activeLang.toUpperCase()}</strong></span>
                  <span>{fields.length} คำถาม</span>
                </div>
              </div>

              {/* Empty state */}
              {fields.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">ยังไม่มีช่องคำถาม</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    คลิกเลือกประเภทคำถามจากกล่องเครื่องมือด้านซ้ายเพื่อเริ่มสร้างฟอร์ม
                  </p>
                </div>
              ) : (
                /* Fields list */
                fields.map((field, index) => {
                  const tmpl = FIELD_TEMPLATES.find(t => t.type === field.field_type) || FIELD_TEMPLATES[0];
                  const Icon = tmpl.icon;
                  const hasOptions = ['radio', 'checkbox', 'select'].includes(field.field_type);
                  const isHeader = field.field_type === 'section_header';

                  return (
                    <motion.div
                      key={field.id || index}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white rounded-2xl border transition-all shadow-xs ${
                        isHeader
                          ? 'border-indigo-200 bg-indigo-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                      } p-5`}
                    >
                      {/* Field Top Actions */}
                      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold font-mono">
                            {index + 1}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            <Icon className="w-3.5 h-3.5 text-[#7B1C3E]" />
                            {tmpl.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Move Up */}
                          <button
                            onClick={() => moveField(index, 'up')}
                            disabled={index === 0}
                            title="เลื่อนขึ้น"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => moveField(index, 'down')}
                            disabled={index === fields.length - 1}
                            title="เลื่อนลง"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          {/* Duplicate */}
                          <button
                            onClick={() => duplicateField(index)}
                            title="ทำซ้ำช่องนี้"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => removeField(index)}
                            title="ลบช่องนี้"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Field Label & Help Text */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {isHeader ? 'ชื่อหัวข้อคั่นส่วน' : 'ข้อความคำถาม'} ({activeLang.toUpperCase()})
                          </label>
                          <input
                            type="text"
                            value={field.label?.[activeLang] || ''}
                            onChange={(e) => updateFieldLabel(index, e.target.value)}
                            placeholder={`ระบุคำถามภาษา ${activeLang.toUpperCase()}...`}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                          />
                        </div>

                        {!isHeader && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                              คำอธิบายเพิ่มเติม / คำแนะนำใต้ช่อง ({activeLang.toUpperCase()})
                            </label>
                            <input
                              type="text"
                              value={field.help_text?.[activeLang] || ''}
                              onChange={(e) => updateFieldHelpText(index, e.target.value)}
                              placeholder={`คำอธิบายเพิ่มเติม (ถ้ามี)...`}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                            />
                          </div>
                        )}

                        {/* Options editor for choice fields */}
                        {hasOptions && (
                          <div className="pt-2">
                            <label className="block text-xs font-semibold text-slate-700 mb-2">
                              ตัวเลือกคำตอบ ({activeLang.toUpperCase()})
                            </label>
                            <div className="space-y-2">
                              {(field.options || []).map((opt, optIdx) => (
                                <div key={opt.value || optIdx} className="flex items-center gap-2">
                                  <span className="text-slate-400 text-xs font-mono">•</span>
                                  <input
                                    type="text"
                                    value={opt.label?.[activeLang] || ''}
                                    onChange={(e) => updateOptionLabel(index, optIdx, e.target.value)}
                                    placeholder={`ตัวเลือกที่ ${optIdx + 1} (${activeLang.toUpperCase()})`}
                                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                                  />
                                  <button
                                    onClick={() => removeOption(index, optIdx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    title="ลบตัวเลือก"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}

                              <button
                                onClick={() => addOption(index)}
                                className="inline-flex items-center gap-1 text-xs text-[#7B1C3E] hover:underline font-semibold mt-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                เพิ่มตัวเลือกใหม่
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Bottom Settings: Required & Width */}
                        {!isHeader && (
                          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 mt-3 border-t border-slate-100 text-xs">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.is_required}
                                onChange={(e) => updateField(index, { is_required: e.target.checked })}
                                className="rounded text-[#7B1C3E] focus:ring-[#7B1C3E] w-4 h-4"
                              />
                              <span className="font-semibold text-slate-700">จำเป็นต้องตอบ (Required)</span>
                            </label>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-medium">ความกว้าง:</span>
                              <select
                                value={field.width}
                                onChange={(e) => updateField(index, { width: e.target.value as any })}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                              >
                                <option value="full">เต็มแถว (100%)</option>
                                <option value="half">ครึ่งแถว (50%)</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
