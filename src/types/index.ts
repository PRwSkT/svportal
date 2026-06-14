export type Student = {
  id: string; // Ensure student_id is strictly a string (4-5 digit numeric string)
  name: string;
  grade: string;
  wallet_balance: number; // Thai Baht, 2 decimal places
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
};

export type TransactionType = 'tuition_payment' | 'shop_sale' | 'wallet_topup' | 'wallet_deduct' | 'wallet_purchase';

export type BaseTransaction = {
  id: string;
  student_id: string | null; // strictly string or null for walk-in
  amount: number; // Thai Baht, 2 decimal places
  transaction_type: TransactionType;
  created_at: string; // ISO 8601
};

export type TuitionPayment = {
  id: string;
  student_id: string;      // 4–5 digit numeric string
  fee_item_ids: string[];
  total_amount: number;    // Thai Baht
  payment_method: 'cash' | 'qr' | 'transfer';
  receipt_number: string;  // e.g. "REC-2568-00001"
  slip_url: string | null;
  cashier_note: string | null;
  svportal_sync_at: string | null;
  created_at: string;
};

export type WalletTopup = BaseTransaction & {
  transaction_type: 'wallet_topup';
  method: 'cash' | 'transfer';
};

export type WalletDeduct = BaseTransaction & {
  transaction_type: 'wallet_deduct';
  reason: string;
};

export type FeeType = {
  id: string;
  name: string;
  amount: number;          // Thai Baht
  academic_year: string;   // e.g. "2568"
  semester: string | null;
  due_date: string | null; // ISO 8601 date
  is_active: boolean;
  created_at: string;
};

export type FeeItem = {
  id: string;
  student_id: string;      // strictly string (4-5 digit numeric string)
  fee_type_id: string;
  fee_type?: FeeType;      // joined
  amount: number;          // Thai Baht
  status: 'unpaid' | 'paid' | 'waived';
  svportal_ref: string | null;
  created_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601
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

export type WalletAccount = {
  id: string;
  student_id: string;           // 4–5 digit numeric string
  balance: number;              // Thai Baht, 2 decimal places, never negative
  daily_limit: number | null;   // Thai Baht, null = no limit
  card_uid: string | null;      // NFC UID hex string, e.g. "A3F2C1B0"
  is_active: boolean;
  created_at: string;           // ISO 8601
  updated_at: string;           // ISO 8601
};

export type WalletTransaction = {
  id: string;
  student_id: string;           // 4–5 digit numeric string
  type: 'topup' | 'purchase' | 'refund' | 'adjustment';
  amount: number;               // Thai Baht, always positive
  balance_before: number;       // Thai Baht, snapshot
  balance_after: number;        // Thai Baht, snapshot
  channel: 'counter' | 'svportal' | 'system' | null;
  reference_id: string | null;
  svportal_ref: string | null;
  cashier_note: string | null;
  created_at: string;           // ISO 8601
};

export type DailySpendTracking = {
  id: string;
  student_id: string;           // 4–5 digit numeric string
  spend_date: string;           // ISO 8601 date
  total_spent: number;          // Thai Baht
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
