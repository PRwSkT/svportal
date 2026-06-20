import { createClient } from './client';
import { DailySummary } from '@/types';

export async function getDailySummary(dateStr: string): Promise<DailySummary> {
  // dateStr format: YYYY-MM-DD
  const supabase = createClient();
  
  // Use timezone-aware bounds (assuming UTC internally, but simple date bounds for now)
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;
  
  // 1. Get tuition payments
  const { data: tuitionData } = await supabase
    .from('tuition_payments')
    .select('total_amount')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);
    
  const tuitionAmount = (tuitionData || []).reduce((sum: number, row: any) => sum + row.total_amount, 0);
  const tuitionCount = (tuitionData || []).length;

  // 2. Get shop transactions
  const { data: shopData } = await supabase
    .from('shop_transactions')
    .select('total_amount')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);
    
  const shopAmount = (shopData || []).reduce((sum: number, row: any) => sum + row.total_amount, 0);
  const shopCount = (shopData || []).length;

  // 3. Get wallet topups
  const { data: topupData } = await supabase
    .from('wallet_transactions')
    .select('amount')
    .eq('type', 'topup')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);
    
  const topupAmount = (topupData || []).reduce((sum: number, row: any) => sum + row.amount, 0);
  const topupCount = (topupData || []).length;

  return {
    date: dateStr,
    total_received: tuitionAmount + shopAmount + topupAmount,
    tuition_count: tuitionCount,
    tuition_amount: tuitionAmount,
    shop_count: shopCount,
    shop_amount: shopAmount,
    topup_count: topupCount,
    topup_amount: topupAmount
  };
}

export async function getAuditLogs(limit: number = 100): Promise<any[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
  return data;
}
