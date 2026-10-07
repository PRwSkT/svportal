'use server';

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
import { triggerWebsiteRebuild } from '@/lib/website-sync';

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('ระบบยังไม่ได้กำหนด SUPABASE_SERVICE_ROLE_KEY บน Server');
  }
  return createClient(url, key);
}

async function verifyAdmin(): Promise<{ authorized: boolean; error?: string }> {
  try {
    const auth = await requireAuth('admin', 'admin_website');
    if (auth.error) {
      return { 
        authorized: false, 
        error: auth.error === 'Unauthorized' 
          ? 'กรุณาเข้าสู่ระบบใหม่ (เซสชันหมดอายุ)' 
          : 'คุณไม่มีสิทธิ์ในการจัดการข้อมูลเว็บไซต์นี้' 
      };
    }
    return { authorized: true };
  } catch (err: any) {
    return { authorized: false, error: err?.message || 'การตรวจสอบสิทธิ์ล้มเหลว' };
  }
}

const ALLOWED_WEBSITE_TABLES = [
  'calendar_events',
  'news',
  'documents',
  'album_photos',
  'albums',
  'personnel',
] as const;

type AllowedWebsiteTable = typeof ALLOWED_WEBSITE_TABLES[number];

function validateWebsiteTable(table: string): AllowedWebsiteTable {
  if (!ALLOWED_WEBSITE_TABLES.includes(table as AllowedWebsiteTable)) {
    throw new Error(`ไม่อนุญาตให้จัดการตาราง ${table} ผ่านฟังก์ชันนี้`);
  }
  return table as AllowedWebsiteTable;
}

export async function insertRecord(table: string, payload: any): Promise<ActionResult> {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const safeTable = validateWebsiteTable(table);
    const supabase = getAdminClient();

    // If inserting personnel with email, try auto-resolving user_id
    if (table === 'personnel' && payload.email) {
      const email = payload.email.toLowerCase().trim();
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const matched = users?.find(u => (u.email || '').toLowerCase().trim() === email);
      if (matched) {
        payload.user_id = matched.id;
      }
    }

    const { data, error } = await supabase.from(table).insert([payload]).select();
    if (error) {
      console.error(`Database error inserting into ${table}:`, error);
      return { success: false, error: error.message };
    }

    // Sync app_users if personnel record was created with user_id
    if (table === 'personnel' && data && data[0]?.user_id) {
      await supabase.from('app_users').update({
        personnel_id: data[0].id,
        full_name: data[0].name_th
      }).eq('id', data[0].user_id);
    }

    return { success: true, data };
  } catch (err: any) {
    console.error(`Server error inserting into ${table}:`, err);
    return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

export async function updateRecord(table: string, id: string, payload: any): Promise<ActionResult> {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const safeTable = validateWebsiteTable(table);
    const supabase = getAdminClient();

    // If updating personnel with email, try auto-resolving user_id if missing
    if (safeTable === 'personnel' && payload.email !== undefined) {
      if (payload.email) {
        const email = payload.email.toLowerCase().trim();
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const matched = users?.find(u => (u.email || '').toLowerCase().trim() === email);
        if (matched) {
          payload.user_id = matched.id;
        }
      } else {
        payload.user_id = null;
      }
    }

    const { data, error } = await supabase.from(safeTable).update(payload).eq('id', id).select();
    if (error) {
      console.error(`Database error updating ${safeTable} id=${id}:`, error);
      return { success: false, error: error.message };
    }

    // Sync app_users
    if (safeTable === 'personnel' && data && data[0]) {
      if (data[0].user_id) {
        await supabase.from('app_users').update({
          personnel_id: data[0].id,
          full_name: data[0].name_th
        }).eq('id', data[0].user_id);
      }
    }

    return { success: true, data };
  } catch (err: any) {
    console.error(`Server error updating ${table}:`, err);
    return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' };
  }
}

export async function deleteRecord(table: string, id: string): Promise<ActionResult> {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const safeTable = validateWebsiteTable(table);
    const supabase = getAdminClient();
    const { data, error } = await supabase.from(safeTable).delete().eq('id', id).select();
    if (error) {
      console.error(`Database error deleting from ${safeTable} id=${id}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error(`Server error deleting from ${table}:`, err);
    return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการลบข้อมูล' };
  }
}

export async function toggleActive(table: string, id: string, currentStatus: boolean): Promise<ActionResult> {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const safeTable = validateWebsiteTable(table);
    const supabase = getAdminClient();
    const { data, error } = await supabase.from(safeTable).update({ is_active: !currentStatus }).eq('id', id).select();
    if (error) {
      console.error(`Database error toggling status in ${safeTable} id=${id}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error(`Server error toggling status in ${table}:`, err);
    return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะ' };
  }
}

/**
 * Explicit manual deploy trigger initiated by school admin.
 * Rebuilds the entire static website on Netlify with the latest Supabase content.
 */
export async function manualTriggerDeploy(): Promise<ActionResult> {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const success = await triggerWebsiteRebuild('Manual trigger by Admin in SVPortal');
    return { success };
  } catch (err: any) {
    return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการทริกเกอร์ deploy' };
  }
}

/**
 * 1-Click Sync: Re-sync all personnel with corresponding auth.users/app_users accounts by email.
 */
export async function autoLinkAllPersonnelUsers(): Promise<ActionResult<{ count: number }>> {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const supabase = getAdminClient();
    const { data: personnelList, error: pErr } = await supabase.from('personnel').select('*');
    if (pErr) throw pErr;

    const { data: { users: authUsers }, error: aErr } = await supabase.auth.admin.listUsers();
    if (aErr) throw aErr;

    let linkedCount = 0;
    for (const p of (personnelList || [])) {
      if (!p.email) continue;
      const targetEmail = p.email.toLowerCase().trim();
      const matchedAuth = authUsers.find(u => (u.email || '').toLowerCase().trim() === targetEmail);

      if (matchedAuth) {
        if (p.user_id !== matchedAuth.id) {
          await supabase.from('personnel').update({ user_id: matchedAuth.id }).eq('id', p.id);
        }
        await supabase.from('app_users').update({
          personnel_id: p.id,
          full_name: p.name_th
        }).eq('id', matchedAuth.id);

        linkedCount++;
      }
    }

    return { success: true, data: { count: linkedCount } };
  } catch (err: any) {
    return { success: false, error: err?.message || 'การเชื่อมโยงข้อมูลล้มเหลว' };
  }
}
