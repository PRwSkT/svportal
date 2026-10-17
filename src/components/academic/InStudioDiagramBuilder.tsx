'use client';

import React, { useState, useMemo } from 'react';
import { 
  Shapes, 
  X, 
  Check, 
  CircleDot, 
  PieChart, 
  Sliders, 
  Maximize2, 
  BarChart2, 
  Zap,
  Layers
} from 'lucide-react';

interface InStudioDiagramBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (svgString: string) => void;
}

type DiagramCategory = 'geometry' | 'venn' | 'fraction' | 'numberline' | 'circuit' | 'barchart';

export function InStudioDiagramBuilderModal({
  isOpen,
  onClose,
  onInsert
}: InStudioDiagramBuilderProps) {
  const [category, setCategory] = useState<DiagramCategory>('geometry');

  // Geometry state
  const [geoSubtype, setGeoSubtype] = useState<'right_triangle' | 'rectangle' | 'circle' | 'parallel_lines'>('right_triangle');
  const [sideA, setSideA] = useState('8 cm');
  const [sideB, setSideB] = useState('6 cm');
  const [sideC, setSideC] = useState('? cm');
  const [circleRadius, setCircleRadius] = useState('r = 7 cm');

  // Venn state
  const [vennType, setVennType] = useState<'2_sets' | '3_sets'>('2_sets');
  const [setALabel, setSetALabel] = useState('ชอบคณิตศาสตร์ (A)');
  const [setBLabel, setSetBLabel] = useState('ชอบวิทยาศาสตร์ (B)');
  const [countA, setCountA] = useState('18');
  const [countB, setCountB] = useState('12');
  const [countBoth, setCountBoth] = useState('5');

  // Fraction state
  const [fractionType, setFractionType] = useState<'pie' | 'bar'>('pie');
  const [numerator, setNumerator] = useState(3);
  const [denominator, setDenominator] = useState(8);

  // Number line state
  const [nlStart, setNlStart] = useState(-5);
  const [nlEnd, setNlEnd] = useState(5);
  const [nlMarkA, setNlMarkA] = useState(-2);
  const [nlMarkALabel, setNlMarkALabel] = useState('A');
  const [nlMarkB, setNlMarkB] = useState(3);
  const [nlMarkBLabel, setNlMarkBLabel] = useState('B');

  // Circuit state
  const [switchOpen, setSwitchOpen] = useState(false);
  const [bulbCount, setBulbCount] = useState<1 | 2>(2);
  const [circuitType, setCircuitType] = useState<'series' | 'parallel'>('series');

  // Bar chart state
  const [barTitle, setBarTitle] = useState('จำนวนนักเรียนที่ชอบกีฬาต่างๆ');
  const [barItems, setBarItems] = useState([
    { name: 'ฟุตบอล', val: 24 },
    { name: 'บาสเกตบอล', val: 18 },
    { name: 'แบดมินตัน', val: 15 },
    { name: 'ว่ายน้ำ', val: 10 }
  ]);

  // Generate SVG String based on settings
  const generatedSvg = useMemo(() => {
    if (category === 'geometry') {
      if (geoSubtype === 'right_triangle') {
        return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  <polygon points="60,180 280,180 60,40" fill="#f8fafc" stroke="#1e293b" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- Right angle marker -->
  <polyline points="60,162 78,162 78,180" fill="none" stroke="#1e293b" stroke-width="1.8"/>
  <!-- Labels -->
  <text x="170" y="202" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${sideA}</text>
  <text x="35" y="115" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${sideB}</text>
  <text x="185" y="100" font-size="14" font-weight="bold" fill="#b91c1c" text-anchor="middle" font-family="sans-serif">${sideC}</text>
  <circle cx="60" cy="180" r="3.5" fill="#0f172a"/>
  <circle cx="280" cy="180" r="3.5" fill="#0f172a"/>
  <circle cx="60" cy="40" r="3.5" fill="#0f172a"/>
  <text x="45" y="195" font-size="13" font-weight="bold" fill="#64748b">B</text>
  <text x="290" y="195" font-size="13" font-weight="bold" fill="#64748b">C</text>
  <text x="45" y="35" font-size="13" font-weight="bold" fill="#64748b">A</text>
</svg>`;
      }

      if (geoSubtype === 'rectangle') {
        return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  <rect x="70" y="50" width="220" height="120" fill="#f8fafc" stroke="#1e293b" stroke-width="2.5" rx="2"/>
  <!-- Labels -->
  <text x="180" y="38" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${sideA}</text>
  <text x="40" y="115" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${sideB}</text>
  <!-- Vertex markers -->
  <text x="60" y="45" font-size="13" font-weight="bold" fill="#64748b">A</text>
  <text x="300" y="45" font-size="13" font-weight="bold" fill="#64748b">B</text>
  <text x="300" y="190" font-size="13" font-weight="bold" fill="#64748b">C</text>
  <text x="60" y="190" font-size="13" font-weight="bold" fill="#64748b">D</text>
</svg>`;
      }

      if (geoSubtype === 'circle') {
        return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  <circle cx="180" cy="110" r="80" fill="#f8fafc" stroke="#1e293b" stroke-width="2.5"/>
  <circle cx="180" cy="110" r="4" fill="#0f172a"/>
  <!-- Radius line -->
  <line x1="180" y1="110" x2="260" y2="110" stroke="#b91c1c" stroke-width="2" stroke-dasharray="4,2"/>
  <circle cx="260" cy="110" r="3" fill="#b91c1c"/>
  <!-- Labels -->
  <text x="165" y="115" font-size="13" font-weight="bold" fill="#64748b">O</text>
  <text x="220" y="100" font-size="13" font-weight="bold" fill="#b91c1c" text-anchor="middle" font-family="sans-serif">${circleRadius}</text>
</svg>`;
      }

      // Parallel lines
      return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  <!-- Parallel lines L1, L2 -->
  <line x1="40" y1="70" x2="320" y2="70" stroke="#1e293b" stroke-width="2.5"/>
  <line x1="40" y1="150" x2="320" y2="150" stroke="#1e293b" stroke-width="2.5"/>
  <!-- Transversal line -->
  <line x1="90" y1="20" x2="270" y2="200" stroke="#b91c1c" stroke-width="2.2"/>
  <!-- Labels -->
  <text x="25" y="75" font-size="13" font-weight="bold" fill="#1e293b">L₁</text>
  <text x="25" y="155" font-size="13" font-weight="bold" fill="#1e293b">L₂</text>
  <text x="160" y="60" font-size="13" font-weight="bold" fill="#b91c1c">1</text>
  <text x="195" y="60" font-size="13" font-weight="bold" fill="#64748b">2</text>
  <text x="220" y="140" font-size="13" font-weight="bold" fill="#b91c1c">3</text>
  <text x="255" y="140" font-size="13" font-weight="bold" fill="#64748b">4</text>
  <text x="180" y="215" font-size="12" fill="#64748b" text-anchor="middle">กำหนดให้ L₁ // L₂</text>
</svg>`;
    }

    if (category === 'venn') {
      return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  <!-- Universe box -->
  <rect x="20" y="20" width="320" height="180" fill="#fafafa" stroke="#475569" stroke-width="2" rx="4"/>
  <text x="35" y="42" font-size="14" font-weight="bold" fill="#334155">U</text>
  <!-- Circles -->
  <circle cx="140" cy="115" r="65" fill="#3b82f6" fill-opacity="0.12" stroke="#2563eb" stroke-width="2.2"/>
  <circle cx="220" cy="115" r="65" fill="#10b981" fill-opacity="0.12" stroke="#059669" stroke-width="2.2"/>
  <!-- Labels -->
  <text x="110" y="45" font-size="12" font-weight="bold" fill="#1e40af" text-anchor="middle">${setALabel}</text>
  <text x="250" y="45" font-size="12" font-weight="bold" fill="#065f46" text-anchor="middle">${setBLabel}</text>
  <text x="110" y="120" font-size="15" font-weight="bold" fill="#1e293b" text-anchor="middle">${countA}</text>
  <text x="180" y="120" font-size="16" font-weight="bold" fill="#b91c1c" text-anchor="middle">${countBoth}</text>
  <text x="250" y="120" font-size="15" font-weight="bold" fill="#1e293b" text-anchor="middle">${countB}</text>
</svg>`;
    }

    if (category === 'fraction') {
      if (fractionType === 'pie') {
        const slices = [];
        const cx = 180;
        const cy = 110;
        const r = 80;
        const safeDenom = Math.max(2, Math.min(12, denominator));
        const safeNum = Math.max(0, Math.min(safeDenom, numerator));
        const angleStep = (2 * Math.PI) / safeDenom;

        for (let i = 0; i < safeDenom; i++) {
          const a1 = i * angleStep - Math.PI / 2;
          const a2 = (i + 1) * angleStep - Math.PI / 2;
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy + r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2);
          const y2 = cy + r * Math.sin(a2);
          const isShaded = i < safeNum;
          const d = `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2} Z`;
          slices.push(
            `<path d="${d}" fill="${isShaded ? '#93c5fd' : '#ffffff'}" stroke="#1e293b" stroke-width="2"/>`
          );
        }

        return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  ${slices.join('\n  ')}
  <text x="180" y="210" font-size="13" font-weight="bold" fill="#1e293b" text-anchor="middle" font-family="sans-serif">เศษส่วน: ${safeNum}/${safeDenom}</text>
</svg>`;
      }

      // Bar fraction
      const safeDenom = Math.max(2, Math.min(12, denominator));
      const safeNum = Math.max(0, Math.min(safeDenom, numerator));
      const barWidth = 280;
      const barHeight = 60;
      const startX = 40;
      const startY = 75;
      const cellWidth = barWidth / safeDenom;
      const cells = [];

      for (let i = 0; i < safeDenom; i++) {
        const x = startX + i * cellWidth;
        const isShaded = i < safeNum;
        cells.push(
          `<rect x="${x}" y="${startY}" width="${cellWidth}" height="${barHeight}" fill="${isShaded ? '#93c5fd' : '#ffffff'}" stroke="#1e293b" stroke-width="2"/>`
        );
      }

      return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  ${cells.join('\n  ')}
  <text x="180" y="170" font-size="13" font-weight="bold" fill="#1e293b" text-anchor="middle" font-family="sans-serif">ส่วนที่แรเงาคิดเป็น: ${safeNum}/${safeDenom}</text>
</svg>`;
    }

    if (category === 'numberline') {
      const stepCount = nlEnd - nlStart;
      const totalWidth = 280;
      const startX = 40;
      const lineY = 110;
      const ticks = [];

      if (stepCount > 0 && stepCount <= 20) {
        const stepWidth = totalWidth / stepCount;
        for (let i = 0; i <= stepCount; i++) {
          const val = nlStart + i;
          const x = startX + i * stepWidth;
          ticks.push(`
  <line x1="${x}" y1="${lineY - 8}" x2="${x}" y2="${lineY + 8}" stroke="#1e293b" stroke-width="2"/>
  <text x="${x}" y="${lineY + 25}" font-size="12" fill="#475569" text-anchor="middle">${val}</text>`);
        }

        // Marker A
        if (nlMarkA >= nlStart && nlMarkA <= nlEnd) {
          const xA = startX + (nlMarkA - nlStart) * stepWidth;
          ticks.push(`
  <circle cx="${xA}" cy="${lineY}" r="5" fill="#dc2626"/>
  <text x="${xA}" y="${lineY - 15}" font-size="13" font-weight="bold" fill="#dc2626" text-anchor="middle">${nlMarkALabel}</text>`);
        }

        // Marker B
        if (nlMarkB >= nlStart && nlMarkB <= nlEnd) {
          const xB = startX + (nlMarkB - nlStart) * stepWidth;
          ticks.push(`
  <circle cx="${xB}" cy="${lineY}" r="5" fill="#2563eb"/>
  <text x="${xB}" y="${lineY - 15}" font-size="13" font-weight="bold" fill="#2563eb" text-anchor="middle">${nlMarkBLabel}</text>`);
        }
      }

      return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  <!-- Axis line with arrows -->
  <line x1="25" y1="${lineY}" x2="335" y2="${lineY}" stroke="#1e293b" stroke-width="2.5"/>
  <polygon points="340,${lineY} 330,${lineY - 5} 330,${lineY + 5}" fill="#1e293b"/>
  <polygon points="20,${lineY} 30,${lineY - 5} 30,${lineY + 5}" fill="#1e293b"/>
  ${ticks.join('')}
</svg>`;
    }

    if (category === 'circuit') {
      const switchSvg = switchOpen
        ? `<line x1="160" y1="40" x2="200" y2="20" stroke="#dc2626" stroke-width="3"/>
           <circle cx="160" cy="40" r="3.5" fill="#1e293b"/>
           <circle cx="205" cy="40" r="3.5" fill="#1e293b"/>
           <text x="180" y="15" font-size="11" font-weight="bold" fill="#dc2626" text-anchor="middle">สวิตช์เปิด (วงจรเปิด)</text>`
        : `<line x1="160" y1="40" x2="200" y2="40" stroke="#1e293b" stroke-width="3"/>
           <circle cx="160" cy="40" r="3.5" fill="#1e293b"/>
           <circle cx="200" cy="40" r="3.5" fill="#1e293b"/>
           <text x="180" y="25" font-size="11" font-weight="bold" fill="#16a34a" text-anchor="middle">สวิตช์ปิด (วงจรปิด)</text>`;

      return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  <!-- Circuit loop -->
  <rect x="60" y="40" width="240" height="130" fill="none" stroke="#1e293b" stroke-width="2.5" rx="4"/>
  <!-- Switch at top -->
  <rect x="155" y="32" width="55" height="16" fill="#ffffff"/>
  ${switchSvg}
  <!-- Battery on left -->
  <rect x="52" y="90" width="16" height="30" fill="#ffffff"/>
  <line x1="50" y1="95" x2="70" y2="95" stroke="#1e293b" stroke-width="3"/>
  <line x1="56" y1="115" x2="64" y2="115" stroke="#1e293b" stroke-width="3"/>
  <text x="40" y="98" font-size="13" font-weight="bold" fill="#1e293b">+</text>
  <text x="40" y="118" font-size="13" font-weight="bold" fill="#1e293b">-</text>
  <!-- Bulbs at bottom -->
  <rect x="120" y="160" width="40" height="20" fill="#ffffff"/>
  <circle cx="140" cy="170" r="14" fill="${switchOpen ? '#f1f5f9' : '#fef08a'}" stroke="#1e293b" stroke-width="2"/>
  <text x="140" y="174" font-size="11" font-weight="bold" fill="#1e293b" text-anchor="middle">L₁</text>
  ${bulbCount === 2 ? `
  <rect x="200" y="160" width="40" height="20" fill="#ffffff"/>
  <circle cx="220" cy="170" r="14" fill="${switchOpen ? '#f1f5f9' : '#fef08a'}" stroke="#1e293b" stroke-width="2"/>
  <text x="220" y="174" font-size="11" font-weight="bold" fill="#1e293b" text-anchor="middle">L₂</text>` : ''}
  <text x="180" y="208" font-size="12" fill="#64748b" text-anchor="middle">วงจรไฟฟ้าอย่างง่าย (ต่อ${circuitType === 'series' ? 'อนุกรม' : 'ขนาน'})</text>
</svg>`;
    }

    // Bar chart
    const maxVal = Math.max(...barItems.map(b => b.val), 30);
    const chartY = 160;
    const chartHeight = 110;
    const chartX = 60;
    const chartWidth = 260;
    const barWidth = chartWidth / (barItems.length * 1.6);
    const barsSvg = barItems.map((item, idx) => {
      const h = (item.val / maxVal) * chartHeight;
      const x = chartX + idx * (chartWidth / barItems.length) + 15;
      const y = chartY - h;
      return `
  <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="#94a3b8" stroke="#1e293b" stroke-width="1.8"/>
  <text x="${x + barWidth / 2}" y="${y - 6}" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle">${item.val}</text>
  <text x="${x + barWidth / 2}" y="${chartY + 18}" font-size="11" fill="#475569" text-anchor="middle">${item.name}</text>`;
    }).join('');

    return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[220px]">
  <rect width="360" height="220" fill="#ffffff"/>
  <text x="180" y="25" font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">${barTitle}</text>
  <!-- Axes -->
  <line x1="${chartX}" y1="40" x2="${chartX}" y2="${chartY}" stroke="#1e293b" stroke-width="2"/>
  <line x1="${chartX}" y1="${chartY}" x2="330" y2="${chartY}" stroke="#1e293b" stroke-width="2"/>
  ${barsSvg}
</svg>`;
  }, [
    category, geoSubtype, sideA, sideB, sideC, circleRadius,
    setALabel, setBLabel, countA, countB, countBoth,
    fractionType, numerator, denominator,
    nlStart, nlEnd, nlMarkA, nlMarkALabel, nlMarkB, nlMarkBLabel,
    switchOpen, bulbCount, circuitType,
    barTitle, barItems
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Shapes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">สตูดิโอสร้างแผนภาพเชิงโต้ตอบ (Diagram Studio)</h3>
              <p className="text-xs text-stone-400">สร้างแผนภาพเวกเตอร์ SVG มาตรฐาน สพฐ. คมชัด ไม่แตกเมื่อพิมพ์ A4</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 pt-3 gap-2 overflow-x-auto">
          {[
            { id: 'geometry', label: 'เรขาคณิต (Geometry)' },
            { id: 'venn', label: 'เวนน์ไดอะแกรม (Venn)' },
            { id: 'fraction', label: 'เศษส่วน (Fraction)' },
            { id: 'numberline', label: 'เส้นจำนวน (Number Line)' },
            { id: 'circuit', label: 'วงจรไฟฟ้า (Circuit)' },
            { id: 'barchart', label: 'แผนภูมิแท่ง (Bar Chart)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id as DiagramCategory)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
                category === tab.id
                  ? 'bg-white text-stone-900 border-t-2 border-primary shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body: Split View (Controls Left, Preview Right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Controls Column */}
          <div className="md:col-span-6 p-6 border-r border-stone-200 overflow-y-auto space-y-4 max-h-[58vh]">
            {category === 'geometry' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    เลือกรูปแบบรูปทรง
                  </label>
                  <select
                    value={geoSubtype}
                    onChange={(e) => setGeoSubtype(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="right_triangle">สามเหลี่ยมมุมฉาก (Right Triangle)</option>
                    <option value="rectangle">สี่เหลี่ยมมุมฉาก (Rectangle)</option>
                    <option value="circle">วงกลมและรัศมี (Circle)</option>
                    <option value="parallel_lines">เส้นขนานและเส้นตัด (Parallel Lines)</option>
                  </select>
                </div>

                {geoSubtype === 'right_triangle' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">ความยาวฐาน (a)</label>
                      <input
                        type="text"
                        value={sideA}
                        onChange={(e) => setSideA(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">ความสูง (b)</label>
                      <input
                        type="text"
                        value={sideB}
                        onChange={(e) => setSideB(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">ด้านตรงข้าม (c)</label>
                      <input
                        type="text"
                        value={sideC}
                        onChange={(e) => setSideC(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg font-bold text-rose-600"
                      />
                    </div>
                  </div>
                )}

                {geoSubtype === 'rectangle' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">ความกว้าง</label>
                      <input
                        type="text"
                        value={sideB}
                        onChange={(e) => setSideB(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">ความยาว</label>
                      <input
                        type="text"
                        value={sideA}
                        onChange={(e) => setSideA(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {geoSubtype === 'circle' && (
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">ระบุรัศมีหรือเส้นผ่านศูนย์กลาง</label>
                    <input
                      type="text"
                      value={circleRadius}
                      onChange={(e) => setCircleRadius(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}

            {category === 'venn' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-stone-600 mb-1">ชื่อเซต A</label>
                  <input
                    type="text"
                    value={setALabel}
                    onChange={(e) => setSetALabel(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1">ชื่อเซต B</label>
                  <input
                    type="text"
                    value={setBLabel}
                    onChange={(e) => setSetBLabel(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">สมาชิก A อย่างเดียว</label>
                    <input
                      type="text"
                      value={countA}
                      onChange={(e) => setCountA(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">ทั้งสองเซต (A∩B)</label>
                    <input
                      type="text"
                      value={countBoth}
                      onChange={(e) => setCountBoth(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg font-bold text-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">สมาชิก B อย่างเดียว</label>
                    <input
                      type="text"
                      value={countB}
                      onChange={(e) => setCountB(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {category === 'fraction' && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="fractionType"
                      checked={fractionType === 'pie'}
                      onChange={() => setFractionType('pie')}
                    />
                    วงกลมเค้ก (Pie)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="fractionType"
                      checked={fractionType === 'bar'}
                      onChange={() => setFractionType('bar')}
                    />
                    แถบสี่เหลี่ยม (Bar)
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">ตัวส่วน (จำนวนส่วนทั้งหมด: 2-12)</label>
                    <input
                      type="number"
                      min={2}
                      max={12}
                      value={denominator}
                      onChange={(e) => setDenominator(parseInt(e.target.value) || 2)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">ตัวเศษ (ส่วนที่แรเงา)</label>
                    <input
                      type="number"
                      min={0}
                      max={denominator}
                      value={numerator}
                      onChange={(e) => setNumerator(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg font-bold text-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {category === 'numberline' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">จุดเริ่มต้น</label>
                    <input
                      type="number"
                      value={nlStart}
                      onChange={(e) => setNlStart(parseInt(e.target.value) || -5)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">จุดสิ้นสุด</label>
                    <input
                      type="number"
                      value={nlEnd}
                      onChange={(e) => setNlEnd(parseInt(e.target.value) || 5)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">มาร์ก A (ตำแหน่ง)</label>
                    <input
                      type="number"
                      value={nlMarkA}
                      onChange={(e) => setNlMarkA(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">มาร์ก B (ตำแหน่ง)</label>
                    <input
                      type="number"
                      value={nlMarkB}
                      onChange={(e) => setNlMarkB(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {category === 'circuit' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                    สถานะสวิตช์
                  </label>
                  <button
                    onClick={() => setSwitchOpen(!switchOpen)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                      switchOpen
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {switchOpen ? 'สวิตช์เปิดอยู่ (กระแสไฟไม่ไหล)' : 'สวิตช์ปิดอยู่ (กระแสไฟไหล)'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">จำนวนหลอดไฟ</label>
                    <select
                      value={bulbCount}
                      onChange={(e) => setBulbCount(parseInt(e.target.value) as any)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    >
                      <option value={1}>1 หลอด</option>
                      <option value={2}>2 หลอด</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">การต่อวงจร</label>
                    <select
                      value={circuitType}
                      onChange={(e) => setCircuitType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                    >
                      <option value="series">อนุกรม (Series)</option>
                      <option value="parallel">ขนาน (Parallel)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {category === 'barchart' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-stone-600 mb-1">หัวข้อแผนภูมิ</label>
                  <input
                    type="text"
                    value={barTitle}
                    onChange={(e) => setBarTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-stone-600">ชุดข้อมูลแท่ง (2-4 รายการ)</label>
                  {barItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...barItems];
                          updated[idx].name = e.target.value;
                          setBarItems(updated);
                        }}
                        className="w-2/3 px-2 py-1 text-xs border border-stone-300 rounded-lg"
                        placeholder={`รายการที่ ${idx + 1}`}
                      />
                      <input
                        type="number"
                        value={item.val}
                        onChange={(e) => {
                          const updated = [...barItems];
                          updated[idx].val = parseInt(e.target.value) || 0;
                          setBarItems(updated);
                        }}
                        className="w-1/3 px-2 py-1 text-xs border border-stone-300 rounded-lg font-bold"
                        placeholder="ค่าตัวเลข"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Column */}
          <div className="md:col-span-6 p-6 bg-stone-50 flex flex-col items-center justify-center border-t md:border-t-0">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
              ภาพตัวอย่างสำหรับกระดาษข้อสอบ A4 (High Contrast SVG)
            </span>
            <div className="w-full p-4 bg-white border border-stone-300 rounded-2xl shadow-sm flex items-center justify-center overflow-hidden">
              <div 
                className="w-full flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: generatedSvg }} 
              />
            </div>
            <p className="text-[11px] text-stone-400 mt-3 text-center">
              ไฟล์เวกเตอร์ SVG ความละเอียดสูง คมชัดทุกขนาด ไม่เบลอหรือลดคุณภาพเมื่อพิมพ์บนกระดาษจริง
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            แผนภาพเวกเตอร์จะถูกบันทึกและแสดงผลทันทีใต้ข้อสอบข้อนี้
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                onInsert(generatedSvg);
                onClose();
              }}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              แนบแผนภาพลงในข้อสอบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
