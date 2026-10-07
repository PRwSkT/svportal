'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormDefinition, FormField, FormResponse } from '@/types';
import { getFormResponses, deleteResponse } from '@/app/admin/forms/actions';
import { exportToCSV } from '@/lib/export';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Download, Search, Filter, Trash2, Eye,
  BarChart2, FileText, CheckCircle2, Calendar, Globe,
  Loader2, ExternalLink, X, Image as ImageIcon, AlertCircle, QrCode
} from 'lucide-react';
import { FormQRCodeModal } from '@/components/forms/FormQRCodeModal';
import { NongFahResponsesInsights } from '@/components/forms/NongFahResponsesInsights';
import { StudentDbSyncSection } from '@/components/forms/StudentDbSyncSection';
import { NongFahFloatingBubble } from '@/components/forms/NongFahFloatingBubble';

export default function FormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const formId = resolvedParams.id;
  const router = useRouter();

  const [form, setForm] = useState<FormDefinition | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState<'all' | 'th' | 'en' | 'zh'>('all');

  // Modal for detail view
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const res = await getFormResponses(formId);
    if (res.success && res.data) {
      setForm(res.data.form);
      setFields(res.data.fields);
      setResponses(res.data.responses);
    } else {
      toast.error('ไม่สามารถโหลดข้อมูลการตอบกลับได้', { description: res.error });
      router.push('/admin/forms');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [formId]);

  const handleDeleteResponse = async (responseId: string) => {
    if (!confirm('คุณต้องการลบข้อมูลการตอบกลับรายการนี้ใช่หรือไม่?')) return;

    const res = await deleteResponse(responseId, formId);
    if (res.success) {
      toast.success('ลบข้อมูลการตอบกลับเรียบร้อย');
      setResponses(prev => prev.filter(r => r.id !== responseId));
      if (selectedResponse?.id === responseId) {
        setSelectedResponse(null);
      }
    } else {
      toast.error('ลบไม่สำเร็จ', { description: res.error });
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (!form || responses.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    // 1. Build headers (excluding layout/media blocks)
    const nonInputTypes = ['section_header', 'image', 'info_text'];
    const validFields = fields.filter(f => !nonInputTypes.includes(f.field_type));

    const headers = [
      'ลำดับ (No.)',
      'วันเวลาที่ส่ง (Timestamp)',
      'ภาษาที่ใช้ (Language)',
      'ผู้ส่ง (Respondent Email / Type)',
      ...validFields.map(f => f.label?.th || f.field_key),
      'ลิงก์ไฟล์แนบ (Attachments)',
    ];

    // 2. Build rows with human-readable resolved labels
    const rows = responses.map((resp, idx) => {
      const fieldAnswers = validFields.map(f => {
        const val = resp.answers?.[f.field_key];
        if (val === undefined || val === null || val === '') return '';
        if (Array.isArray(val)) {
          return val.map(v => {
            const opt = f.options?.find(o => o.value === v);
            return opt?.label?.th || v;
          }).join(', ');
        }
        if (['radio', 'select'].includes(f.field_type) && f.options) {
          const opt = f.options.find(o => o.value === val);
          if (opt) return opt.label?.th || opt.value;
        }
        return String(val);
      });

      const attachmentsStr = (resp.attachments || []).join(' ; ');

      return [
        idx + 1,
        new Date(resp.submitted_at).toLocaleString('th-TH'),
        resp.submission_lang?.toUpperCase() || 'TH',
        resp.respondent_email || 'บุคคลภายนอก (Public)',
        ...fieldAnswers,
        attachmentsStr,
      ];
    });

    const filename = `SV-Forms_${form.slug}_responses_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(filename, headers, rows);
    toast.success('ส่งออกไฟล์ Excel/CSV เรียบร้อยแล้ว (รองรับภาษาไทย)');
  };

  // Filtered responses
  const filteredResponses = responses.filter(r => {
    const matchLang = langFilter === 'all' || r.submission_lang === langFilter;
    const matchSearch =
      searchQuery === '' ||
      (r.respondent_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(r.answers || {}).toLowerCase().includes(searchQuery.toLowerCase());

    return matchLang && matchSearch;
  });

  // Analytics Calculation
  const total = responses.length;
  const thCount = responses.filter(r => r.submission_lang === 'th').length;
  const enCount = responses.filter(r => r.submission_lang === 'en').length;
  const zhCount = responses.filter(r => r.submission_lang === 'zh').length;

  if (isLoading || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#7B1C3E] animate-spin" />
          <p className="text-sm font-medium text-slate-600">กำลังโหลดข้อมูลการตอบกลับ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E]">
                    การตอบกลับ (Responses)
                  </span>
                  <span className="text-xs text-slate-400 font-mono">/forms/{form.slug}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  {form.title?.th || 'แบบฟอร์ม'}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="สร้างและดาวน์โหลด QR Code ตามดีไซน์ SV Portal"
              >
                <QrCode className="w-4 h-4 text-[#6E0D22]" />
                <span>QR Code</span>
              </button>

              <Link
                href={`/admin/forms/${form.id}/edit`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                แก้ไขฟอร์ม
              </Link>

              <button
                onClick={handleExportCSV}
                disabled={responses.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#1B3A6B] hover:bg-[#142c52] text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                ส่งออก Excel (CSV)
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <div className="text-xs font-medium text-slate-500">การตอบกลับทั้งหมด</div>
              <div className="text-2xl font-bold text-slate-900 mt-1.5">{total}</div>
              <div className="text-xs text-slate-400 mt-0.5">ชุดข้อมูลที่บันทึกแล้ว</div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-4">
              <div className="text-xs font-medium text-emerald-800">ภาษาไทย (TH)</div>
              <div className="text-2xl font-bold text-emerald-950 mt-1.5">
                {thCount} <span className="text-xs font-normal text-emerald-700">({total > 0 ? Math.round((thCount / total) * 100) : 0}%)</span>
              </div>
              <div className="text-xs text-emerald-700/80 mt-0.5">ตอบด้วยภาษาไทย</div>
            </div>

            <div className="bg-blue-50/60 border border-blue-200/60 rounded-2xl p-4">
              <div className="text-xs font-medium text-blue-800">English (EN)</div>
              <div className="text-2xl font-bold text-blue-950 mt-1.5">
                {enCount} <span className="text-xs font-normal text-blue-700">({total > 0 ? Math.round((enCount / total) * 100) : 0}%)</span>
              </div>
              <div className="text-xs text-blue-700/80 mt-0.5">ตอบด้วยภาษาอังกฤษ</div>
            </div>

            <div className="bg-rose-50/60 border border-rose-200/60 rounded-2xl p-4">
              <div className="text-xs font-medium text-rose-800">中文 (ZH)</div>
              <div className="text-2xl font-bold text-rose-950 mt-1.5">
                {zhCount} <span className="text-xs font-normal text-rose-700">({total > 0 ? Math.round((zhCount / total) * 100) : 0}%)</span>
              </div>
              <div className="text-xs text-rose-700/80 mt-0.5">ตอบด้วยภาษาจีน</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Nong Fah AI Executive Insights */}
        <NongFahResponsesInsights
          formId={form.id}
          totalResponses={total}
        />

        {/* Student Database Sync & Update Section */}
        <StudentDbSyncSection
          formId={form.id}
        />

        {/* Filters Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาข้อความคำตอบ หรืออีเมล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setLangFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${langFilter === 'all' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              ทุกภาษา ({total})
            </button>
            <button
              onClick={() => setLangFilter('th')}
              className={`px-3 py-1.5 rounded-lg transition-all ${langFilter === 'th' ? 'bg-white shadow-xs text-emerald-800' : 'text-slate-600 hover:text-slate-900'}`}
            >
              TH ({thCount})
            </button>
            <button
              onClick={() => setLangFilter('en')}
              className={`px-3 py-1.5 rounded-lg transition-all ${langFilter === 'en' ? 'bg-white shadow-xs text-blue-800' : 'text-slate-600 hover:text-slate-900'}`}
            >
              EN ({enCount})
            </button>
            <button
              onClick={() => setLangFilter('zh')}
              className={`px-3 py-1.5 rounded-lg transition-all ${langFilter === 'zh' ? 'bg-white shadow-xs text-rose-800' : 'text-slate-600 hover:text-slate-900'}`}
            >
              ZH ({zhCount})
            </button>
          </div>
        </div>

        {/* Responses Table */}
        {filteredResponses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">ยังไม่มีข้อมูลการตอบกลับ</h3>
            <p className="text-xs text-slate-500 mt-1">
              เมื่อมีผู้ตอบกรอกแบบฟอร์ม ข้อมูลและไฟล์แนบจะปรากฏที่หน้านี้แบบเรียลไทม์
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4 w-40">วันเวลาที่ส่ง</th>
                    <th className="py-3.5 px-4 w-28">ภาษา</th>
                    <th className="py-3.5 px-4 w-48">ผู้ตอบฟอร์ม</th>
                    <th className="py-3.5 px-4">ตัวอย่างคำตอบแรก</th>
                    <th className="py-3.5 px-4 w-24 text-center">ไฟล์แนบ</th>
                    <th className="py-3.5 px-4 w-32 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResponses.map((resp, index) => {
                    const firstField = fields.find(f => !['section_header', 'image', 'info_text'].includes(f.field_type));
                    const rawVal = firstField ? resp.answers?.[firstField.field_key] : null;
                    let previewText = '-';
                    if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
                      if (Array.isArray(rawVal)) {
                        previewText = rawVal.map(v => firstField?.options?.find(o => o.value === v)?.label?.th || v).join(', ');
                      } else if (firstField?.options) {
                        previewText = firstField.options.find(o => o.value === rawVal)?.label?.th || String(rawVal);
                      } else {
                        previewText = String(rawVal);
                      }
                    }

                    const hasFiles = Array.isArray(resp.attachments) && resp.attachments.length > 0;

                    return (
                      <tr key={resp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {new Date(resp.submitted_at).toLocaleString('th-TH', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              resp.submission_lang === 'th'
                                ? 'bg-emerald-100 text-emerald-800'
                                : resp.submission_lang === 'en'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {resp.submission_lang?.toUpperCase() || 'TH'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 truncate max-w-[180px]">
                          {resp.respondent_email || 'บุคคลภายนอก (Public)'}
                        </td>
                        <td className="py-3.5 px-4 truncate max-w-xs text-slate-600">
                          <span className="font-semibold text-slate-800 mr-1.5">
                            {firstField?.label?.th}:
                          </span>
                          <span>{previewText}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {hasFiles ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                              <ImageIcon className="w-3 h-3" />
                              {resp.attachments!.length} ไฟล์
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedResponse(resp)}
                              className="p-1.5 text-slate-500 hover:text-[#7B1C3E] hover:bg-slate-100 rounded-lg transition-colors"
                              title="ดูรายละเอียดฉบับเต็ม"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteResponse(resp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="ลบรายการนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Response Detail View */}
      <AnimatePresence>
        {selectedResponse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      ภาษา: {selectedResponse.submission_lang?.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(selectedResponse.submitted_at).toLocaleString('th-TH')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    รายละเอียดการตอบกลับจาก {selectedResponse.respondent_email || 'บุคคลภายนอก'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedResponse(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Q&A list */}
              <div className="p-6 overflow-y-auto space-y-4 divide-y divide-slate-100">
                {fields
                  .filter(f => !['section_header', 'image', 'info_text'].includes(f.field_type))
                  .map((field, idx) => {
                    const rawAns = selectedResponse.answers?.[field.field_key];
                    const label = field.label?.th || field.field_key;
                    let displayAns = '-';
                    if (rawAns !== undefined && rawAns !== null && rawAns !== '') {
                      if (Array.isArray(rawAns)) {
                        displayAns = rawAns.map(v => field.options?.find(o => o.value === v)?.label?.th || v).join(', ');
                      } else if (field.options) {
                        displayAns = field.options.find(o => o.value === rawAns)?.label?.th || String(rawAns);
                      } else {
                        displayAns = String(rawAns);
                      }
                    }

                    return (
                      <div key={field.id} className={idx > 0 ? 'pt-4' : ''}>
                        <div className="text-xs font-bold text-slate-500 mb-1">
                          {idx + 1}. {label}
                        </div>
                        <div className="text-sm font-medium text-slate-900 bg-slate-50 p-3 rounded-xl">
                          {rawAns === undefined || rawAns === null || rawAns === '' ? (
                            <span className="text-slate-400 italic">ไม่มีข้อมูล</span>
                          ) : typeof rawAns === 'string' && rawAns.startsWith('http') ? (
                            <a
                              href={rawAns}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#7B1C3E] underline font-semibold flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              เปิดดูไฟล์แนบ
                            </a>
                          ) : (
                            displayAns
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* Attachments Section */}
                {selectedResponse.attachments && selectedResponse.attachments.length > 0 && (
                  <div className="pt-4">
                    <div className="text-xs font-bold text-slate-500 mb-2">ไฟล์และสลิปแนบทั้งหมด:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedResponse.attachments.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate text-xs font-medium text-slate-700">
                            <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="truncate">ไฟล์ที่ {i + 1}</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <button
                  onClick={() => handleDeleteResponse(selectedResponse.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบรายการนี้
                </button>
                <button
                  onClick={() => setSelectedResponse(null)}
                  className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors"
                >
                  ปิดหน้าต่าง
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
        formTitle={form.title?.th || 'แบบฟอร์ม'}
        formSlug={form.slug}
      />

      {/* Cute Floating Nong Fah AI Chatbot Bubble */}
      <NongFahFloatingBubble
        onClick={() => {
          const el = document.getElementById('nong-fah-insights');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        label="น้องฟ้า AI สรุปผล"
        badge="สรุปผล"
      />
    </div>
  );
}
