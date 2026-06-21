'use client';

import { useState, useEffect, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Student, StudentAddress, StudentParent } from '@/types';
import { getStudentById, updateStudent, createStudent, upsertStudentAddress, upsertStudentParent } from '@/lib/supabase/students';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, User, MapPin, Users, PlusCircle, CheckCircle2 } from 'lucide-react';

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const resolvedId = params?.id as string | undefined;

  const isNew = resolvedId === 'new';

  const [student, setStudent] = useState<Partial<Student>>({
    id: '', name: '', grade: '', status: 'กำลังศึกษาอยู่'
  });
  const [addresses, setAddresses] = useState<Partial<StudentAddress>[]>([]);
  const [parents, setParents] = useState<Partial<StudentParent>[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'address' | 'parents'>('general');

  useEffect(() => {
    // Fail-safe to remove skeleton if something hangs indefinitely
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    if (resolvedId && !isNew) {
      fetchStudent();
    } else if (isNew) {
      setIsLoading(false);
    }

    return () => clearTimeout(timer);
  }, [isNew, resolvedId]);

  const fetchStudent = async () => {
    try {
      if (!resolvedId) return;
      const data = await getStudentById(resolvedId);
      if (data) {
        setStudent(data);
        if (data.student_addresses && data.student_addresses.length > 0) {
          setAddresses(data.student_addresses);
        } else {
          setAddresses([{ student_id: data.id }]);
        }

        if (data.student_parents && data.student_parents.length > 0) {
          setParents(data.student_parents);
        } else {
          setParents([
            { student_id: data.id, relationship: 'บิดา' },
            { student_id: data.id, relationship: 'มารดา' }
          ]);
        }
      } else {
        toast.error('ไม่พบข้อมูลนักเรียน', { description: `รหัส: ${resolvedId}` });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('ไม่สามารถโหลดข้อมูลนักเรียนได้', { description: err?.message || 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!student.id || !student.name || !student.grade) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็น', { description: 'รหัสนักเรียน, ชื่อ-สกุลเต็ม, และระดับชั้น' });
      return;
    }

    setIsSaving(true);
    try {
      let savedId = student.id!;
      if (isNew) {
        const newSt = await createStudent(student as Omit<Student, 'wallet_balance' | 'created_at' | 'updated_at' | 'student_addresses' | 'student_parents'>);
        savedId = newSt.id;
      } else {
        await updateStudent(student.id!, student);
      }

      // Save Address
      for (const addr of addresses) {
        if (addr.house_number || addr.province) {
          await upsertStudentAddress({ ...addr, student_id: savedId });
        }
      }

      // Save Parents
      for (const p of parents) {
        if (p.first_name || p.last_name || p.citizen_id) {
          await upsertStudentParent({ ...p, student_id: savedId });
        }
      }

      toast.success('บันทึกข้อมูลสำเร็จ', {
        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />
      });
      router.push('/admin/students');
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-8 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-24 h-10 bg-foreground/5 rounded-lg"></div>
          <div className="w-64 h-10 bg-foreground/10 rounded-lg"></div>
        </div>
        <div className="bg-surface rounded-2xl shadow-sm border border-foreground/5 h-[600px] flex flex-col">
          <div className="h-14 border-b border-foreground/5 flex">
            <div className="flex-1 border-r border-foreground/5 bg-foreground/5"></div>
            <div className="flex-1 border-r border-foreground/5 bg-foreground/[0.02]"></div>
            <div className="flex-1 bg-foreground/[0.02]"></div>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i}>
                  <div className="w-24 h-4 bg-foreground/10 rounded mb-2"></div>
                  <div className="w-full h-12 bg-foreground/5 rounded-xl"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-8 max-w-4xl mx-auto space-y-8 font-sans"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/students" className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-foreground/5 border border-foreground/10 rounded-xl text-foreground/70 font-medium transition-colors shadow-sm">
            <ArrowLeft className="w-4 h-4" /> กลับ
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">
            {isNew ? 'เพิ่มนักเรียนใหม่' : student.name || student.id}
          </h1>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </button>
      </div>

      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-foreground/5 bg-foreground/[0.02]">
          {[
            { id: 'general', label: 'ข้อมูลพื้นฐาน', icon: User },
            { id: 'address', label: 'ข้อมูลที่อยู่', icon: MapPin },
            { id: 'parents', label: 'ข้อมูลผู้ปกครอง', icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`relative flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm transition-all overflow-hidden ${isActive ? 'text-primary bg-surface' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-foreground/40'}`} />
                {tab.label}
                {isActive && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            )
          })}
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div 
                key="general"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">รหัสนักเรียน (id)</label>
                    <input type="text" disabled={!isNew} value={student.id || ''} onChange={e => setStudent({...student, id: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 text-foreground transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">ชื่อ-สกุลเต็ม</label>
                    <input type="text" value={student.name || ''} onChange={e => setStudent({...student, name: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">คำนำหน้าชื่อ</label>
                    <input type="text" value={student.prefix || ''} onChange={e => setStudent({...student, prefix: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">ชื่อ (First Name)</label>
                    <input type="text" value={student.first_name || ''} onChange={e => setStudent({...student, first_name: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">นามสกุล (Last Name)</label>
                    <input type="text" value={student.last_name || ''} onChange={e => setStudent({...student, last_name: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">ระดับชั้น</label>
                    <input type="text" value={student.grade || ''} onChange={e => setStudent({...student, grade: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">วันเกิด</label>
                    <input type="date" value={student.birth_date || ''} onChange={e => setStudent({...student, birth_date: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">สถานะ</label>
                    <select value={student.status || 'กำลังศึกษาอยู่'} onChange={e => setStudent({...student, status: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all">
                      <option value="กำลังศึกษาอยู่">กำลังศึกษาอยู่</option>
                      <option value="สำเร็จการศึกษา">สำเร็จการศึกษา</option>
                      <option value="ลาออก">ลาออก</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'address' && (
              <motion.div 
                key="address"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {addresses.map((addr, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-6 bg-foreground/[0.02] p-6 rounded-2xl border border-foreground/5 relative group">
                    <div className="absolute top-4 right-4 text-foreground/20 font-mono text-4xl font-extrabold select-none">#{(idx+1).toString().padStart(2, '0')}</div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">บ้านเลขที่</label>
                      <input type="text" value={addr.house_number || ''} onChange={e => {
                        const newAddrs = [...addresses];
                        newAddrs[idx].house_number = e.target.value;
                        setAddresses(newAddrs);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">หมู่ที่</label>
                      <input type="text" value={addr.moo || ''} onChange={e => {
                        const newAddrs = [...addresses];
                        newAddrs[idx].moo = e.target.value;
                        setAddresses(newAddrs);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">ซอย / ถนน</label>
                      <input type="text" value={addr.road || addr.soi || ''} onChange={e => {
                        const newAddrs = [...addresses];
                        newAddrs[idx].road = e.target.value;
                        setAddresses(newAddrs);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">ตำบล</label>
                      <input type="text" value={addr.sub_district || ''} onChange={e => {
                        const newAddrs = [...addresses];
                        newAddrs[idx].sub_district = e.target.value;
                        setAddresses(newAddrs);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">อำเภอ</label>
                      <input type="text" value={addr.district || ''} onChange={e => {
                        const newAddrs = [...addresses];
                        newAddrs[idx].district = e.target.value;
                        setAddresses(newAddrs);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">จังหวัด</label>
                      <input type="text" value={addr.province || ''} onChange={e => {
                        const newAddrs = [...addresses];
                        newAddrs[idx].province = e.target.value;
                        setAddresses(newAddrs);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'parents' && (
              <motion.div 
                key="parents"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {parents.map((parent, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-6 bg-foreground/[0.02] p-6 rounded-2xl border border-foreground/5 relative group">
                    <div className="col-span-2 flex justify-between items-center border-b border-foreground/10 pb-3 mb-2">
                      <h3 className="font-extrabold text-lg text-primary flex items-center gap-2">
                        <Users className="w-5 h-5 opacity-50" /> {parent.relationship}
                      </h3>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">คำนำหน้าชื่อ</label>
                      <input type="text" value={parent.prefix || ''} onChange={e => {
                        const newParents = [...parents];
                        newParents[idx].prefix = e.target.value;
                        setParents(newParents);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">ชื่อ - นามสกุล</label>
                      <div className="flex gap-2">
                        <input type="text" placeholder="ชื่อ" value={parent.first_name || ''} onChange={e => {
                          const newParents = [...parents];
                          newParents[idx].first_name = e.target.value;
                          setParents(newParents);
                        }} className="w-1/2 px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                        <input type="text" placeholder="นามสกุล" value={parent.last_name || ''} onChange={e => {
                          const newParents = [...parents];
                          newParents[idx].last_name = e.target.value;
                          setParents(newParents);
                        }} className="w-1/2 px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">เลขบัตรประชาชน</label>
                      <input type="text" value={parent.citizen_id || ''} onChange={e => {
                        const newParents = [...parents];
                        newParents[idx].citizen_id = e.target.value;
                        setParents(newParents);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">เบอร์โทรศัพท์</label>
                      <input type="text" value={parent.phone_number || ''} onChange={e => {
                        const newParents = [...parents];
                        newParents[idx].phone_number = e.target.value;
                        setParents(newParents);
                      }} className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" />
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => setParents([...parents, { student_id: student.id, relationship: 'ผู้ปกครอง' }])}
                  className="w-full py-4 border-2 border-dashed border-foreground/20 rounded-2xl text-foreground/50 font-bold hover:border-primary hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" /> เพิ่มผู้ปกครอง
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
