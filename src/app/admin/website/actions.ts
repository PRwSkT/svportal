'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function insertRecord(table: string, payload: any) {
  const { data, error } = await supabaseAdmin.from(table).insert([payload]).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRecord(table: string, id: string, payload: any) {
  const { data, error } = await supabaseAdmin.from(table).update(payload).eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRecord(table: string, id: string) {
  const { data, error } = await supabaseAdmin.from(table).delete().eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function toggleActive(table: string, id: string, currentStatus: boolean) {
  const { data, error } = await supabaseAdmin.from(table).update({ is_active: !currentStatus }).eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}
