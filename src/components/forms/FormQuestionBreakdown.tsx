'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { FormDefinition, FormField, FormResponse } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  BarChart2,
  PieChart as PieChartIcon,
  Star,
  FileText,
  User,
  Clock,
  ExternalLink,
  Paperclip,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface FormQuestionBreakdownProps {
  form: FormDefinition;
  fields: FormField[];
  responses: FormResponse[];
  onSelectResponse: (response: FormResponse) => void;
}

const PALETTE = [
  '#7B1C3E', // Burgundy
  '#1B3A6B', // Navy
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#EA580C', // Orange
];

export function FormQuestionBreakdown({
  form,
  fields,
  responses,
  onSelectResponse,
}: FormQuestionBreakdownProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAnswer, setFilterAnswer] = useState<string>('all');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter input fields only
  const inputFields = useMemo(() => {
    const layoutTypes = ['section_header', 'image', 'info_text'];
    return (fields || [])
      .filter((f) => !layoutTypes.includes(f.field_type))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [fields]);

  const currentField = inputFields[selectedFieldIndex] || inputFields[0];

  // Navigation handlers
  const handlePrev = () => {
    setSelectedFieldIndex((prev) => (prev > 0 ? prev - 1 : inputFields.length - 1));
    setSearchQuery('');
    setFilterAnswer('all');
  };

  const handleNext = () => {
    setSelectedFieldIndex((prev) => (prev < inputFields.length - 1 ? prev + 1 : 0));
    setSearchQuery('');
    setFilterAnswer('all');
  };

  // Compile responses for the current field
  const { questionAnswers, chartData, stats } = useMemo(() => {
    if (!currentField) {
      return { questionAnswers: [], chartData: [], stats: { answered: 0, total: 0, rate: 0 } };
    }

    const total = responses.length;
    let answered = 0;
    const countMap: Record<string, number> = {};

    // Initialize option counts if choice field
    if (['radio', 'select', 'checkbox'].includes(currentField.field_type) && currentField.options) {
      currentField.options.forEach((opt) => {
        countMap[opt.value] = 0;
      });
    }

    const items: Array<{
      responseId: string;
      respondent: string;
      lang: string;
      submittedAt: string;
      answerRaw: any;
      answerFormatted: string;
      fullResponse: FormResponse;
    }> = [];

    responses.forEach((r) => {
      const raw = r.answers?.[currentField.field_key];
      const hasAnswer = raw !== undefined && raw !== null && raw !== '';
      if (hasAnswer) answered++;

      // Format answer nicely
      let formatted = '-';
      if (hasAnswer) {
        if (Array.isArray(raw)) {
          formatted = raw
            .map((v) => currentField.options?.find((o) => o.value === v)?.label?.th || String(v))
            .join(', ');
          raw.forEach((v) => {
            const strVal = String(v);
            countMap[strVal] = (countMap[strVal] || 0) + 1;
          });
        } else if (currentField.options) {
          const opt = currentField.options.find((o) => o.value === raw);
          formatted = opt ? opt.label?.th || opt.value : String(raw);
          const strVal = String(raw);
          countMap[strVal] = (countMap[strVal] || 0) + 1;
        } else {
          formatted = String(raw);
          if (['rating', 'number'].includes(currentField.field_type)) {
            const numKey = String(Math.round(Number(raw)));
            countMap[numKey] = (countMap[numKey] || 0) + 1;
          }
        }
      }

      items.push({
        responseId: r.id,
        respondent: r.respondent_email || 'บุคคลภายนอก (Public)',
        lang: r.submission_lang || 'th',
        submittedAt: r.submitted_at,
        answerRaw: raw,
        answerFormatted: formatted,
        fullResponse: r,
      });
    });

    // Build chart data
    const chartItems: any[] = [];
    if (['radio', 'select', 'checkbox'].includes(currentField.field_type) && currentField.options) {
      currentField.options.forEach((opt, idx) => {
        const cnt = countMap[opt.value] || 0;
        chartItems.push({
          label: opt.label?.th || opt.value,
          value: opt.value,
          count: cnt,
          percentage: answered > 0 ? Math.round((cnt / answered) * 100) : 0,
          color: PALETTE[idx % PALETTE.length],
        });
      });
    } else if (currentField.field_type === 'rating') {
      for (let star = 1; star <= 5; star++) {
        const cnt = countMap[String(star)] || 0;
        chartItems.push({
          label: `${star} ดาว ⭐`,
          value: String(star),
          count: cnt,
          percentage: answered > 0 ? Math.round((cnt / answered) * 100) : 0,
          color: '#F59E0B',
        });
      }
    }

    return {
      questionAnswers: items,
      chartData: chartItems,
      stats: {
        answered,
        total,
        rate: total > 0 ? Math.round((answered / total) * 100) : 0,
      },
    };
  }, [currentField, responses]);

  // Filtered rows for current question
  const filteredItems = useMemo(() => {
    return questionAnswers.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.respondent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answerFormatted.toLowerCase().includes(searchQuery.toLowerCase());

      const matchFilter =
        filterAnswer === 'all' ||
        (filterAnswer === '__answered__' && item.answerFormatted !== '-') ||
        (filterAnswer === '__empty__' && item.answerFormatted === '-') ||
        String(item.answerRaw) === filterAnswer ||
        (Array.isArray(item.answerRaw) && item.answerRaw.includes(filterAnswer));

      return matchSearch && matchFilter;
    });
  }, [questionAnswers, searchQuery, filterAnswer]);

  if (!inputFields.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">ไม่พบคำถามในแบบฟอร์มนี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Question Selector Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              title="ข้อก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
              คำถามที่ {selectedFieldIndex + 1} จาก {inputFields.length}
            </span>

            <button
              type="button"
              onClick={handleNext}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              title="ข้อถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Select Dropdown */}
          <div className="relative w-full sm:w-80">
            <select
              value={selectedFieldIndex}
              onChange={(e) => {
                setSelectedFieldIndex(Number(e.target.value));
                setSearchQuery('');
                setFilterAnswer('all');
              }}
              className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
            >
              {inputFields.map((f, idx) => (
                <option key={f.id || f.field_key} value={idx}>
                  ข้อ {idx + 1}: {f.label?.th || f.field_key}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Question Info Card */}
        <div className="mt-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#7B1C3E]/10 text-[#7B1C3E]">
                {getFieldTypeLabel(currentField.field_type)}
              </span>
              {currentField.is_required && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">
                  จำเป็นต้องตอบ
                </span>
              )}
              <span className="text-xs text-slate-400 font-mono">key: {currentField.field_key}</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {currentField.label?.th || currentField.field_key}
            </h2>
            {currentField.help_text?.th && (
              <p className="text-xs text-slate-500 mt-1">{currentField.help_text.th}</p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 bg-slate-50 border border-slate-100 p-3 rounded-xl">
            <div className="text-center px-2">
              <div className="text-xs text-slate-500">ตอบแล้ว</div>
              <div className="text-lg font-bold text-slate-900">{stats.answered}</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center px-2">
              <div className="text-xs text-slate-500">เว้นว่าง</div>
              <div className="text-lg font-bold text-slate-400">{stats.total - stats.answered}</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center px-2">
              <div className="text-xs text-slate-500">อัตราการตอบ</div>
              <div className="text-lg font-bold text-emerald-600">{stats.rate}%</div>
            </div>
          </div>
        </div>

        {/* Mini Chart for this Question (if applicable) */}
        {chartData.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-7 h-48 w-full">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => (v.length > 12 ? v.slice(0, 12) + '...' : v)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        borderRadius: '10px',
                        color: '#FFF',
                        fontSize: '12px',
                        border: 'none',
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val} คน (${item?.payload?.percentage || 0}%)`,
                        item?.payload?.label || 'จำนวนผู้ตอบ',
                      ]}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={`bar-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="md:col-span-5 space-y-1.5">
              {chartData.map((item) => (
                <div key={item.value} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700 truncate">{item.label}</span>
                  </div>
                  <span className="font-semibold text-slate-900 shrink-0">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Individual Answers Table for this Question ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาตามชื่อ/อีเมล หรือคำตอบ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7B1C3E]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterAnswer}
              onChange={(e) => setFilterAnswer(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#7B1C3E]"
            >
              <option value="all">คำตอบทั้งหมด ({questionAnswers.length})</option>
              <option value="__answered__">เฉพาะที่ตอบแล้ว ({stats.answered})</option>
              <option value="__empty__">เฉพาะที่เว้นว่าง ({stats.total - stats.answered})</option>
              {currentField.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  ตัวเลือก: {opt.label?.th || opt.value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Answers List */}
        <div className="divide-y divide-slate-100">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              ไม่พบคำตอบที่ตรงกับเงื่อนไขการค้นหา
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isEmpty = item.answerFormatted === '-';
              return (
                <div
                  key={item.responseId}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.respondent}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            item.lang === 'th'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.lang === 'en'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.lang.toUpperCase()}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.submittedAt).toLocaleString('th-TH', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      {/* Render Answer */}
                      <div className="mt-1.5">
                        {isEmpty ? (
                          <span className="text-slate-400 italic">ไม่ได้ตอบคำถามข้อนี้</span>
                        ) : currentField.field_type === 'rating' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-700">{item.answerFormatted} ดาว</span>
                            <div className="flex text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3.5 h-3.5 ${
                                    star <= Math.round(Number(item.answerRaw))
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-amber-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        ) : currentField.field_type === 'file_upload' &&
                          typeof item.answerRaw === 'string' &&
                          item.answerRaw.startsWith('http') ? (
                          <a
                            href={item.answerRaw}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#1B3A6B] font-semibold hover:underline"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>ดูไฟล์แนบ</span>
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        ) : (
                          <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                            {item.answerFormatted}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* View Full Submission Modal */}
                  <button
                    type="button"
                    onClick={() => onSelectResponse(item.fullResponse)}
                    className="self-end sm:self-center px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>ดูคำตอบทั้งชุด</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function getFieldTypeLabel(type: string): string {
  switch (type) {
    case 'text':
      return 'ข้อความสั้น';
    case 'textarea':
      return 'ย่อหน้าข้อความยาว';
    case 'number':
      return 'ตัวเลข';
    case 'radio':
      return 'เลือกข้อเดียว (Radio)';
    case 'checkbox':
      return 'เลือกหลายข้อ (Checkbox)';
    case 'select':
      return 'เมนูเลื่อนลง (Dropdown)';
    case 'date':
      return 'วันที่';
    case 'time':
      return 'เวลา';
    case 'file_upload':
      return 'อัปโหลดไฟล์';
    case 'rating':
      return 'ระดับคะแนน (Rating)';
    default:
      return type;
  }
}
