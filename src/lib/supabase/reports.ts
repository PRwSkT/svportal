import { createClient } from './client';
import { DailySummary } from '@/types';

export async function getDailySummary(dateStr: string): Promise<DailySummary> {
  // dateStr format: YYYY-MM-DD
  const supabase = createClient();
  
  // Use Bangkok timezone-aware bounds (GMT+7)
  const startOfDay = `${dateStr}T00:00:00.000+07:00`;
  const endOfDay = `${dateStr}T23:59:59.999+07:00`;
  
  // 1. Get tuition payments
  const { data: tuitionData } = await supabase
    .from('tuition_payments')
    .select('total_amount')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);
    
  const tuitionAmount = (tuitionData || []).reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0);
  const tuitionCount = (tuitionData || []).length;

  // 2. Get shop transactions
  const { data: shopData } = await supabase
    .from('shop_transactions')
    .select('total_amount, payment_method')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);
    
  const shopAmount = (shopData || []).reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0);
  const shopCashAmount = (shopData || [])
    .filter((row: any) => row.payment_method === 'cash')
    .reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0);
  const shopCount = (shopData || []).length;

  // 3. Get wallet topups
  const { data: topupData } = await supabase
    .from('wallet_transactions')
    .select('amount')
    .eq('type', 'topup')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);
    
  const topupAmount = (topupData || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  const topupCount = (topupData || []).length;

  return {
    date: dateStr,
    total_received: tuitionAmount + shopCashAmount + topupAmount,
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
