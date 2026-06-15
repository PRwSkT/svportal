'use client';

import { useState, useEffect, useRef } from 'react';
import { Student } from '@/types';
import { getStudents, createStudent, updateStudent, importStudentsFromCSV } from '@/lib/supabase/students';

export default function StudentRecordsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    grade: '',
    status: 'active' as 'active' | 'graduated' | 'dropped_out',
    parent_name: '',
    parent_phone: '',
    health_condition: '',
    notes: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const data = await getStudents(searchQuery, statusFilter);
      setStudents(data);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูลนักเรียน');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [searchQuery, statusFilter]);

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        id: student.id,
        name: student.name,
        grade: student.grade,
        status: student.status,
        parent_name: student.profile_data?.parent_name || '',
        parent_phone: student.profile_data?.parent_phone || '',
        health_condition: student.profile_data?.health_condition || '',
        notes: student.profile_data?.notes || '',
      });
    } else {
      setEditingStudent(null);
      setFormData({
        id: '', name: '', grade: '', status: 'active',
        parent_name: '', parent_phone: '', health_condition: '', notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const profileData = {
        parent_name: formData.parent_name,
        parent_phone: formData.parent_phone,
        health_condition: formData.health_condition,
        notes: formData.notes
      };

      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          name: formData.name,
          grade: formData.grade,
          status: formData.status,
          profile_data: profileData
        });
      } else {
        await createStudent({
          id: formData.id,
          name: formData.name,
          grade: formData.grade,
          status: formData.status,
          profile_data: profileData
        });
      }
      setIsModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').filter(r => r.trim());
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        
        const idIdx = headers.indexOf('id');
        const nameIdx = headers.indexOf('name');
        const gradeIdx = headers.indexOf('grade');
        
        if (idIdx === -1 || nameIdx === -1 || gradeIdx === -1) {
          alert('CSV ต้องมีคอลัมน์ id, name, grade เป็นอย่างน้อย');
          return;
        }

        const toImport = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(',').map(c => c.trim());
          if (cols.length < 3) continue;
          
          toImport.push({
            id: cols[idIdx],
            name: cols[nameIdx],
            grade: cols[gradeIdx],
            status: 'active',
            profile_data: {}
          });
        }

        const result = await importStudentsFromCSV(toImport);
        alert(`สำเร็จ ${result.success} รายการ, ล้มเหลว ${result.failed} รายการ`);
        fetchStudents();
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-surface p-6 rounded-2xl shadow-sm border border-foreground/5">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">งานระเบียนนักเรียน</h1>
          <p className="text-foreground/70">จัดการข้อมูลประวัตินักเรียนและสถานะการศึกษา</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-secondary/10 text-secondary font-bold rounded-xl hover:bg-secondary/20 transition-colors"
          >
            📥 Import CSV
          </button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleCsvImport}
          />
          <button 
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            + เพิ่มนักเรียน
          </button>
        </div>
      </div>

      <div className="flex gap-4 bg-surface p-4 rounded-xl shadow-sm border border-foreground/5">
        <input 
          type="text" 
          placeholder="ค้นหารหัส หรือ ชื่อ..." 
          className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-lg focus:outline-none focus:border-primary text-foreground"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select 
          className="px-4 py-3 bg-background border border-foreground/10 rounded-lg focus:outline-none text-foreground w-48"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="active">กำลังศึกษา</option>
          <option value="graduated">จบการศึกษา</option>
          <option value="dropped_out">ลาออก</option>
        </select>
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-foreground/5 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-foreground/50">กำลังโหลดข้อมูล...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-foreground/50">ไม่พบข้อมูลนักเรียน</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-foreground/5">
              <tr>
                <th className="p-4 font-semibold text-foreground/70">รหัส</th>
                <th className="p-4 font-semibold text-foreground/70">ชื่อ-สกุล</th>
                <th className="p-4 font-semibold text-foreground/70">ชั้นเรียน</th>
                <th className="p-4 font-semibold text-foreground/70">สถานะ</th>
                <th className="p-4 font-semibold text-foreground/70 text-right">Wallet</th>
                <th className="p-4 font-semibold text-foreground/70 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="p-4 font-mono">{s.id}</td>
                  <td className="p-4 font-medium text-primary">{s.name}</td>
                  <td className="p-4">{s.grade || '-'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      s.status === 'active' ? 'bg-secondary/10 text-secondary' : 
                      s.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {s.status === 'active' ? 'กำลังศึกษา' : s.status === 'graduated' ? 'จบการศึกษา' : 'ลาออก'}
                    </span>
                  </td>
                  <td className="p-4 text-right">฿{s.wallet_balance.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleOpenModal(s)}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      แก้ไข/ประวัติ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8 border-b border-foreground/5 sticky top-0 bg-surface z-10 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-primary">{editingStudent ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-foreground/50 hover:text-foreground text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSaveStudent} className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">รหัสนักเรียน</label>
                  <input required type="text" disabled={!!editingStudent} value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none disabled:opacity-50 text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">ชื่อ-สกุล</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">ระดับชั้น</label>
                  <input type="text" value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/70 mb-2">สถานะการศึกษา</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground">
                    <option value="active">กำลังศึกษา</option>
                    <option value="graduated">จบการศึกษา</option>
                    <option value="dropped_out">ลาออก</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t border-foreground/5 space-y-6">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <span>📝</span> ข้อมูลประวัติ (สำหรับ AI วิเคราะห์)
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">ชื่อผู้ปกครอง</label>
                    <input type="text" value={formData.parent_name} onChange={e => setFormData({...formData, parent_name: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">เบอร์โทรผู้ปกครอง</label>
                    <input type="text" value={formData.parent_phone} onChange={e => setFormData({...formData, parent_phone: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">โรคประจำตัว / ข้อมูลสุขภาพ</label>
                    <input type="text" value={formData.health_condition} onChange={e => setFormData({...formData, health_condition: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">บันทึกพฤติกรรม / ข้อมูลอื่นๆ ที่สำคัญ</label>
                    <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:outline-none text-foreground" placeholder="เช่น เป็นนักกีฬาโรงเรียน, เคยได้รับทุนเรียนดี, ฯลฯ" />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 pt-4 sticky bottom-0 bg-surface">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-foreground/5 text-foreground/70 rounded-xl font-bold hover:bg-foreground/10 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
