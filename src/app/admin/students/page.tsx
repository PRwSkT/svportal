'use client';

import { useState, useEffect, useRef } from 'react';
import { Student } from '@/types';
import { getStudents, importStudentsFromCSV } from '@/lib/supabase/students';
import Link from 'next/link';

export default function StudentRecordsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStudents(searchQuery, statusFilter);
      setStudents(data || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลนักเรียน');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [searchQuery, statusFilter]);

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
            status: 'active'
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
            📥 Import CSV Basic
          </button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleCsvImport}
          />
          <Link href="/admin/students/new">
            <button className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              + เพิ่มนักเรียน
            </button>
          </Link>
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
          <option value="กำลังศึกษาอยู่">กำลังศึกษาอยู่</option>
          <option value="สำเร็จการศึกษา">สำเร็จการศึกษา</option>
          <option value="ลาออก">ลาออก</option>
          <option value="active">Active (Legacy)</option>
        </select>
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-foreground/5 overflow-hidden">
        <div className="p-4 bg-yellow-50 text-yellow-800 text-xs font-mono mb-4 border-b border-yellow-200">
          Debug: isLoading={String(isLoading)}, error={String(error)}, students={students.length}, search={searchQuery}, status={statusFilter}
        </div>
        {error ? (
          <div className="p-12 text-center text-red-500 font-bold bg-red-50">❌ Error: {error}</div>
        ) : isLoading ? (
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
                      s.status?.includes('กำลังศึกษา') || s.status === 'active' ? 'bg-secondary/10 text-secondary' : 
                      'bg-foreground/10 text-foreground/70'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">฿{(s.wallet_balance || 0).toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <Link href={`/admin/students/${s.id}`}>
                      <button className="text-primary hover:underline text-sm font-medium px-4 py-2 bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">
                        แก้ไข / ดูประวัติ
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
