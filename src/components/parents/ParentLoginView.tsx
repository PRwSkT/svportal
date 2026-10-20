'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { setParentClientSession, ParentClientSession } from '@/lib/pipeline/bidirectional-store';
import {
  ShieldCheck,
  Lock,
  LogIn,
  User,
  Phone,
  CreditCard,
  GraduationCap,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  School,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';

interface DemoGuardianItem {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  full_name: string;
  citizen_id: string | null;
  phone_number: string | null;
  relationship: string;
  children: Array<{
    id: string;
    name: string;
    grade: string;
    relationship: string;
  }>;
}

interface ParentLoginViewProps {
  onLoginSuccess: (guardian: any, children: any[]) => void;
}

export function ParentLoginView({ onLoginSuccess }: ParentLoginViewProps) {
  const { language } = useLanguage();
  const isThai = language === 'th';

  const [activeTab, setActiveTab] = useState<'credentials' | 'demo'>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Demo guardians state
  const [demoList, setDemoList] = useState<DemoGuardianItem[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch demo guardians
  const fetchDemoGuardians = async (q = '') => {
    try {
      setDemoLoading(true);
      const url = q
        ? `/api/parents/auth?action=demo_list&q=${encodeURIComponent(q)}`
        : '/api/parents/auth?action=demo_list';
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok && Array.isArray(data.demoGuardians)) {
        setDemoList(data.demoGuardians);
      }
    } catch (err) {
      console.error('Failed to fetch demo guardians:', err);
    } finally {
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    fetchDemoGuardians();
  }, []);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage(
        isThai
          ? 'กรุณากรอกเลขประจำตัวประชาชน (13 หลัก) หรือเบอร์โทรศัพท์ที่ลงทะเบียนไว้'
          : 'Please enter your 13-digit National ID or registered phone number.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/parents/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          identifier: cleanId,
          studentId: studentId.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error || (isThai ? 'เข้าสู่ระบบไม่สำเร็จ' : 'Sign in failed'));
        setLoading(false);
        return;
      }

      // Success
      const sessionData: ParentClientSession = {
        authenticated: true,
        guardian: data.guardian,
        children: data.children || [],
      };
      setParentClientSession(sessionData);
      toast.success(
        isThai
          ? `ยินดีต้อนรับ ${data.guardian.full_name} เข้าสู่ระบบ`
          : `Welcome, ${data.guardian.full_name}!`
      );
      onLoginSuccess(data.guardian, data.children || []);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage(
        isThai
          ? 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'
          : 'Server connection error. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (guardianItem: DemoGuardianItem) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/parents/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'demo_login',
          guardianId: guardianItem.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error || (isThai ? 'เข้าสู่ระบบไม่สำเร็จ' : 'Sign in failed'));
        setLoading(false);
        return;
      }

      const sessionData: ParentClientSession = {
        authenticated: true,
        guardian: data.guardian,
        children: data.children || [],
      };
      setParentClientSession(sessionData);
      toast.success(
        isThai
          ? `ยินดีต้อนรับ ${data.guardian.full_name} เข้าสู่ระบบ`
          : `Welcome, ${data.guardian.full_name}!`
      );
      onLoginSuccess(data.guardian, data.children || []);
    } catch (err) {
      console.error('Demo login error:', err);
      setErrorMessage(
        isThai
          ? 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
          : 'Server connection error.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F9F7F5] via-[#F4F0EB] to-[#ECE6DF] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header Bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7B1C3E] to-[#9B2C52] flex items-center justify-center p-1.5 shadow-md shadow-[#7B1C3E]/20">
            <Image
              src="/logo2.png"
              alt="โรงเรียนสมคิดวิทยา"
              width={36}
              height={36}
              className="w-8 h-8 object-contain brightness-0 invert"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold text-[#7B1C3E] tracking-tight">
                SV Parents Portal
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E]">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              โรงเรียนสมคิดวิทยา • Somkidvittaya School
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher size="sm" showIcon />
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-6 bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 p-6 sm:p-8">
        {/* Title & Branding */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7B1C3E]/10 via-[#D4AF37]/15 to-[#7B1C3E]/10 border border-[#D4AF37]/30 text-[#7B1C3E] mx-auto shadow-inner">
            <Lock className="w-7 h-7 text-[#7B1C3E]" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {isThai ? 'เข้าสู่ระบบผู้ปกครอง' : 'Parent Sign In'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {isThai
              ? 'ระบบสารสนเทศผู้ปกครองออนไลน์ ติดตามบุตรหลานแบบเรียลไทม์'
              : 'Real-time school information and child portal'}
          </p>
          <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>parents.portal.somkidvittaya.ac.th</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('credentials');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'credentials'
                ? 'bg-white text-[#7B1C3E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{isThai ? 'เข้าสู่ระบบ' : 'Sign In'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('demo');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'demo'
                ? 'bg-white text-[#7B1C3E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{isThai ? 'บัญชีทดสอบ' : 'Demo Families'}</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Tab 1: Credentials Form */}
        {activeTab === 'credentials' && (
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isThai
                  ? 'เลขประจำตัวประชาชน (13 หลัก) หรือ เบอร์โทรศัพท์'
                  : 'National Citizen ID (13 digits) or Phone Number'}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    isThai
                      ? 'เช่น 3210100373073 หรือ 085-419-9496'
                      : 'e.g. 3210100373073 or 0854199496'
                  }
                  required
                  autoFocus
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-300 focus:border-[#7B1C3E] focus:ring-2 focus:ring-[#7B1C3E]/20 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all outline-hidden"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {isThai
                  ? 'ใช้เลขบัตรประชาชนหรือเบอร์โทรศัพท์ที่เคยแจ้งไว้กับห้องธุรการโรงเรียน'
                  : 'Use your registered Citizen ID or Phone number on school records.'}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {isThai
                    ? 'รหัสประจำตัวนักเรียนของบุตรหลาน'
                    : 'Child Student ID (Optional verification)'}
                </label>
                <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                  {isThai ? 'เพื่อความปลอดภัย' : 'Security check'}
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder={isThai ? 'เช่น 10260 หรือ 10088' : 'e.g. 10260 or 10088'}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-300 focus:border-[#7B1C3E] focus:ring-2 focus:ring-[#7B1C3E]/20 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all outline-hidden"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {isThai
                  ? 'ตรวจสอบได้จากบัตรประจำตัวนักเรียน หรือใบเสร็จค่าธรรมเนียมการศึกษา'
                  : 'Found on the student ID card or official tuition receipt.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#7B1C3E] via-[#8C2046] to-[#7B1C3E] hover:from-[#6B1836] hover:to-[#6B1836] text-white font-bold text-sm shadow-md shadow-[#7B1C3E]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isThai ? 'กำลังตรวจสอบข้อมูล...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{isThai ? 'เข้าสู่ระบบ (Sign In)' : 'Sign In'}</span>
                </>
              )}
            </button>

            {/* Quick Switch to Demo */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setActiveTab('demo')}
                className="text-xs text-[#7B1C3E] hover:underline font-bold inline-flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {isThai
                    ? 'ไม่มีรหัส? กดเลือกครอบครัวทดสอบเพื่อดูระบบได้ทันที'
                    : 'No credentials? Test with sample parent accounts'}
                </span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Demo / Quick Access */}
        {activeTab === 'demo' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                {isThai
                  ? 'ข้อมูลผู้ปกครองและนักเรียนจริงในฐานข้อมูลโรงเรียนสมคิดวิทยา เลือกบัญชีด้านล่างเพื่อเข้าใช้งานทันทีแบบ 1-Click'
                  : 'Real parent and student records from Somkidvittaya database. Select an account to sign in with 1 click.'}
              </div>
            </div>

            {/* Search Input for Demo */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchDemoGuardians(e.target.value);
                }}
                placeholder={
                  isThai
                    ? 'ค้นหาชื่อผู้ปกครอง หรือเลขบัตร (จาก 266 คน)...'
                    : 'Search parent by name or citizen ID...'
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7B1C3E] focus:ring-1 focus:ring-[#7B1C3E] outline-hidden"
              />
            </div>

            {demoLoading && (
              <div className="py-6 text-center text-xs text-slate-500">
                <div className="w-5 h-5 border-2 border-[#7B1C3E]/30 border-t-[#7B1C3E] rounded-full animate-spin mx-auto mb-2" />
                {isThai ? 'กำลังค้นหาข้อมูล...' : 'Searching...'}
              </div>
            )}

            {!demoLoading && demoList.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-500">
                {isThai ? 'ไม่พบบัญชีผู้ปกครองที่ค้นหา' : 'No parents found'}
              </div>
            )}

            {!demoLoading && (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {demoList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl border border-slate-200 hover:border-[#7B1C3E]/40 hover:bg-slate-50/80 transition-all text-left flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-[#7B1C3E] transition-colors">
                          {item.full_name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {item.relationship}
                        </span>
                      </div>

                      {/* Children List */}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.children.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200"
                          >
                            <GraduationCap className="w-3 h-3 text-[#7B1C3E]" />
                            <span>
                              {c.name} ({c.grade})
                            </span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-1 text-[10px] text-slate-600 flex items-center gap-2">
                        {item.phone_number && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            {item.phone_number}
                          </span>
                        )}
                        {item.citizen_id && <span>เลขบัตร: {item.citizen_id}</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleDemoLogin(item)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-[#7B1C3E] hover:bg-[#6B1836] text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      <span>{isThai ? 'เข้าสู่ระบบ' : 'Select'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Support Info */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-1.5">
          <p className="text-[11px] text-slate-600">
            {isThai
              ? 'หากพบปัญหาการเข้าสู่ระบบ หรือต้องการแก้ไขข้อมูลเบอร์โทรศัพท์'
              : 'Need help signing in or updating your registered phone number?'}
          </p>
          <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[#7B1C3E]" />
            <span>
              {isThai ? 'ห้องธุรการ โทร. 038-611-195' : 'School Office Tel. 038-611-195'}
            </span>
          </p>
        </div>
      </main>

      {/* Security & System Badge */}
      <footer className="max-w-4xl w-full mx-auto text-center py-2 space-y-1">
        <p className="text-[11px] text-slate-500 font-medium">
          © 2026 Somkidvittaya School. All rights reserved. • PDPA Protected • Next.js 16
        </p>
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
          <a
            href="https://sv-portal.somkidvittaya.ac.th"
            className="hover:text-[#7B1C3E] flex items-center gap-1"
          >
            <School className="w-3 h-3" />
            <span>{isThai ? 'พอร์ทัลหลักบุคลากร' : 'Staff Portal'}</span>
          </a>
          <span>•</span>
          <a
            href="https://somkidvittaya.ac.th"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#7B1C3E] flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>{isThai ? 'เว็บไซต์โรงเรียน' : 'School Website'}</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
