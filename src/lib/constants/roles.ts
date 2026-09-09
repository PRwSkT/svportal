export interface RoleConfig {
  key: string;
  labelEn: string;
  labelTh: string;
  fullLabel: string;
  badgeClass: string;
}

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  admin: {
    key: 'admin',
    labelEn: 'Admin',
    labelTh: 'ผู้ดูแลระบบ',
    fullLabel: 'Admin (ผู้ดูแลระบบ)',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
  },
  executive: {
    key: 'executive',
    labelEn: 'Executive',
    labelTh: 'ผู้บริหาร',
    fullLabel: 'Executive (ผู้บริหาร)',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
  },
  teacher: {
    key: 'teacher',
    labelEn: 'Teacher',
    labelTh: 'ครูผู้สอน',
    fullLabel: 'Teacher (ครูผู้สอน)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  },
  'academic staff': {
    key: 'academic staff',
    labelEn: 'Academic Staff',
    labelTh: 'บุคลากรวิชาการ',
    fullLabel: 'Academic Staff (บุคลากรวิชาการ)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
  },
  'non-academic staff': {
    key: 'non-academic staff',
    labelEn: 'Support Staff',
    labelTh: 'บุคลากรสายสนับสนุน',
    fullLabel: 'Support Staff (บุคลากรสายสนับสนุน)',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
  },
  cashier: {
    key: 'cashier',
    labelEn: 'Cashier',
    labelTh: 'เจ้าหน้าที่การเงิน/ร้านค้า',
    fullLabel: 'Cashier (เจ้าหน้าที่การเงิน/ร้านค้า)',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
  }
};

export function getRoleConfig(role?: string | null): RoleConfig {
  if (!role) {
    return {
      key: 'staff',
      labelEn: 'Staff',
      labelTh: 'เจ้าหน้าที่',
      fullLabel: 'Staff (เจ้าหน้าที่)',
      badgeClass: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
    };
  }
  const normalized = role.trim().toLowerCase();
  return (
    ROLE_CONFIGS[normalized] || {
      key: normalized,
      labelEn: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      labelTh: 'เจ้าหน้าที่',
      fullLabel: normalized,
      badgeClass: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
    }
  );
}

export interface FeatureDefinition {
  id: string;
  name: string;
  category: string;
  href: string;
}

export const SYSTEM_FEATURES: FeatureDefinition[] = [
  { id: 'dashboard', name: 'แดชบอร์ดสรุปยอด', category: 'งานการเงิน', href: '/dashboard' },
  { id: 'pos_fees', name: 'ชำระค่าเทอม', category: 'งานการเงิน', href: '/pos/fees' },
  { id: 'admin_reports', name: 'รายงานการเงิน', category: 'งานการเงิน', href: '/admin/reports' },
  { id: 'pos_shop', name: 'POS ขายสินค้า', category: 'งานร้านค้าสหกรณ์', href: '/pos/shop' },
  { id: 'admin_products', name: 'จัดการสินค้า', category: 'งานร้านค้าสหกรณ์', href: '/admin/products' },
  { id: 'pos_wallet_topup', name: 'เติมเงิน Wallet', category: 'งานร้านค้าสหกรณ์', href: '/pos/wallet/topup' },
  { id: 'admin_wallet_students', name: 'Wallet นักเรียน', category: 'งานร้านค้าสหกรณ์', href: '/admin/wallet/students' },
  { id: 'admin_students', name: 'ข้อมูลนักเรียน', category: 'งานทะเบียน', href: '/admin/students' },
  { id: 'admin_users', name: 'จัดการผู้ใช้งาน', category: 'งาน HR', href: '/admin/users' },
  { id: 'admin_attendance', name: 'ข้อมูลการเข้างาน', category: 'งาน HR', href: '/admin/attendance' },
  { id: 'admin_website', name: 'จัดการเว็บไซต์', category: 'งานประชาสัมพันธ์ (PR)', href: '/admin/website' },
  { id: 'post_assistant', name: 'Post Assistance', category: 'งานประชาสัมพันธ์ (PR)', href: '/post-assistant.html' },
  { id: 'audio_remote', name: 'Audio Remote', category: 'งานประชาสัมพันธ์ (PR)', href: '/audio-remote.html' },
  { id: 'qr_generator', name: 'สร้าง QR Code', category: 'งานประชาสัมพันธ์ (PR)', href: '/qr-generator' },
  { id: 'settings', name: 'การตั้งค่า', category: 'งานบริหารทั่วไป', href: '#' },
  { id: 'academic_todo', name: 'รอการพัฒนา', category: 'งานวิชาการ', href: '#' }
];

export function getFeatureName(featureId: string): string {
  const f = SYSTEM_FEATURES.find(item => item.id === featureId);
  return f ? f.name : featureId;
}
