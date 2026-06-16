'use client';

import { useState, useEffect } from 'react';
import { AppUser } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Shield, X, Check, UserX } from 'lucide-react';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'cashier'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('app_users')
      .select('*, auth_users:id (email)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data as AppUser[]);
    } else if (error) {
      toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้', { description: error.message });
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
      setFormData({ email: '', password: '', full_name: '', role: 'cashier' });
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
                      {u.full_name}
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-primary/10 text-primary'
                      }`}>
                        {u.role === 'admin' && <Shield className="w-3 h-3" />}
                        {u.role === 'admin' ? 'Admin' : 'Cashier'}
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
                    <td className="p-5 text-right">
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        disabled={user?.id === u.id}
                        className={`text-sm font-bold px-4 py-2 rounded-xl transition-all ${
                          u.is_active 
                            ? 'text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-30' 
                            : 'text-green-600 bg-green-50 hover:bg-green-100 disabled:opacity-30'
                        }`}
                      >
                        {u.is_active ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

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
                      <option value="cashier">Cashier (พนักงานขาย)</option>
                      <option value="admin">Admin (ผู้ดูแลระบบ)</option>
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
