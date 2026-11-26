import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldAlert, Home } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { PostAssistantStudio } from '@/components/post-assistant/PostAssistantStudio';

export const metadata: Metadata = {
  title: 'Social Post Assistant v2 | SV Portal',
  description: 'ระบบสตูดิโอสร้างโพสต์ประชาสัมพันธ์ 3 ภาษา และซิงก์ข่าวสารขึ้นเว็บไซต์ somkidvittaya.ac.th',
};

export const dynamic = 'force-dynamic';

export default async function PostAssistantV2Page() {
  const auth = await requireAuth('admin', ['post_assistant', 'admin_website']);

  if (auth.error === 'Unauthorized') {
    redirect('/login');
  }

  if (auth.error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-[#7B1C3E] flex items-center justify-center mx-auto border border-rose-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">ไม่มีสิทธิ์เข้าถึง Social Post Assistant v2</h1>
        <p className="text-sm text-slate-600">
          บัญชีของท่านไม่ได้รับมอบหมายสิทธิ์ <code className="bg-slate-100 px-1.5 py-0.5 rounded">post_assistant</code> หรือ{' '}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded">admin_website</code> กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm font-bold hover:opacity-95"
        >
          <Home className="w-4 h-4" />
          <span>กลับหน้าหลัก</span>
        </Link>
      </div>
    );
  }

  return <PostAssistantStudio />;
}
