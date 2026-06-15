import { createClient } from './supabase/client';

export async function logAction(params: {
  action: string;
  tableName: string;
  recordId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createClient();
    
    // Attempt to get user session. If it fails, we still log (system action or anonymous)
    const { data: { user } } = await supabase.auth.getUser();
    
    let userName = null;
    if (user) {
      const { data: userData } = await supabase
        .from('app_users')
        .select('full_name')
        .eq('id', user.id)
        .single();
      userName = userData?.full_name || null;
    }

    const { error } = await supabase.from('audit_logs').insert({
      user_id: user?.id || null,
      user_name: userName,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId,
      old_value: params.oldValue || null,
      new_value: params.newValue || null,
    });

    if (error) {
      console.warn('Audit log insert failed:', error);
    }
  } catch (err) {
    console.warn('Audit log exception:', err);
  }
}
