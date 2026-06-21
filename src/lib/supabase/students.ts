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
    .order('id', { ascending: true });

  if (searchQuery) {
    query = query.or(`id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
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
  fileData: { id: string; name: string; grade: string; status?: string; }[]
): Promise<{ success: number; failed: number; errors: any[] }> {
  const supabase = createClient();
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const item of fileData) {
    const { error } = await supabase
      .from('students')
      .upsert([{
        id: item.id,
        name: item.name,
        grade: item.grade,
        status: item.status || 'กำลังศึกษาอยู่'
      }], { onConflict: 'id', ignoreDuplicates: false });

    if (error) {
      failed++;
      errors.push({ id: item.id, message: error.message });
    } else {
      success++;
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
