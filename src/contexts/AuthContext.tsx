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

    // Hard safety timeout to ensure isLoading never stays stuck on slow/hanging network
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    const fetchAppUser = async (userId: string, email?: string) => {
      try {
        // 1. Fetch user record via RPC get_app_user_by_id (bypasses RLS cleanly)
        const { data: idData, error: idError } = await supabase.rpc('get_app_user_by_id', {
          target_user_id: userId
        });
        if (!idError && idData) {
          setAppUser(idData as AppUser);
          if (idData.role) setRole(idData.role);
          return;
        }

        // 2. Fetch user record via RPC get_app_user_by_email
        if (email) {
          const { data: emailData, error: emailError } = await supabase.rpc('get_app_user_by_email', {
            target_email: email
          });
          if (!emailError && emailData) {
            setAppUser(emailData as AppUser);
            if (emailData.role) setRole(emailData.role);
            return;
          }
        }

        // 3. Fallback: get_current_app_user
        const { data: rpcData } = await supabase.rpc('get_current_app_user');
        if (rpcData) {
          setAppUser(rpcData as AppUser);
          if (rpcData.role) setRole(rpcData.role);
          return;
        }

        // 4. Direct table fallback
        const { data } = await supabase.from('app_users').select('*').eq('id', userId).single();
        if (data) {
          setAppUser(data as AppUser);
          if (data.role) setRole(data.role);
        }
      } catch (err) {
        console.error('Error in fetchAppUser:', err);
      }
    };

    const fetchSession = async () => {
      // ----------------------------------------------------
      // DEV MODE BYPASS FOR TESTING
      // ----------------------------------------------------
      if (process.env.NODE_ENV === 'development') {
        const dummyUser = { id: 'dev-user-id', email: 'admin@dev.local' } as User;
        const dummyAppUser: AppUser = {
          id: 'dev-user-id',
          full_name: 'ผู้ดูแลระบบ (Dev Mode)',
          role: 'admin',
          is_active: true,
          assigned_features: ['dashboard', 'pos_fees', 'admin_reports', 'pos_shop', 'admin_products', 'pos_wallet_topup', 'admin_wallet_students', 'admin_students', 'admin_users', 'admin_website', 'post_assistant', 'audio_remote', 'qr_generator', 'settings', 'academic_todo', 'admin_attendance'],
          created_at: new Date().toISOString()
        };
        setUser(dummyUser);
        setRole('admin');
        setAppUser(dummyAppUser);
        setIsLoading(false);
        return;
      }
      // ----------------------------------------------------

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
          await fetchAppUser(currentUser.id, currentUser.email);
        } else {
          setRole(null);
          setAppUser(null);
        }
      } catch (err) {
        console.error('Auth fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => {
      if (process.env.NODE_ENV === 'development') return;
      
      try {
        const currentUser = session?.user || null;
        setUser(currentUser);
        if (currentUser) {
          const adminEmails = ['admin@somkidvittaya.ac.th', 'peerawat@somkidvittaya.ac.th', 'media@somkidvittaya.ac.th', 'admin@svportal.com'];
          if (currentUser.email && adminEmails.includes(currentUser.email.toLowerCase())) {
            setRole('admin');
          }
          await fetchAppUser(currentUser.id, currentUser.email);
        } else {
          setRole(null);
          setAppUser(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } finally {
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
