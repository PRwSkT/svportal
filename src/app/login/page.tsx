'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setIsLoading(false);
      setError(signInError.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const loginEmail = email.trim().toLowerCase() === 'admin' ? 'admin@svportal.com' : email;
    
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (signInError) {
      setIsLoading(false);
      if (signInError.message.includes('Invalid login credentials')) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else {
        setError(signInError.message);
      }
    } else {
      // successful login, middleware will redirect
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="max-w-md w-full space-y-8 bg-surface/80 backdrop-blur-xl p-10 rounded-[24px] shadow-2xl border border-white/60 relative overflow-hidden">
        {/* Decorative subtle gradient inside card */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center relative z-10">
          <Image src="/logo.png" alt="School Logo" width={80} height={80} className="mb-4 drop-shadow-md hover:scale-105 transition-transform duration-300" />
          <h2 className="text-center text-3xl font-extrabold text-primary flex items-center gap-2">
            <Image src="/SV-Portal.png" alt="SVPortal Logo" width={140} height={40} className="h-10 w-auto drop-shadow-sm" />
          </h2>
          <p className="mt-4 text-center text-sm text-foreground/70 font-medium">
            เข้าสู่ระบบเพื่อใช้งาน (ใช้ระบบจัดการผู้ใช้ของโรงเรียน)
          </p>
        </div>
        <div className="mt-8 relative z-10">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-3 py-3.5 px-4 border border-foreground/10 rounded-[16px] text-foreground bg-white/60 hover:bg-white/90 backdrop-blur-sm transition-all font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            เข้าสู่ระบบด้วย Google (GMS)
          </button>
        </div>

        <div className="mt-6 relative z-10">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-foreground/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-surface/90 rounded-full text-foreground/50 text-xs font-bold tracking-wider uppercase">หรือเข้าสู่ระบบด้วยอีเมลสำรอง</span>
            </div>
          </div>
        </div>

        <form className="mt-6 space-y-6 relative z-10" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50/90 backdrop-blur-sm text-red-600 p-4 rounded-[16px] text-sm border border-red-200 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">อีเมล</label>
              <input
                id="email-address"
                name="email"
                type="text"
                autoComplete="email"
                required
                className="appearance-none rounded-[12px] relative block w-full px-4 py-3.5 border border-foreground/10 placeholder-foreground/40 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm bg-white/60 backdrop-blur-sm transition-all"
                placeholder="อีเมล หรือชื่อผู้ใช้ (admin)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">รหัสผ่าน</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-[12px] relative block w-full px-4 py-3.5 border border-foreground/10 placeholder-foreground/40 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm bg-white/60 backdrop-blur-sm transition-all"
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-[16px] text-white bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              {isLoading ? 'กำลังดำเนินการ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
