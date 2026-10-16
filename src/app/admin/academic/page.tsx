'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  BookOpen, 
  Settings, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Layers, 
  Sparkles,
  School,
  ExternalLink,
  ChevronRight,
  X,
  Edit2,
  Trash2,
  Save,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { AcademicClass, AcademicCourse } from '@/types/academic';
import Link from 'next/link';

export default function AdminAcademicSetupPage() {
  const [activeTab, setActiveTab] = useState<'classes' | 'courses'>('classes');
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<AcademicCourse[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [academicYear, setAcademicYear] = useState<string>('2568');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // New Course Modal State
  const [isNewCourseOpen, setIsNewCourseOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    course_code: '',
    name_th: '',
    name_en: '',
    department: 'primary',
    grade_level: 'P3',
    subject_group: 'คณิตศาสตร์',
    course_type: 'basic',
    annual_hours: 160,
    credits: 4.0,
    academic_year: '2568',
    is_reported_to_opec: true,
    show_on_parent_report: true,
    opec_course_code: ''
  });

  // Edit Course Modal State
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [isSavingEditCourse, setIsSavingEditCourse] = useState(false);

  const fetchData = async (year = academicYear) => {
    setIsLoading(true);
    try {
      const [resCls, resCrs] = await Promise.all([
        fetch(`/api/academic/classes?year=${year}`),
        fetch(`/api/academic/courses?year=${year}`)
      ]);

      if (resCls.ok) {
        const d = await resCls.json();
        setClasses(d.classes || []);
        if (d.personnel) setPersonnel(d.personnel);
      }
      if (resCrs.ok) {
        const d = await resCrs.json();
        setCourses(d.courses || []);
      }
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดข้อมูลวิชาการได้: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(academicYear);
  }, [academicYear]);

  const handleSyncStudents = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/academic/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_from_students', academic_year: academicYear })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || 'ซิงค์ห้องเรียนและนักเรียนสำเร็จ');
      fetchData(academicYear);
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการซิงค์: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedCurriculum = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/academic/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_standard_curriculum', academic_year: academicYear })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || 'ติดตั้งหลักสูตรมาตรฐานสำเร็จ');
      fetchData(academicYear);
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการติดตั้งหลักสูตร: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  // Assign Homeroom Teacher directly on Class card
  const handleAssignTeacher = async (classId: string, type: 'actual' | 'opec', teacherId: string) => {
    try {
      const payload: Record<string, any> = { id: classId };
      if (type === 'actual') payload.actual_homeroom_teacher_id = teacherId || null;
      if (type === 'opec') payload.opec_homeroom_teacher_id = teacherId || null;

      const res = await fetch('/api/academic/classes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state instantly
      setClasses(prev => prev.map(c => {
        if (c.id === classId) {
          const matchedTeacher = personnel.find((p: any) => p.id === teacherId);
          if (type === 'actual') {
            return {
              ...c,
              actual_homeroom_teacher_id: teacherId || null,
              actual_homeroom_teacher: matchedTeacher || null
            };
          } else {
            return {
              ...c,
              opec_homeroom_teacher_id: teacherId || null,
              opec_homeroom_teacher: matchedTeacher || null
            };
          }
        }
        return c;
      }));

      toast.success('บันทึกการกำหนดครูประจำชั้นเรียบร้อยแล้ว');
    } catch (err: any) {
      toast.error('กำหนดครูล้มเหลว: ' + err.message);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/academic/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newCourse, academic_year: academicYear })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('สร้างรายวิชาเรียบร้อยแล้ว');
      setIsNewCourseOpen(false);
      fetchData(academicYear);
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleSaveEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setIsSavingEditCourse(true);
    try {
      const res = await fetch('/api/academic/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCourse)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('อัปเดตข้อมูลรายวิชาเรียบร้อยแล้ว');
      setEditingCourse(null);
      fetchData(academicYear);
    } catch (err: any) {
      toast.error('อัปเดตวิชาล้มเหลว: ' + err.message);
    } finally {
      setIsSavingEditCourse(false);
    }
  };

  const handleDeleteCourse = async (courseId: string, courseCode: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายวิชา ${courseCode}?`)) return;
    try {
      const res = await fetch(`/api/academic/courses?id=${courseId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('ลบรายวิชาเรียบร้อยแล้ว');
      fetchData(academicYear);
    } catch (err: any) {
      toast.error('ลบรายวิชาล้มเหลว: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <Link href="/academic" className="hover:underline">งานวิชาการ</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>การตั้งค่าโครงสร้างวิชาการ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Settings className="w-7 h-7 text-[#7B1C3E]" />
              ตั้งค่าโครงสร้างหลักสูตรและห้องเรียน
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              กำหนดครูประจำชั้น, ครูตาม สช. (OPEC), และจัดการรายวิชา Dual-Layer (โรงเรียนจริง / สช. REGIS)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 pl-1">ปีการศึกษา:</span>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                <option value="2567">2567</option>
                <option value="2568">2568</option>
                <option value="2569">2569</option>
              </select>
            </div>

            <button
              onClick={handleSyncStudents}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 rounded-xl text-xs sm:text-sm font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              ซิงค์ห้องเรียนจากนักเรียน
            </button>
            <button
              onClick={handleSeedCurriculum}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-xl text-xs sm:text-sm font-bold transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              ติดตั้งหลักสูตรมาตรฐาน
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab('classes')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'classes'
                ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <School className="w-4 h-4" />
            ห้องเรียน & กำหนดครูประจำชั้น ({classes.length} ห้อง)
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'courses'
                ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            โครงสร้างรายวิชา & สิทธิ์ส่ง สช. ({courses.length} วิชา)
          </button>
        </div>

        {/* TAB 1: Classrooms */}
        {activeTab === 'classes' && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 rounded-2xl flex items-start gap-3">
              <Layers className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-900 dark:text-blue-200">
                <span className="font-bold">ระบบ Dual-Layer Classroom:</span> ในชีวิตจริงโรงเรียนเปิดสอนแยกห้อง เช่น ป.3/1 และ ป.3/2 แต่ในระบบของ สช. จะถูก Map รวมเป็นห้อง <strong>&ldquo;ป.3&rdquo;</strong> เดียวกันให้อัตโนมัติเมื่อกดส่งออกไฟล์ REGIS และสามารถระบุครูประจำชั้นตัวจริงแยกจากครูตามทะเบียน สช. ได้อย่างอิสระ
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <div 
                  key={cls.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {cls.name}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        cls.department === 'kindergarten' 
                          ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' 
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}>
                        {cls.department === 'kindergarten' ? 'ปฐมวัย' : 'ประถม'}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">จำนวนนักเรียน:</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">{cls.student_count || 0} คน</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">ห้องอ้างอิง สช. (OPEC Room):</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">{cls.opec_room_name}</span>
                      </div>

                      {/* Dropdown: Actual Homeroom Teacher */}
                      <div className="pt-1">
                        <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">
                          ครูประจำชั้นตัวจริง (Homeroom Teacher):
                        </label>
                        <select
                          value={cls.actual_homeroom_teacher_id || ''}
                          onChange={(e) => handleAssignTeacher(cls.id, 'actual', e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 cursor-pointer"
                        >
                          <option value="">-- ยังไม่ได้ระบุครูประจำชั้น --</option>
                          {personnel.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name_th} ({p.position_th || 'ครูผู้สอน'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dropdown: OPEC Homeroom Teacher */}
                      <div className="pt-1">
                        <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">
                          ครูตามทะเบียน สช. (วิทยฐานะ REGIS):
                        </label>
                        <select
                          value={cls.opec_homeroom_teacher_id || ''}
                          onChange={(e) => handleAssignTeacher(cls.id, 'opec', e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
                        >
                          <option value="">-- ใช้ชื่อครูประจำชั้นตัวจริง --</option>
                          {personnel.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name_th} ({p.position_th || 'ครูผู้สอน'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Link
                      href={cls.department === 'kindergarten' ? `/academic/early-years?class_id=${cls.id}` : `/academic/gradebook?class_id=${cls.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#7B1C3E] hover:underline"
                    >
                      เปิดสมุดคะแนน (ปพ.5)
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: Courses */}
        {activeTab === 'courses' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">
                วิชาที่มีป้าย <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">ส่ง สช. (REGIS)</span> จะถูกส่งออกไฟล์ ส่วนวิชาที่มีป้าย <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">เฉพาะใบเกรดผู้ปกครอง</span> เช่น Mathematics (MEP) จะถูกตัดออกจากไฟล์ สช. อัตโนมัติ
              </div>
              <button
                onClick={() => setIsNewCourseOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1C3E] hover:bg-[#641430] text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่มรายวิชา
              </button>
            </div>

            <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">รหัสวิชา</th>
                    <th className="py-3.5 px-4">ชื่อรายวิชา</th>
                    <th className="py-3.5 px-4">กลุ่มสาระฯ</th>
                    <th className="py-3.5 px-4">ระดับชั้น</th>
                    <th className="py-3.5 px-4 text-center">ชม./ปี</th>
                    <th className="py-3.5 px-4 text-center">หน่วยกิต</th>
                    <th className="py-3.5 px-4 text-center">สิทธิ์ส่ง สช. (OPEC)</th>
                    <th className="py-3.5 px-4 text-center">แสดงในใบเกรด</th>
                    <th className="py-3.5 px-4 text-center w-24">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {courses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">{c.course_code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {c.name_th}
                        {c.name_en && <span className="block text-[11px] font-normal text-slate-400">{c.name_en}</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">{c.subject_group}</td>
                      <td className="py-3 px-4 font-bold">{c.grade_level}</td>
                      <td className="py-3 px-4 text-center font-mono">{c.annual_hours}</td>
                      <td className="py-3 px-4 text-center font-mono">{c.credits}</td>
                      <td className="py-3 px-4 text-center">
                        {c.is_reported_to_opec ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            ส่ง REGIS สช.
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-[11px]">
                            ตัดออก ไม่ส่ง สช. (MEP)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.show_on_parent_report ? (
                          <span className="text-emerald-600 font-bold inline-flex items-center gap-1 justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>แสดง</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium inline-flex items-center gap-1 justify-center text-[11px]">
                            <span>ซ่อน</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingCourse(c)}
                            title="แก้ไขวิชา"
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 hover:text-[#7B1C3E] rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(c.id, c.course_code)}
                            title="ลบวิชา"
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Dialog for New Course */}
        <AnimatePresence>
          {isNewCourseOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden"
              >
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#7B1C3E]" />
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">เพิ่มรายวิชาใหม่ ({academicYear})</h3>
                  </div>
                  <button
                    onClick={() => setIsNewCourseOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateCourse} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        รหัสวิชา <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ค13101"
                        value={newCourse.course_code}
                        onChange={(e) => setNewCourse({ ...newCourse, course_code: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        รหัสวิชา สช. (REGIS)
                      </label>
                      <input
                        type="text"
                        placeholder="เว้นว่างถ้าตรงกัน"
                        value={newCourse.opec_course_code}
                        onChange={(e) => setNewCourse({ ...newCourse, opec_course_code: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ชื่อรายวิชา (ภาษาไทย) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น คณิตศาสตร์ 3"
                      value={newCourse.name_th}
                      onChange={(e) => setNewCourse({ ...newCourse, name_th: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        กลุ่มสาระฯ
                      </label>
                      <select
                        value={newCourse.subject_group}
                        onChange={(e) => setNewCourse({ ...newCourse, subject_group: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                      >
                        <option value="ภาษาไทย">ภาษาไทย</option>
                        <option value="คณิตศาสตร์">คณิตศาสตร์</option>
                        <option value="วิทยาศาสตร์และเทคโนโลยี">วิทยาศาสตร์และเทคโนโลยี</option>
                        <option value="สังคมศึกษา ศาสนา และวัฒนธรรม">สังคมศึกษาฯ</option>
                        <option value="สุขศึกษาและพลศึกษา">สุขศึกษาและพลศึกษา</option>
                        <option value="ศิลปะ">ศิลปะ</option>
                        <option value="การงานอาชีพ">การงานอาชีพ</option>
                        <option value="ภาษาต่างประเทศ">ภาษาต่างประเทศ</option>
                        <option value="กิจกรรมพัฒนาผู้เรียน">กิจกรรมพัฒนาผู้เรียน</option>
                        <option value="พัฒนาการ 4 ด้าน">พัฒนาการ 4 ด้าน (ปฐมวัย)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        ระดับชั้น
                      </label>
                      <select
                        value={newCourse.grade_level}
                        onChange={(e) => setNewCourse({ ...newCourse, grade_level: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                      >
                        <option value="K1">อ.1 (K1)</option>
                        <option value="K2">อ.2 (K2)</option>
                        <option value="K3">อ.3 (K3)</option>
                        <option value="P1">ป.1 (P1)</option>
                        <option value="P2">ป.2 (P2)</option>
                        <option value="P3">ป.3 (P3)</option>
                        <option value="P4">ป.4 (P4)</option>
                        <option value="P5">ป.5 (P5)</option>
                        <option value="P6">ป.6 (P6)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        ชั่วโมง/ปี
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newCourse.annual_hours}
                        onChange={(e) => setNewCourse({ ...newCourse, annual_hours: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        หน่วยกิต / น้ำหนัก
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={newCourse.credits}
                        onChange={(e) => setNewCourse({ ...newCourse, credits: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCourse.is_reported_to_opec}
                        onChange={(e) => setNewCourse({ ...newCourse, is_reported_to_opec: e.target.checked })}
                        className="rounded border-slate-300 text-[#7B1C3E] focus:ring-[#7B1C3E] w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        ส่งออกผลการเรียนให้ สช. (REGIS OPEC)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCourse.show_on_parent_report}
                        onChange={(e) => setNewCourse({ ...newCourse, show_on_parent_report: e.target.checked })}
                        className="rounded border-slate-300 text-[#7B1C3E] focus:ring-[#7B1C3E] w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        แสดงในสมุดรายงานประจำตัวนักเรียน / ปพ.6
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsNewCourseOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold text-white bg-[#7B1C3E] hover:bg-[#641430] rounded-xl shadow-sm"
                    >
                      บันทึกรายวิชา
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Dialog for Edit Course */}
        <AnimatePresence>
          {editingCourse && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden"
              >
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-[#7B1C3E]" />
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">แก้ไขรายวิชา ({editingCourse.course_code})</h3>
                  </div>
                  <button
                    onClick={() => setEditingCourse(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEditCourse} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        รหัสวิชา
                      </label>
                      <input
                        type="text"
                        required
                        value={editingCourse.course_code || ''}
                        onChange={(e) => setEditingCourse({ ...editingCourse, course_code: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        รหัสวิชา สช. (REGIS)
                      </label>
                      <input
                        type="text"
                        value={editingCourse.opec_course_code || ''}
                        onChange={(e) => setEditingCourse({ ...editingCourse, opec_course_code: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ชื่อรายวิชา (ภาษาไทย)
                    </label>
                    <input
                      type="text"
                      required
                      value={editingCourse.name_th || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, name_th: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ชื่อรายวิชา (ภาษาอังกฤษ)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น Mathematics (MEP)"
                      value={editingCourse.name_en || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, name_en: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        กลุ่มสาระฯ
                      </label>
                      <select
                        value={editingCourse.subject_group || 'คณิตศาสตร์'}
                        onChange={(e) => setEditingCourse({ ...editingCourse, subject_group: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="ภาษาไทย">ภาษาไทย</option>
                        <option value="คณิตศาสตร์">คณิตศาสตร์</option>
                        <option value="วิทยาศาสตร์และเทคโนโลยี">วิทยาศาสตร์และเทคโนโลยี</option>
                        <option value="สังคมศึกษา ศาสนา และวัฒนธรรม">สังคมศึกษาฯ</option>
                        <option value="สุขศึกษาและพลศึกษา">สุขศึกษาและพลศึกษา</option>
                        <option value="ศิลปะ">ศิลปะ</option>
                        <option value="การงานอาชีพ">การงานอาชีพ</option>
                        <option value="ภาษาต่างประเทศ">ภาษาต่างประเทศ</option>
                        <option value="กิจกรรมพัฒนาผู้เรียน">กิจกรรมพัฒนาผู้เรียน</option>
                        <option value="พัฒนาการ 4 ด้าน">พัฒนาการ 4 ด้าน (ปฐมวัย)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        ระดับชั้น
                      </label>
                      <select
                        value={editingCourse.grade_level || 'P3'}
                        onChange={(e) => setEditingCourse({ ...editingCourse, grade_level: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="K1">อ.1 (K1)</option>
                        <option value="K2">อ.2 (K2)</option>
                        <option value="K3">อ.3 (K3)</option>
                        <option value="P1">ป.1 (P1)</option>
                        <option value="P2">ป.2 (P2)</option>
                        <option value="P3">ป.3 (P3)</option>
                        <option value="P4">ป.4 (P4)</option>
                        <option value="P5">ป.5 (P5)</option>
                        <option value="P6">ป.6 (P6)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        ชั่วโมง/ปี
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingCourse.annual_hours || 0}
                        onChange={(e) => setEditingCourse({ ...editingCourse, annual_hours: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        หน่วยกิต / น้ำหนัก
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={editingCourse.credits || 0}
                        onChange={(e) => setEditingCourse({ ...editingCourse, credits: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editingCourse.is_reported_to_opec}
                        onChange={(e) => setEditingCourse({ ...editingCourse, is_reported_to_opec: e.target.checked })}
                        className="rounded border-slate-300 text-[#7B1C3E] focus:ring-[#7B1C3E] w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        ส่งออกผลการเรียนให้ สช. (REGIS OPEC)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editingCourse.show_on_parent_report}
                        onChange={(e) => setEditingCourse({ ...editingCourse, show_on_parent_report: e.target.checked })}
                        className="rounded border-slate-300 text-[#7B1C3E] focus:ring-[#7B1C3E] w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        แสดงในสมุดรายงานประจำตัวนักเรียน / ปพ.6
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingCourse(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEditCourse}
                      className="px-5 py-2 text-xs font-bold text-white bg-[#7B1C3E] hover:bg-[#641430] rounded-xl shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSavingEditCourse ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
