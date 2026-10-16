'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  GraduationCap, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileCheck2, 
  Baby, 
  CalendarDays, 
  CheckSquare, 
  Settings, 
  ChevronRight, 
  ArrowUpRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Award
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export default function AcademicHubPage() {
  const { user, appUser, role } = useAuth();
  const [gradebooks, setGradebooks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchHubData = async () => {
    setIsLoading(true);
    try {
      const [resGb, resCls] = await Promise.all([
        fetch('/api/academic/gradebooks'),
        fetch('/api/academic/classes?year=2568')
      ]);

      if (resGb.ok) {
        const d = await resGb.json();
        setGradebooks(d.gradebooks || []);
      }
      if (resCls.ok) {
        const d = await resCls.json();
        setClasses(d.classes || []);
      }
    } catch (err: any) {
      toast.error('โหลดข้อมูลหน้าแดชบอร์ดวิชาการล้มเหลว');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, []);

  const pendingHeadReview = gradebooks.filter(g => g.approval_status === 'SUBMITTED_TO_HEAD');
  const pendingDirectorReview = gradebooks.filter(g => g.approval_status === 'APPROVED_BY_HEAD');
  const lockedCount = gradebooks.filter(g => g.approval_status === 'OFFICIALLY_LOCKED').length;
  const draftCount = gradebooks.filter(g => g.approval_status === 'DRAFT' || g.approval_status === 'REVISION_REQUESTED').length;

  const handleReviewAction = async (gradebookId: string, action: string, notes?: string) => {
    setActionLoadingId(gradebookId);
    try {
      const res = await fetch(`/api/academic/gradebooks/${gradebookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewer_id: appUser?.personnel_id || null,
          notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || 'ดำเนินการสำเร็จ');
      fetchHubData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const isAdminOrDirector = role === 'admin' || role === 'executive';
  const isHeadOrAdmin = role === 'admin' || role === 'executive' || role === 'academic staff';

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Header Banner - Matching Forms Studio */}
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20">
                  Somkid Academic Studio
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 font-medium">
                  ศูนย์รวมงานวิชาการและการวัดผลประเมินผล
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                ระบบวิชาการและการวัดผลประเมินผล
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                ระบบวิชาการครบวงจรตั้งแต่เตรียมอนุบาลถึงประถมศึกษา ถูกต้องตามระเบียบ สพฐ. และ สช. 100% พร้อมสายการอนุมัติ 3 ระดับ และการแปลงข้อมูลส่ง REGIS ไร้รอยต่อ
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-nongfah-chat'));
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#7B1C3E]/40 hover:bg-[#7B1C3E]/5 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#7B1C3E]" />
                <span>คุยกับน้องฟ้า AI วิชาการ</span>
              </button>
              <Link
                href="/academic/timetable"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-[#7B1C3E]/20 transition-all cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>จัดการตารางสอน</span>
              </Link>
            </div>
          </div>

          {/* 4 Quick Metrics Bar - Matching Forms Studio Layout */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-900">รอหัวหน้าแผนกตรวจ</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-950 mt-2">{pendingHeadReview.length} เล่ม</div>
              <div className="text-xs text-amber-700/80 mt-0.5">คิวตรวจทานระดับที่ 1</div>
            </div>

            <div className="bg-purple-50/70 border border-purple-200/70 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-900">รอผู้อำนวยการอนุมัติ</span>
                <ShieldCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-950 mt-2">{pendingDirectorReview.length} เล่ม</div>
              <div className="text-xs text-purple-700/80 mt-0.5">คิวลงนามและล็อกถาวร</div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">อนุมัติเสร็จสิ้น (ล็อก)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{lockedCount} เล่ม</div>
              <div className="text-xs text-slate-400 mt-0.5">พร้อมส่งออก ปพ. และ REGIS</div>
            </div>

            <div className="bg-[#7B1C3E]/5 border border-[#7B1C3E]/15 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#7B1C3E]">ห้องเรียนทั้งหมด</span>
                <BookOpen className="w-4 h-4 text-[#7B1C3E]" />
              </div>
              <div className="text-2xl font-bold text-[#7B1C3E] mt-2">{classes.length} ห้อง</div>
              <div className="text-xs text-[#7B1C3E]/70 mt-0.5">อนุบาลและประถม ปีการศึกษา 2568</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">

        {/* 3-Tier Review Hub Queue (Visible to Reviewers) */}
        {isHeadOrAdmin && (pendingHeadReview.length > 0 || pendingDirectorReview.length > 0) && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-300 font-bold">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>คิวตรวจทานผลการเรียน 3 ลำดับชั้น (Academic Review Queue)</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Head Queue */}
              {pendingHeadReview.map((gb) => (
                <div key={gb.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-semibold">
                        รอหัวหน้าแผนกตรวจทาน
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{gb.class?.name}</span>
                      <span className="text-slate-500 text-sm">• {gb.course?.name_th} ({gb.course?.course_code})</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      ครูผู้สอน: {gb.actual_teacher?.name_th || 'ไม่ระบุ'} • ส่งเมื่อ: {new Date(gb.submitted_at).toLocaleDateString('th-TH')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/academic/gradebook?gradebook_id=${gb.id}`}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      ดูคะแนน
                    </Link>
                    <button
                      onClick={() => handleReviewAction(gb.id, 'reject_head')}
                      disabled={actionLoadingId === gb.id}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium transition-all"
                    >
                      ส่งกลับแก้ไข
                    </button>
                    <button
                      onClick={() => handleReviewAction(gb.id, 'approve_head')}
                      disabled={actionLoadingId === gb.id}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-sm transition-all"
                    >
                      อนุมัติชั้นต้น
                    </button>
                  </div>
                </div>
              ))}

              {/* Director Queue */}
              {pendingDirectorReview.map((gb) => (
                <div key={gb.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-semibold">
                        รอผู้อำนวยการอนุมัติ (Final Lock)
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{gb.class?.name}</span>
                      <span className="text-slate-500 text-sm">• {gb.course?.name_th} ({gb.course?.course_code})</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      หัวหน้าแผนกตรวจแล้ว • รอลงนามอนุมัติและล็อกผลการเรียนถาวร
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/academic/gradebook?gradebook_id=${gb.id}`}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      ตรวจสอบเล่ม
                    </Link>
                    {isAdminOrDirector && (
                      <>
                        <button
                          onClick={() => handleReviewAction(gb.id, 'reject_director')}
                          disabled={actionLoadingId === gb.id}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium transition-all"
                        >
                          ส่งกลับ
                        </button>
                        <button
                          onClick={() => handleReviewAction(gb.id, 'approve_director')}
                          disabled={actionLoadingId === gb.id}
                          className="px-4 py-1.5 rounded-lg bg-purple-700 text-white hover:bg-purple-800 text-xs font-semibold shadow-sm transition-all"
                        >
                          ลงนามอนุมัติ (Final Lock)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* 1. Smart Gradebook ปพ.5 */}
          <Link
            href="/academic/gradebook"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all hover:border-emerald-300"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Smart Gradebook (ปพ.5)</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              ตารางกรอกคะแนนลื่นไหลแบบ Excel มี Auto-save คำนวณตัดเกรด 8 ระดับอัตโนมัติ และระบบ Pre-flight ตรวจสอบความถูกต้องก่อนส่ง
            </p>
          </Link>

          {/* 2. Kindergarten Early Years */}
          <Link
            href="/academic/early-years"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all hover:border-pink-300"
          >
            <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-950/50 flex items-center justify-center text-pink-600 mb-4 group-hover:scale-110 transition-transform">
              <Baby className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>ประเมินพัฒนาการปฐมวัย</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-pink-600 transition-colors" />
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              บันทึกพัฒนาการ 4 ด้าน (ระดับ 3, 2, 1) และคำนวณภาวะโภชนาการ BMI ตามเกณฑ์กรมอนามัย พร้อมผู้ช่วย AI ช่วยเขียนสรุปความเห็น
            </p>
          </Link>

          {/* 3. OPEC REGIS Export */}
          <Link
            href="/academic/opec"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all hover:border-purple-300"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>ส่งออก REGIS สช. (OPEC Ready)</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              ระบบ Dual-Layer รวมห้องเรียนย่อยเป็นห้อง สช. อัตโนมัติ ตัดวิชา MEP ออก และแปลงชื่อครูตามวิทยฐานะ สช. ใน 1 คลิก
            </p>
          </Link>

          {/* 4. Exams & OMR */}
          <Link
            href="/academic/exams"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all hover:border-amber-300"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 mb-4 group-hover:scale-110 transition-transform">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>คลังข้อสอบ & ตรวจ OMR กระดาษ</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              ออกข้อสอบสลับชุด A, B, C พิมพ์กระดาษคำตอบมี QR รายคน และสแกนตรวจด้วยกล้องมือถือ/เครื่องถ่ายเอกสาร คะแนนไหลเข้า ปพ.5 ทันที
            </p>
          </Link>

          {/* 5. Timetable & Substitution */}
          <Link
            href="/academic/timetable"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all hover:border-sky-300"
          >
            <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 mb-4 group-hover:scale-110 transition-transform">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>ตารางสอน & จัดสอนแทนอัจฉริยะ</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              น้องฟ้า AI ร่างตารางสอน ป้องกันชั่วโมงชน เกลี่ยภาระงานครู และจัดครูสอนแทนเมื่อมีครูลาอย่างเป็นธรรม
            </p>
          </Link>

          {/* 6. Controlled Documents Hub (ปพ.1, ปพ.2, ปพ.3, ปพ.6) */}
          <Link
            href="/academic/documents"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all hover:border-[#7B1C3E]/50"
          >
            <div className="w-12 h-12 rounded-xl bg-[#7B1C3E]/10 flex items-center justify-center text-[#7B1C3E] mb-4 group-hover:scale-110 transition-transform">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>พิมพ์เอกสาร ปพ. (ปพ.1, 2, 3, 6)</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7B1C3E] transition-colors" />
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              ระบบพิมพ์ทับกระดาษจริงตราครุฑดุนนูนสอบเทียบระดับมิลลิเมตร ออก ปพ.3 ส่ง ORSS สช. 1-Click และสมุดพก 16 หน้า
            </p>
          </Link>

          {/* 7. Academic Setup */}
          <Link
            href="/admin/academic"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all hover:border-slate-400"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>ตั้งค่าโครงสร้างหลักสูตร</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              กำหนดวิชาพื้นฐาน/เพิ่มเติม สัดส่วนคะแนนเก็บ และการจับคู่ห้องเรียนกับระบบ สช.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
