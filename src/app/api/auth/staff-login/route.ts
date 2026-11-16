import { NextRequest, NextResponse } from 'next/server';
import { isSystemAdmin } from '@/lib/constants/auth';
import {
  attachStaffSessionCookie,
  clearStaffSessionCookie,
} from '@/lib/auth/staff-session';
import { authenticateStaffWithPg } from '@/lib/auth/staff-auth-pg';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Enforce domain restriction
    if (!cleanEmail.endsWith('@somkidvittaya.ac.th') && !isSystemAdmin(cleanEmail)) {
      return NextResponse.json(
        { error: 'Only @somkidvittaya.ac.th accounts or authorized system admins may sign in' },
        { status: 403 }
      );
    }

    // 1. Try Netlify Postgres authentication first
    let authenticatedUser: { id: string; email: string; full_name: string } | null = null;
    try {
      authenticatedUser = await authenticateStaffWithPg(cleanEmail, password);
    } catch (pgErr) {
      console.warn('authenticateStaffWithPg encountered error, checking Supabase fallback:', pgErr);
    }

    // 2. If Postgres auth did not match, try Supabase fallback if Supabase environment is active
    if (!authenticatedUser) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && anonKey) {
        try {
          const supabase = createServerClient(url, anonKey, {
            cookies: {
              getAll() {
                return req.cookies.getAll();
              },
              setAll() {},
            },
          });
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (!error && data?.user) {
            authenticatedUser = {
              id: data.user.id,
              email: data.user.email || cleanEmail,
              full_name:
                data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            };
          }
        } catch (sbErr) {
          console.warn('Supabase auth fallback error:', sbErr);
        }
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json(
        { error: 'Invalid login credentials' },
        { status: 401 }
      );
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        user_metadata: {
          full_name: authenticatedUser.full_name,
        },
      },
    });

    await attachStaffSessionCookie(res, authenticatedUser);
    return res;
  } catch (error: any) {
    console.error('Staff login error:', error);
    return NextResponse.json(
      { error: error?.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  clearStaffSessionCookie(res);
  return res;
}
