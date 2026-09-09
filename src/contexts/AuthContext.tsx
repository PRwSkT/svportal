'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

import { AppUser } from '@/types';

type AuthContextType = {
  user: User | null;
  role: 'admin' | 'executive' | 'teacher' | 'academic staff' | 'non-academic staff' | 'cashier' | null;
  appUser: AppUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'executive' | 'teacher' | 'academic staff' | 'non-academic staff' | 'cashier' | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Safety timer to prevent any indefinite loading freeze
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    const fetchAppUserFallback = async (userId: string, email?: string) => {
      try {
        // 1. Fetch user record via RPC get_app_user_by_id
        const { data: idData, error: idError } = await supabase.rpc('get_app_user_by_id', {
          target_user_id: userId
        });
        if (!idError && idData) {
          const parsed = typeof idData === 'string' ? JSON.parse(idData) : idData;
          setAppUser(parsed as AppUser);
          if (parsed.role) setRole(parsed.role);
          return;
        }

        // 2. Fetch user record via RPC get_app_user_by_email
        if (email) {
          const { data: emailData, error: emailError } = await supabase.rpc('get_app_user_by_email', {
            target_email: email
          });
          if (!emailError && emailData) {
            const parsed = typeof emailData === 'string' ? JSON.parse(emailData) : emailData;
            setAppUser(parsed as AppUser);
            if (parsed.role) setRole(parsed.role);
            return;
          }
        }

        // 3. Fallback: get_current_app_user
        const { data: rpcData } = await supabase.rpc('get_current_app_user');
        if (rpcData) {
          const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
          setAppUser(parsed as AppUser);
          if (parsed.role) setRole(parsed.role);
          return;
        }

        // 4. Direct table fallback
        const { data } = await supabase.from('app_users').select('*').eq('id', userId).single();
        if (data) {
          setAppUser(data as AppUser);
          if (data.role) setRole(data.role);
        }
      } catch (err) {
        console.error('Error in fetchAppUserFallback:', err);
      }
    };

    const loadSession = async () => {
      // DEV MODE BYPASS FOR TESTING
      if (process.env.NODE_ENV === 'development') {
        const dummyUser = { id: 'dev-user-id', email: 'admin@dev.local' } as User;
        const dummyAppUser: AppUser = {
          id: 'dev-user-id',
          full_name: 'ผู้ดูแลระบบ (Dev Mode)',
          role: 'admin',
          is_active: true,
          assigned_features: [
            'dashboard', 'pos_fees', 'admin_reports', 'pos_shop', 'admin_products', 
            'pos_wallet_topup', 'admin_wallet_students', 'admin_students', 'admin_users', 
            'admin_website', 'post_assistant', 'audio_remote', 'qr_generator', 
            'settings', 'academic_todo', 'admin_attendance'
          ],
          created_at: new Date().toISOString()
        };
        setUser(dummyUser);
        setRole('admin');
        setAppUser(dummyAppUser);
        setIsLoading(false);
        return;
      }

      try {
        // 1. Primary: Load directly from /api/auth/me (Same-origin server verified, avoids client RLS/CORS)
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setAppUser(data.appUser);
            setRole(data.role);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load session from /api/auth/me:', err);
      }

      // 2. Client-side fallback via Supabase client
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.error('Session error:', sessionError);
        const currentUser = session?.user || null;
        setUser(currentUser);
        if (currentUser) {
          const adminEmails = ['admin@somkidvittaya.ac.th', 'peerawat@somkidvittaya.ac.th', 'media@somkidvittaya.ac.th', 'admin@svportal.com'];
          if (currentUser.email && adminEmails.includes(currentUser.email.toLowerCase())) {
            setRole('admin');
          }
          await fetchAppUserFallback(currentUser.id, currentUser.email);
        } else {
          setRole(null);
          setAppUser(null);
        }
      } catch (err) {
        console.error('Auth fetch fallback error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => {
      if (process.env.NODE_ENV === 'development') return;
      
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        loadSession();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
        setAppUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Client signout error:', e);
    }
    window.location.href = '/api/auth/logout';
  };

  return (
    <AuthContext.Provider value={{ user, role, appUser, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
