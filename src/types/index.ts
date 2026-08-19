export type Student = {
  id: string; // student code
  name: string; // Full name (legacy support)
  grade: string; // Class level (legacy support)
  citizen_id?: string | null;
  prefix?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  nationality?: string | null;
  religion?: string | null;
  height?: number | null;
  weight?: number | null;
  disability?: string | null;
  enrolled_date?: string | null;
  wallet_balance: number; // Thai Baht
  status: string; // 'กำลังศึกษาอยู่' etc.
  created_at: string;
  updated_at: string;
  // Relational joins
  student_addresses?: StudentAddress[];
  student_parents?: StudentParent[];
};

export type StudentAddress = {
  id: string;
  student_id: string;
  house_code?: string | null;
  house_number?: string | null;
  moo?: string | null;
  soi?: string | null;
  road?: string | null;
  sub_district?: string | null;
  district?: string | null;
  province?: string | null;
  zip_code?: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentParent = {
  id: string;
  student_id: string;
  relationship: string;
  citizen_id?: string | null;
  prefix?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  occupation?: string | null;
  salary?: string | null;
  phone_number?: string | null;
  status?: string | null;
  created_at: string;
  updated_at: string;
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

export type AppUser = {
  id: string;
  full_name: string;
  role: 'cashier' | 'admin';
  is_active: boolean;
  created_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

export type DailySummary = {
  date: string;              // ISO 8601 date
  total_received: number;    // Thai Baht
  tuition_count: number;
  tuition_amount: number;    // Thai Baht
  shop_count: number;
  shop_amount: number;       // Thai Baht
  topup_count: number;
  topup_amount: number;      // Thai Baht
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

// ==========================================
// Website Content Management Tables
// ==========================================

export type Personnel = {
  id: string;
  name_th: string;
  name_en: string;
  position_th: string;
  position_en: string;
  category: string; // 'executive', 'teacher', 'staff'
  image_url: string;
  bio_th: string | null;
  bio_en: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type News = {
  id: string;
  title_th: string;
  title_en: string;
  content_th: string;
  content_en: string;
  cover_image_url: string | null;
  album_id: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Album = {
  id: string;
  title_th: string;
  title_en: string;
  description_th: string | null;
  description_en: string | null;
  cover_image_url: string | null;
  event_date: string;
  created_at: string;
  updated_at: string;
};

export type AlbumPhoto = {
  id: string;
  album_id: string;
  image_url: string;
  caption_th: string | null;
  caption_en: string | null;
  sort_order: number;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  title_th: string;
  title_en: string;
  start_date: string;
  end_date: string | null;
  is_holiday: boolean;
  category: string; // 'academic', 'holiday', 'activity'
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  title_th: string;
  title_en: string;
  file_url: string;
  category: string; // 'form', 'policy', etc.
  file_type: string; // 'pdf', 'docx', etc.
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
};
