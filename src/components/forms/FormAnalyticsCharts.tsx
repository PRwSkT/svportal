'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FormDefinition, FormField, FormResponse } from '@/types';
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
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart2,
  PieChart as PieChartIcon,
  Star,
  FileText,
  Calendar,
  Clock,
  Paperclip,
  CheckSquare,
  List,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Hash,
  ExternalLink,
} from 'lucide-react';

interface FormAnalyticsChartsProps {
  form: FormDefinition;
  fields: FormField[];
  responses: FormResponse[];
}

const PALETTE = [
  '#7B1C3E', // Burgundy (SV Primary)
  '#1B3A6B', // Navy Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#EA580C', // Orange
  '#4F46E5', // Indigo
  '#10B981', // Teal
];

export function FormAnalyticsCharts({ form, fields, responses }: FormAnalyticsChartsProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [chartTypeMap, setChartTypeMap] = useState<Record<string, 'bar' | 'pie'>>({});
  const [textSearchMap, setTextSearchMap] = useState<Record<string, string>>({});
  const [expandedTextMap, setExpandedTextMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter input fields (excluding decorative blocks)
  const inputFields = useMemo(() => {
    const layoutTypes = ['section_header', 'image', 'info_text'];
    return (fields || [])
      .filter((f) => !layoutTypes.includes(f.field_type))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [fields]);

  // Submissions timeline (grouped by day)
  const timelineData = useMemo(() => {
    if (!responses.length) return [];
    const dateCounts: Record<string, number> = {};

    // Sort responses by submitted_at ascending
    const sorted = [...responses].sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    );

    sorted.forEach((r) => {
      const d = new Date(r.submitted_at);
      const key = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      dateCounts[key] = (dateCounts[key] || 0) + 1;
    });

    return Object.entries(dateCounts).map(([date, count]) => ({
      date,
      count,
    }));
  }, [responses]);

  // Languages distribution
  const languageData = useMemo(() => {
    const counts = { th: 0, en: 0, zh: 0 };
    responses.forEach((r) => {
      const lang = r.submission_lang || 'th';
      if (lang === 'th') counts.th++;
      else if (lang === 'en') counts.en++;
      else if (lang === 'zh') counts.zh++;
    });

    return [
      { name: 'ภาษาไทย (TH)', code: 'th', count: counts.th, color: '#059669' },
      { name: 'English (EN)', code: 'en', count: counts.en, color: '#1B3A6B' },
      { name: '中文 (ZH)', code: 'zh', count: counts.zh, color: '#DB2777' },
    ].filter((item) => item.count > 0);
  }, [responses]);

  if (!responses.length) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">ยังไม่มีข้อมูลการตอบกลับสำหรับสร้างกราฟ</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          เมื่อมีผู้ตอบแบบสอบถามหรือกรอกฟอร์ม ระบบจะประมวลผลข้อมูลออกเป็นแผนภูมิสถิติและแจกแจงคำตอบให้อัตโนมัติทันที
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Overview: Timeline & Language Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#7B1C3E]" />
                สถิติการส่งแบบฟอร์มตามช่วงเวลา (Timeline)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">จำนวนผู้ตอบแบบฟอร์มในแต่ละวัน</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              รวม {responses.length} ครั้ง
            </span>
          </div>

          <div className="h-56 w-full">
            {isMounted && timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7B1C3E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7B1C3E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '12px',
                      border: 'none',
                    }}
                    labelStyle={{ fontWeight: 'bold', color: '#F1F5F9' }}
                    formatter={(val: any) => [`${val} ครั้ง`, 'จำนวนการส่ง']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#7B1C3E"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                กำลังเตรียมข้อมูลกราฟ...
              </div>
            )}
          </div>
        </div>

        {/* Language Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#1B3A6B]" />
              สัดส่วนภาษาที่ใช้ตอบ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">แบ่งตามภาษาที่ผู้ตอบเลือกกรอก</p>
          </div>

          <div className="h-44 w-full">
            {isMounted && languageData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {languageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '12px',
                      border: 'none',
                    }}
                    formatter={(value: any, name: any) => [`${value} รายการ`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                กำลังเตรียมข้อมูล...
              </div>
            )}
          </div>

          <div className="space-y-1.5 mt-2">
            {languageData.map((lang) => {
              const pct = responses.length > 0 ? Math.round((lang.count / responses.length) * 100) : 0;
              return (
                <div key={lang.code} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lang.color }} />
                    <span className="font-medium text-slate-700">{lang.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900">
                    {lang.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Per-Question Analytics Cards ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#7B1C3E]" />
              สถิติแยกตามรายข้อคำถาม (Question Analytics)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              วิเคราะห์คำตอบจากผู้ตอบทั้งหมด {responses.length} คน จำแนกตามประเภทของแต่ละข้อคำถาม
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-[#7B1C3E]/10 text-[#7B1C3E] rounded-full">
            {inputFields.length} ข้อคำถาม
          </span>
        </div>

        {inputFields.map((field, fieldIndex) => {
          return (
            <FieldAnalyticsCard
              key={field.id || field.field_key}
              index={fieldIndex + 1}
              field={field}
              responses={responses}
              chartType={chartTypeMap[field.field_key] || 'bar'}
              onToggleChartType={(type) =>
                setChartTypeMap((prev) => ({ ...prev, [field.field_key]: type }))
              }
              searchQuery={textSearchMap[field.field_key] || ''}
              onSearchChange={(q) =>
                setTextSearchMap((prev) => ({ ...prev, [field.field_key]: q }))
              }
              isExpanded={!!expandedTextMap[field.field_key]}
              onToggleExpand={() =>
                setExpandedTextMap((prev) => ({
                  ...prev,
                  [field.field_key]: !prev[field.field_key],
                }))
              }
              isMounted={isMounted}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: FieldAnalyticsCard
// ─────────────────────────────────────────────────────────────
interface FieldAnalyticsCardProps {
  index: number;
  field: FormField;
  responses: FormResponse[];
  chartType: 'bar' | 'pie';
  onToggleChartType: (type: 'bar' | 'pie') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isMounted: boolean;
}

function FieldAnalyticsCard({
  index,
  field,
  responses,
  chartType,
  onToggleChartType,
  searchQuery,
  onSearchChange,
  isExpanded,
  onToggleExpand,
  isMounted,
}: FieldAnalyticsCardProps) {
  const totalSubmissions = responses.length;

  // Extract all answers for this field
  const rawAnswers = useMemo(() => {
    return responses
      .map((r) => r.answers?.[field.field_key])
      .filter((v) => v !== undefined && v !== null && v !== '');
  }, [responses, field.field_key]);

  const answeredCount = rawAnswers.length;
  const skippedCount = totalSubmissions - answeredCount;
  const answerRate = totalSubmissions > 0 ? Math.round((answeredCount / totalSubmissions) * 100) : 0;

  // 1. Radio / Select / Single-choice
  if (field.field_type === 'radio' || field.field_type === 'select') {
    const options = field.options || [];
    const countMap: Record<string, number> = {};

    options.forEach((opt) => {
      countMap[opt.value] = 0;
    });

    let otherCount = 0;
    rawAnswers.forEach((ans) => {
      const key = String(ans);
      if (countMap[key] !== undefined) {
        countMap[key]++;
      } else {
        otherCount++;
      }
    });

    const chartData = options.map((opt, i) => {
      const count = countMap[opt.value] || 0;
      const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
      return {
        label: opt.label?.th || opt.value,
        value: opt.value,
        count,
        percentage: pct,
        color: PALETTE[i % PALETTE.length],
      };
    });

    if (otherCount > 0) {
      chartData.push({
        label: 'อื่นๆ / คำตอบอื่น',
        value: '__other__',
        count: otherCount,
        percentage: answeredCount > 0 ? Math.round((otherCount / answeredCount) * 100) : 0,
        color: '#94A3B8',
      });
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-all hover:shadow-sm">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-xl bg-[#7B1C3E]/10 text-[#7B1C3E] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              {index}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {field.field_type === 'radio' ? 'ตัวเลือกเดียว (Radio)' : 'เมนูแบบเลื่อนลง (Dropdown)'}
                </span>
                {field.is_required && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">
                    จำเป็น
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                {field.label?.th || field.field_key}
              </h3>
              {field.help_text?.th && (
                <p className="text-xs text-slate-500 mt-0.5">{field.help_text.th}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right text-xs">
              <span className="font-bold text-slate-900">{answeredCount}</span>
              <span className="text-slate-500"> / {totalSubmissions} ตอบ</span>
              <span className="text-slate-400 ml-1">({answerRate}%)</span>
            </div>

            {/* Toggle Pie / Bar */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => onToggleChartType('bar')}
                className={`p-1.5 rounded-lg transition-colors ${
                  chartType === 'bar' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="แสดงเป็นแผนภูมิแท่ง"
              >
                <BarChart2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onToggleChartType('pie')}
                className={`p-1.5 rounded-lg transition-colors ${
                  chartType === 'pie' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="แสดงเป็นแผนภูมิวงกลม"
              >
                <PieChartIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Visual Chart & Option Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 items-center">
          {/* Chart Display */}
          <div className="lg:col-span-7 h-64 w-full">
            {isMounted && answeredCount > 0 ? (
              chartType === 'pie' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {chartData.map((entry, idx) => (
                        <Cell key={`pie-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
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
                        item?.payload?.label || name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#334155' }}
                      width={120}
                      tickFormatter={(val) => (val.length > 15 ? val.slice(0, 15) + '...' : val)}
                    />
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
                        'จำนวนผู้ตอบ',
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={`bar-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                ยังไม่มีข้อมูลคำตอบในข้อนี้
              </div>
            )}
          </div>

          {/* Breakdown Table */}
          <div className="lg:col-span-5 space-y-2.5">
            {chartData.map((opt) => (
              <div key={opt.value} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span className="font-semibold text-slate-800 truncate">{opt.label}</span>
                  </div>
                  <div className="shrink-0 font-bold text-slate-900">
                    {opt.count} <span className="font-normal text-slate-500">({opt.percentage}%)</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${opt.percentage}%`,
                      backgroundColor: opt.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Checkbox / Multiple choices
  if (field.field_type === 'checkbox') {
    const options = field.options || [];
    const countMap: Record<string, number> = {};

    options.forEach((opt) => {
      countMap[opt.value] = 0;
    });

    let otherCount = 0;
    rawAnswers.forEach((ans) => {
      let values: string[] = [];
      if (Array.isArray(ans)) {
        values = ans.map(String);
      } else if (typeof ans === 'string') {
        try {
          const parsed = JSON.parse(ans);
          if (Array.isArray(parsed)) values = parsed.map(String);
          else values = [ans];
        } catch {
          values = ans.split(',').map((s) => s.trim());
        }
      }

      values.forEach((v) => {
        if (countMap[v] !== undefined) {
          countMap[v]++;
        } else if (v) {
          otherCount++;
        }
      });
    });

    const chartData = options.map((opt, i) => {
      const count = countMap[opt.value] || 0;
      const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
      return {
        label: opt.label?.th || opt.value,
        value: opt.value,
        count,
        percentage: pct,
        color: PALETTE[i % PALETTE.length],
      };
    });

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-xl bg-[#1B3A6B]/10 text-[#1B3A6B] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              {index}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  หลายตัวเลือก (Checkbox / Multiple)
                </span>
                {field.is_required && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">
                    จำเป็น
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                {field.label?.th || field.field_key}
              </h3>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="font-bold text-slate-900">{answeredCount}</span>
            <span className="text-slate-500"> / {totalSubmissions} ตอบ</span>
            <span className="text-slate-400 ml-1">({answerRate}%)</span>
          </div>
        </div>

        {/* Checkbox horizontal bars */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 items-center">
          <div className="lg:col-span-7 h-64 w-full">
            {isMounted && answeredCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#334155' }}
                    width={130}
                    tickFormatter={(val) => (val.length > 15 ? val.slice(0, 15) + '...' : val)}
                  />
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
                      'จำนวนผู้เลือก',
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={`cb-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                ยังไม่มีข้อมูลคำตอบในข้อนี้
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-2.5">
            {chartData.map((opt) => (
              <div key={opt.value} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className="w-3 h-3 rounded-md shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span className="font-semibold text-slate-800 truncate">{opt.label}</span>
                  </div>
                  <div className="shrink-0 font-bold text-slate-900">
                    {opt.count} <span className="font-normal text-slate-500">({opt.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${opt.percentage}%`,
                      backgroundColor: opt.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. Rating / Scale / Numbers
  if (field.field_type === 'rating' || field.field_type === 'number') {
    const numericValues = rawAnswers
      .map((v) => Number(v))
      .filter((n) => !isNaN(n));

    const count = numericValues.length;
    const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
    const avg = count > 0 ? (sum / count).toFixed(1) : '0';
    const min = count > 0 ? Math.min(...numericValues) : 0;
    const max = count > 0 ? Math.max(...numericValues) : 0;

    // Distribution
    const distMap: Record<number, number> = {};
    if (field.field_type === 'rating') {
      for (let star = 1; star <= 5; star++) distMap[star] = 0;
      numericValues.forEach((val) => {
        const star = Math.min(5, Math.max(1, Math.round(val)));
        distMap[star] = (distMap[star] || 0) + 1;
      });
    } else {
      numericValues.forEach((val) => {
        distMap[val] = (distMap[val] || 0) + 1;
      });
    }

    const distData = Object.entries(distMap)
      .map(([val, cnt]) => ({
        label: field.field_type === 'rating' ? `${val} ดาว ⭐` : `${val}`,
        score: Number(val),
        count: cnt,
        percentage: count > 0 ? Math.round((cnt / count) * 100) : 0,
      }))
      .sort((a, b) => a.score - b.score);

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              {index}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {field.field_type === 'rating' ? 'ระดับคะแนนความพึงพอใจ (Rating)' : 'ตัวเลข (Number)'}
                </span>
                {field.is_required && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">
                    จำเป็น
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                {field.label?.th || field.field_key}
              </h3>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="font-bold text-slate-900">{answeredCount}</span>
            <span className="text-slate-500"> / {totalSubmissions} ตอบ</span>
            <span className="text-slate-400 ml-1">({answerRate}%)</span>
          </div>
        </div>

        {/* Rating Metrics & Chart */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
          {/* Average Box */}
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <div className="text-xs font-semibold text-amber-800">คะแนนเฉลี่ย (Average)</div>
            <div className="text-3xl font-black text-amber-950 mt-1 flex items-center gap-1.5">
              <span>{avg}</span>
              {field.field_type === 'rating' && <span className="text-base text-amber-500">/ 5.0</span>}
            </div>
            {field.field_type === 'rating' && (
              <div className="flex items-center gap-1 mt-2 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(Number(avg))
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-amber-200'
                    }`}
                  />
                ))}
              </div>
            )}
            <div className="text-[11px] text-amber-700 mt-2">
              ต่ำสุด: {min} | สูงสุด: {max}
            </div>
          </div>

          {/* Distribution Bar Chart */}
          <div className="md:col-span-3 h-52 w-full">
            {isMounted && count > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
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
                      'จำนวนผู้ตอบ',
                    ]}
                  />
                  <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                ยังไม่มีข้อมูลคะแนน
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 4. File Upload
  if (field.field_type === 'file_upload') {
    const fileList: { url: string; respondent: string; date: string }[] = [];
    responses.forEach((r) => {
      const val = r.answers?.[field.field_key];
      if (val) {
        const dateStr = new Date(r.submitted_at).toLocaleDateString('th-TH');
        if (Array.isArray(val)) {
          val.forEach((url) => fileList.push({ url, respondent: r.respondent_email || 'ผู้ตอบ', date: dateStr }));
        } else if (typeof val === 'string' && val.startsWith('http')) {
          fileList.push({ url: val, respondent: r.respondent_email || 'ผู้ตอบ', date: dateStr });
        }
      }
    });

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-xl bg-violet-500/10 text-violet-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              {index}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  ไฟล์แนบ (File Upload)
                </span>
                {field.is_required && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">
                    จำเป็น
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                {field.label?.th || field.field_key}
              </h3>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="font-bold text-slate-900">{fileList.length}</span>
            <span className="text-slate-500"> ไฟล์ที่อัปโหลด</span>
          </div>
        </div>

        {fileList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">ยังไม่มีไฟล์อัปโหลดในข้อนี้</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {fileList.map((file, i) => (
              <a
                key={i}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Paperclip className="w-4 h-4 text-violet-600 shrink-0" />
                  <div className="truncate text-left">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {file.url.split('/').pop() || `ไฟล์ที่ ${i + 1}`}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{file.respondent} • {file.date}</p>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2" />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 5. Text / Textarea (Open-ended responses)
  const filteredTexts = rawAnswers
    .map(String)
    .filter((txt) =>
      searchQuery ? txt.toLowerCase().includes(searchQuery.toLowerCase()) : true
    );

  const displayedTexts = isExpanded ? filteredTexts : filteredTexts.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
            {index}
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {field.field_type === 'textarea' ? 'ข้อความยาว (Paragraph)' : 'ข้อความสั้น (Short Text)'}
              </span>
              {field.is_required && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">
                  จำเป็น
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
              {field.label?.th || field.field_key}
            </h3>
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="font-bold text-slate-900">{answeredCount}</span>
          <span className="text-slate-500"> / {totalSubmissions} ตอบ</span>
          <span className="text-slate-400 ml-1">({answerRate}%)</span>
        </div>
      </div>

      {/* Search Input for Text Responses */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาข้อความในคำตอบ..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7B1C3E]"
          />
        </div>
        <span className="text-[11px] text-slate-500 shrink-0">
          แสดง {displayedTexts.length} จาก {rawAnswers.length} ข้อความ
        </span>
      </div>

      {/* Answers list */}
      <div className="mt-3 space-y-2">
        {displayedTexts.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            {searchQuery ? 'ไม่พบข้อความที่ค้นหา' : 'ยังไม่มีคำตอบในข้อนี้'}
          </div>
        ) : (
          displayedTexts.map((text, i) => (
            <div
              key={i}
              className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-800 leading-relaxed"
            >
              {text}
            </div>
          ))
        )}
      </div>

      {/* Expand / Collapse Button */}
      {filteredTexts.length > 5 && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-xs font-semibold text-[#7B1C3E] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>ย่อรายการคำตอบ</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>ดูคำตอบทั้งหมด ({filteredTexts.length} รายการ)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
