import { createClient } from './client';
import { WalletAccount, WalletTransaction, GoogleBackupPayload } from '@/types';
import { logAction } from '../audit';

// ---------------------------------------------------------------------------
// Wallet Lookups
// ---------------------------------------------------------------------------

export async function getWalletByStudentId(studentId: string): Promise<WalletAccount | null> {
  // studentId: 4–5 digit numeric string
  const supabase = createClient();
  const { data, error } = await supabase
    .from('wallet_accounts')
    .select('*')
    .eq('student_id', studentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching wallet by student_id:', error);
    throw new Error('DB_ERROR');
  }

  return data as WalletAccount;
}

export async function getWalletByCardUID(cardUID: string): Promise<WalletAccount | null> {
  const supabase = createClient();
  const normalizedUID = cardUID.toUpperCase().trim();

  const { data, error } = await supabase
    .from('wallet_accounts')
    .select('*')
    .eq('card_uid', normalizedUID)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching wallet by card_uid:', error);
    throw new Error('DB_ERROR');
  }

  return data as WalletAccount;
}

// ---------------------------------------------------------------------------
// Card Linking
// ---------------------------------------------------------------------------

export async function linkCardToStudent(studentId: string, cardUID: string): Promise<void> {
  // studentId: 4–5 digit numeric string
  const supabase = createClient();
  const normalizedUID = cardUID.toUpperCase().trim();

  const { error } = await supabase
    .from('wallet_accounts')
    .update({ card_uid: normalizedUID, updated_at: new Date().toISOString() })
    .eq('student_id', studentId);

  if (error) {
    console.error('Error linking card:', error);
    throw new Error('DB_ERROR');
  }
}

// ---------------------------------------------------------------------------
// Top-up (via RPC — atomic)
// ---------------------------------------------------------------------------

export async function topupWallet(
  studentId: string,  // 4–5 digit numeric string
  amount: number,     // Thai Baht
  channel: 'counter' | 'svportal',
  note?: string
): Promise<WalletTransaction> {
  const supabase = createClient();

  const payload = {
    student_id: studentId,
    amount,
    channel,
    cashier_note: note || null,
    svportal_ref: null,
  };

  const { data, error } = await supabase.rpc('topup_wallet', { payload });

  if (error) {
    console.error('topup_wallet RPC error:', error);
    throw new Error(error.message || 'DB_ERROR');
  }

  const result = data as { success: boolean; transaction_id: string; balance_before: number; balance_after: number };

  const transaction: WalletTransaction = {
    id: result.transaction_id,
    student_id: studentId,
    type: 'topup',
    amount,                         // Thai Baht
    balance_before: result.balance_before, // Thai Baht
    balance_after: result.balance_after,   // Thai Baht
    channel,
    reference_id: null,
    svportal_ref: null,
    cashier_note: note || null,
    created_at: new Date().toISOString(),
  };

  // Google Sheets backup — fire-and-forget
  backupWalletTransaction(transaction).catch(console.error);

  logAction({
    action: 'wallet_topup',
    tableName: 'wallet_transactions',
    recordId: result.transaction_id,
    newValue: { studentId, amount, channel, note, balance_after: result.balance_after }
  });

  return transaction;
}

// ---------------------------------------------------------------------------
// Deduct (via RPC — atomic, online-only)
// ---------------------------------------------------------------------------

export async function deductWallet(
  studentId: string,  // 4–5 digit numeric string
  amount: number,     // Thai Baht
  referenceId: string
): Promise<WalletTransaction> {
  if (!navigator.onLine) {
    throw new Error('ระบบออฟไลน์: ไม่สามารถชำระเงินผ่าน Wallet ได้ กรุณาเชื่อมต่ออินเทอร์เน็ต');
  }

  const supabase = createClient();

  const payload = {
    student_id: studentId,
    amount,
    reference_id: referenceId,
  };

  const { data, error } = await supabase.rpc('deduct_wallet_balance', { payload });

  if (error) {
    console.error('deduct_wallet_balance RPC error:', error);
    // Extract specific error messages from PostgreSQL
    const msg = error.message || '';
    if (msg.includes('INSUFFICIENT_BALANCE')) throw new Error('INSUFFICIENT_BALANCE');
    if (msg.includes('DAILY_LIMIT_EXCEEDED')) throw new Error('DAILY_LIMIT_EXCEEDED');
    if (msg.includes('WALLET_NOT_FOUND')) throw new Error('WALLET_NOT_FOUND');
    if (msg.includes('WALLET_INACTIVE')) throw new Error('WALLET_INACTIVE');
    throw new Error('DB_ERROR');
  }

  const result = data as { success: boolean; transaction_id: string; balance_before: number; balance_after: number };

  const transaction: WalletTransaction = {
    id: result.transaction_id,
    student_id: studentId,
    type: 'purchase',
    amount,                         // Thai Baht
    balance_before: result.balance_before, // Thai Baht
    balance_after: result.balance_after,   // Thai Baht
    channel: null,
    reference_id: referenceId,
    svportal_ref: null,
    cashier_note: null,
    created_at: new Date().toISOString(),
  };

  // Google Sheets backup — fire-and-forget
  backupWalletTransaction(transaction).catch(console.error);

  // Low balance notification — fire-and-forget
  notifyLowBalance(studentId, result.balance_after).catch(console.error);

  logAction({
    action: 'wallet_deduct',
    tableName: 'wallet_transactions',
    recordId: result.transaction_id,
    newValue: { studentId, amount, referenceId, balance_after: result.balance_after }
  });

  return transaction;
}

// ---------------------------------------------------------------------------
// Admin: Balance Adjustment
// ---------------------------------------------------------------------------

export async function adjustBalance(
  studentId: string,  // 4–5 digit numeric string
  amount: number,     // Thai Baht, positive = add, negative = deduct
  note: string
): Promise<WalletTransaction> {
  const supabase = createClient();

  if (amount > 0) {
    // Positive adjustment = topup
    const payload = {
      student_id: studentId,
      amount,
      channel: 'system',
      cashier_note: `[Adjustment] ${note}`,
      svportal_ref: null,
    };
    const { data, error } = await supabase.rpc('topup_wallet', { payload });
    if (error) throw new Error(error.message || 'DB_ERROR');

    const result = data as { success: boolean; transaction_id: string; balance_before: number; balance_after: number };
    return {
      id: result.transaction_id,
      student_id: studentId,
      type: 'adjustment',
      amount,                         // Thai Baht
      balance_before: result.balance_before, // Thai Baht
      balance_after: result.balance_after,   // Thai Baht
      channel: 'system',
      reference_id: null,
      svportal_ref: null,
      cashier_note: `[Adjustment] ${note}`,
      created_at: new Date().toISOString(),
    };
  } else {
    // Negative adjustment = deduct (use absolute value)
    const absAmount = Math.abs(amount);
    const payload = {
      student_id: studentId,
      amount: absAmount,
      reference_id: `adj-${Date.now()}`,
    };
    const { data, error } = await supabase.rpc('deduct_wallet_balance', { payload });
    if (error) throw new Error(error.message || 'DB_ERROR');

    const result = data as { success: boolean; transaction_id: string; balance_before: number; balance_after: number };
    return {
      id: result.transaction_id,
      student_id: studentId,
      type: 'adjustment',
      amount: absAmount,               // Thai Baht
      balance_before: result.balance_before, // Thai Baht
      balance_after: result.balance_after,   // Thai Baht
      channel: 'system',
      reference_id: null,
      svportal_ref: null,
      cashier_note: `[Adjustment] ${note}`,
      created_at: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Wallet History & Daily Spend
// ---------------------------------------------------------------------------

export async function getWalletHistory(
  studentId: string,  // 4–5 digit numeric string
  limit: number = 30
): Promise<WalletTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error('DB_ERROR');
  return (data || []) as WalletTransaction[];
}

export async function getTodaySpend(studentId: string): Promise<number> {
  // studentId: 4–5 digit numeric string
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('daily_spend_tracking')
    .select('total_spent')
    .eq('student_id', studentId)
    .eq('spend_date', today)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return 0; // No spend record today
    console.error('Error fetching today spend:', error);
    return 0;
  }

  return (data?.total_spent as number) || 0; // Thai Baht
}

export async function updateDailyLimit(
  studentId: string,  // 4–5 digit numeric string
  limit: number | null // Thai Baht, null = no limit
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('wallet_accounts')
    .update({ daily_limit: limit, updated_at: new Date().toISOString() })
    .eq('student_id', studentId);

  if (error) {
    console.error('Error updating daily limit:', error);
    throw new Error('DB_ERROR');
  }
}

// ---------------------------------------------------------------------------
// Get all wallet accounts (admin list)
// ---------------------------------------------------------------------------

export async function getAllWalletAccounts(): Promise<(WalletAccount & { student_name?: string; student_grade?: string })[]> {
  const supabase = createClient();

  // Fetch wallet accounts
  const { data: wallets, error: walletErr } = await supabase
    .from('wallet_accounts')
    .select('*')
    .order('student_id', { ascending: true });

  if (walletErr) throw new Error('DB_ERROR');
  if (!wallets) return [];

  // Fetch student names
  const studentIds = wallets.map(w => w.student_id);
  const { data: students } = await supabase
    .from('students')
    .select('id, name, grade')
    .in('id', studentIds);

  const studentMap = new Map((students || []).map(s => [s.id, s]));

  return wallets.map(w => ({
    ...(w as WalletAccount),
    student_name: studentMap.get(w.student_id)?.name,
    student_grade: studentMap.get(w.student_id)?.grade,
  }));
}

// ---------------------------------------------------------------------------
// Stubs (future implementation)
// ---------------------------------------------------------------------------

/**
 * TODO: Called by SVPortal webhook when parent completes online payment
 * Will create a 'topup' wallet_transaction with channel='svportal'
 */
export async function processSVPortalTopup(
  studentId: string,  // 4–5 digit numeric string
  amount: number,     // Thai Baht
  svportalRef: string
): Promise<void> {
  console.warn(`processSVPortalTopup: SVPortal webhook not yet configured (student: ${studentId}, amount: ${amount}, ref: ${svportalRef})`);
  // Future: call topup_wallet RPC with channel='svportal' and svportal_ref
}

/**
 * TODO: Send LINE/SMS notification to parent via SVPortal
 * when wallet balance drops below threshold
 */
async function notifyLowBalance(
  studentId: string,  // 4–5 digit numeric string
  balance: number     // Thai Baht
): Promise<void> {
  if (balance < 50) { // Thai Baht
    console.warn(`LOW_BALANCE: student ${studentId} has ${balance} THB remaining`);
    // Future: call SVPortal notification API
  }
}

// ---------------------------------------------------------------------------
// Google Sheets Backup Helper
// ---------------------------------------------------------------------------

async function backupWalletTransaction(tx: WalletTransaction): Promise<void> {
  try {
    // Call the API route to handle backup (since appendTransactionRow uses server-only googleapis)
    const payload: GoogleBackupPayload = {
      transaction_id: tx.id,
      timestamp: tx.created_at,
      student_id: tx.student_id, // 4–5 digit numeric string
      transaction_type: tx.type === 'topup' ? 'wallet_topup' : 'wallet_purchase',
      amount: tx.amount, // Thai Baht
      description: tx.type === 'topup'
        ? `Wallet Top-up (${tx.channel || 'counter'}): +${tx.amount} THB`
        : `Wallet Purchase: -${tx.amount} THB (ref: ${tx.reference_id || 'N/A'})`,
    };

    await fetch('/api/wallet/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Wallet backup failed (non-blocking):', err);
  }
}
