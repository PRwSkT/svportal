'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FormDefinition, FormField, SupportedLang } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/image-compression';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, AlertCircle, Upload, Star, Check, Globe,
  Lock, ArrowRight, Loader2, RefreshCw, FileText, ChevronRight
} from 'lucide-react';

const UI_TEXT: Record<SupportedLang, {
  schoolName: string;
  subTitle: string;
  requiredBadge: string;
  selectPlaceholder: string;
  uploadButton: string;
  uploading: string;
  submitButton: string;
  submitting: string;
  submitSuccessTitle: string;
  submitSuccessDesc: string;
  submitAnother: string;
  internalOnlyTitle: string;
  internalOnlyDesc: string;
  loginButton: string;
  validationError: string;
}> = {
  th: {
    schoolName: 'โรงเรียนสมคิดวิทยา',
    subTitle: 'อ.เมือง จ.ระยอง (Somkidvittaya School)',
    requiredBadge: 'จำเป็นต้องกรอก',
    selectPlaceholder: '-- โปรดเลือก --',
    uploadButton: 'เลือกไฟล์หรือสลิปเพื่ออัปโหลด',
    uploading: 'กำลังอัปโหลดไฟล์...',
    submitButton: 'ส่งแบบฟอร์ม',
    submitting: 'กำลังส่งข้อมูล...',
    submitSuccessTitle: 'ส่งแบบฟอร์มเรียบร้อยแล้ว',
    submitSuccessDesc: 'ระบบได้รับข้อมูลของท่านเรียบร้อยแล้ว ขอบคุณสำหรับความร่วมมือ',
    submitAnother: 'ส่งคำตอบเพิ่มเติมอีกครั้ง',
    internalOnlyTitle: 'แบบฟอร์มเฉพาะบุคลากรภายใน',
    internalOnlyDesc: 'แบบฟอร์มนี้สงวนสิทธิ์สำหรับครูและบุคลากรโรงเรียนสมคิดวิทยาเท่านั้น กรุณาเข้าสู่ระบบด้วยบัญชี @somkidvittaya.ac.th',
    loginButton: 'เข้าสู่ระบบสำหรับบุคลากร',
    validationError: 'กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วน',
  },
  en: {
    schoolName: 'Somkidvittaya School',
    subTitle: 'Rayong, Thailand',
    requiredBadge: 'Required',
    selectPlaceholder: '-- Please Select --',
    uploadButton: 'Choose file or receipt slip to upload',
    uploading: 'Uploading file...',
    submitButton: 'Submit Form',
    submitting: 'Submitting...',
    submitSuccessTitle: 'Form Submitted Successfully',
    submitSuccessDesc: 'Your response has been recorded. Thank you for your cooperation.',
    submitAnother: 'Submit another response',
    internalOnlyTitle: 'Internal Access Only',
    internalOnlyDesc: 'This form is restricted to Somkidvittaya School personnel only. Please sign in with your @somkidvittaya.ac.th account.',
    loginButton: 'Sign in to access',
    validationError: 'Please fill in all required fields.',
  },
  zh: {
    schoolName: '松吉威提雅学校 (Somkidvittaya School)',
    subTitle: '泰国罗勇府',
    requiredBadge: '必填项',
    selectPlaceholder: '-- 请选择 --',
    uploadButton: '选择文件或汇款凭证上传',
    uploading: '正在上传文件...',
    submitButton: '提交表单',
    submitting: '正在提交...',
    submitSuccessTitle: '表单提交成功',
    submitSuccessDesc: '我们已收到您的答复。感谢您的支持与配合！',
    submitAnother: '再提交一份答复',
    internalOnlyTitle: '仅限校内人员访问',
    internalOnlyDesc: '本表单仅限松吉威提雅学校教职员工填写，请使用 @somkidvittaya.ac.th 账号登录。',
    loginButton: '教职工登录',
    validationError: '请完整填写所有必填项目。',
  },
};

interface FormViewerProps {
  initialForm: FormDefinition;
  initialFields: FormField[];
  currentUser: { id: string; email: string } | null;
}

export default function FormViewerClient({
  initialForm,
  initialFields,
  currentUser,
}: FormViewerProps) {
  const [lang, setLang] = useState<SupportedLang>('th');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<Record<string, string>>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const supabase = createClient();
  const t = UI_TEXT[lang];

  // Helper to safely get localized text
  const getLocalized = (obj?: { th: string; en?: string; zh?: string } | null, fallback = '') => {
    if (!obj) return fallback;
    return obj[lang] || obj.th || fallback;
  };

  // Internal permission check
  const isInternal = initialForm.access_type !== 'public';
  if (isInternal && !currentUser) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <Image
            src="/logo2.png"
            alt="School Logo"
            width={120}
            height={60}
            className="h-12 w-auto mx-auto mb-4 object-contain"
          />
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t.internalOnlyTitle}</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">{t.internalOnlyDesc}</p>
          <Link
            href={`/login?redirect=/forms/${initialForm.slug}`}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl font-semibold shadow-sm transition-all"
          >
            <span>{t.loginButton}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Handle Input Changes
  const handleInputChange = (fieldKey: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [fieldKey]: value }));
    if (validationErrors[fieldKey]) {
      setValidationErrors((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  // Handle Checkbox Toggles
  const handleCheckboxToggle = (fieldKey: string, optionValue: string) => {
    const cur = (answers[fieldKey] as string[]) || [];
    let updated: string[];
    if (cur.includes(optionValue)) {
      updated = cur.filter((v) => v !== optionValue);
    } else {
      updated = [...cur, optionValue];
    }
    handleInputChange(fieldKey, updated);
  };

  // Handle File Upload to Supabase Storage
  const handleFileUpload = async (fieldKey: string, file: File) => {
    setUploadingField(fieldKey);
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file, 1600, 0.85);
      }

      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${initialForm.id}/${fieldKey}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('form-attachments')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('form-attachments')
        .getPublicUrl(data.path);

      const url = publicUrlData.publicUrl;
      setAttachments((prev) => ({ ...prev, [fieldKey]: url }));
      handleInputChange(fieldKey, url);
      toast.success(lang === 'th' ? 'อัปโหลดไฟล์เรียบร้อยแล้ว' : lang === 'en' ? 'File uploaded successfully' : '文件上传成功');
    } catch (err: any) {
      console.error('File upload error:', err);
      toast.error(lang === 'th' ? 'อัปโหลดไฟล์ล้มเหลว' : 'Upload failed', { description: err.message });
    } finally {
      setUploadingField(null);
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validation check
    const errors: Record<string, boolean> = {};
    let hasError = false;

    for (const field of initialFields) {
      if (field.is_required && field.field_type !== 'section_header') {
        const val = answers[field.field_key];
        const isEmpty =
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0);

        if (isEmpty) {
          errors[field.field_key] = true;
          hasError = true;
        }
      }
    }

    if (hasError) {
      setValidationErrors(errors);
      toast.error(t.validationError);
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0];
      const el = document.getElementById(`field-${firstErrorKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // 2. Submit to API
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${initialForm.slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          attachments: Object.values(attachments),
          lang,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(err.message || 'Error submitting form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Thank You / Success View
  if (isSubmitted) {
    const thankTitle = getLocalized(initialForm.thank_you_title, t.submitSuccessTitle);
    const thankMsg = getLocalized(initialForm.thank_you_message, t.submitSuccessDesc);

    return (
      <div className="min-h-screen bg-[#F5F4F2] py-12 px-4 sm:px-6 flex items-center justify-center font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl max-w-lg w-full p-8 sm:p-10 shadow-xl border border-slate-200 text-center relative overflow-hidden"
        >
          {/* Top Brand Strip */}
          <div className="h-3 bg-[#7B1C3E] absolute top-0 left-0 right-0" />

          {/* School Emblem */}
          <div className="mb-6 mt-2">
            <Image
              src="/logo2.png"
              alt="School Logo"
              width={160}
              height={80}
              className="h-16 w-auto mx-auto object-contain"
            />
          </div>

          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">{thankTitle}</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-8">{thankMsg}</p>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-500 mb-6">
            <div className="font-semibold text-slate-700 mb-1">{t.schoolName}</div>
            <div>{t.subTitle}</div>
          </div>

          {initialForm.allow_multiple !== false && (
            <button
              onClick={() => {
                setAnswers({});
                setAttachments({});
                setIsSubmitted(false);
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t.submitAnother}
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  // Active Form Viewer
  const formTitle = getLocalized(initialForm.title);
  const formDesc = getLocalized(initialForm.description);

  return (
    <div className="min-h-screen bg-[#F5F4F2] pb-20 font-sans text-slate-800">
      {/* Official School CI Top Bar */}
      <header className="bg-[#7B1C3E] text-white shadow-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          {/* Logo & School Branding */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo2.png"
              alt="โรงเรียนสมคิดวิทยา"
              width={140}
              height={70}
              className="h-10 w-auto object-contain brightness-0 invert drop-shadow-xs"
            />
            <div className="border-l border-white/25 pl-3 hidden sm:block">
              <div className="text-xs font-bold tracking-wide uppercase leading-tight">
                {t.schoolName}
              </div>
              <div className="text-[10px] text-white/80">{t.subTitle}</div>
            </div>
          </div>

          {/* Floating Trilingual Switcher */}
          <div className="flex items-center bg-black/25 backdrop-blur-md rounded-xl p-1 border border-white/20 shadow-xs">
            <button
              type="button"
              onClick={() => setLang('th')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                lang === 'th' ? 'bg-white text-[#7B1C3E] shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              🇹🇭 ไทย
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                lang === 'en' ? 'bg-white text-[#1B3A6B] shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              🇬🇧 EN
            </button>
            <button
              type="button"
              onClick={() => setLang('zh')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                lang === 'zh' ? 'bg-white text-rose-800 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              🇨🇳 中文
            </button>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Form Header Card */}
          <div className="bg-white rounded-3xl border-t-8 border-t-[#7B1C3E] border border-slate-200/80 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-[#7B1C3E] mb-2 uppercase tracking-wider">
              <span>{t.schoolName}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal">Official Online Form</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
              {formTitle}
            </h1>

            {formDesc && (
              <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap leading-relaxed">
                {formDesc}
              </p>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span className="text-rose-600 font-medium">* {t.requiredBadge}</span>
              {currentUser && (
                <span className="text-slate-500 truncate max-w-[200px]">
                  ส่งในนาม: {currentUser.email}
                </span>
              )}
            </div>
          </div>

          {/* Render Form Fields */}
          {initialFields.map((field, index) => {
            const fieldLabel = getLocalized(field.label);
            const fieldHelp = getLocalized(field.help_text);
            const isError = validationErrors[field.field_key];

            // Section Header Field
            if (field.field_type === 'section_header') {
              return (
                <div
                  key={field.id}
                  className="bg-[#1B3A6B] text-white rounded-2xl p-5 shadow-xs border-l-4 border-l-[#7B1C3E]"
                >
                  <h3 className="text-base sm:text-lg font-bold">{fieldLabel}</h3>
                  {fieldHelp && <p className="text-xs text-white/80 mt-1">{fieldHelp}</p>}
                </div>
              );
            }

            return (
              <motion.div
                key={field.id}
                id={`field-${field.field_key}`}
                layout
                className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-2xs transition-all ${
                  isError
                    ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10'
                    : 'border-slate-200/90'
                }`}
              >
                {/* Field Label & Required asterisk */}
                <div className="mb-3">
                  <label className="block text-sm font-bold text-slate-900 leading-snug">
                    {fieldLabel}
                    {field.is_required && (
                      <span className="text-rose-500 ml-1 text-base leading-none">*</span>
                    )}
                  </label>
                  {fieldHelp && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{fieldHelp}</p>
                  )}
                </div>

                {/* Input Fields By Type */}
                <div className="mt-2">
                  {/* Single Line Text */}
                  {field.field_type === 'text' && (
                    <input
                      type="text"
                      value={answers[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      placeholder={fieldLabel}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all"
                    />
                  )}

                  {/* Multiline Paragraph Textarea */}
                  {field.field_type === 'textarea' && (
                    <textarea
                      rows={3}
                      value={answers[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      placeholder={fieldLabel}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all resize-y"
                    />
                  )}

                  {/* Number */}
                  {field.field_type === 'number' && (
                    <input
                      type="number"
                      value={answers[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      placeholder="0"
                      className="w-full sm:w-60 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all"
                    />
                  )}

                  {/* Radio Choice (Single select) */}
                  {field.field_type === 'radio' && (
                    <div className="space-y-2.5 pt-1">
                      {(field.options || []).map((opt) => {
                        const optLabel = getLocalized(opt.label);
                        const isChecked = answers[field.field_key] === opt.value;
                        return (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] font-medium'
                                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name={field.field_key}
                              value={opt.value}
                              checked={isChecked}
                              onChange={() => handleInputChange(field.field_key, opt.value)}
                              className="w-4 h-4 text-[#7B1C3E] focus:ring-[#7B1C3E] accent-[#7B1C3E]"
                            />
                            <span className="text-sm">{optLabel}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Checkbox (Multi select) */}
                  {field.field_type === 'checkbox' && (
                    <div className="space-y-2.5 pt-1">
                      {(field.options || []).map((opt) => {
                        const optLabel = getLocalized(opt.label);
                        const selectedArr = (answers[field.field_key] as string[]) || [];
                        const isChecked = selectedArr.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] font-medium'
                                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              value={opt.value}
                              checked={isChecked}
                              onChange={() => handleCheckboxToggle(field.field_key, opt.value)}
                              className="w-4 h-4 rounded text-[#7B1C3E] focus:ring-[#7B1C3E] accent-[#7B1C3E]"
                            />
                            <span className="text-sm">{optLabel}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown Select */}
                  {field.field_type === 'select' && (
                    <select
                      value={answers[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all text-slate-800"
                    >
                      <option value="">{t.selectPlaceholder}</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {getLocalized(opt.label)}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Date */}
                  {field.field_type === 'date' && (
                    <input
                      type="date"
                      value={answers[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      className="w-full sm:w-64 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all"
                    />
                  )}

                  {/* Time */}
                  {field.field_type === 'time' && (
                    <input
                      type="time"
                      value={answers[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      className="w-full sm:w-48 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all"
                    />
                  )}

                  {/* Rating 1-5 Stars */}
                  {field.field_type === 'rating' && (
                    <div className="flex items-center gap-2 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const curRating = answers[field.field_key] || 0;
                        const isFilled = star <= curRating;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleInputChange(field.field_key, star)}
                            className="p-1 text-slate-300 hover:text-amber-400 focus:outline-none transition-colors"
                          >
                            <Star
                              className={`w-8 h-8 ${
                                isFilled
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          </button>
                        );
                      })}
                      {answers[field.field_key] && (
                        <span className="text-xs font-bold text-amber-600 ml-2">
                          {answers[field.field_key]} / 5
                        </span>
                      )}
                    </div>
                  )}

                  {/* File Upload / Slip */}
                  {field.field_type === 'file_upload' && (
                    <div className="space-y-3">
                      <label className="border-2 border-dashed border-slate-200 hover:border-[#7B1C3E] bg-slate-50 hover:bg-[#7B1C3E]/5 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                        <Upload className="w-7 h-7 text-slate-400 mb-2" />
                        <span className="text-xs font-semibold text-slate-700">
                          {t.uploadButton}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          รองรับรูปภาพ (JPG, PNG) และเอกสาร (PDF) ขนาดสูงสุด 10MB
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(field.field_key, file);
                          }}
                          className="hidden"
                        />
                      </label>

                      {uploadingField === field.field_key && (
                        <div className="flex items-center gap-2 text-xs text-[#7B1C3E] font-medium">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t.uploading}</span>
                        </div>
                      )}

                      {attachments[field.field_key] && (
                        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                          <div className="flex items-center gap-2 truncate">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="truncate">แนบไฟล์เรียบร้อยแล้ว</span>
                          </div>
                          <a
                            href={attachments[field.field_key]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-emerald-700 underline shrink-0 ml-2"
                          >
                            เปิดดูไฟล์
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isError && (
                  <p className="text-xs font-semibold text-rose-500 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t.requiredBadge}
                  </p>
                )}
              </motion.div>
            );
          })}

          {/* Submit Button Bar */}
          <div className="pt-4 pb-12">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-[#7B1C3E] hover:bg-[#631430] active:scale-[0.99] text-white rounded-2xl font-bold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.submitting}</span>
                </>
              ) : (
                <>
                  <span>{t.submitButton}</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
            <div className="text-center text-xs text-slate-400 mt-4">
              {t.schoolName} • ระบบแบบฟอร์มอิเล็กทรอนิกส์มาตรฐานความปลอดภัย
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
