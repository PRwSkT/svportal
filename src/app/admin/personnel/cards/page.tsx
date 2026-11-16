'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Users, 
  Search, 
  Filter, 
  RotateCw, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  Eye, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  GraduationCap,
  Briefcase,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { Personnel } from '@/types';
import { StaffIdCard } from '@/components/staff-card/StaffIdCard';
import { StaffCardModal } from '@/components/staff-card/StaffCardModal';
import { formatStaffName } from '@/lib/staff-card/utils';

export default function AdminStaffCardsPage() {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load personnel list
  useEffect(() => {
    const fetchPersonnel = async () => {
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');
        setPersonnelList(data.all_personnel || []);
      } catch (err: any) {
        console.error('Error fetching personnel:', err);
        toast.error('ไม่สามารถโหลดข้อมูลบุคลากรได้', { description: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonnel();
  }, []);

  // Filtered list
  const filteredList = useMemo(() => {
    return personnelList.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTh = (p.name_th || '').toLowerCase().includes(q);
        const matchEn = (p.name_en || '').toLowerCase().includes(q);
        const matchPosTh = (p.position_th || '').toLowerCase().includes(q);
        const matchPosEn = (p.position_en || '').toLowerCase().includes(q);
        const matchEmail = (p.email || '').toLowerCase().includes(q);
        if (!matchTh && !matchEn && !matchPosTh && !matchPosEn && !matchEmail) {
          return false;
        }
      }
      return true;
    });
  }, [personnelList, searchQuery, selectedCategory]);

  const stats = useMemo(() => {
    const total = personnelList.length;
    const teachers = personnelList.filter((p) => p.category === 'teacher').length;
    const executives = personnelList.filter((p) => p.category === 'executive').length;
    const staff = personnelList.filter((p) => p.category === 'staff').length;
    return { total, teachers, executives, staff };
  }, [personnelList]);

  const handleOpenCardModal = (p: Personnel) => {
    setSelectedPersonnel(p);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              ระบบบัตรประจำตัวบุคลากรออนไลน์
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#183e66] text-white">
              Studio
            </span>
          </div>
          <p className="text-xs text-slate-500">
            ดูตัวอย่าง ตรวจสอบ และดาวน์โหลดบัตรประจำตัวดิจิทัลของครูและบุคลากรทุกท่าน
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/staff/id-card"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-sky-600" />
            <span>ดูบัตรของฉัน</span>
          </Link>

          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#183e66] hover:bg-[#122f4d] text-white shadow-xs transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>จัดการผู้ใช้และข้อมูลทำเนียบ</span>
          </Link>
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400">บุคลากรทั้งหมด</span>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600">ครูผู้สอน</span>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{stats.teachers}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold text-indigo-600">คณะผู้บริหาร</span>
          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mt-1">{stats.executives}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold text-sky-600">สายสนับสนุน</span>
          <p className="text-2xl font-bold text-sky-700 dark:text-sky-400 mt-1">{stats.staff}</p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อไทย, ชื่ออังกฤษ, ตำแหน่ง หรืออีเมล..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'teacher', label: 'ครูผู้สอน' },
            { id: 'executive', label: 'ผู้บริหาร' },
            { id: 'staff', label: 'สายสนับสนุน' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-[#183e66] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Personnel Grid */}
      {isLoading ? (
        <div className="py-24 text-center">
          <RotateCw className="w-8 h-8 text-[#183e66] animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">กำลังโหลดรายชื่อบุคลากร...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 p-6">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">ไม่พบบุคลากรที่ค้นหา</h3>
          <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredList.map((p) => {
            const nameInfo = formatStaffName(p.name_en, p.name_th);
            return (
              <div
                key={p.id}
                onClick={() => handleOpenCardModal(p)}
                className="group relative bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600 shadow-2xs hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col items-center"
              >
                {/* Mini Card Preview with hover 3D tilt */}
                <div className="w-full flex justify-center py-2">
                  <div className="transition-transform duration-300 group-hover:scale-[1.03]">
                    <StaffIdCard
                      personnel={p}
                      width={220}
                      showControls={false}
                    />
                  </div>
                </div>

                {/* Details Footer */}
                <div className="w-full mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-center">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {p.name_th}
                  </h4>
                  <p className="text-[11px] text-[#183e66] dark:text-sky-300 font-semibold truncate mt-0.5">
                    {nameInfo.fullNameEn}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {p.position_th || p.position_en}
                  </p>

                  <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-400 group-hover:text-sky-700">
                    <Eye className="w-3.5 h-3.5" />
                    <span>คลิกเพื่อดูและดาวน์โหลดบัตร</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card Details Modal */}
      <StaffCardModal
        personnel={selectedPersonnel}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPersonnel(null);
        }}
        onUpdated={(updated) => {
          setSelectedPersonnel(updated);
          setPersonnelList((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
        }}
      />
    </div>
  );
}
