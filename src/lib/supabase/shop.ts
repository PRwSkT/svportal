import { createClient } from './client';
import { Product, CartItem, ShopTransaction } from '@/types';
import { saveToQueue } from '../queue/offline';

export async function searchProducts(query: string): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .limit(20);

  if (error) {
    console.error('Error searching products:', error);
    throw new Error('DB_ERROR');
  }

  return data as Product[];
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('barcode', barcode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching product by barcode:', error);
    throw new Error('DB_ERROR');
  }

  return data as Product;
}

export async function createShopTransaction(
  cart: CartItem[],
  paymentMethod: 'cash' | 'wallet',
  studentId?: string | null // 4–5 digit numeric string
): Promise<ShopTransaction> {
  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0); // Thai Baht

  const transactionId = crypto.randomUUID();

  // Wallet payments: online-only, atomic RPC — never through queue
  if (paymentMethod === 'wallet') {
    if (!studentId) throw new Error('INSUFFICIENT_WALLET');
    if (!navigator.onLine) {
      throw new Error('ระบบออฟไลน์: ไม่สามารถชำระเงินผ่าน Wallet ได้ กรุณาเชื่อมต่ออินเทอร์เน็ต');
    }

    // Atomic deduction via RPC (handles balance check + daily limit + ledger entry)
    const { deductWallet } = await import('./wallet');
    await deductWallet(studentId, totalAmount, transactionId);

    // Also save the shop transaction itself through queue
    const payload = {
      id: transactionId,
      student_id: studentId,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      cashier_note: null,
      items: cart,
    };
    saveToQueue('checkout_shop_transaction', payload, 'rpc');

    return {
      id: transactionId,
      student_id: studentId,
      total_amount: totalAmount, // Thai Baht
      payment_method: paymentMethod,
      cashier_note: null,
      items: cart,
      created_at: new Date().toISOString(),
    };
  }

  // Cash payments: continue using offline queue
  const payload = {
    id: transactionId,
    student_id: studentId || null,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    cashier_note: null,
    items: cart,
  };

  saveToQueue('checkout_shop_transaction', payload, 'rpc');

  return {
    id: transactionId,
    student_id: studentId || null,
    total_amount: totalAmount, // Thai Baht
    payment_method: paymentMethod,
    cashier_note: null,
    items: cart,
    created_at: new Date().toISOString(),
  };
}

export async function getRecentTransactions(limit: number): Promise<ShopTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shop_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent transactions:', error);
    throw new Error('DB_ERROR');
  }

  return data as ShopTransaction[];
}
