'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, RefreshCw, Save, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { getKitchenBangkokDate, type KitchenMenu } from '@/lib/kitchen/inhouse-kitchen-engine';

export default function KitchenMenuTab() {
  const [selectedDate, setSelectedDate] = useState<string>(() => getKitchenBangkokDate());
  const [menus, setMenus] = useState<Record<string, KitchenMenu>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for selected date
  const [formData, setFormData] = useState<Partial<KitchenMenu>>({
    standard_main_dish: '',
    standard_side_dish: '',
    standard_soup: '',
    standard_fruit: '',
    standard_allergens: [],
    halal_substitute: '',
    vegetarian_substitute: '',
    allergy_free_substitute: '',
    soft_diet_substitute: '',
    staff_special_dish: '',
    target_cost_per_head: 30,
  });

  const [allergenInput, setAllergenInput] = useState<string>('');

  // Calculate week range (Monday to Friday) around selectedDate
  const getWeekRange = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00+07:00`);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const toIso = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dateNum = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${dateNum}`;
    };

    return { from: toIso(monday), to: toIso(friday) };
  };

  const fetchWeekMenus = useCallback(async () => {
    setIsLoading(true);
    const { from, to } = getWeekRange(selectedDate);
    try {
      const res = await fetch(`/api/admin/kitchen?action=menus&from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'โหลดเมนูไม่สำเร็จ');

      const menuMap: Record<string, KitchenMenu> = {};
      (json.menus || []).forEach((m: KitchenMenu) => {
        menuMap[m.menu_date] = m;
      });
      setMenus(menuMap);

      if (menuMap[selectedDate]) {
        const cur = menuMap[selectedDate];
        setFormData({ ...cur });
        setAllergenInput((cur.standard_allergens || []).join(', '));
      } else {
        setFormData({
          menu_date: selectedDate,
          standard_main_dish: '',
          standard_side_dish: '',
          standard_soup: '',
          standard_fruit: '',
          standard_allergens: [],
          halal_substitute: '',
          vegetarian_substitute: '',
          allergy_free_substitute: '',
          soft_diet_substitute: '',
          staff_special_dish: '',
          target_cost_per_head: 30,
        });
        setAllergenInput('');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'โหลดเมนูไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchWeekMenus();
  }, [fetchWeekMenus]);

  const handleSelectDate = (d: string) => {
    setSelectedDate(d);
    if (menus[d]) {
      const cur = menus[d];
      setFormData({ ...cur });
      setAllergenInput((cur.standard_allergens || []).join(', '));
    } else {
      setFormData({
        menu_date: d,
        standard_main_dish: '',
        standard_side_dish: '',
        standard_soup: '',
        standard_fruit: '',
        standard_allergens: [],
        halal_substitute: '',
        vegetarian_substitute: '',
        allergy_free_substitute: '',
        soft_diet_substitute: '',
        staff_special_dish: '',
        target_cost_per_head: 30,
      });
      setAllergenInput('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.standard_main_dish?.trim()) {
      toast.error('กรุณาระบุเมนูหลักมาตรฐาน');
      return;
    }

    setIsSaving(true);
    const allergens = allergenInput
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/admin/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_menu',
          menu_date: selectedDate,
          ...formData,
          standard_allergens: allergens,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกเมนูไม่สำเร็จ');
      toast.success('บันทึกเมนูประจำวันเรียบร้อยแล้ว');
      fetchWeekMenus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกเมนูไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate 5 days of current week
  const { from } = getWeekRange(selectedDate);
  const weekDays = Array.from({ length: 5 }).map((_, idx) => {
    const d = new Date(`${from}T00:00:00+07:00`);
    d.setDate(d.getDate() + idx);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateNum = String(d.getDate()).padStart(2, '0');
    const iso = `${year}-${month}-${dateNum}`;
    const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    return {
      iso,
      dayName: dayNames[d.getDay()],
      dateTh: `${d.getDate()} / ${d.getMonth() + 1}`,
      hasMenu: Boolean(menus[iso]),
    };
  });

  return (
    <div className="space-y-6">
      {/* Week Selector Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#7B1C3E]" />
          <span className="text-sm font-bold text-slate-800 dark:text-white">เลือกวันและรอบสัปดาห์:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleSelectDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
          />
          <button
            onClick={() => fetchWeekMenus()}
            disabled={isLoading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
            title="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {weekDays.map((day) => {
            const isSelected = day.iso === selectedDate;
            return (
              <button
                key={day.iso}
                onClick={() => handleSelectDate(day.iso)}
                className={`flex-1 md:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div>วัน{day.dayName}</div>
                <div className="text-[10px] opacity-80">{day.dateTh}</div>
                <div className="mt-1">
                  {day.hasMenu ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-slate-300"></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Utensils className="w-5 h-5 text-[#7B1C3E]" />
              กำหนดเมนูอาหารประจำวัน ({selectedDate})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              เมนูมาตรฐานจะเสิร์ฟให้นักเรียนทุกคน ยกเว้นกรณีอาหารแพ้ ฮาลาล หรืออาหารอ่อนตามที่ระบุเมนูทดแทนไว้
            </p>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#681834] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกเมนูประจำวันนี้'}</span>
          </button>
        </div>

        {/* Standard Menu Fields */}
        <div className="space-y-4">
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">1. รายการเมนูมาตรฐาน (ถาดปกติ)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                เมนูหลัก (เช่น ข้าวผัดไข่ใส่ไก่ / ข้าวสวย พะแนงไก่) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.standard_main_dish || ''}
                onChange={(e) => setFormData({ ...formData, standard_main_dish: e.target.value })}
                placeholder="ระบุเมนูหลัก..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                กับข้าวเสริม / ผักเครื่องเคียง
              </label>
              <input
                type="text"
                value={formData.standard_side_dish || ''}
                onChange={(e) => setFormData({ ...formData, standard_side_dish: e.target.value })}
                placeholder="เช่น แตงกวาและแครอทต้ม..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ต้ม / ซุป / แกงจืด
              </label>
              <input
                type="text"
                value={formData.standard_soup || ''}
                onChange={(e) => setFormData({ ...formData, standard_soup: e.target.value })}
                placeholder="เช่น ต้มจืดเต้าหู้หมูสับ/ไก่สับ..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ผลไม้ / ของว่างช่วงบ่าย
              </label>
              <input
                type="text"
                value={formData.standard_fruit || ''}
                onChange={(e) => setFormData({ ...formData, standard_fruit: e.target.value })}
                placeholder="เช่น ส้มโอ / กล้วยน้ำว้า..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-red-700 dark:text-red-400 mb-1">
              สารก่อภูมิแพ้ในเมนูมาตรฐาน (คั่นด้วยจุลภาค เช่น ไข่ไก่, ถั่วลิสง, กุ้ง, แป้งสาลี)
            </label>
            <input
              type="text"
              value={allergenInput}
              onChange={(e) => setAllergenInput(e.target.value)}
              placeholder="ระบุสารก่อภูมิแพ้เพื่อเตือนใบสั่งผลิตอัตโนมัติ..."
              className="w-full px-3.5 py-2 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              ระบบจะจับคู่กับประวัติแพ้อาหารของเด็ก หากตรงกันจะขึ้นป้ายเตือน &quot;ระวังสูงสุด (CRITICAL)&quot; ทันที
            </p>
          </div>
        </div>

        {/* Substitute Dishes */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">2. เมนูทดแทนสำหรับถาดพิเศษ</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                เมนูทดแทนสำหรับเด็กแพ้อาหาร (Allergy-Free Substitute)
              </label>
              <input
                type="text"
                value={formData.allergy_free_substitute || ''}
                onChange={(e) => setFormData({ ...formData, allergy_free_substitute: e.target.value })}
                placeholder="เช่น ข้าวสวย อกไก่ย่างเกลือ ต้มจืดผักกาดขาว..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                เมนูทดแทนอาหารอ่อน / ข้าวต้ม (ห้องพยาบาลหรือท้องเสีย)
              </label>
              <input
                type="text"
                value={formData.soft_diet_substitute || ''}
                onChange={(e) => setFormData({ ...formData, soft_diet_substitute: e.target.value })}
                placeholder="เช่น ข้าวต้มไก่สับใส่แครอทละเอียด..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                เมนูทดแทนฮาลาล (Halal Substitute)
              </label>
              <input
                type="text"
                value={formData.halal_substitute || ''}
                onChange={(e) => setFormData({ ...formData, halal_substitute: e.target.value })}
                placeholder="เช่น ข้าวผัดไก่ฮาลาล (ไม่ปนเปื้อนหมู)..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                เมนูทดแทนมังสวิรัติ (Vegetarian Substitute)
              </label>
              <input
                type="text"
                value={formData.vegetarian_substitute || ''}
                onChange={(e) => setFormData({ ...formData, vegetarian_substitute: e.target.value })}
                placeholder="เช่น ผัดผักรวมมิตรเต้าหู้ทอด..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {/* Staff & Target Cost */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">3. สำรับครู/บุคลากร และงบประมาณเป้าหมาย</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                เมนูพิเศษสำหรับครูและบุคลากร (Staff Dish)
              </label>
              <input
                type="text"
                value={formData.staff_special_dish || ''}
                onChange={(e) => setFormData({ ...formData, staff_special_dish: e.target.value })}
                placeholder="เช่น น้ำพริกกะปิ ปลาทูทอด ผักสด (เว้นว่างได้ถ้าทานเหมือนนักเรียน)..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                งบประมาณวัตถุดิบเป้าหมาย (บาท/หัว/มื้อ)
              </label>
              <input
                type="number"
                min={10}
                max={200}
                value={formData.target_cost_per_head || 30}
                onChange={(e) => setFormData({ ...formData, target_cost_per_head: Number(e.target.value) })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
