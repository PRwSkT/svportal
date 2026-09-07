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

    const fetchAppUser = async (userId: string) => {
      try {
        // 1. Fetch user record via RPC get_current_app_user (bypasses any RLS restrictions cleanly)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_current_app_user');
        if (!rpcError && rpcData) {
          setAppUser(rpcData as AppUser);
          if (rpcData.role) setRole(rpcData.role);
          return;
        }

        // 2. Direct table fallback
        const { data, error } = await supabase.from('app_users').select('*').eq('id', userId).single();
        if (!error && data) {
          setAppUser(data as AppUser);
          if (data.role) setRole(data.role);
        } else {
          setAppUser(null);
        }
      } catch (err) {
        console.error('Error in fetchAppUser:', err);
        setAppUser(null);
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
          if (currentUser.email === 'admin@svportal.com') {
            setRole('admin');
          }
          await fetchAppUser(currentUser.id);
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
          if (currentUser.email === 'admin@svportal.com') {
            setRole('admin');
          }
          await fetchAppUser(currentUser.id);
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
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
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
