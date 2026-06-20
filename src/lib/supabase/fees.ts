import { createClient } from './client';
import { FeeType, FeeItem, Student } from '@/types';
import { logAction } from '../audit';

export type StudentWithFees = Student & {
  unpaid_fees: FeeItem[];
};

export async function searchStudentsWithFees(query: string): Promise<StudentWithFees[]> {
  const supabase = createClient();
  
  // Exact match on ID or ilike on name
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('*')
    .or(`id.eq.${query},name.ilike.%${query}%`)
    .limit(10);

  if (studentError) throw studentError;
  if (!students || students.length === 0) return [];

  const studentIds = students.map((s: Student) => s.id);
  const { data: feeItems, error: feeError } = await supabase
    .from('fee_items')
    .select(`
      *,
      fee_type:fee_types(*)
    `)
    .in('student_id', studentIds)
    .eq('status', 'unpaid');

  if (feeError) throw feeError;

  return students.map((student: Student) => ({
    ...student,
    unpaid_fees: feeItems ? feeItems.filter(f => f.student_id === student.id) as FeeItem[] : []
  }));
}

export async function getUnpaidFees(studentId: string): Promise<FeeItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fee_items')
    .select('*, fee_type:fee_types(*)')
    .eq('student_id', studentId)
    .eq('status', 'unpaid');
    
  if (error) throw error;
  return data as FeeItem[];
}

export async function createTuitionPayment(
  studentId: string,
  feeItemIds: string[],
  paymentMethod: 'cash' | 'qr' | 'transfer',
  totalAmount: number,
  academicYear: string
): Promise<{ payment_id: string, receipt_number: string }> {
  const supabase = createClient();
  
  const payload = {
    student_id: studentId,
    fee_item_ids: feeItemIds,
    payment_method: paymentMethod,
    total_amount: totalAmount,
    academic_year: academicYear
  };

  const { data, error } = await supabase.rpc('process_tuition_payment', { payload });
  if (error) throw error;

  const result = data as { payment_id: string, receipt_number: string };

  logAction({
    action: 'pay_tuition',
    tableName: 'tuition_payments',
    recordId: result.payment_id,
    newValue: { studentId, feeItemIds, paymentMethod, totalAmount, academicYear }
  });

  return result;
}

export async function importFeeItemsFromCSV(rows: {student_id: string, fee_type_id: string, amount: number}[]): Promise<{ inserted: number, skipped: number }> {
  const supabase = createClient();
  
  // Fetch existing pairs to skip duplicates
  const { data: existing, error: fetchErr } = await supabase
    .from('fee_items')
    .select('student_id, fee_type_id');
    
  if (fetchErr) throw fetchErr;
    
  const existingSet = new Set(existing?.map(e => `${e.student_id}_${e.fee_type_id}`));
  
  const toInsert = rows.filter(r => !existingSet.has(`${r.student_id}_${r.fee_type_id}`));
  
  // Batch insert in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { error } = await supabase.from('fee_items').insert(chunk);
    if (error) throw error;
  }
  
  return {
    inserted: toInsert.length,
    skipped: rows.length - toInsert.length
  };
}

export async function getFeeTypes(): Promise<FeeType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fee_types')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data as FeeType[];
}

/**
 * TODO: Implement when SVPortal API is available
 * Will POST payment confirmation to SVPortal and update svportal_sync_at
 */
export async function syncPaymentToSVPortal(paymentId: string): Promise<void> {
  console.warn(`syncPaymentToSVPortal: SVPortal API not yet configured (payment_id: ${paymentId})`);
  // Future implementation here
}
