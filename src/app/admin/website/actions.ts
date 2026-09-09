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

export async function insertRecord(table: string, payload: any): Promise<ActionResult> {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const supabase = getAdminClient();
    const { data, error } = await supabase.from(table).insert([payload]).select();
    if (error) {
      console.error(`Database error inserting into ${table}:`, error);
      return { success: false, error: error.message };
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
    const supabase = getAdminClient();
    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select();
    if (error) {
      console.error(`Database error updating ${table} id=${id}:`, error);
      return { success: false, error: error.message };
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
    const supabase = getAdminClient();
    const { data, error } = await supabase.from(table).delete().eq('id', id).select();
    if (error) {
      console.error(`Database error deleting from ${table} id=${id}:`, error);
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
    const supabase = getAdminClient();
    const { data, error } = await supabase.from(table).update({ is_active: !currentStatus }).eq('id', id).select();
    if (error) {
      console.error(`Database error toggling status in ${table} id=${id}:`, error);
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
