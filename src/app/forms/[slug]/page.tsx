import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import FormViewerClient from './FormViewerClient';
import { FormDefinition, FormField } from '@/types';
import { getServerUser } from '@/lib/auth';
import { isSystemAdmin } from '@/lib/constants/auth';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, Lock, AlertTriangle } from 'lucide-react';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getAdminClient();

  const { data: form } = await supabase
    .from('forms')
    .select('title, description')
    .eq('slug', slug)
    .single();

  if (!form) return { title: 'แบบฟอร์ม - โรงเรียนสมคิดวิทยา' };

  return {
    title: `${form.title?.th || 'แบบฟอร์มออนไลน์'} | โรงเรียนสมคิดวิทยา`,
    description: form.description?.th || 'แบบฟอร์มออนไลน์ โรงเรียนสมคิดวิทยา อ.เมือง จ.ระยอง',
  };
}

export default async function FormViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getAdminClient();

  // 1. Fetch form
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('*')
    .eq('slug', slug)
    .single();

  if (formErr || !form) {
    notFound();
  }

  // 2. Fetch fields
  const { data: fields } = await supabase
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order', { ascending: true });

  const currentUser = await getServerUser();
  const isStaffOrAdmin =
    !!currentUser &&
    (isSystemAdmin(currentUser.email) ||
      Boolean(currentUser.email?.endsWith('@somkidvittaya.ac.th')) ||
      currentUser.user_metadata?.role === 'admin');

  // 3. Draft Mode Handling
  if (!form.is_published) {
    if (isStaffOrAdmin) {
      // Staff or Admin can preview the draft form with a preview banner
      return (
        <FormViewerClient
          initialForm={form as FormDefinition}
          initialFields={(fields || []) as FormField[]}
          currentUser={currentUser ? { id: currentUser.id, email: currentUser.email || '' } : null}
          isDraftPreview={true}
        />
      );
    }

    // Public Guest: Show clean school notice
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200 text-center relative overflow-hidden">
          <div className="h-3 bg-amber-500 absolute top-0 left-0 right-0" />
          <div className="mb-4 mt-2">
            <Image
              src="/logo2.png"
              alt="School Logo"
              width={140}
              height={70}
              className="h-14 w-auto mx-auto object-contain"
            />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            แบบฟอร์มนี้ยังไม่เปิดรับคำตอบ
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            แบบฟอร์มนี้อยู่ในสถานะแบบร่าง (Draft) หรือยังไม่เปิดให้บุคคลภายนอกเข้าทำแบบสอบถามในขณะนี้
          </p>
          <div className="space-y-2.5">
            <Link
              href="/website"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl font-semibold shadow-sm transition-all text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับสู่หน้าหลักโรงเรียน</span>
            </Link>
            <Link
              href={`/login?redirect=/forms/${slug}`}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all text-xs"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบบุคลากร (ดูตัวอย่างแบบร่าง)</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Time Window Check for Published Forms
  const now = new Date();
  if (form.starts_at && new Date(form.starts_at) > now && !isStaffOrAdmin) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200 text-center relative overflow-hidden">
          <div className="h-3 bg-[#1B3A6B] absolute top-0 left-0 right-0" />
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">แบบฟอร์มยังไม่เปิดรับคำตอบ</h2>
          <p className="text-sm text-slate-600 mb-6">
            แบบฟอร์มนี้มีกำหนดเปิดรับคำตอบในวันที่{' '}
            {new Date(form.starts_at).toLocaleDateString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
          <Link
            href="/website"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#7B1C3E] text-white rounded-xl font-semibold text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับสู่หน้าหลัก</span>
          </Link>
        </div>
      </div>
    );
  }

  if (form.ends_at && new Date(form.ends_at) < now && !isStaffOrAdmin) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200 text-center relative overflow-hidden">
          <div className="h-3 bg-slate-400 absolute top-0 left-0 right-0" />
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">แบบฟอร์มปิดรับคำตอบแล้ว</h2>
          <p className="text-sm text-slate-600 mb-6">
            สิ้นสุดระยะเวลาเปิดรับคำตอบเมื่อวันที่{' '}
            {new Date(form.ends_at).toLocaleDateString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
          <Link
            href="/website"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#7B1C3E] text-white rounded-xl font-semibold text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับสู่หน้าหลัก</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <FormViewerClient
      initialForm={form as FormDefinition}
      initialFields={(fields || []) as FormField[]}
      currentUser={currentUser ? { id: currentUser.id, email: currentUser.email || '' } : null}
      isDraftPreview={false}
    />
  );
}
