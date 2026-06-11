export type Student = {
  id: string; // Ensure student_id is strictly a string (4-5 digit numeric string)
  name: string;
  grade: string;
  wallet_balance: number; // Thai Baht, 2 decimal places
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
};

export type TransactionType = 'tuition_payment' | 'shop_sale' | 'wallet_topup' | 'wallet_deduct';

export type BaseTransaction = {
  id: string;
  student_id: string | null; // strictly string or null for walk-in
  amount: number; // Thai Baht, 2 decimal places
  transaction_type: TransactionType;
  created_at: string; // ISO 8601
};

export type TuitionPayment = BaseTransaction & {
  transaction_type: 'tuition_payment';
  fee_item_id: string;
};

export type WalletTopup = BaseTransaction & {
  transaction_type: 'wallet_topup';
  method: 'cash' | 'transfer';
};

export type WalletDeduct = BaseTransaction & {
  transaction_type: 'wallet_deduct';
  reason: string;
};

export type FeeItem = {
  id: string;
  student_id: string; // strictly string (4-5 digit numeric string)
  semester: string;
  description: string;
  amount_due: number; // Thai Baht, 2 decimal places
  amount_paid: number; // Thai Baht, 2 decimal places
  due_date: string; // ISO 8601
  created_at: string; // ISO 8601
};

export type Product = {
  id: string;
  name: string;
  price: number;          // Thai Baht, 2 decimal places
  category: string | null;
  stock_qty: number;
  barcode: string | null;
  is_active: boolean;
  created_at: string;     // ISO 8601
  updated_at: string;     // ISO 8601
};

export type CartItem = {
  product: Product;
  quantity: number;
  subtotal: number;       // Thai Baht — product.price * quantity
};

export type ShopTransaction = {
  id: string;
  student_id: string | null;   // 4–5 digit numeric string, null for walk-in
  items: CartItem[];           // jsonb snapshot
  total_amount: number;        // Thai Baht
  payment_method: 'cash' | 'wallet';
  cashier_note: string | null;
  created_at: string;
};

export type Transaction = TuitionPayment | ShopTransaction | WalletTopup | WalletDeduct;

export type AuditLog = {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  performed_by: string;
  details: Record<string, unknown>;
  created_at: string; // ISO 8601
};

export type GoogleBackupPayload = {
  transaction_id: string;
  timestamp: string; // ISO 8601
  student_id: string | null; // strictly string (4-5 digit numeric string)
  transaction_type: TransactionType;
  amount: number; // Thai Baht, 2 decimal places
  description: string;
  receipt_url?: string;
};
