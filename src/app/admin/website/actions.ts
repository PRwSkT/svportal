'use server';

import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufsqavndpjphowuacxfi.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmc3Fhdm5kcGpwaG93dWFjeGZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTExMzg3OCwiZXhwIjoyMDk2Njg5ODc4fQ.ntNcIPdTwLRIy25nScwqPs6d_RuT28l11Ttqoo7r8NU';
  return createClient(url, key);
}

export async function insertRecord(table: string, payload: any) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(table).insert([payload]).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRecord(table: string, id: string, payload: any) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRecord(table: string, id: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(table).delete().eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function toggleActive(table: string, id: string, currentStatus: boolean) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(table).update({ is_active: !currentStatus }).eq('id', id).select();
  if (error) throw new Error(error.message);
  return data;
}
