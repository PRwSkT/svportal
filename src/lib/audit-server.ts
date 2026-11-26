import { getAdminClient } from '@/lib/supabase/admin';

export interface ServerAuditLogParams {
  userId?: string | null;
  userName?: string | null;
  action: string;
  tableName: string;
  recordId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Writes an immutable audit trail entry using the server-side admin client.
 * Never throws so non-critical audit writes do not crash primary operations,
 * while remaining awaitable before returning a Route Handler response.
 */
export async function logServerAuditAction(params: ServerAuditLogParams): Promise<void> {
  try {
    const admin = getAdminClient();

    let resolvedUserName = params.userName || null;
    if (!resolvedUserName && params.userId) {
      const { data: appUser } = await admin
        .from('app_users')
        .select('full_name')
        .eq('id', params.userId)
        .maybeSingle();
      resolvedUserName = (appUser?.full_name as string | undefined) || null;
    }

    const { error } = await admin.from('audit_logs').insert({
      user_id: params.userId || null,
      user_name: resolvedUserName,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      ip_address: params.ipAddress ?? null,
    });

    if (error) {
      console.warn('[ServerAudit] Insert warning:', error.message);
    }
  } catch (err: unknown) {
    console.warn('[ServerAudit] Exception:', err instanceof Error ? err.message : String(err));
  }
}

export function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim() || null;
  }
  return request.headers.get('x-real-ip') || null;
}
