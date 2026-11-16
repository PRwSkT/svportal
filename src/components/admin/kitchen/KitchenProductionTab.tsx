'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChefHat, Lock, Printer, RefreshCw, Tags, Users, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import {
  KITCHEN_DEPARTMENT_LABELS,
  KITCHEN_DIET_LABELS,
  getKitchenBangkokDate,
  type KitchenDepartment,
  type KitchenProductionSheet,
  type KitchenSpecialTray,
} from '@/lib/kitchen/inhouse-kitchen-engine';

interface SheetResponse {
  success: boolean;
  sheet: KitchenProductionSheet;
  locked: { status: string; locked_by: string | null; locked_at: string | null } | null;
  missingTables: string[];
  error?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openPrintWindow(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) {
    toast.error('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up');
    return;
  }
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:'Sarabun','Noto Sans Thai',sans-serif;margin:16px;color:#111}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:14px 0 6px}
  table{border-collapse:collapse;width:100%;font-size:13px} th,td{border:1px solid #444;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#eee} .num{text-align:right;font-weight:700}
  .labels{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .label{border:3px solid #111;border-radius:8px;padding:10px;page-break-inside:avoid}
  .label.critical{border-color:#b91c1c;background:#fef2f2}
  .label .name{font-size:20px;font-weight:800} .label .meta{font-size:13px;margin:2px 0}
  .badge{display:inline-block;border:1px solid #111;border-radius:999px;padding:1px 8px;margin:2px 4px 2px 0;font-size:12px;font-weight:700}
  .warn{color:#b91c1c;font-weight:800;font-size:14px}
  @media print{ .noprint{display:none} }
</style></head><body>${bodyHtml}
<p class="noprint"><button onclick="window.print()">พิมพ์</button></p></body></html>`);
  w.document.close();
  w.focus();
}

function formatDateTh(date: string): string {
  try {
    return new Date(`${date}T00:00:00+07:00`).toLocaleDateString('th-TH', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok',
    });
  } catch {
    return date;
  }
}

function dietText(tray: KitchenSpecialTray): string {
  return tray.dietTypes.map((d) => KITCHEN_DIET_LABELS[d]).join(' + ');
}

function buildProductionHtml(sheet: KitchenProductionSheet): string {
  const m = sheet.menu;
  const rows = (Object.keys(KITCHEN_DEPARTMENT_LABELS) as KitchenDepartment[])
    .filter((d) => d !== 'OTHER' || sheet.standard.OTHER > 0)
    .map((d) => `<tr><td>${escapeHtml(KITCHEN_DEPARTMENT_LABELS[d])}${d === 'NURSERY' ? ' (ชิ้นเล็ก/อ่อนนุ่ม)' : ''}</td><td class="num">${sheet.standard[d]}</td><td class="num">${sheet.specialByDepartment[d]}</td></tr>`)
    .join('');
  const specialRows = sheet.special
    .map((t) => `<tr><td>${escapeHtml(t.studentName)}${t.nickname ? ` (${escapeHtml(t.nickname)})` : ''}</td><td>${escapeHtml(t.grade)}${t.classroom ? `/${escapeHtml(t.classroom)}` : ''}</td><td>${escapeHtml(dietText(t))}</td><td>${escapeHtml(t.allergens.join(', ') || '-')}</td><td>${escapeHtml(t.substituteDish || '-')}</td></tr>`)
    .join('');
  return `<h1>ใบสั่งผลิตอาหารประจำวัน — ครัวโรงเรียนสมคิดวิทยา</h1>
<div>${escapeHtml(formatDateTh(sheet.date))} · ตัดยอด ${sheet.cutoffTime} น. · ที่มาตัวเลข: ${sheet.attendanceSource === 'LIVE_ATTENDANCE' ? 'เช็กชื่อจริง' : 'พยากรณ์จากรายชื่อ (ยังไม่เช็กชื่อ)'}</div>
<h2>เมนูมาตรฐาน</h2>
<div>${escapeHtml([m?.standard_main_dish, m?.standard_side_dish, m?.standard_soup, m?.standard_fruit].filter(Boolean).join(' / ') || 'ยังไม่ได้ตั้งเมนู')}</div>
<h2>จำนวนถาด</h2>
<table><tr><th>กลุ่ม</th><th>ถาดมาตรฐาน</th><th>ถาดพิเศษ (แยกป้ายชื่อ)</th></tr>${rows}
<tr><th>รวมนักเรียน</th><th class="num">${sheet.standard.total}</th><th class="num">${sheet.special.length}</th></tr></table>
<h2>สำรับครูและบุคลากร: <b>${sheet.staff.effective}</b> ชุด${m?.staff_special_dish ? ` (เมนู: ${escapeHtml(m.staff_special_dish)})` : ''}</h2>
<h2>รวมทั้งสิ้น: <b>${sheet.totals.grandTotal}</b> ชุด</h2>
<h2>ถาดพิเศษรายบุคคล (${sheet.special.length})</h2>
<table><tr><th>ชื่อ</th><th>ชั้น</th><th>ประเภท</th><th>แพ้</th><th>เมนูทดแทน</th></tr>${specialRows || '<tr><td colspan="5">ไม่มี</td></tr>'}</table>
${sheet.warnings.length ? `<h2>ข้อควรระวัง</h2><ul>${sheet.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : ''}`;
}

function buildLabelsHtml(sheet: KitchenProductionSheet): string {
  if (sheet.special.length === 0) return '<h1>วันนี้ไม่มีถาดพิเศษ</h1>';
  const labels = sheet.special
    .map((t) => `<div class="label ${t.severity === 'CRITICAL' ? 'critical' : ''}">
<div class="name">${escapeHtml(t.studentName)}${t.nickname ? ` (${escapeHtml(t.nickname)})` : ''}</div>
<div class="meta">ชั้น ${escapeHtml(t.grade)}${t.classroom ? `/${escapeHtml(t.classroom)}` : ''} · รหัส ${escapeHtml(t.studentId)}</div>
<div>${t.dietTypes.map((d) => `<span class="badge">${escapeHtml(KITCHEN_DIET_LABELS[d])}</span>`).join('')}</div>
${t.allergens.length ? `<div class="warn">⚠ แพ้: ${escapeHtml(t.allergens.join(', '))}</div>` : ''}
${t.forbiddenIngredients.length ? `<div class="meta">ห้ามมี: ${escapeHtml(t.forbiddenIngredients.join(', '))}</div>` : ''}
<div class="meta"><b>เมนูทดแทน:</b> ${escapeHtml(t.substituteDish || 'ปรึกษาหัวหน้าโรงครัว')}</div>
${t.needsKitchenReview ? '<div class="warn">หลายเงื่อนไข — หัวหน้าโรงครัวตรวจก่อนเสิร์ฟ</div>' : ''}
</div>`)
    .join('');
  return `<h1>ป้ายถาดอาหารพิเศษ — ${escapeHtml(formatDateTh(sheet.date))}</h1><div class="labels">${labels}</div>`;
}

export default function KitchenProductionTab() {
  const [date, setDate] = useState<string>(() => getKitchenBangkokDate());
  const [data, setData] = useState<SheetResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [staffInput, setStaffInput] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/kitchen?action=sheet&date=${date}`);
        const json = (await res.json()) as SheetResponse;
        if (!res.ok) throw new Error(json.error || 'โหลดใบสั่งผลิตไม่สำเร็จ');
        setData(json);
        setStaffInput(json.sheet.staff.override != null ? String(json.sheet.staff.override) : '');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'โหลดใบสั่งผลิตไม่สำเร็จ');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [date]
  );

  useEffect(() => {
    load();
    if (date !== getKitchenBangkokDate()) return;
    const timer = setInterval(() => load(true), 60_000);
    return () => clearInterval(timer);
  }, [load, date]);

  const sheet = data?.sheet;
  const isLocked = data?.locked?.status === 'LOCKED';
  const criticalCount = useMemo(() => sheet?.special.filter((t) => t.severity === 'CRITICAL').length ?? 0, [sheet]);

  const post = async (payload: Record<string, unknown>, okMessage: string) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/admin/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ดำเนินการไม่สำเร็จ');
      toast.success(okMessage);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex gap-3">
        <ChefHat className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          <strong>โรงครัวภายในโรงเรียน:</strong> อาหารกลางวันรวมอยู่ในค่าเทอม ทุกคนทานเมนูเดียวกัน ยกเว้นครู/บุคลากร และเด็กที่แพ้อาหาร/ศาสนา/โรคประจำตัว/อาหารอ่อน
          (โรงเรียนไม่เบิกเงินอุดหนุนอาหารกลางวันจากรัฐ) ตัวเลขดึงจากการเช็กชื่อเช้า ห้องพยาบาล และลงเวลาครูแบบเรียลไทม์
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">วันที่ผลิต:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
          />
          <button
            onClick={() => load()}
            disabled={isLoading}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> รีเฟรช
          </button>
          {sheet && (
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${sheet.attendanceSource === 'LIVE_ATTENDANCE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {sheet.attendanceSource === 'LIVE_ATTENDANCE' ? 'ตัวเลขจากเช็กชื่อจริง' : 'พยากรณ์จากรายชื่อ (ยังไม่เช็กชื่อ)'}
            </span>
          )}
          {isLocked && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-white flex items-center gap-1">
              <Lock className="w-3 h-3" /> ล็อกแล้ว {data?.locked?.locked_by ? `โดย ${data.locked.locked_by}` : ''}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={!sheet}
            onClick={() => sheet && openPrintWindow('ใบสั่งผลิตอาหารประจำวัน', buildProductionHtml(sheet))}
            className="px-4 py-2 bg-[#7B1C3E] hover:bg-[#681834] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> พิมพ์ใบสั่งผลิต
          </button>
          <button
            disabled={!sheet}
            onClick={() => sheet && openPrintWindow('ป้ายถาดอาหารพิเศษ', buildLabelsHtml(sheet))}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Tags className="w-4 h-4" /> พิมพ์ป้ายถาดพิเศษ
          </button>
          <button
            disabled={!sheet || isLocked || isBusy}
            onClick={() => {
              if (confirm('ล็อกใบสั่งผลิตของวันนี้? หลังล็อกจะแก้จำนวนสำรับครูไม่ได้ และใช้ยอดนี้คำนวณต้นทุนต่อถาด')) {
                post({ action: 'lock_sheet', date }, 'ล็อกใบสั่งผลิตเรียบร้อย');
              }
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Lock className="w-4 h-4" /> ล็อกใบสั่งผลิต
          </button>
        </div>
      </div>

      {data && data.missingTables.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
          ยังไม่พบตาราง: <span className="font-mono">{data.missingTables.join(', ')}</span> — ให้ผู้ดูแลระบบรัน migration{' '}
          <span className="font-mono">20261114000003_inhouse_kitchen_engine.sql</span> แล้วรีเฟรช
        </div>
      )}

      {sheet && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {(['NURSERY', 'KINDERGARTEN', 'PRIMARY'] as KitchenDepartment[]).map((d) => (
              <div key={d} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-bold text-slate-400">ถาดมาตรฐาน · {KITCHEN_DEPARTMENT_LABELS[d]}</p>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {sheet.standard[d]} <span className="text-xs font-normal text-slate-400">ถาด</span>
                </p>
                <p className="text-[11px] text-slate-400">+ พิเศษ {sheet.specialByDepartment[d]} ถาด</p>
              </div>
            ))}
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm">
              <p className="text-xs font-bold text-red-600">ถาดพิเศษรายบุคคล</p>
              <p className="text-2xl font-extrabold text-red-700">
                {sheet.special.length} <span className="text-xs font-normal">ถาด</span>
              </p>
              <p className="text-[11px] text-red-500">ระวังสูงสุด {criticalCount} คน</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-bold text-slate-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> สำรับครู/บุคลากร</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {sheet.staff.effective} <span className="text-xs font-normal text-slate-400">ชุด</span>
              </p>
              <p className="text-[11px] text-slate-400">ลงเวลา {sheet.staff.present} คน{sheet.staff.override != null ? ' (ปรับมือ)' : ''}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-extrabold flex items-center gap-2 mb-2"><Utensils className="w-4 h-4 text-[#7B1C3E]" /> เมนูวันนี้ — {formatDateTh(sheet.date)}</h3>
              {sheet.menu ? (
                <div className="text-sm space-y-1">
                  <p><b>เมนูหลัก:</b> {sheet.menu.standard_main_dish}</p>
                  {sheet.menu.standard_side_dish && <p><b>กับข้าว:</b> {sheet.menu.standard_side_dish}</p>}
                  {sheet.menu.standard_soup && <p><b>ซุป/แกง:</b> {sheet.menu.standard_soup}</p>}
                  {sheet.menu.standard_fruit && <p><b>ผลไม้:</b> {sheet.menu.standard_fruit}</p>}
                  {sheet.menu.standard_allergens && sheet.menu.standard_allergens.length > 0 && (
                    <p className="text-red-700"><b>สารก่อภูมิแพ้ในเมนูมาตรฐาน:</b> {sheet.menu.standard_allergens.join(', ')}</p>
                  )}
                  {sheet.menu.staff_special_dish && <p><b>เมนูครู/บุคลากร:</b> {sheet.menu.staff_special_dish}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-500">ยังไม่ได้ตั้งเมนูของวันนี้ — ไปที่แท็บ &quot;เมนูประจำสัปดาห์&quot;</p>
              )}
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <h3 className="text-sm font-extrabold">ปรับจำนวนสำรับครู/บุคลากร</h3>
              <p className="text-[11px] text-slate-500">ใช้เมื่อมีวิทยากร/แขก หรือครูไม่ได้ลงเวลาผ่านระบบ (เว้นว่าง = ใช้ตัวเลขลงเวลาจริง)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={staffInput}
                  disabled={isLocked}
                  onChange={(e) => setStaffInput(e.target.value)}
                  className="w-24 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono font-bold"
                />
                <button
                  disabled={isLocked || isBusy}
                  onClick={() => post({ action: 'set_staff_override', date, staff_count: staffInput === '' ? null : Number(staffInput) }, 'บันทึกจำนวนสำรับครูแล้ว')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs disabled:opacity-50"
                >
                  บันทึก
                </button>
              </div>
              <p className="text-xs font-bold pt-1">รวมทั้งสิ้น <span className="text-lg font-extrabold text-[#7B1C3E]">{sheet.totals.grandTotal}</span> ชุด</p>
            </div>
          </div>

          {sheet.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
              {sheet.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-900 dark:text-amber-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{w}</p>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 text-sm font-extrabold">ถาดอาหารพิเศษรายบุคคล ({sheet.special.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">ชื่อ</th>
                    <th className="py-3 px-3">ชั้น</th>
                    <th className="py-3 px-3">ประเภท</th>
                    <th className="py-3 px-3">แพ้ / ห้ามมี</th>
                    <th className="py-3 px-3">เมนูทดแทน</th>
                    <th className="py-3 px-3">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sheet.special.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-400">วันนี้ไม่มีถาดอาหารพิเศษ</td></tr>
                  )}
                  {sheet.special.map((t) => (
                    <tr key={t.studentId} className={t.severity === 'CRITICAL' ? 'bg-red-50/60 dark:bg-red-950/20' : ''}>
                      <td className="py-3 px-4 font-bold">
                        {t.studentName}
                        {t.nickname && <span className="text-slate-400 font-normal"> ({t.nickname})</span>}
                        <span className="block text-[11px] font-mono text-slate-400">รหัส {t.studentId}{t.verifiedByNurse ? ' · พยาบาลยืนยัน' : ''}</span>
                      </td>
                      <td className="py-3 px-3">{t.grade}{t.classroom ? `/${t.classroom}` : ''}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {t.dietTypes.map((d) => (
                            <span key={d} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800">{KITCHEN_DIET_LABELS[d]}</span>
                          ))}
                          {t.severity === 'CRITICAL' && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white">ระวังสูงสุด</span>}
                          {t.needsKitchenReview && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">หลายเงื่อนไข</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {t.allergens.length > 0 && <span className="text-red-700 font-bold">แพ้: {t.allergens.join(', ')}</span>}
                        {t.forbiddenIngredients.length > 0 && <span className="block text-slate-500">ห้าม: {t.forbiddenIngredients.join(', ')}</span>}
                        {t.allergens.length === 0 && t.forbiddenIngredients.length === 0 && '-'}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold">{t.substituteDish || <span className="text-amber-700">ยังไม่ระบุ</span>}</td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">{t.notes.join(' · ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {sheet.excluded.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4">
              <h3 className="text-sm font-extrabold mb-2">ไม่เตรียมถาด ({sheet.excluded.length})</h3>
              <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                {sheet.excluded.map((e) => (
                  <li key={e.studentId}><b>{e.studentName}</b> ({e.grade}) — {e.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
