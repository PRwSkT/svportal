import { createClient } from './client';
import { Student } from '@/types';

export async function getStudents(
  searchQuery?: string,
  statusFilter?: string,
  gradeFilter?: string
): Promise<Student[]> {
  const supabase = createClient();
  let query = supabase.from('students').select('*').order('id', { ascending: true });

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
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as Student | null;
}

export async function createStudent(
  student: Omit<Student, 'wallet_balance' | 'created_at' | 'updated_at'>
): Promise<Student> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('students')
    .insert([{
      id: student.id,
      name: student.name,
      grade: student.grade,
      status: student.status,
      profile_data: student.profile_data
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Student;
}

export async function updateStudent(
  id: string,
  updates: Partial<Pick<Student, 'name' | 'grade' | 'status' | 'profile_data'>>
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
  // Attempt delete (will fail if there are foreign key constraints like transactions)
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function importStudentsFromCSV(
  fileData: { id: string; name: string; grade: string; status?: string; profile_data?: Record<string, any> }[]
): Promise<{ success: number; failed: number; errors: any[] }> {
  const supabase = createClient();
  let success = 0;
  let failed = 0;
  const errors = [];

  // For safety and detailed error tracking, we'll process them one by one or in batches
  // Here we use one-by-one for clear error messages per student
  for (const item of fileData) {
    const { error } = await supabase
      .from('students')
      .upsert([{
        id: item.id,
        name: item.name,
        grade: item.grade,
        status: item.status || 'active',
        profile_data: item.profile_data || {}
        // we don't update wallet_balance on upsert so it doesn't reset
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
