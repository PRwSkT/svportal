'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Student, StudentAddress, StudentParent } from '@/types';
import { getStudentById, updateStudent, createStudent, upsertStudentAddress, upsertStudentParent, deleteStudentParent } from '@/lib/supabase/students';
import Link from 'next/link';
import { use } from 'react';

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const isNew = resolvedParams.id === 'new';

  const [student, setStudent] = useState<Partial<Student>>({
    id: '', name: '', grade: '', status: 'กำลังศึกษาอยู่'
  });
  const [addresses, setAddresses] = useState<Partial<StudentAddress>[]>([]);
  const [parents, setParents] = useState<Partial<StudentParent>[]>([]);

  const [isLoading, setIsLoading] = useState(!isNew);
  const [activeTab, setActiveTab] = useState<'general' | 'address' | 'parents'>('general');

  useEffect(() => {
    if (!isNew) {
      fetchStudent();
    }
  }, [isNew, resolvedParams.id]);

  const fetchStudent = async () => {
    try {
      const data = await getStudentById(resolvedParams.id);
      if (data) {
        setStudent(data);
        if (data.student_addresses) setAddresses(data.student_addresses);
        else setAddresses([{ student_id: data.id }]);

        if (data.student_parents && data.student_parents.length > 0) {
          setParents(data.student_parents);
        } else {
          setParents([
            { student_id: data.id, relationship: 'บิดา' },
            { student_id: data.id, relationship: 'มารดา' }
          ]);
        }
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถโหลดข้อมูลนักเรียนได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
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

      alert('บันทึกข้อมูลเรียบร้อย');
      router.push('/admin/students');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  if (isLoading) return <div className="p-12 text-center text-foreground/50">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/admin/students" className="px-4 py-2 bg-foreground/5 rounded-lg hover:bg-foreground/10 text-foreground/70 font-medium transition-colors">
          &larr; กลับ
        </Link>
        <h1 className="text-3xl font-bold text-primary">{isNew ? 'เพิ่มนักเรียนใหม่' : `ข้อมูลนักเรียน: ${student.name || student.id}`}</h1>
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-foreground/5 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-foreground/5 bg-foreground/[0.02]">
          <button onClick={() => setActiveTab('general')} className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'general' ? 'bg-surface text-primary border-b-2 border-primary' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'}`}>
            ข้อมูลพื้นฐาน
          </button>
          <button onClick={() => setActiveTab('address')} className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'address' ? 'bg-surface text-primary border-b-2 border-primary' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'}`}>
            ข้อมูลที่อยู่
          </button>
          <button onClick={() => setActiveTab('parents')} className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'parents' ? 'bg-surface text-primary border-b-2 border-primary' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'}`}>
            ข้อมูลผู้ปกครอง
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">รหัสนักเรียน (id)</label>
                  <input type="text" disabled={!isNew} value={student.id || ''} onChange={e => setStudent({...student, id: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none disabled:opacity-50 text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">ชื่อ-สกุลเต็ม (Legacy)</label>
                  <input type="text" value={student.name || ''} onChange={e => setStudent({...student, name: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">คำนำหน้าชื่อ</label>
                  <input type="text" value={student.prefix || ''} onChange={e => setStudent({...student, prefix: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">ชื่อ (First Name)</label>
                  <input type="text" value={student.first_name || ''} onChange={e => setStudent({...student, first_name: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">นามสกุล (Last Name)</label>
                  <input type="text" value={student.last_name || ''} onChange={e => setStudent({...student, last_name: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">ระดับชั้น</label>
                  <input type="text" value={student.grade || ''} onChange={e => setStudent({...student, grade: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">วันเกิด (YYYY-MM-DD)</label>
                  <input type="date" value={student.birth_date || ''} onChange={e => setStudent({...student, birth_date: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">สถานะ</label>
                  <select value={student.status || 'กำลังศึกษาอยู่'} onChange={e => setStudent({...student, status: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground">
                    <option value="กำลังศึกษาอยู่">กำลังศึกษาอยู่</option>
                    <option value="สำเร็จการศึกษา">สำเร็จการศึกษา</option>
                    <option value="ลาออก">ลาออก</option>
                    <option value="active">Active</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'address' && (
            <div className="space-y-6">
              {addresses.map((addr, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-6 bg-foreground/[0.02] p-6 rounded-xl border border-foreground/5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">บ้านเลขที่</label>
                    <input type="text" value={addr.house_number || ''} onChange={e => {
                      const newAddrs = [...addresses];
                      newAddrs[idx].house_number = e.target.value;
                      setAddresses(newAddrs);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">หมู่ที่</label>
                    <input type="text" value={addr.moo || ''} onChange={e => {
                      const newAddrs = [...addresses];
                      newAddrs[idx].moo = e.target.value;
                      setAddresses(newAddrs);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">ซอย / ถนน</label>
                    <input type="text" value={addr.road || addr.soi || ''} onChange={e => {
                      const newAddrs = [...addresses];
                      newAddrs[idx].road = e.target.value;
                      setAddresses(newAddrs);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">ตำบล</label>
                    <input type="text" value={addr.sub_district || ''} onChange={e => {
                      const newAddrs = [...addresses];
                      newAddrs[idx].sub_district = e.target.value;
                      setAddresses(newAddrs);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">อำเภอ</label>
                    <input type="text" value={addr.district || ''} onChange={e => {
                      const newAddrs = [...addresses];
                      newAddrs[idx].district = e.target.value;
                      setAddresses(newAddrs);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">จังหวัด</label>
                    <input type="text" value={addr.province || ''} onChange={e => {
                      const newAddrs = [...addresses];
                      newAddrs[idx].province = e.target.value;
                      setAddresses(newAddrs);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'parents' && (
            <div className="space-y-6">
              {parents.map((parent, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-6 bg-foreground/[0.02] p-6 rounded-xl border border-foreground/5">
                  <div className="col-span-2 flex justify-between items-center border-b border-foreground/10 pb-2">
                    <h3 className="font-bold text-lg text-primary">{parent.relationship}</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">คำนำหน้าชื่อ</label>
                    <input type="text" value={parent.prefix || ''} onChange={e => {
                      const newParents = [...parents];
                      newParents[idx].prefix = e.target.value;
                      setParents(newParents);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">ชื่อ - นามสกุล</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="ชื่อ" value={parent.first_name || ''} onChange={e => {
                        const newParents = [...parents];
                        newParents[idx].first_name = e.target.value;
                        setParents(newParents);
                      }} className="w-1/2 px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                      <input type="text" placeholder="นามสกุล" value={parent.last_name || ''} onChange={e => {
                        const newParents = [...parents];
                        newParents[idx].last_name = e.target.value;
                        setParents(newParents);
                      }} className="w-1/2 px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">เลขบัตรประชาชน</label>
                    <input type="text" value={parent.citizen_id || ''} onChange={e => {
                      const newParents = [...parents];
                      newParents[idx].citizen_id = e.target.value;
                      setParents(newParents);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">เบอร์โทรศัพท์</label>
                    <input type="text" value={parent.phone_number || ''} onChange={e => {
                      const newParents = [...parents];
                      newParents[idx].phone_number = e.target.value;
                      setParents(newParents);
                    }} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setParents([...parents, { student_id: student.id, relationship: 'ผู้ปกครอง' }])}
                className="w-full py-4 border-2 border-dashed border-foreground/20 rounded-xl text-foreground/50 font-bold hover:border-primary hover:text-primary transition-colors"
              >
                + เพิ่มผู้ปกครอง
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={handleSave} className="px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors w-full sm:w-auto ml-auto">
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );
}
