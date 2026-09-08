import { createClient } from './client';
import { Student } from '@/types';

export async function getStudents(
  searchQuery?: string,
  statusFilter?: string,
  gradeFilter?: string
): Promise<Student[]> {
  const supabase = createClient();
  let query = supabase
    .from('students')
    .select('*, student_addresses(*), student_parents(*)')
    .order('id', { ascending: true })
    .limit(5000);

  if (searchQuery) {
    const sanitized = searchQuery.replace(/[,()"]/g, '');
    query = query.or(`id.ilike.%${sanitized}%,name.ilike.%${sanitized}%`);
  }
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (gradeFilter && gradeFilter !== 'all') {
    query = query.eq('grade', gradeFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Student[];
}

export async function getStudentById(id: string): Promise<Student | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('students')
    .select('*, student_addresses(*), student_parents(*)')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as Student | null;
}

export async function createStudent(
  student: Omit<Student, 'wallet_balance' | 'created_at' | 'updated_at' | 'student_addresses' | 'student_parents'>
): Promise<Student> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('students')
    .insert([student])
    .select()
    .single();

  if (error) throw error;
  return data as Student;
}

export async function updateStudent(
  id: string,
  updates: Partial<Omit<Student, 'id' | 'wallet_balance' | 'created_at' | 'updated_at' | 'student_addresses' | 'student_parents'>>
): Promise<Student> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('students')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Student;
}

export async function deleteStudent(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function importStudentsFromCSV(
  fileData: { id: string; name: string; grade: string; citizen_id?: string; status?: string; }[]
): Promise<{ success: number; failed: number; errors: any[] }> {
  const supabase = createClient();
  let success = 0;
  let failed = 0;
  const errors: any[] = [];

  const BATCH_SIZE = 100;
  for (let i = 0; i < fileData.length; i += BATCH_SIZE) {
    const batch = fileData.slice(i, i + BATCH_SIZE).map(item => ({
      id: item.id,
      name: item.name,
      grade: item.grade,
      citizen_id: item.citizen_id,
      status: item.status || 'กำลังศึกษาอยู่',
    }));

    const { error } = await supabase
      .from('students')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

    if (error) {
      failed += batch.length;
      errors.push({ batchRange: `${i + 1} - ${i + batch.length}`, message: error.message });
    } else {
      success += batch.length;
    }
  }

  return { success, failed, errors };
}

export async function upsertStudentAddress(address: any): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('student_addresses').upsert(address);
  if (error) throw error;
}

export async function upsertStudentParent(parent: any): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('student_parents').upsert(parent);
  if (error) throw error;
}

export async function deleteStudentParent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('student_parents').delete().eq('id', id);
  if (error) throw error;
}
