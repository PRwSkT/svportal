'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FormDefinition, FormField, FormFieldType, FormFieldOption, SupportedLang
} from '@/types';
import {
  getFormWithFields,
  saveFormStudio,
  toggleFormPublish,
  getFormCollaboratorCandidates,
  updateFormCollaborators,
  createForm,
} from '@/app/admin/forms/actions';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/image-compression';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Sparkles, Eye, Settings, Plus, Trash2,
  Copy, ChevronUp, ChevronDown, Check, Globe, HelpCircle,
  FileText, AlignLeft, Hash, CheckSquare, CircleDot, ChevronDownSquare,
  Calendar, Clock, Upload, Star, Heading, Loader2, ExternalLink,
  ShieldCheck, AlertCircle, RefreshCw, X, LayoutTemplate,
  Image as ImageIcon, Info, Smartphone, Monitor, User, Users, UserCheck, Search, QrCode, Bot, BarChart2,
  Award, ShieldAlert
} from 'lucide-react';
import { FormQRCodeModal } from '@/components/forms/FormQRCodeModal';
import { NongFahStudioModal } from '@/components/forms/NongFahStudioModal';
import { NongFahChatWidget } from '@/components/forms/NongFahChatWidget';
import { GeneratedFormDefinition } from '@/lib/ai/gemma';

const FIELD_TEMPLATES: {
  type: FormFieldType;
  title: string;
  category: string;
  icon: any;
  defaultLabel: { th: string; en: string; zh: string };
  defaultHelp?: { th: string; en: string; zh: string };
  defaultOptions?: FormFieldOption[];
}[] = [
  // --- Content & Layout Elements ---
  {
    type: 'section_header',
    title: 'หัวข้อแบ่งส่วน (Section Header)',
    category: 'layout',
    icon: Heading,
    defaultLabel: { th: 'ส่วนที่: ข้อมูลเพิ่มเติม', en: 'Section: Additional Information', zh: '部分：补充信息' }
  },
  {
    type: 'info_text',
    title: 'ข้อความชี้แจง / รายละเอียดเฉยๆ (Note)',
    category: 'layout',
    icon: Info,
    defaultLabel: { th: 'ข้อความชี้แจง', en: 'Information & Guidelines', zh: '须知与说明' }
  },
  {
    type: 'image',
    title: 'รูปภาพ / โปสเตอร์ / QR ชำระเงิน',
    category: 'layout',
    icon: ImageIcon,
    defaultLabel: { th: 'รูปภาพประกอบ', en: 'Illustration / Image', zh: '插图 / 图片' }
  },
  // --- Input Questions ---
  {
    type: 'text',
    title: 'ข้อความสั้น (Single line)',
    category: 'input',
    icon: FileText,
    defaultLabel: { th: 'คำถามข้อความสั้น', en: 'Short Text Question', zh: '简答题' }
  },
  {
    type: 'textarea',
    title: 'ข้อความยาว (Paragraph)',
    category: 'input',
    icon: AlignLeft,
    defaultLabel: { th: 'คำถามข้อความยาว', en: 'Long Paragraph Question', zh: '段落问答' }
  },
  {
    type: 'number',
    title: 'ตัวเลข (Number)',
    category: 'input',
    icon: Hash,
    defaultLabel: { th: 'ระบุจำนวน / ตัวเลข', en: 'Number / Amount', zh: '数字' }
  },
  {
    type: 'radio',
    title: 'เลือกได้ข้อเดียว (Radio)',
    category: 'input',
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
    category: 'input',
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
    category: 'input',
    icon: ChevronDownSquare,
    defaultLabel: { th: 'กรุณาเลือกจากรายการ', en: 'Please select from list', zh: '下拉选择' },
    defaultOptions: [
      { value: 'opt_1', label: { th: 'รายการที่ 1', en: 'Item 1', zh: '项目 1' } },
      { value: 'opt_2', label: { th: 'รายการที่ 2', en: 'Item 2', zh: '项目 2' } }
    ]
  },
  {
    type: 'date',
    title: 'วันที่ (Date Picker)',
    category: 'input',
    icon: Calendar,
    defaultLabel: { th: 'เลือกวันที่', en: 'Select Date', zh: '选择日期' }
  },
  {
    type: 'time',
    title: 'เวลา (Time Picker)',
    category: 'input',
    icon: Clock,
    defaultLabel: { th: 'เลือกเวลา', en: 'Select Time', zh: '选择时间' }
  },
  {
    type: 'file_upload',
    title: 'อัปโหลดไฟล์ / สลิปโอนเงิน (File Upload)',
    category: 'input',
    icon: Upload,
    defaultLabel: { th: 'แนบหลักฐาน / ภาพถ่าย / สลิปโอนเงิน', en: 'Attach File / Slip Receipt', zh: '上传凭证/文件' }
  },
  {
    type: 'rating',
    title: 'ระดับความพึงพอใจ (1-5 ดาว)',
    category: 'input',
    icon: Star,
    defaultLabel: { th: 'ระดับความพึงพอใจโดยรวม', en: 'Overall Satisfaction Rating', zh: '满意度评分' }
  }
];

export default function FormEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const formId = resolvedParams.id;
  const router = useRouter();

  const [form, setForm] = useState<FormDefinition | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [activeLang, setActiveLang] = useState<SupportedLang>('th');
  const [activeTab, setActiveTab] = useState<'fields' | 'settings' | 'quiz'>('fields');
  const [mobileStudioTab, setMobileStudioTab] = useState<'canvas' | 'toolbox'>('canvas');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Upload States
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Live Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewLang, setPreviewLang] = useState<SupportedLang>('th');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showNongFahModal, setShowNongFahModal] = useState(false);

  // Collaborator States
  const [collaboratorCandidates, setCollaboratorCandidates] = useState<any[]>([]);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [isSavingCollaborators, setIsSavingCollaborators] = useState(false);
  const [collaboratorSearchQuery, setCollaboratorSearchQuery] = useState('');

  const supabase = createClient();

  // Load Form Data & Collaborators
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [res, candRes] = await Promise.all([
        getFormWithFields(formId),
        getFormCollaboratorCandidates(),
      ]);

      if (res.success && res.data) {
        setForm(res.data.form);
        const isDummy = (txt?: string | null) => {
          if (!txt) return false;
          const t = txt.trim();
          return (
            t === 'คำอธิบายเพิ่มเติมสำหรับส่วนนี้ (ถ้ามี)' ||
            t === 'Additional description for this section (optional)' ||
            t === '本节补充说明（可选）' ||
            t === 'คำอธิบายรูปภาพหรือคำแนะนำเพิ่มเติม (ถ้ามี)' ||
            t === 'Image caption or instructions (optional)' ||
            t === '图片说明或指引（可选）' ||
            t === 'ระบุเนื้อหา รายละเอียด กฎระเบียบ หรือข้อมูลสำคัญที่ต้องการแจ้งให้ผู้ตอบฟอร์มทราบโดยไม่ต้องให้ตอบคำถาม' ||
            (t.includes('(ถ้ามี)') && t.length <= 40) ||
            (t.includes('(optional)') && t.length <= 50) ||
            (t.includes('（可选）') && t.length <= 30)
          );
        };
        const sanitizedFields = (res.data.fields || []).map((f: FormField) => {
          if (f.help_text && (isDummy(f.help_text.th) || isDummy(f.help_text.en) || isDummy(f.help_text.zh))) {
            return {
              ...f,
              help_text: { th: '', en: '', zh: '' },
            };
          }
          return f;
        });
        setFields(sanitizedFields);
        setSelectedCollaboratorIds(res.data.form.collaborator_ids || []);
      } else {
        toast.error('ไม่สามารถเปิดแบบฟอร์มได้', { description: res.error });
        router.push('/admin/forms');
      }

      if (candRes.success && candRes.data) {
        setCollaboratorCandidates(candRes.data);
      }

      setIsLoading(false);
    }
    load();
  }, [formId, router]);

  // Prompt on leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Mark changes
  const notifyChange = () => setHasUnsavedChanges(true);

  // Field Management
  const addField = (template: typeof FIELD_TEMPLATES[0]) => {
    if (!form) return;
    const newFieldKey = `field_${Date.now().toString(36)}`;
    const isNonInput = ['section_header', 'image', 'info_text'].includes(template.type);

    const newField: FormField = {
      id: crypto.randomUUID(),
      form_id: form.id,
      field_key: newFieldKey,
      label: { ...template.defaultLabel },
      help_text: { th: '', en: '', zh: '' },
      field_type: template.type,
      is_required: !isNonInput,
      image_url: null,
      sort_order: fields.length,
      width: 'full',
      options: template.defaultOptions ? JSON.parse(JSON.stringify(template.defaultOptions)) : null,
    };
    setFields([...fields, newField]);
    notifyChange();
    setMobileStudioTab('canvas');
    toast.success(`เพิ่ม "${template.title}" เรียบร้อย`);
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
    toast.success('คัดลอกช่องเรียบร้อย');
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

  // Apply Nong Fah AI Generated Form
  const handleApplyNongFahForm = (
    generated: GeneratedFormDefinition,
    mode: 'replace' | 'append'
  ) => {
    if (!form) return;

    const isReplacing = mode === 'replace' || fields.length === 0;
    const baseIndex = isReplacing ? 0 : fields.length;
    const preparedFields: FormField[] = (generated.fields || []).map((f, idx) => ({
      ...f,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f_${Date.now()}_${idx}`,
      form_id: form.id,
      field_key: f.field_key || `field_${Date.now().toString(36)}_${idx}`,
      sort_order: baseIndex + idx,
      label: f.label || { th: 'คำถาม', en: 'Question', zh: '问题' },
      help_text: f.help_text || { th: '', en: '', zh: '' },
      is_required: f.is_required ?? true,
      width: f.width || 'full',
      options: f.options ? JSON.parse(JSON.stringify(f.options)) : null,
    }));

    if (isReplacing) {
      setForm(prev => prev ? ({
        ...prev,
        title: generated.title || prev.title,
        description: generated.description || prev.description,
        category: generated.category || prev.category,
      }) : null);
      setFields(preparedFields);
      toast.success(`นำเข้าโครงสร้างจากน้องฟ้า AI สำเร็จ (${preparedFields.length} ช่องคำถาม)`, {
        description: 'กรุณากดปุ่ม "บันทึกข้อมูล" ที่มุมขวาบนเพื่อบันทึกการเปลี่ยนแปลงลงฐานข้อมูล',
      });
    } else {
      setFields(prev => [...prev, ...preparedFields]);
      toast.success(`เพิ่มช่องคำถามจากน้องฟ้า AI (+${preparedFields.length} ช่อง) ต่อท้ายเรียบร้อย`, {
        description: 'กรุณากดปุ่ม "บันทึกข้อมูล" ที่มุมขวาบนเพื่อบันทึกการเปลี่ยนแปลง',
      });
    }
    notifyChange();
  };

  // Apply Interactive Modified Fields from Nong Fah Chat
  const handleApplyModifiedFields = (modifiedFields: FormField[]) => {
    if (!form) return;
    const preparedFields: FormField[] = modifiedFields.map((f, idx) => {
      const existing = fields.find(old => old.id === f.id || (old.field_key && old.field_key === f.field_key));
      return {
        ...f,
        id: existing?.id || f.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f_${Date.now()}_${idx}`),
        form_id: form.id,
        field_key: f.field_key || existing?.field_key || `field_${Date.now().toString(36)}_${idx}`,
        sort_order: idx,
        label: f.label || { th: 'คำถาม', en: 'Question', zh: '问题' },
        help_text: f.help_text || { th: '', en: '', zh: '' },
        is_required: f.is_required ?? true,
        width: f.width || 'full',
        options: f.options ? JSON.parse(JSON.stringify(f.options)) : null,
      };
    });

    setFields(preparedFields);
    notifyChange();
    toast.success(`ปรับปรุงโครงสร้างตามคำแนะนำของน้องฟ้าเรียบร้อย (${preparedFields.length} ช่องคำถาม)`, {
      description: 'อย่าลืมกดปุ่ม "บันทึกข้อมูล" ที่มุมขวาบนเพื่อบันทึกการเปลี่ยนแปลงลงฐานข้อมูล',
    });
  };

  // Create brand-new form from Nong Fah template
  const handleCreateNewFormFromTemplate = async (template: GeneratedFormDefinition) => {
    try {
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const categorySlug = (template.category || 'form').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const toastId = toast.loading('กำลังสร้างฟอร์มใหม่จากโครงสร้างน้องฟ้า AI...');
      const res = await createForm({
        title_th: template.title?.th || 'แบบฟอร์มใหม่',
        title: template.title,
        description_th: template.description?.th,
        description: template.description,
        slug: `sv-${categorySlug}-${randomSuffix}`,
        category: template.category || 'general',
        access_type: 'public',
        initial_fields: template.fields || [],
      });
      toast.dismiss(toastId);
      if (res.success && res.data) {
        toast.success(`สร้างฟอร์มใหม่เรียบร้อยพร้อม ${template.fields?.length || 0} ช่องคำถาม!`);
        router.push(`/admin/forms/${res.data.id}/edit`);
      } else {
        toast.error('ไม่สามารถสร้างฟอร์มใหม่ได้', { description: res.error });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการสร้างฟอร์ม', { description: err.message });
    }
  };

  // Image Upload for questions and image fields
  const handleImageFieldUpload = async (index: number, file: File) => {
    setUploadingImageIndex(index);
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file, 1600, 0.85);
      }
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('formId', form?.id || 'common');

      const res = await fetch('/api/admin/forms/upload-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
      }

      updateField(index, { image_url: data.url });
      toast.success('อัปโหลดรูปภาพประกอบเรียบร้อย');
    } catch (err: any) {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ', { description: err.message });
    } finally {
      setUploadingImageIndex(null);
    }
  };

  // Banner Upload for Form
  const handleBannerUpload = async (file: File) => {
    if (!form) return;
    setIsUploadingBanner(true);
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file, 1920, 0.85);
      }
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('formId', form.id);

      const res = await fetch('/api/admin/forms/upload-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'อัปโหลดภาพแบนเนอร์ไม่สำเร็จ');
      }

      setForm(prev => prev ? { ...prev, banner_url: data.url } : null);
      notifyChange();
      toast.success('อัปโหลดภาพแบนเนอร์สำเร็จ');
    } catch (err: any) {
      toast.error('อัปโหลดแบนเนอร์ไม่สำเร็จ', { description: err.message });
    } finally {
      setIsUploadingBanner(false);
    }
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
        toast.success('แปลภาษาอัตโนมัติสำเร็จ! ตรวจสอบที่แท็บ EN และ ZH ได้ทันที', { id: toastId });
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

  // Collaborator Handlers
  const handleToggleCollaborator = (id: string) => {
    setSelectedCollaboratorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveCollaborators = async () => {
    if (!form) return;
    setIsSavingCollaborators(true);
    const res = await updateFormCollaborators(form.id, selectedCollaboratorIds);
    setIsSavingCollaborators(false);
    if (res.success) {
      toast.success(`บันทึกสิทธิ์ผู้ร่วมจัดการ (${selectedCollaboratorIds.length} ท่าน) เรียบร้อยแล้ว`);
      setForm({ ...form, collaborator_ids: selectedCollaboratorIds });
      setShowCollaboratorModal(false);
    } else {
      toast.error('บันทึกสิทธิ์ไม่สำเร็จ', { description: res.error });
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
      <header className="bg-white border-b border-slate-200 sticky top-16 z-40 px-4 sm:px-6 py-3 shadow-xs">
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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight max-w-md truncate">
                  {form.title?.th || 'แบบฟอร์มไม่มีชื่อ'}
                </h1>
                <button
                  type="button"
                  onClick={handleTogglePublish}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer shadow-2xs ${
                    form.is_published
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                  }`}
                  title={
                    form.is_published
                      ? 'ฟอร์มกำลังเปิดให้บุคคลทั่วไปเข้าใช้งาน (คลิกเพื่อปิดกลับเป็นแบบร่าง)'
                      : 'ฟอร์มยังเป็นแบบร่าง (คลิกเพื่อเผยแพร่เปิดให้บุคคลทั่วไปเข้าใช้งาน)'
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      form.is_published ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
                    }`}
                  />
                  <span>{form.is_published ? 'เผยแพร่อยู่ (ออนไลน์)' : 'แบบร่าง (คลิกเพื่อเผยแพร่)'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                <a
                  href={`/forms/${form.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#7B1C3E] underline flex items-center gap-1"
                  title="เปิดดูหน้าฟอร์มจริงในแท็บใหม่"
                >
                  <span>/forms/{form.slug}</span>
                  <ExternalLink className="w-3 h-3 inline" />
                </a>
                {hasUnsavedChanges && (
                  <span className="text-amber-600 font-sans font-semibold">● มีการแก้ไขที่ยังไม่ได้บันทึก</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* View Responses & AI Dashboard */}
            <Link
              href={`/admin/forms/${form.id}/responses`}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-xl text-xs font-bold shadow-2xs transition-all"
              title="เปิดแดชบอร์ดข้อมูลการตอบกลับและบทสรุปจากน้องฟ้า AI"
            >
              <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600" />
              <span>ดูข้อมูลตอบกลับ & บทสรุป AI</span>
            </Link>

            {/* Nong Fah AI Assistant */}
            <button
              type="button"
              onClick={() => setShowNongFahModal(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-sky-50 to-indigo-50 hover:from-sky-100 hover:to-indigo-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="ให้น้องฟ้าออกแบบโครงร่างฟอร์มให้คุณอัตโนมัติด้วย AI"
            >
              <img
                src="/images/nongfah/nongfah-avatar.png?v=5"
                alt="น้องฟ้า"
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover bg-white border border-sky-300 shrink-0"
              />
              <span>น้องฟ้า<span className="hidden sm:inline">ช่วยสร้างฟอร์ม</span></span>
            </button>

            {/* AI Translate Button */}
            <button
              onClick={handleAITranslate}
              disabled={isTranslating}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-indigo-600" />
                  <span className="hidden sm:inline">กำลังแปลด้วย AI...</span>
                  <span className="sm:hidden">กำลังแปล...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                  <span className="hidden sm:inline">แปล 3 ภาษาด้วย AI</span>
                  <span className="sm:hidden">แปล AI</span>
                </>
              )}
            </button>

            {/* In-Studio Live Preview */}
            <button
              onClick={() => {
                setPreviewLang(activeLang);
                setShowPreviewModal(true);
              }}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">ดูตัวอย่างฟอร์ม</span>
              <span className="sm:hidden">ตัวอย่าง</span>
            </button>

            {/* QR Code Sharing */}
            <button
              onClick={() => setShowQrModal(true)}
              title="สร้าง QR Code ตามดีไซน์ SV Portal"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#6E0D22]" />
              <span>QR<span className="hidden sm:inline"> Code</span></span>
            </button>

            {/* External Live Link */}
            <a
              href={`/forms/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              title="เปิดหน้าเว็บจริงในแท็บใหม่"
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </a>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:shadow disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  <span>บันทึก...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>บันทึก<span className="hidden sm:inline">แบบฟอร์ม</span></span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sub-bar: Tabs & Language Switcher */}
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
          {/* View Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('fields')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === 'fields'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              โครงสร้างฟอร์ม ({fields.length} ช่อง)
            </button>
            <button
              onClick={() => setActiveTab('quiz')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === 'quiz'
                  ? 'bg-white text-amber-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>โหมดข้อสอบ & ป้องกันทุจริต</span>
              {form?.quiz_settings?.is_quiz && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              แบนเนอร์ & สิทธิ์
            </button>
          </div>

          {/* Active Language Switcher for Studio */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-xs text-slate-500 font-medium">แก้ไขภาษา:</span>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                onClick={() => setActiveLang('th')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeLang === 'th'
                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ไทย (TH)
              </button>
              <button
                onClick={() => setActiveLang('en')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeLang === 'en'
                    ? 'bg-[#1B3A6B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline">English (</span>EN<span className="hidden sm:inline">)</span>
              </button>
              <button
                onClick={() => setActiveLang('zh')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeLang === 'zh'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline">中文 (</span>ZH<span className="hidden sm:inline">)</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Workspace Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {activeTab === 'quiz' ? (
          /* Quiz & Anti-Cheat Settings View */
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  <span>โหมดข้อสอบออนไลน์ & ป้องกันการทุจริต (Online Quiz & Anti-Cheating)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  เปลี่ยนแบบฟอร์มเป็นข้อสอบ มีระบบจับเวลานับถอยหลัง ตรวจข้อสอบอัตโนมัติ และระบบคุมสอบตรวจจับการสลับจอ
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.quiz_settings?.is_quiz ?? false}
                  onChange={(e) => {
                    const isQ = e.target.checked;
                    setForm({
                      ...form,
                      quiz_settings: {
                        is_quiz: isQ,
                        time_limit_minutes: form.quiz_settings?.time_limit_minutes ?? 30,
                        passing_score_percentage: form.quiz_settings?.passing_score_percentage ?? 60,
                        shuffle_questions: form.quiz_settings?.shuffle_questions ?? false,
                        shuffle_options: form.quiz_settings?.shuffle_options ?? false,
                        show_score_immediately: form.quiz_settings?.show_score_immediately ?? true,
                        show_correct_answers: form.quiz_settings?.show_correct_answers ?? true,
                        anti_cheat: {
                          enforce_fullscreen: form.quiz_settings?.anti_cheat?.enforce_fullscreen ?? true,
                          detect_tab_switch: form.quiz_settings?.anti_cheat?.detect_tab_switch ?? true,
                          max_tab_switches: form.quiz_settings?.anti_cheat?.max_tab_switches ?? 3,
                          block_clipboard: form.quiz_settings?.anti_cheat?.block_clipboard ?? true,
                          block_right_click: form.quiz_settings?.anti_cheat?.block_right_click ?? true,
                          block_keyboard_shortcuts: form.quiz_settings?.anti_cheat?.block_keyboard_shortcuts ?? true,
                          auto_submit_on_violation: form.quiz_settings?.anti_cheat?.auto_submit_on_violation ?? true,
                        },
                      },
                    });
                    notifyChange();
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {!form.quiz_settings?.is_quiz ? (
              <div className="text-center py-12 bg-amber-50/40 rounded-2xl border border-amber-200 p-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                  <Award className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">โหมดข้อสอบยังไม่ได้เปิดใช้งาน</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
                  เปิดสวิตช์ด้านบนเพื่อแปลงฟอร์มนี้เป็นข้อสอบออนไลน์ พร้อมระบบคำนวณคะแนนอัตโนมัติและระบบคุมสอบตรวจจับทุจริต
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      ...form,
                      quiz_settings: {
                        is_quiz: true,
                        time_limit_minutes: 30,
                        passing_score_percentage: 60,
                        shuffle_questions: false,
                        shuffle_options: false,
                        show_score_immediately: true,
                        show_correct_answers: true,
                        anti_cheat: {
                          enforce_fullscreen: true,
                          detect_tab_switch: true,
                          max_tab_switches: 3,
                          block_clipboard: true,
                          block_right_click: true,
                          block_keyboard_shortcuts: true,
                          auto_submit_on_violation: true,
                        },
                      },
                    });
                    notifyChange();
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  เปิดใช้งานโหมดข้อสอบตอนนี้
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Exam Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เวลาในการทำข้อสอบ (นาที)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={360}
                        value={form.quiz_settings?.time_limit_minutes ?? 30}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setForm({
                            ...form,
                            quiz_settings: {
                              ...form.quiz_settings!,
                              time_limit_minutes: val,
                            },
                          });
                          notifyChange();
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                        placeholder="0 = ไม่จำกัดเวลา"
                      />
                      <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      ระบุ 0 หรือเว้นว่างหากไม่ต้องการจำกัดเวลา
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เกณฑ์คะแนนผ่าน (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.quiz_settings?.passing_score_percentage ?? 60}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                          setForm({
                            ...form,
                            quiz_settings: {
                              ...form.quiz_settings!,
                              passing_score_percentage: val,
                            },
                          });
                          notifyChange();
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                      />
                      <span className="text-xs font-bold text-slate-400 absolute right-3 top-2.5">%</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      เกณฑ์เริ่มต้น 60% สำหรับสถานะสอบผ่าน
                    </span>
                  </div>
                </div>

                {/* Score and Answer Review Display */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-slate-800">การแสดงผลคะแนนและเฉลย</div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.quiz_settings?.show_score_immediately ?? true}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          quiz_settings: {
                            ...form.quiz_settings!,
                            show_score_immediately: e.target.checked,
                          },
                        });
                        notifyChange();
                      }}
                      className="rounded text-[#7B1C3E] focus:ring-[#7B1C3E] w-4 h-4"
                    />
                    <span>แสดงคะแนนสอบทันทีที่ผู้เรียนกดส่งข้อสอบ</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.quiz_settings?.show_correct_answers ?? true}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          quiz_settings: {
                            ...form.quiz_settings!,
                            show_correct_answers: e.target.checked,
                          },
                        });
                        notifyChange();
                      }}
                      className="rounded text-[#7B1C3E] focus:ring-[#7B1C3E] w-4 h-4"
                    />
                    <span>แสดงเฉลยข้อที่ถูกต้องและคำอธิบายหลังส่งข้อสอบ</span>
                  </label>
                </div>

                {/* Anti-Cheating System Settings */}
                <div className="p-5 bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-200/80 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-700" />
                    <div>
                      <h3 className="text-sm font-bold text-indigo-950">
                        ระบบป้องกันการทุจริตและการคุมสอบ (Anti-Cheating & Proctoring)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        ระบบจะตรวจจับการกระทำของผู้สอบและบันทึกลงในรายงานความซื่อสัตย์
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.quiz_settings?.anti_cheat?.enforce_fullscreen ?? true}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            quiz_settings: {
                              ...form.quiz_settings!,
                              anti_cheat: {
                                ...(form.quiz_settings?.anti_cheat || {}),
                                enforce_fullscreen: e.target.checked,
                              },
                            },
                          });
                          notifyChange();
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-600 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          บังคับเปิดแบบเต็มหน้าจอ (Enforce Fullscreen)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ผู้เรียนต้องทำข้อสอบในโหมดเต็มหน้าจอ และจะถูกแจ้งเตือนหากพยายามย่อจอ
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.quiz_settings?.anti_cheat?.detect_tab_switch ?? true}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            quiz_settings: {
                              ...form.quiz_settings!,
                              anti_cheat: {
                                ...(form.quiz_settings?.anti_cheat || {}),
                                detect_tab_switch: e.target.checked,
                              },
                            },
                          });
                          notifyChange();
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-600 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          ตรวจจับการสลับแท็บ / ยุบหน้าต่างเบราว์เซอร์ (Detect Tab Switch)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          บันทึกประวัติและจำนวนครั้งที่ออกจากหน้าจอข้อสอบ
                        </span>
                      </div>
                    </label>

                    {form.quiz_settings?.anti_cheat?.detect_tab_switch && (
                      <div className="ml-6 pl-2 border-l-2 border-indigo-200 flex items-center gap-3">
                        <span className="text-xs text-slate-600">อนุญาตให้สลับหน้าจอได้สูงสุด:</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={form.quiz_settings?.anti_cheat?.max_tab_switches ?? 3}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 3);
                            setForm({
                              ...form,
                              quiz_settings: {
                                ...form.quiz_settings!,
                                anti_cheat: {
                                  ...(form.quiz_settings?.anti_cheat || {}),
                                  max_tab_switches: val,
                                },
                              },
                            });
                            notifyChange();
                          }}
                          className="w-16 px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-center"
                        />
                        <span className="text-xs text-slate-500">ครั้ง</span>
                      </div>
                    )}

                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.quiz_settings?.anti_cheat?.block_clipboard ?? true}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            quiz_settings: {
                              ...form.quiz_settings!,
                              anti_cheat: {
                                ...(form.quiz_settings?.anti_cheat || {}),
                                block_clipboard: e.target.checked,
                              },
                            },
                          });
                          notifyChange();
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-600 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          ปิดกั้นคลิปบอร์ดและการเลือกข้อความ (Block Copy, Cut & Paste)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ไม่อนุญาตให้คัดลอกโจทย์หรือวางคำตอบจากภายนอก
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.quiz_settings?.anti_cheat?.block_right_click ?? true}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            quiz_settings: {
                              ...form.quiz_settings!,
                              anti_cheat: {
                                ...(form.quiz_settings?.anti_cheat || {}),
                                block_right_click: e.target.checked,
                              },
                            },
                          });
                          notifyChange();
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-600 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          ปิดกั้นคลิกขวา (Block Right Click)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ไม่อนุญาตให้เปิด Context Menu เพื่อค้นหาข้อความ
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.quiz_settings?.anti_cheat?.auto_submit_on_violation ?? true}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            quiz_settings: {
                              ...form.quiz_settings!,
                              anti_cheat: {
                                ...(form.quiz_settings?.anti_cheat || {}),
                                auto_submit_on_violation: e.target.checked,
                              },
                            },
                          });
                          notifyChange();
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-600 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          ส่งข้อสอบทันทีเมื่อทำผิดกฎเกินจำนวนครั้ง (Auto-Submit on Violation)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          หากผู้เรียนสลับหน้าจอเกินจำนวนที่กำหนด ระบบจะทำการตัดคะแนนและส่งข้อสอบอัตโนมัติ
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'settings' ? (
          /* Form Settings View */
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">ตั้งค่าแบบฟอร์ม (Form Settings)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                กำหนดภาพแบนเนอร์ การเข้าถึง และข้อความหลังจากผู้ตอบส่งแบบฟอร์ม
              </p>
            </div>

            {/* Banner Image Uploader */}
            <div>
              {(() => {
                const bannerVal = form.banner_url || '/images/default-form-banner.png';
                const isHidden = form.banner_url === 'none';
                const isDefault = !isHidden && (bannerVal === '/images/default-form-banner.png' || bannerVal.includes('default-form-banner.png'));

                return (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        ภาพแบนเนอร์ส่วนหัวของฟอร์ม (Header Banner Image)
                      </label>
                      {!isHidden ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDefault
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {isDefault ? 'แบนเนอร์มาตรฐานโรงเรียน' : 'แบนเนอร์กำหนดเอง'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          ปิดการแสดงแบนเนอร์
                        </span>
                      )}
                    </div>

                    {!isHidden ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 mb-3 group bg-[#E6E6D7]/40">
                        <img
                          src={bannerVal}
                          alt="Form Banner"
                          className="w-full h-44 object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-2.5 p-4">
                          <label className="px-3.5 py-1.5 bg-white text-slate-800 rounded-xl text-xs font-semibold cursor-pointer shadow-sm hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-slate-600" />
                            <span>{isDefault ? 'อัปโหลดภาพแบนเนอร์ของคุณ' : 'เปลี่ยนภาพแบนเนอร์'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingBanner}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleBannerUpload(file);
                              }}
                            />
                          </label>

                          {!isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                setForm({ ...form, banner_url: '/images/default-form-banner.png' });
                                notifyChange();
                                toast.success('คืนค่าเป็นแบนเนอร์มาตรฐานของโรงเรียนเรียบร้อย');
                              }}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>ใช้แบนเนอร์มาตรฐาน</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setForm({ ...form, banner_url: 'none' });
                              notifyChange();
                            }}
                            className="px-3.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-rose-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ไม่ใช้ภาพแบนเนอร์</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 text-center sm:text-left">
                          <div className="w-10 h-10 rounded-xl bg-slate-200/80 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">
                              ไม่ได้เปิดใช้ภาพแบนเนอร์ส่วนหัว
                            </p>
                            <p className="text-[11px] text-slate-400">
                              แบบฟอร์มนี้จะไม่แสดงภาพแบนเนอร์ด้านบน
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setForm({ ...form, banner_url: '/images/default-form-banner.png' });
                              notifyChange();
                              toast.success('เลือกใช้แบนเนอร์มาตรฐานของโรงเรียนแล้ว');
                            }}
                            className="px-3 py-1.5 bg-[#7B1C3E] text-white hover:bg-[#631430] rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            ใช้แบนเนอร์มาตรฐาน
                          </button>

                          <label className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                            อัปโหลดภาพใหม่
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingBanner}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleBannerUpload(file);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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
                  <option value="public">บุคคลภายนอก / ทั่วไป (ผู้ปกครอง, ประชาชน)</option>
                  <option value="internal_all">บุคลากรทุกคน (@somkidvittaya.ac.th)</option>
                  <option value="internal_teacher">ครูผู้สอนเท่านั้น</option>
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

            {/* Form Collaborators & Permission Controls */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-700" />
                    <span>สิทธิ์ผู้ร่วมจัดการแบบฟอร์ม (Form Collaborators)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    เฉพาะผู้สร้างและแอดมินเท่านั้นที่จะเห็นฟอร์มนี้เป็นค่าเริ่มต้น คุณสามารถมอบสิทธิ์ให้ครู/บุคลากรท่านอื่นร่วมดูแลได้
                  </p>
                </div>
                {form.can_manage_permissions && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollaboratorIds(form.collaborator_ids || []);
                      setShowCollaboratorModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold shadow-2xs transition-colors shrink-0 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>จัดการสิทธิ์ ({selectedCollaboratorIds.length} ท่าน)</span>
                  </button>
                )}
              </div>

              {selectedCollaboratorIds.length > 0 ? (
                <div className="p-4 bg-purple-50/60 border border-purple-200/80 rounded-2xl flex flex-wrap gap-2">
                  {collaboratorCandidates
                    .filter(
                      (c) =>
                        selectedCollaboratorIds.includes(c.user_id || c.id) ||
                        selectedCollaboratorIds.includes(c.id)
                    )
                    .map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-white border border-purple-200 rounded-xl text-xs font-medium text-purple-950 shadow-2xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>{c.name_th}</span>
                        <span className="text-[10px] text-purple-600">({c.position_th})</span>
                      </span>
                    ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 text-center">
                  ยังไม่มีการมอบสิทธิ์ให้ผู้อื่น (มีเฉพาะคุณในฐานะผู้สร้างและผู้ดูแลระบบเท่านั้นที่เข้าถึงฟอร์มนี้ได้)
                </div>
              )}
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
          <div>
            {/* Mobile Tab Switcher between Canvas and Toolbox */}
            <div className="lg:hidden flex items-center bg-slate-200/80 p-1 rounded-2xl mb-4 text-xs font-bold shadow-inner">
              <button
                type="button"
                onClick={() => setMobileStudioTab('canvas')}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mobileStudioTab === 'canvas'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-[#7B1C3E]" />
                <span>หน้าฟอร์ม ({fields.length} ช่อง)</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileStudioTab('toolbox')}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mobileStudioTab === 'toolbox'
                    ? 'bg-white text-[#7B1C3E] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-[#7B1C3E]" />
                <span>กล่องเครื่องมือ (+เพิ่ม)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Toolbox (4 cols) */}
              <div className={`lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs sticky top-28 ${
                mobileStudioTab === 'toolbox' ? 'block' : 'hidden lg:block'
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4 text-[#7B1C3E]" />
                <h3 className="text-sm font-bold text-slate-900">เพิ่มองค์ประกอบฟอร์ม</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                เลือกเครื่องมือที่ต้องการเพื่อเพิ่มลงในแบบฟอร์ม
              </p>

              <div className="space-y-4 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
                {/* Nong Fah AI Form Generator Card */}
                <div className="p-3.5 bg-gradient-to-br from-sky-50 to-indigo-50/60 border border-sky-200/90 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-sky-950">น้องฟ้าช่วยสร้างฟอร์ม</span>
                  </div>
                  <p className="text-[11px] text-sky-800/80 leading-relaxed mb-2.5">
                    ระบุความต้องการ ให้น้องฟ้า AI วางโครงสร้างคำถามให้คุณทันที
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNongFahModal(true)}
                    className="w-full py-1.5 px-3 bg-white hover:bg-sky-100/70 text-sky-800 border border-sky-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5 text-sky-600" />
                    <span>เปิดผู้ช่วยน้องฟ้า</span>
                  </button>
                </div>

                {/* Category 1: Layout & Information Elements */}
                <div>
                  <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span>ข้อมูลและสื่อ (Content / Media)</span>
                  </div>
                  <div className="space-y-1.5">
                    {FIELD_TEMPLATES.filter(t => t.category === 'layout').map((tmpl) => {
                      const Icon = tmpl.icon;
                      return (
                        <button
                          key={tmpl.type}
                          onClick={() => addField(tmpl)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-indigo-100 hover:border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50 text-left transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 group-hover:text-indigo-800 transition-colors shrink-0 shadow-2xs">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-900 transition-colors">
                              {tmpl.title}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category 2: Input Questions */}
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span>ช่องคำถามให้ผู้ตอบกรอก (Questions)</span>
                  </div>
                  <div className="space-y-1.5">
                    {FIELD_TEMPLATES.filter(t => t.category === 'input').map((tmpl) => {
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
              </div>
            </div>

            {/* Right Column: Canvas / Fields List (8 cols) */}
            <div className={`lg:col-span-8 space-y-4 ${
              mobileStudioTab === 'canvas' ? 'block' : 'hidden lg:block'
            }`}>
              {/* Header card preview with inline editing */}
              <div className="bg-white rounded-2xl border-t-4 border-t-[#7B1C3E] border border-slate-200 p-6 shadow-xs relative overflow-hidden">
                {form.banner_url !== 'none' && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-[#E6E6D7]/30">
                    <img
                      src={form.banner_url || '/images/default-form-banner.png'}
                      alt="Banner"
                      className="w-full h-36 object-cover object-center"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-semibold text-[#7B1C3E] mb-2">
                  <span>โรงเรียนสมคิดวิทยา (Somkidvittaya School)</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    ภาษาที่กำลังแก้ไข: <strong className="text-slate-700">{activeLang.toUpperCase()}</strong>
                  </span>
                </div>

                {/* Inline Title input */}
                <input
                  type="text"
                  value={form.title?.[activeLang] || ''}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      title: { ...form.title, [activeLang]: e.target.value }
                    });
                    notifyChange();
                  }}
                  placeholder={`ชื่อแบบฟอร์มภาษา ${activeLang.toUpperCase()}...`}
                  className="w-full text-xl sm:text-2xl font-bold text-slate-900 border-b border-transparent hover:border-slate-200 focus:border-[#7B1C3E] focus:outline-none py-1 bg-transparent transition-colors"
                />

                {/* Inline Description textarea */}
                <textarea
                  rows={2}
                  value={form.description?.[activeLang] || ''}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      description: { ...(form.description || { th: '' }), [activeLang]: e.target.value }
                    });
                    notifyChange();
                  }}
                  placeholder={`คำชี้แจง / รายละเอียดส่วนหัวของแบบฟอร์มภาษา ${activeLang.toUpperCase()}...`}
                  className="w-full text-xs text-slate-600 mt-2 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#7B1C3E] focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Empty state */}
              {fields.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto text-sky-600 mb-3 shadow-2xs">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">ยังไม่มีองค์ประกอบในฟอร์ม</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                    คลิกเลือกเครื่องมือด้านซ้าย หรือให้น้องฟ้า AI ช่วยวางโครงร่างแบบฟอร์มให้คุณอย่างรวดเร็ว
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNongFahModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>ให้น้องฟ้าช่วยสร้างฟอร์ม</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Fields list */}
                  {fields.map((field, index) => {
                  const tmpl = FIELD_TEMPLATES.find(t => t.type === field.field_type) || FIELD_TEMPLATES[0];
                  const Icon = tmpl.icon;
                  const hasOptions = ['radio', 'checkbox', 'select'].includes(field.field_type);
                  const isHeader = field.field_type === 'section_header';
                  const isImage = field.field_type === 'image';
                  const isInfoText = field.field_type === 'info_text';
                  const isNonInput = isHeader || isImage || isInfoText;

                  return (
                    <motion.div
                      key={field.id || index}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white rounded-2xl border transition-all shadow-xs ${
                        isHeader
                          ? 'border-indigo-300 bg-indigo-50/20'
                          : isInfoText
                          ? 'border-blue-200 bg-blue-50/15'
                          : isImage
                          ? 'border-rose-200 bg-rose-50/10'
                          : 'border-slate-200 hover:border-slate-300'
                      } p-5`}
                    >
                      {/* Field Top Actions */}
                      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold font-mono">
                            {index + 1}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isNonInput ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
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

                      {/* Special Editor for Image Field */}
                      {isImage && (
                        <div className="space-y-4 mb-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              เลือกรูปภาพ / โปสเตอร์ / QR Code
                            </label>
                            {field.image_url ? (
                              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex items-center justify-center">
                                <img
                                  src={field.image_url}
                                  alt="Field Image"
                                  className="max-h-56 w-auto object-contain rounded-xl"
                                />
                                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                  <label className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg cursor-pointer transition-colors" title="เปลี่ยนรูปภาพ">
                                    <Upload className="w-3.5 h-3.5" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageFieldUpload(index, file);
                                      }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => updateField(index, { image_url: null })}
                                    className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
                                    title="ลบรูปภาพ"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-slate-200 hover:border-[#7B1C3E] rounded-2xl p-5 text-center bg-slate-50/50">
                                <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1 mb-3 inline-block font-medium">
                                  ยังไม่ได้อัปโหลดรูปภาพ (ช่องนี้จะไม่แสดงในหน้าฟอร์มจริงจนกว่าจะอัปโหลดภาพ)
                                </div>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                  <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-2xs transition-colors">
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>{uploadingImageIndex === index ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปภาพ / QR Code'}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      disabled={uploadingImageIndex === index}
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageFieldUpload(index, file);
                                      }}
                                    />
                                  </label>
                                  <span className="text-xs text-slate-400">หรือวาง URL:</span>
                                  <input
                                    type="url"
                                    placeholder="https://..."
                                    value={field.image_url || ''}
                                    onChange={(e) => updateField(index, { image_url: e.target.value })}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono w-full sm:w-60 focus:outline-none focus:ring-1 focus:ring-[#7B1C3E]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Field Label & Help Text */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {isHeader
                              ? 'ชื่อหัวข้อคั่นส่วน'
                              : isInfoText
                              ? 'หัวข้อของข้อความชี้แจง / รายละเอียด'
                              : isImage
                              ? 'คำบรรยายภาพ / ชื่อรูปภาพ'
                              : 'ข้อความคำถาม'} ({activeLang.toUpperCase()})
                          </label>
                          <input
                            type="text"
                            value={field.label?.[activeLang] || ''}
                            onChange={(e) => updateFieldLabel(index, e.target.value)}
                            placeholder={`ระบุข้อความภาษา ${activeLang.toUpperCase()}...`}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                          />
                        </div>

                        {/* Help text / Detail text */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">
                            {isInfoText
                              ? 'เนื้อหารายละเอียดชี้แจง / ข้อกำหนด (Paragraph Details)'
                              : 'คำอธิบายเพิ่มเติม / คำแนะนำใต้ช่อง (Help text)'} ({activeLang.toUpperCase()})
                          </label>
                          {isInfoText ? (
                            <textarea
                              rows={3}
                              value={field.help_text?.[activeLang] || ''}
                              onChange={(e) => updateFieldHelpText(index, e.target.value)}
                              placeholder={`ระบุเนื้อหารายละเอียด ข้อกำหนด กฎระเบียบภาษา ${activeLang.toUpperCase()}...`}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white leading-relaxed resize-y"
                            />
                          ) : (
                            <input
                              type="text"
                              value={field.help_text?.[activeLang] || ''}
                              onChange={(e) => updateFieldHelpText(index, e.target.value)}
                              placeholder={`คำอธิบายเพิ่มเติม (ถ้ามี)...`}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
                            />
                          )}
                        </div>

                        {/* Question Image Attachment for regular questions */}
                        {!isImage && !isHeader && (
                          <div className="pt-2 pb-1 border-t border-slate-100">
                            {field.image_url ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                    <ImageIcon className="w-3.5 h-3.5 text-[#7B1C3E]" />
                                    <span>รูปภาพประกอบโจทย์ / คำถาม</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateField(index, { image_url: null })}
                                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    ลบรูปภาพออก
                                  </button>
                                </div>
                                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2.5 flex flex-col sm:flex-row items-center gap-3">
                                  <div className="relative max-h-48 max-w-xs shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center p-1 shadow-2xs">
                                    <img
                                      src={field.image_url}
                                      alt="Question illustration"
                                      className="max-h-40 w-auto object-contain rounded-lg"
                                    />
                                  </div>
                                  <div className="flex-1 w-full space-y-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-2xs transition-colors">
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>{uploadingImageIndex === index ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปภาพใหม่'}</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          disabled={uploadingImageIndex === index}
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImageFieldUpload(index, file);
                                          }}
                                        />
                                      </label>
                                      <a
                                        href={field.image_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-medium"
                                      >
                                        <Eye className="w-3 h-3" />
                                        ดูภาพเต็ม
                                      </a>
                                    </div>
                                    <div>
                                      <span className="text-[11px] text-slate-500 block mb-1">ลิงก์ URL รูปภาพ:</span>
                                      <input
                                        type="url"
                                        placeholder="https://..."
                                        value={field.image_url || ''}
                                        onChange={(e) => updateField(index, { image_url: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#7B1C3E]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 hover:border-[#7B1C3E] bg-slate-50/80 hover:bg-rose-50/40 text-slate-600 hover:text-[#7B1C3E] text-xs font-medium cursor-pointer transition-all">
                                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{uploadingImageIndex === index ? 'กำลังอัปโหลดรูปภาพ...' : '+ แนบรูปภาพประกอบโจทย์'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={uploadingImageIndex === index}
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleImageFieldUpload(index, file);
                                    }}
                                  />
                                </label>
                                <span className="text-[11px] text-slate-400">หรือวาง URL:</span>
                                <input
                                  type="url"
                                  placeholder="https://... (วางลิงก์รูปภาพ)"
                                  value={field.image_url || ''}
                                  onChange={(e) => updateField(index, { image_url: e.target.value })}
                                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono w-44 sm:w-60 focus:outline-none focus:ring-1 focus:ring-[#7B1C3E]"
                                />
                              </div>
                            )}
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
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 mt-3 border-t border-slate-100 text-xs">
                          {!isNonInput ? (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.is_required}
                                onChange={(e) => updateField(index, { is_required: e.target.checked })}
                                className="rounded text-[#7B1C3E] focus:ring-[#7B1C3E] w-4 h-4"
                              />
                              <span className="font-semibold text-slate-700">จำเป็นต้องตอบ (Required)</span>
                            </label>
                          ) : (
                            <span className="text-xs text-indigo-700 font-medium">
                              {isHeader ? 'หัวข้อแบ่งส่วน' : isInfoText ? 'กล่องข้อมูลชี้แจง' : 'รูปภาพประกอบ'} (ไม่บังคับตอบ)
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">ความกว้างการแสดงผล:</span>
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

                        {/* Answer Key & Scoring for Quiz Mode */}
                        {form.quiz_settings?.is_quiz && !isNonInput && (
                          <div className="mt-4 pt-3 border-t border-amber-200/80 bg-amber-50/50 rounded-xl p-3.5 border text-xs space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                <Award className="w-4 h-4 text-amber-600" />
                                <span>เฉลยคำตอบและกำหนดคะแนน (Answer Key & Scoring)</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-600 font-medium">คะแนน:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={field.quiz_config?.points ?? 1}
                                  onChange={(e) => {
                                    const pts = Math.max(0, parseInt(e.target.value) || 0);
                                    updateField(index, {
                                      quiz_config: {
                                        ...(field.quiz_config || {}),
                                        points: pts,
                                      },
                                    });
                                  }}
                                  className="w-16 px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900 text-center focus:ring-1 focus:ring-amber-500"
                                />
                                <span className="text-slate-500">คะแนน</span>
                              </div>
                            </div>

                            {/* Select / Radio / Checkbox: Choose correct option */}
                            {hasOptions && field.options && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-semibold text-slate-700">
                                  เลือกคำตอบที่ถูกต้อง ({field.field_type === 'checkbox' ? 'เลือกได้หลายข้อ' : 'เลือกข้อที่ถูกต้อง 1 ข้อ'}):
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {field.options.map((opt) => {
                                    const isCorrect = (field.quiz_config?.correct_answers || []).includes(opt.value);
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                          const cur = field.quiz_config?.correct_answers || [];
                                          let updated: string[];
                                          if (field.field_type === 'checkbox') {
                                            updated = isCorrect ? cur.filter((v) => v !== opt.value) : [...cur, opt.value];
                                          } else {
                                            updated = [opt.value];
                                          }
                                          updateField(index, {
                                            quiz_config: {
                                              ...(field.quiz_config || {}),
                                              correct_answers: updated,
                                            },
                                          });
                                        }}
                                        className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                                          isCorrect
                                            ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className="truncate">{opt.label[activeLang] || opt.label.th}</span>
                                        {isCorrect ? (
                                          <Check className="w-4 h-4 text-emerald-700 shrink-0 ml-1" />
                                        ) : (
                                          <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 ml-1" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Text / Number: Exact Match Answer Input */}
                            {(field.field_type === 'text' || field.field_type === 'number') && (
                              <div className="space-y-1">
                                <div className="text-[11px] font-semibold text-slate-700">
                                  คำตอบที่ถูกต้อง (ระบุข้อความหรือตัวเลขที่ถูกต้อง คั่นด้วยเครื่องหมายจุลภาค , หากมีหลายคำตอบ):
                                </div>
                                <input
                                  type="text"
                                  value={(field.quiz_config?.correct_answers || []).join(', ')}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const arr = raw.split(',').map((s) => s.trim()).filter(Boolean);
                                    updateField(index, {
                                      quiz_config: {
                                        ...(field.quiz_config || {}),
                                        correct_answers: arr,
                                      },
                                    });
                                  }}
                                  placeholder="เช่น คำตอบที่ 1, คำตอบที่ 2"
                                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            )}

                            {/* Explanation / Rationale */}
                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-slate-700">
                                คำอธิบายเฉลย / ข้อคิดเห็น (แสดงให้ผู้เรียนดูหลังส่งข้อสอบ):
                              </div>
                              <input
                                type="text"
                                value={field.quiz_config?.explanation?.[activeLang] || ''}
                                onChange={(e) => {
                                  updateField(index, {
                                    quiz_config: {
                                      ...(field.quiz_config || {}),
                                      explanation: {
                                        ...(field.quiz_config?.explanation || { th: '' }),
                                        [activeLang]: e.target.value,
                                      },
                                    },
                                  });
                                }}
                                placeholder={`คำอธิบายเฉลยภาษา ${activeLang.toUpperCase()}...`}
                                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Mobile Add Element Button */}
                <button
                  type="button"
                  onClick={() => setMobileStudioTab('toolbox')}
                  className="w-full py-3.5 border-2 border-dashed border-[#7B1C3E]/30 hover:border-[#7B1C3E] bg-[#7B1C3E]/5 hover:bg-[#7B1C3E]/10 text-[#7B1C3E] font-bold rounded-2xl text-xs flex items-center justify-center gap-2 lg:hidden transition-all cursor-pointer shadow-2xs mt-4"
                >
                  <Plus className="w-4 h-4" />
                  <span>แตะเพื่อเพิ่มช่องคำถาม / สื่อ (เปิดกล่องเครื่องมือ)</span>
                </button>
              </>
            )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Modal: Live Studio Interactive Preview */}
      <AnimatePresence>
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-100 rounded-3xl w-full max-w-4xl h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
            >
              {/* Preview Modal Header */}
              <div className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.5 rounded-lg transition-colors ${previewDevice === 'desktop' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                      title="Desktop View"
                    >
                      <Monitor className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.5 rounded-lg transition-colors ${previewDevice === 'mobile' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                      title="Mobile View"
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
                    ตัวอย่างฟอร์มจริง (Live Preview)
                  </span>
                </div>

                {/* Preview Language Toggle */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-xs font-bold">
                    <button
                      onClick={() => setPreviewLang('th')}
                      className={`px-2.5 py-1 rounded-lg ${previewLang === 'th' ? 'bg-white text-[#7B1C3E] shadow-xs' : 'text-slate-600'}`}
                    >
                      TH
                    </button>
                    <button
                      onClick={() => setPreviewLang('en')}
                      className={`px-2.5 py-1 rounded-lg ${previewLang === 'en' ? 'bg-white text-[#1B3A6B] shadow-xs' : 'text-slate-600'}`}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => setPreviewLang('zh')}
                      className={`px-2.5 py-1 rounded-lg ${previewLang === 'zh' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'}`}
                    >
                      ZH
                    </button>
                  </div>

                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Preview Content Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-[#F5F4F2]">
                <div className={`w-full transition-all duration-300 ${
                  previewDevice === 'mobile' ? 'max-w-md shadow-2xl rounded-3xl bg-white overflow-hidden my-auto' : 'max-w-3xl'
                }`}>
                  {/* CI Header */}
                  <div className="bg-[#7B1C3E] text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img src="/logo2.png" alt="Logo" className="h-8 w-auto brightness-0 invert" />
                      <div className="border-l border-white/25 pl-2.5">
                        <div className="text-xs font-bold">โรงเรียนสมคิดวิทยา</div>
                        <div className="text-[10px] text-white/80">Somkidvittaya School</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20">
                      {previewLang.toUpperCase()}
                    </span>
                  </div>

                  {/* Form Container */}
                  <div className="p-5 sm:p-6 space-y-5 bg-[#F5F4F2]">
                    {/* Header Banner */}
                    {form.banner_url !== 'none' && (
                      <div className="w-full rounded-2xl overflow-hidden border border-slate-200 bg-[#E6E6D7]/30">
                        <img
                          src={form.banner_url || '/images/default-form-banner.png'}
                          alt="Banner"
                          className="w-full max-h-48 object-cover object-center"
                        />
                      </div>
                    )}

                    {/* Title card */}
                    <div className="bg-white rounded-2xl border-t-6 border-t-[#7B1C3E] border border-slate-200 p-5 shadow-xs">
                      <h2 className="text-xl font-bold text-slate-900">
                        {form.title?.[previewLang] || form.title?.th || 'แบบฟอร์ม'}
                      </h2>
                      {(form.description?.[previewLang] || form.description?.th) && (
                        <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed">
                          {form.description?.[previewLang] || form.description?.th}
                        </p>
                      )}
                    </div>

                    {/* Fields in Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fields.map((field) => {
                        const lbl = field.label?.[previewLang] || field.label?.th;
                        const rawHlp = field.help_text?.[previewLang] || field.help_text?.th;
                        const isDummy = (txt?: string | null) => {
                          if (!txt) return false;
                          const t = txt.trim();
                          return (
                            t === 'คำอธิบายเพิ่มเติมสำหรับส่วนนี้ (ถ้ามี)' ||
                            t === 'Additional description for this section (optional)' ||
                            t === '本节补充说明（可选）' ||
                            t === 'คำอธิบายรูปภาพหรือคำแนะนำเพิ่มเติม (ถ้ามี)' ||
                            t === 'Image caption or instructions (optional)' ||
                            t === '图片说明或指引（可选）' ||
                            t === 'ระบุเนื้อหา รายละเอียด กฎระเบียบ หรือข้อมูลสำคัญที่ต้องการแจ้งให้ผู้ตอบฟอร์มทราบโดยไม่ต้องให้ตอบคำถาม' ||
                            (t.includes('(ถ้ามี)') && t.length <= 40) ||
                            (t.includes('(optional)') && t.length <= 50) ||
                            (t.includes('（可选）') && t.length <= 30)
                          );
                        };
                        const hlp = isDummy(rawHlp) ? '' : rawHlp;
                        const colClass = field.width === 'half' ? 'sm:col-span-1' : 'col-span-full';

                        if (field.field_type === 'section_header') {
                          return (
                            <div key={field.id} className="col-span-full bg-[#1B3A6B] text-white p-4 rounded-xl border-l-4 border-l-[#7B1C3E]">
                              <h3 className="text-base font-bold">{lbl}</h3>
                              {hlp && <p className="text-xs text-white/80 mt-1">{hlp}</p>}
                            </div>
                          );
                        }

                        if (field.field_type === 'info_text') {
                          const isDummyTitle = lbl === 'ข้อความชี้แจง / เงื่อนไขและรายละเอียด' || lbl === 'Information & Guidelines' || lbl === '须知与说明' || lbl === 'ข้อความชี้แจง';
                          if (isDummyTitle && !hlp) return null;

                          return (
                            <div key={field.id} className={`${colClass} bg-indigo-50/60 border border-indigo-100 p-4 rounded-xl`}>
                              <div className="flex items-start gap-2.5">
                                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                <div>
                                  {lbl && !isDummyTitle && <h4 className="text-sm font-bold text-slate-900">{lbl}</h4>}
                                  {hlp && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap leading-relaxed">{hlp}</p>}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (field.field_type === 'image') {
                          if (!field.image_url) {
                            return (
                              <div key={field.id} className={`${colClass} bg-amber-50/70 border border-dashed border-amber-300 p-3 rounded-xl text-center text-xs text-amber-800`}>
                                ช่องรูปภาพยังไม่ได้อัปโหลดภาพ (จะไม่แสดงในหน้าฟอร์มจริง)
                              </div>
                            );
                          }
                          const isDummyTitle = lbl === 'รูปภาพประกอบ / โปสเตอร์กิจกรรม' || lbl === 'Illustration / Event Poster' || lbl === '活动海报 / 插图' || lbl === 'รูปภาพประกอบ';
                          return (
                            <div key={field.id} className={`${colClass} bg-white border border-slate-200 p-4 rounded-xl`}>
                              {lbl && !isDummyTitle && <h4 className="text-sm font-bold text-slate-900 mb-2">{lbl}</h4>}
                              <img src={field.image_url} alt="Image" className="max-h-60 w-auto mx-auto object-contain rounded-lg" />
                              {hlp && <p className="text-xs text-slate-500 mt-2">{hlp}</p>}
                            </div>
                          );
                        }

                        return (
                          <div key={field.id} className={`${colClass} bg-white border border-slate-200 p-4 rounded-xl shadow-2xs`}>
                            <label className="block text-xs font-bold text-slate-800 mb-1">
                              {lbl} {field.is_required && <span className="text-rose-500">*</span>}
                            </label>
                            {hlp && <p className="text-[11px] text-slate-500 mb-2">{hlp}</p>}
                            {field.image_url && (
                              <div className="mb-2.5 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center p-1.5">
                                <img src={field.image_url} alt="Question illustration" className="max-h-48 w-auto object-contain rounded" />
                              </div>
                            )}
                            <div className="h-8 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3 text-xs text-slate-400">
                              ตัวอย่างช่องกรอกข้อมูล ({field.field_type})
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Collaborator Assignment */}
      <AnimatePresence>
        {showCollaboratorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col relative text-slate-800"
            >
              <button
                type="button"
                onClick={() => setShowCollaboratorModal(false)}
                className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    กำหนดสิทธิ์ผู้ร่วมจัดการแบบฟอร์ม
                  </h3>
                  <p className="text-xs text-slate-500">
                    ฟอร์ม: {form.title?.th || form.slug}
                  </p>
                </div>
              </div>

              {/* Guidance Info Card */}
              <div className="bg-purple-50/80 border border-purple-200/90 rounded-2xl p-3.5 my-3.5 text-xs text-purple-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong>ความปลอดภัยของข้อมูล:</strong> ตามค่าเริ่มต้น ฟอร์มจะแสดงเฉพาะ<strong>ผู้สร้างและแอดมิน</strong>เท่านั้น คุณสามารถเลือกครูหรือบุคลากรท่านอื่นเพื่อให้สิทธิ์<strong>มองเห็นแบบฟอร์มนี้ในระบบ ตรวจสอบผลการตอบกลับ และร่วมแก้ไขฟอร์มได้</strong>
                </div>
              </div>

              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อครู, ตำแหน่ง, อีเมล..."
                    value={collaboratorSearchQuery}
                    onChange={(e) => setCollaboratorSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="text-xs font-bold text-purple-900 bg-purple-100 px-2.5 py-1 rounded-lg">
                    เลือกแล้ว {selectedCollaboratorIds.length} ท่าน
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCollaboratorIds(
                          collaboratorCandidates.map((c) => c.user_id || c.id)
                        )
                      }
                      className="px-2 py-1 text-purple-700 hover:bg-purple-50 rounded font-semibold cursor-pointer"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCollaboratorIds([])}
                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded font-semibold cursor-pointer"
                    >
                      ล้างค่า
                    </button>
                  </div>
                </div>
              </div>

              {/* Candidates Checklist */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[44vh]">
                {collaboratorCandidates
                  .filter((c) => {
                    const q = collaboratorSearchQuery.toLowerCase();
                    return (
                      !q ||
                      c.name_th?.toLowerCase().includes(q) ||
                      c.name_en?.toLowerCase().includes(q) ||
                      c.position_th?.toLowerCase().includes(q) ||
                      c.email?.toLowerCase().includes(q)
                    );
                  })
                  .map((c) => {
                    const lookupKey = c.user_id || c.id;
                    const isSelected =
                      selectedCollaboratorIds.includes(lookupKey) ||
                      selectedCollaboratorIds.includes(c.id);

                    return (
                      <div
                        key={c.id}
                        onClick={() => handleToggleCollaborator(lookupKey)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-purple-50/90 border-purple-300 ring-1 ring-purple-400 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                            {c.image_url ? (
                              <img
                                src={c.image_url}
                                alt={c.name_th}
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <User className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {c.name_th}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{c.position_th}</div>
                            {c.email && (
                              <div className="text-[10px] text-purple-700 font-mono truncate">{c.email}</div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 pr-1">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-lg border-2 border-slate-300 flex items-center justify-center bg-white" />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCollaboratorModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSavingCollaborators}
                  onClick={handleSaveCollaborators}
                  className="py-2.5 px-6 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingCollaborators ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึกสิทธิ์...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>บันทึกสิทธิ์ ({selectedCollaboratorIds.length} ท่าน)</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Form QR Code Modal (SV Portal Style) */}
      <FormQRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        formTitle={form.title[activeLang] || form.title.th || 'แบบฟอร์ม'}
        formSlug={form.slug}
      />

      {/* Nong Fah AI Form Studio Modal */}
      <NongFahStudioModal
        isOpen={showNongFahModal}
        onClose={() => setShowNongFahModal(false)}
        onApplyForm={handleApplyNongFahForm}
      />

      {/* Interactive Bottom-Right Nong Fah Chat Widget */}
      <NongFahChatWidget
        formTitle={form.title[activeLang] || form.title.th}
        pageContext="editor"
        currentFields={fields}
        onApplyForm={handleApplyNongFahForm}
        onApplyModifiedFields={handleApplyModifiedFields}
        onCreateFromTemplate={handleCreateNewFormFromTemplate}
        onOpenStudio={() => setShowNongFahModal(true)}
      />
    </div>
  );
}
