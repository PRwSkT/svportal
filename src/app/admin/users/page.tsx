'use client';

import { useState, useEffect } from 'react';
import { AppUser, Personnel } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserPlus, Shield, X, Check, UserX, Settings2, CheckSquare, 
  Square, RefreshCw, Link2, Link2Off, Search, CheckCircle2, Filter
} from 'lucide-react';
import { SYSTEM_FEATURES, getRoleConfig, getFeatureName } from '@/lib/constants/roles';
import Image from 'next/image';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [allPersonnel, setAllPersonnel] = useState<Personnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'teacher' as AppUser['role'],
    assigned_features: [] as string[],
    personnel_id: '' as string
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingFeaturesUser, setEditingFeaturesUser] = useState<AppUser | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      setUsers(data.users || []);
      setAllPersonnel(data.all_personnel || []);
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้', { description: err.message });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSyncPersonnel = async () => {
    setIsSyncing(true);
    const loadingToast = toast.loading('กำลังซิงค์และเชื่อมโยงข้อมูลกับทำเนียบบุคลากร...');
    try {
      const res = await fetch('/api/admin/users', { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูล');

      toast.success(`เชื่อมโยงข้อมูลสำเร็จแล้ว ${data.count || 0} บัญชี`, { id: loadingToast });
      await loadUsers();
    } catch (err: any) {
      toast.error('การซิงค์ข้อมูลล้มเหลว', { id: loadingToast, description: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectPersonnelForCreate = (personnelId: string) => {
    if (!personnelId) {
      setFormData(prev => ({ ...prev, personnel_id: '' }));
      return;
    }
    const matched = allPersonnel.find(p => p.id === personnelId);
    if (matched) {
      let role: AppUser['role'] = 'teacher';
      if (matched.category === 'executive') role = 'executive';
      else if (matched.category === 'staff') role = 'non-academic staff';

      setFormData(prev => ({
        ...prev,
        personnel_id: matched.id,
        full_name: matched.name_th,
        email: matched.email || prev.email,
        role: role
      }));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading('กำลังสร้างผู้ใช้ใหม่...');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: formData.email.trim().toLowerCase(),
          personnel_id: formData.personnel_id || null
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create user');
      
      toast.success('สร้างผู้ใช้ใหม่เรียบร้อยแล้ว', { id: loadingToast });
      setShowModal(false);
      setFormData({ email: '', password: '', full_name: '', role: 'teacher', assigned_features: [], personnel_id: '' });
      loadUsers();
    } catch (err: any) {
      toast.error('ไม่สามารถสร้างผู้ใช้ได้', { id: loadingToast, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการ${currentStatus ? 'ระงับ' : 'เปิด'}การใช้งานผู้ใช้นี้?`)) return;
    
    const loadingToast = toast.loading(`กำลัง${currentStatus ? 'ระงับ' : 'เปิด'}การใช้งาน...`);
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update user');
      
      toast.success(`${currentStatus ? 'ระงับ' : 'เปิด'}การใช้งานเรียบร้อยแล้ว`, { id: loadingToast });
      loadUsers();
    } catch (err: any) {
      toast.error('ไม่สามารถอัปเดตสถานะได้', { id: loadingToast, description: err.message });
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeaturesUser) return;
    
    setIsSubmitting(true);
    const loadingToast = toast.loading('กำลังอัปเดตข้อมูลผู้ใช้...');

    try {
      const res = await fetch(`/api/admin/users?id=${editingFeaturesUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editingFeaturesUser.full_name,
          role: editingFeaturesUser.role,
          assigned_features: editingFeaturesUser.assigned_features,
          personnel_id: editingFeaturesUser.personnel_id || null
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update user');
      
      toast.success('อัปเดตข้อมูลและสิทธิ์เรียบร้อยแล้ว', { id: loadingToast });
      setEditingFeaturesUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error('ไม่สามารถอัปเดตข้อมูลได้', { id: loadingToast, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFeature = (featureId: string, currentUser: AppUser) => {
    const isAssigned = currentUser.assigned_features?.includes(featureId);
    const newFeatures = isAssigned 
      ? currentUser.assigned_features.filter(id => id !== featureId)
      : [...(currentUser.assigned_features || []), featureId];
      
    setEditingFeaturesUser({ ...currentUser, assigned_features: newFeatures });
  };

  const selectAllFeatures = () => {
    if (!editingFeaturesUser) return;
    setEditingFeaturesUser({
      ...editingFeaturesUser,
      assigned_features: SYSTEM_FEATURES.map(f => f.id)
    });
  };

  const clearAllFeatures = () => {
    if (!editingFeaturesUser) return;
    setEditingFeaturesUser({
      ...editingFeaturesUser,
      assigned_features: []
    });
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const email = (u as any).auth_users?.email?.toLowerCase() || '';
    const name = (u.full_name || '').toLowerCase();
    const pos = (u.personnel?.position_th || '').toLowerCase();

    const matchQuery = !q || email.includes(q) || name.includes(q) || pos.includes(q);
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const isLinked = Boolean(u.personnel || u.personnel_id);
    const matchLinked = filterLinked === 'all' || 
      (filterLinked === 'linked' && isLinked) || 
      (filterLinked === 'unlinked' && !isLinked);

    return matchQuery && matchRole && matchLinked;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 font-sans"
    >
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary mb-0.5">จัดการผู้ใช้งานระบบ</h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                {users.length} บัญชี
              </span>
            </div>
            <p className="text-foreground/60 text-sm font-medium">
              กำหนดบทบาท สิทธิ์การเข้าถึง และเชื่อมโยงประวัติกับทำเนียบบุคลากรบนเว็บไซต์
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleSyncPersonnel}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm shadow-sm disabled:opacity-50"
            title="ตรวจสอบและเชื่อมโยงข้อมูลอีเมลกับทำเนียบบุคลากรให้อัตโนมัติ"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>ซิงค์เชื่อมโยงบุคลากรอัตโนมัติ</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm"
          >
            <UserPlus className="w-5 h-5" /> สร้างผู้ใช้ใหม่
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-surface/80 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ, อีเมล, หรือตำแหน่ง..."
            className="w-full bg-background border border-foreground/10 pl-10 pr-4 py-2 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/60 bg-foreground/5 px-2.5 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-foreground"
            >
              <option value="all">ทุกบทบาท (Roles)</option>
              <option value="admin">Admin</option>
              <option value="executive">Executive</option>
              <option value="teacher">Teacher</option>
              <option value="academic staff">Academic Staff</option>
              <option value="non-academic staff">Support Staff</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>

          {/* Personnel Link Filter */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/60 bg-foreground/5 px-2.5 py-1.5 rounded-xl">
            <Link2 className="w-3.5 h-3.5" />
            <select
              value={filterLinked}
              onChange={e => setFilterLinked(e.target.value as any)}
              className="bg-transparent outline-none cursor-pointer text-foreground"
            >
              <option value="all">สถานะทำเนียบทั้งหมด</option>
              <option value="linked">ผูกกับบุคลากรแล้ว</option>
              <option value="unlinked">ยังไม่ได้ผูกข้อมูล</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="flex-1 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="w-24 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="w-32 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="w-24 h-12 bg-foreground/5 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-foreground/40 space-y-4">
            <UserX className="w-20 h-20 opacity-20" />
            <p className="text-xl font-medium">ไม่พบผู้ใช้งานตามเงื่อนไขที่ระบุ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[850px]">
              <thead className="bg-foreground/[0.02] border-b border-foreground/5">
                <tr>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">ชื่อ-นามสกุล / อีเมล</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">บทบาท (Role)</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">ข้อมูลทำเนียบบุคลากร</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">โมดูลที่ได้รับ</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">สถานะ</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                <AnimatePresence>
                  {filteredUsers.map(u => {
                    const roleCfg = getRoleConfig(u.role);
                    const assignedList = u.assigned_features || [];
                    const isAdmin = u.role === 'admin';
                    const hasPersonnel = Boolean(u.personnel);
                    const displayName = u.personnel?.name_th || u.full_name || 'ไม่ระบุชื่อ';

                    return (
                      <motion.tr 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout
                        key={u.id} 
                        className="hover:bg-foreground/[0.02] transition-colors"
                      >
                        {/* Name, Avatar & Email */}
                        <td className="p-5 font-bold text-foreground/80 flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-primary/10 overflow-hidden relative border border-foreground/10 shrink-0 flex items-center justify-center text-primary font-bold shadow-sm">
                            {u.personnel?.image_url ? (
                              <Image 
                                src={u.personnel.image_url} 
                                alt={displayName} 
                                fill 
                                className="object-cover" 
                                unoptimized 
                              />
                            ) : (
                              displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm text-foreground/90 font-bold">{displayName}</span>
                            <span className="text-xs text-foreground/50 font-normal truncate font-mono">
                              {(u as any).auth_users?.email}
                            </span>
                            {u.personnel?.position_th && (
                              <span className="text-[11px] text-primary/80 font-medium truncate mt-0.5">
                                {u.personnel.position_th}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Role Tag */}
                        <td className="p-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${roleCfg.badgeClass}`}>
                            {(u.role === 'admin' || u.role === 'executive') && <Shield className="w-3 h-3 shrink-0" />}
                            <span>{roleCfg.labelEn}</span>
                            <span className="opacity-75 font-normal text-[10px]">({roleCfg.labelTh})</span>
                          </span>
                        </td>

                        {/* Personnel Link Status */}
                        <td className="p-5">
                          {hasPersonnel ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>ผูกกับทำเนียบแล้ว</span>
                              </span>
                              <Link 
                                href="/admin/website/personnel" 
                                className="text-[11px] text-primary hover:underline flex items-center gap-1"
                              >
                                ดูโปรไฟล์หน้าเว็บ →
                              </Link>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Link2Off className="w-3 h-3 text-amber-500" /> ยังไม่ผูกโปรไฟล์
                            </span>
                          )}
                        </td>

                        {/* Assigned Modules */}
                        <td className="p-5 max-w-[260px]">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              <Shield className="w-3 h-3 text-purple-600" /> ทุกโมดูล (Admin)
                            </span>
                          ) : assignedList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {assignedList.slice(0, 3).map(fid => (
                                <span key={fid} className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-foreground/5 text-foreground/70 border border-foreground/10">
                                  {getFeatureName(fid)}
                                </span>
                              ))}
                              {assignedList.length > 3 && (
                                <span className="inline-block px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary">
                                  +{assignedList.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-foreground/40 italic">ยังไม่ได้กำหนด</span>
                          )}
                        </td>

                        {/* Active Status */}
                        <td className="p-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                            u.is_active ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {u.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {u.is_active ? 'ใช้งานปกติ' : 'ระงับการใช้งาน'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-5 text-right flex justify-end gap-2">
                          <button
                            onClick={() => setEditingFeaturesUser({ ...u, assigned_features: u.assigned_features || [] })}
                            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl transition-all text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-sm"
                          >
                            <Settings2 className="w-4 h-4" /> สิทธิ์ & เชื่อมโยง
                          </button>
                          <button
                            onClick={() => handleToggleActive(u.id, u.is_active)}
                            disabled={user?.id === u.id}
                            className={`text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl transition-all ${
                              u.is_active 
                                ? 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-30' 
                                : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-30'
                            }`}
                          >
                            {u.is_active ? 'ระงับ' : 'เปิดใช้'}
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User & Feature Assignment Modal */}
      <AnimatePresence>
        {editingFeaturesUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-2xl rounded-3xl shadow-2xl border border-foreground/10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02]">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">แก้ไขข้อมูลและกำหนดสิทธิ์</h2>
                  <p className="text-sm text-foreground/60 font-mono">{(editingFeaturesUser as any).auth_users?.email || editingFeaturesUser.full_name}</p>
                </div>
                <button onClick={() => setEditingFeaturesUser(null)} className="p-2 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <form id="edit-user-form" onSubmit={handleUpdateUser} className="space-y-6">
                  
                  {/* Personnel Profile Link Card */}
                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                      <Link2 className="w-4 h-4" /> เชื่อมโยงกับทำเนียบบุคลากรบนเว็บไซต์ (Website Personnel)
                    </label>
                    <select
                      value={editingFeaturesUser.personnel_id || ''}
                      onChange={e => {
                        const pid = e.target.value;
                        const matched = allPersonnel.find(p => p.id === pid);
                        setEditingFeaturesUser({
                          ...editingFeaturesUser,
                          personnel_id: pid || null,
                          personnel: matched || null,
                          full_name: matched ? matched.name_th : editingFeaturesUser.full_name
                        });
                      }}
                      className="w-full bg-background border border-foreground/10 p-2.5 rounded-xl outline-none focus:border-primary focus:ring-1 text-sm font-medium"
                    >
                      <option value="">-- ไม่เชื่อมโยง (บัญชีระบบทั่วไป / Cashier) --</option>
                      {allPersonnel.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name_th} ({p.position_th}) {p.email ? `[${p.email}]` : ''}
                        </option>
                      ))}
                    </select>

                    {editingFeaturesUser.personnel && (
                      <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-primary/20">
                        <div className="w-10 h-12 rounded-lg bg-foreground/5 relative overflow-hidden shrink-0 border border-foreground/10">
                          {editingFeaturesUser.personnel.image_url ? (
                            <Image src={editingFeaturesUser.personnel.image_url} alt="Profile" fill className="object-cover" unoptimized />
                          ) : (
                            <Users className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground/30" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">{editingFeaturesUser.personnel.name_th}</p>
                          <p className="text-[11px] text-foreground/60 truncate">{editingFeaturesUser.personnel.position_th}</p>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          เชื่อมต่อแล้ว
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Basic Details: Name & Role */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-foreground/10">
                    <div>
                      <label className="block text-sm font-bold text-foreground/70 mb-1.5">ชื่อ-นามสกุล *</label>
                      <input 
                        type="text"
                        required
                        value={editingFeaturesUser.full_name}
                        onChange={e => setEditingFeaturesUser({ ...editingFeaturesUser, full_name: e.target.value })}
                        className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-foreground/70 mb-1.5">บทบาทหลัก (Role) *</label>
                      <select 
                        value={editingFeaturesUser.role}
                        onChange={e => setEditingFeaturesUser({ ...editingFeaturesUser, role: e.target.value as any })}
                        className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                      >
                        <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                        <option value="executive">Executive (ผู้บริหาร)</option>
                        <option value="teacher">Teacher (ครูผู้สอน)</option>
                        <option value="academic staff">Academic Staff (บุคลากรวิชาการ)</option>
                        <option value="non-academic staff">Support Staff (บุคลากรสายสนับสนุน)</option>
                        <option value="cashier">Cashier (เจ้าหน้าที่การเงิน/ร้านค้า)</option>
                      </select>
                    </div>
                  </div>

                  {/* Feature Assignment Header */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <h3 className="font-bold text-base text-foreground/90">สิทธิ์การเข้าถึงโมดูล (Assigned Features)</h3>
                      <p className="text-xs text-foreground/50">เลือกโมดูลที่ต้องการให้ผู้ใช้งานท่านนี้มองเห็นและเข้าถึงได้</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={selectAllFeatures}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
                      >
                        <CheckSquare className="w-3.5 h-3.5" /> เลือกทั้งหมด
                      </button>
                      <button 
                        type="button" 
                        onClick={clearAllFeatures}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-foreground/5 text-foreground/60 hover:bg-foreground/10 transition-colors flex items-center gap-1"
                      >
                        <Square className="w-3.5 h-3.5" /> ล้างทั้งหมด
                      </button>
                    </div>
                  </div>

                  {/* Modules Grouped by Category */}
                  <div className="space-y-5">
                    {Object.entries(
                      SYSTEM_FEATURES.reduce((acc, feature) => {
                        if (!acc[feature.category]) acc[feature.category] = [];
                        acc[feature.category].push(feature);
                        return acc;
                      }, {} as Record<string, typeof SYSTEM_FEATURES>)
                    ).map(([category, features]) => (
                      <div key={category} className="space-y-2.5">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-foreground/50 border-b border-foreground/5 pb-1">
                          {category}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {features.map(f => {
                            const isChecked = editingFeaturesUser.assigned_features?.includes(f.id) || false;
                            return (
                              <label 
                                key={f.id} 
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                  isChecked 
                                    ? 'bg-primary/5 border-primary/30 text-primary font-bold' 
                                    : 'border-foreground/10 hover:bg-foreground/5 text-foreground/80'
                                }`}
                              >
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-foreground/20 text-primary focus:ring-primary/20 accent-primary"
                                  checked={isChecked}
                                  onChange={() => toggleFeature(f.id, editingFeaturesUser)}
                                />
                                <span className="text-sm font-medium">{f.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                </form>
              </div>

              <div className="p-6 border-t border-foreground/5 flex justify-end gap-3 bg-foreground/[0.02]">
                <button 
                  type="button" 
                  onClick={() => setEditingFeaturesUser(null)} 
                  className="px-5 py-2.5 text-foreground/60 font-bold hover:bg-foreground/5 rounded-xl transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  form="edit-user-form" 
                  disabled={isSubmitting} 
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md shadow-primary/20 text-sm"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-md rounded-3xl shadow-2xl border border-foreground/10 overflow-hidden"
            >
              <div className="p-6 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02]">
                <h2 className="text-xl font-extrabold text-foreground">สร้างผู้ใช้ใหม่</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <form onSubmit={handleCreateUser} className="space-y-4">
                  {/* Option to link existing personnel */}
                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-primary" /> ผูกกับบุคลากรในทำเนียบ (แนะนำ)
                    </label>
                    <select
                      value={formData.personnel_id}
                      onChange={e => handleSelectPersonnelForCreate(e.target.value)}
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    >
                      <option value="">-- ไม่ผูกกับบุคลากร (ผู้ใช้ทั่วไป) --</option>
                      {allPersonnel.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name_th} ({p.position_th}) {p.email ? `[${p.email}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground/70 mb-1">ชื่อ-นามสกุล *</label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                      placeholder="สมชาย ใจดี"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground/70 mb-1">อีเมล *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium font-mono"
                      placeholder="somchai@somkidvittaya.ac.th"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground/70 mb-1">รหัสผ่าน *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground/70 mb-1">บทบาท *</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value as any})}
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    >
                      <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                      <option value="executive">Executive (ผู้บริหาร)</option>
                      <option value="teacher">Teacher (ครูผู้สอน)</option>
                      <option value="academic staff">Academic Staff (บุคลากรวิชาการ)</option>
                      <option value="non-academic staff">Support Staff (บุคลากรสายสนับสนุน)</option>
                      <option value="cashier">Cashier (เจ้าหน้าที่การเงิน/ร้านค้า)</option>
                    </select>
                  </div>
                  <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-foreground/5">
                    <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-foreground/60 font-bold hover:bg-foreground/5 rounded-xl transition-colors text-sm">ยกเลิก</button>
                    <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md shadow-primary/20 text-sm">
                      {isSubmitting ? 'กำลังบันทึก...' : <><UserPlus className="w-4 h-4" /> บันทึกผู้ใช้</>}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
