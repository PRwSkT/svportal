'use client';

import { useState, useEffect } from 'react';
import { AppUser } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Shield, X, Check, UserX, Settings2 } from 'lucide-react';

const availableFeatures = [
  { id: "dashboard", name: "แดชบอร์ดสรุปยอด", category: "งานการเงิน" },
  { id: "pos_fees", name: "ชำระค่าเทอม", category: "งานการเงิน" },
  { id: "admin_reports", name: "รายงานการเงิน", category: "งานการเงิน" },
  { id: "pos_shop", name: "POS ขายสินค้า", category: "งานร้านค้าสหกรณ์" },
  { id: "admin_products", name: "จัดการสินค้า", category: "งานร้านค้าสหกรณ์" },
  { id: "pos_wallet_topup", name: "เติมเงิน Wallet", category: "งานร้านค้าสหกรณ์" },
  { id: "admin_wallet_students", name: "Wallet นักเรียน", category: "งานร้านค้าสหกรณ์" },
  { id: "admin_students", name: "ข้อมูลนักเรียน", category: "งานทะเบียน" },
  { id: "admin_users", name: "จัดการผู้ใช้งาน", category: "งาน HR" },
  { id: "admin_attendance", name: "ข้อมูลการเข้างาน", category: "งาน HR" },
  { id: "admin_website", name: "จัดการเว็บไซต์", category: "งานประชาสัมพันธ์ (PR)" },
  { id: "post_assistant", name: "Post Assistance", category: "งานประชาสัมพันธ์ (PR)" },
  { id: "audio_remote", name: "Audio Remote", category: "งานประชาสัมพันธ์ (PR)" },
  { id: "qr_generator", name: "สร้าง QR Code", category: "งานประชาสัมพันธ์ (PR)" },
  { id: "settings", name: "การตั้งค่า", category: "งานบริหารทั่วไป" },
  { id: "academic_todo", name: "รอการพัฒนา", category: "งานวิชาการ" }
];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'cashier',
    assigned_features: [] as string[]
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
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้', { description: err.message });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading('กำลังสร้างผู้ใช้ใหม่...');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create user');
      
      toast.success('สร้างผู้ใช้ใหม่เรียบร้อยแล้ว', { id: loadingToast });
      setShowModal(false);
      setFormData({ email: '', password: '', full_name: '', role: 'cashier', assigned_features: [] });
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

  const handleUpdateFeatures = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeaturesUser) return;
    
    setIsSubmitting(true);
    const loadingToast = toast.loading('กำลังอัปเดตสิทธิ์การใช้งาน...');

    try {
      const res = await fetch(`/api/admin/users?id=${editingFeaturesUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_features: editingFeaturesUser.assigned_features })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update features');
      
      toast.success('อัปเดตสิทธิ์การใช้งานเรียบร้อยแล้ว', { id: loadingToast });
      setEditingFeaturesUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error('ไม่สามารถอัปเดตสิทธิ์ได้', { id: loadingToast, description: err.message });
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-7xl mx-auto space-y-8 font-sans"
    >
      <div className="flex justify-between items-center bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">จัดการผู้ใช้งาน</h1>
            <p className="text-foreground/60 font-medium">เพิ่ม ลด และกำหนดสิทธิ์การใช้งานระบบ</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
          <UserPlus className="w-5 h-5" /> สร้างผู้ใช้ใหม่
        </button>
      </div>

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
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-foreground/40 space-y-4">
            <UserX className="w-20 h-20 opacity-20" />
            <p className="text-xl font-medium">ไม่พบผู้ใช้งานในระบบ</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-foreground/[0.02] border-b border-foreground/5">
              <tr>
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider">ชื่อ-นามสกุล</th>
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider">บทบาท</th>
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider">สถานะ</th>
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              <AnimatePresence>
                {users.map(u => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    layout
                    key={u.id} 
                    className="hover:bg-foreground/[0.02] transition-colors"
                  >
                    <td className="p-5 font-bold text-foreground/80 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span>{u.full_name}</span>
                        <span className="text-xs text-foreground/50 font-normal">{(u as any).auth_users?.email}</span>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'executive' ? 'bg-blue-100 text-blue-800' :
                        u.role === 'teacher' ? 'bg-green-100 text-green-800' :
                        u.role === 'academic staff' ? 'bg-orange-100 text-orange-800' :
                        u.role === 'non-academic staff' ? 'bg-gray-100 text-gray-800' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {(u.role === 'admin' || u.role === 'executive') && <Shield className="w-3 h-3" />}
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                        u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {u.is_active ? 'ใช้งานปกติ' : 'ระงับการใช้งาน'}
                      </span>
                    </td>
                    <td className="p-5 text-right flex justify-end gap-2">
                      <button
                        onClick={() => setEditingFeaturesUser(u)}
                        className="flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-xl transition-all text-blue-600 bg-blue-50 hover:bg-blue-100"
                      >
                        <Settings2 className="w-4 h-4" /> สิทธิ์ใช้งาน
                      </button>
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        disabled={user?.id === u.id}
                        className={`text-sm font-bold px-4 py-2 rounded-xl transition-all ${
                          u.is_active 
                            ? 'text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-30' 
                            : 'text-green-600 bg-green-50 hover:bg-green-100 disabled:opacity-30'
                        }`}
                      >
                        {u.is_active ? 'ระงับ' : 'เปิดใช้'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Feature Assignment Modal */}
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
                  <h2 className="text-xl font-extrabold text-foreground">กำหนดสิทธิ์การใช้งาน</h2>
                  <p className="text-sm text-foreground/60">{editingFeaturesUser.full_name}</p>
                </div>
                <button onClick={() => setEditingFeaturesUser(null)} className="p-2 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <form id="features-form" onSubmit={handleUpdateFeatures} className="space-y-6">
                  {Object.entries(
                    availableFeatures.reduce((acc, feature) => {
                      if (!acc[feature.category]) acc[feature.category] = [];
                      acc[feature.category].push(feature);
                      return acc;
                    }, {} as Record<string, typeof availableFeatures>)
                  ).map(([category, features]) => (
                    <div key={category} className="space-y-3">
                      <h3 className="font-bold text-foreground/80 border-b border-foreground/10 pb-2">{category}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {features.map(f => (
                          <label key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-foreground/10 hover:bg-foreground/5 cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 rounded border-foreground/20 text-primary focus:ring-primary/20"
                              checked={editingFeaturesUser.assigned_features?.includes(f.id) || false}
                              onChange={() => toggleFeature(f.id, editingFeaturesUser)}
                            />
                            <span className="font-medium text-sm text-foreground/80">{f.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </form>
              </div>
              <div className="p-6 border-t border-foreground/5 flex justify-end gap-3 bg-foreground/[0.02]">
                <button type="button" onClick={() => setEditingFeaturesUser(null)} className="px-5 py-2.5 text-foreground/60 font-bold hover:bg-foreground/5 rounded-xl transition-colors">ยกเลิก</button>
                <button type="submit" form="features-form" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md shadow-primary/20">
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
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
                  <div>
                    <label className="block text-sm font-bold text-foreground/70 mb-1">ชื่อ-นามสกุล *</label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
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
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="somchai@svportal.com"
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
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground/70 mb-1">บทบาท *</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-background border border-foreground/10 p-3 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm appearance-none"
                    >
                      <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                      <option value="executive">Executive (ผู้บริหาร)</option>
                      <option value="teacher">Teacher (ครูผู้สอน)</option>
                      <option value="academic staff">Academic Staff (บุคลากรวิชาการ)</option>
                      <option value="non-academic staff">Non-academic Staff (บุคลากรสายสนับสนุน)</option>
                      <option value="cashier">Cashier (พนักงานขาย)</option>
                    </select>
                  </div>
                  <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-foreground/5">
                    <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-foreground/60 font-bold hover:bg-foreground/5 rounded-xl transition-colors">ยกเลิก</button>
                    <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md shadow-primary/20">
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
