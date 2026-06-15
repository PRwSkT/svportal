'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
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
    <div className="min-h-[80vh] flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-surface p-10 rounded-2xl shadow-xl border border-foreground/5">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-primary">
            ระบบการเงิน SVPortal
          </h2>
          <p className="mt-2 text-center text-sm text-foreground/70">
            เข้าสู่ระบบเพื่อใช้งาน (ใช้ระบบจัดการผู้ใช้ของโรงเรียน)
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">อีเมล</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-xl relative block w-full px-3 py-3 border border-foreground/20 placeholder-foreground/50 text-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-surface"
                placeholder="อีเมล"
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
                className="appearance-none rounded-xl relative block w-full px-3 py-3 border border-foreground/20 placeholder-foreground/50 text-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-surface"
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
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
