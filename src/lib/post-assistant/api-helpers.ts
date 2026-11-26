import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSupabasePublicObjectUrl } from '@/lib/supabase/storage-admin';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requirePostAssistantAuth() {
  const auth = await requireAuth('admin', ['post_assistant', 'admin_website']);
  if (auth.error || !auth.user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 }),
    };
  }
  return { ok: true as const, user: auth.user, role: auth.role, appUser: auth.appUser };
}

export function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export function isSchemaMissingError(err: unknown): boolean {
  const errObj = err as { code?: unknown; message?: unknown } | null;
  const code = String(errObj?.code || '');
  const msg = String(errObj?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

export function getErrorMessage(err: unknown, fallback = 'Unexpected error'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

export function schemaNotMigratedResponse() {
  return NextResponse.json(
    {
      error:
        'ฐานข้อมูลยังไม่มีตาราง social_posts หรือคอลัมน์ v2 — กรุณารันไฟล์ supabase/deploy_20261126_post_assistant_v2.sql ใน Supabase Dashboard -> SQL Editor',
      code: 'SCHEMA_NOT_MIGRATED',
    },
    { status: 503 }
  );
}

export function resolveSafePostMediaUrl(storagePath: string, draftId: string): string {
  const clean = (storagePath || '').replace(/^\/+/, '');
  if (!clean.startsWith(`staging/${draftId}/`) || clean.includes('..')) {
    throw new Error(`Invalid post-media storage path: ${storagePath}`);
  }
  return getSupabasePublicObjectUrl('post-media', clean);
}
