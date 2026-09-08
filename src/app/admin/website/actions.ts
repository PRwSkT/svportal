'use server';

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase Service Role configuration');
  }
  return createClient(url, key);
}

async function verifyAdmin() {
  const auth = await requireAuth('admin');
  if (auth.error) {
    throw new Error(auth.error);
  }
}

export async function insertRecord(table: string, payload: any) {
  await verifyAdmin();
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(table).insert([payload]).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRecord(table: string, id: string, payload: any) {
  await verifyAdmin();
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRecord(table: string, id: string) {
  await verifyAdmin();
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(table).delete().eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function toggleActive(table: string, id: string, currentStatus: boolean) {
  await verifyAdmin();
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(table).update({ is_active: !currentStatus }).eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}
