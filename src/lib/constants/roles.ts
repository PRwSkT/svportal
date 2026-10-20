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
  },
  nurse: {
    key: 'nurse',
    labelEn: 'School Nurse',
    labelTh: 'ครูพยาบาล',
    fullLabel: 'School Nurse (ครูพยาบาล)',
    badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
  },
  driver: {
    key: 'driver',
    labelEn: 'Transport & Safety',
    labelTh: 'เจ้าหน้าที่รถรับ-ส่ง/ความปลอดภัย',
    fullLabel: 'Transport & Safety (รถรับ-ส่ง/ความปลอดภัย)',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800'
  },
  dpo: {
    key: 'dpo',
    labelEn: 'Data Protection Officer',
    labelTh: 'เจ้าหน้าที่คุ้มครองข้อมูล (DPO)',
    fullLabel: 'DPO (เจ้าหน้าที่คุ้มครองข้อมูล)',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800'
  },
  parent: {
    key: 'parent',
    labelEn: 'Parent / Guardian',
    labelTh: 'ผู้ปกครอง',
    fullLabel: 'Parent / Guardian (ผู้ปกครอง)',
    badgeClass: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800'
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
  // งานการเงินและงบประมาณ
  { id: 'dashboard', name: 'แดชบอร์ดสรุปยอด', category: 'งานการเงิน', href: '/dashboard' },
  { id: 'pos_fees', name: 'ชำระค่าเทอม', category: 'งานการเงิน', href: '/pos/fees' },
  { id: 'admin_reports', name: 'รายงานการเงิน', category: 'งานการเงิน', href: '/admin/reports' },
  { id: 'subsidy_free15y', name: 'เงินอุดหนุนเรียนฟรี 15 ปี (อร.1/1)', category: 'งานการเงิน', href: '/admin/subsidy/free15y' },
  // งานร้านค้าสหกรณ์
  { id: 'pos_shop', name: 'POS ขายสินค้า', category: 'งานร้านค้าสหกรณ์', href: '/pos/shop' },
  { id: 'admin_products', name: 'จัดการสินค้า', category: 'งานร้านค้าสหกรณ์', href: '/admin/products' },
  { id: 'pos_wallet_topup', name: 'เติมเงิน Wallet', category: 'งานร้านค้าสหกรณ์', href: '/pos/wallet/topup' },
  { id: 'admin_wallet_students', name: 'Wallet นักเรียน', category: 'งานร้านค้าสหกรณ์', href: '/admin/wallet/students' },
  // งานทะเบียนและดูแลนักเรียน
  { id: 'admin_students', name: 'ข้อมูลนักเรียน & ครอบครัว', category: 'งานทะเบียน & ดูแลนักเรียน', href: '/admin/students' },
  { id: 'student_attendance', name: 'เช็กชื่อนักเรียน & อนุมัติใบลา', category: 'งานทะเบียน & ดูแลนักเรียน', href: '/admin/students/attendance' },
  { id: 'pickup_dismissal', name: 'จุดรับ-ส่งเด็ก & ตรวจสอบผู้มารับ (Pickup)', category: 'งานทะเบียน & ดูแลนักเรียน', href: '/admin/safety/pickup' },
  { id: 'pastoral_care', name: 'ดูแลช่วยเหลือนักเรียน 360° (SDQ & เยี่ยมบ้าน)', category: 'งานทะเบียน & ดูแลนักเรียน', href: '/admin/students/pastoral' },
  { id: 'student_nutrition', name: 'โภชนาการ & บัญชีนมโรงเรียน', category: 'งานทะเบียน & ดูแลนักเรียน', href: '/admin/students/nutrition' },
  { id: 'van_safety', name: 'ความปลอดภัยรถรับ-ส่งนักเรียน', category: 'งานทะเบียน & ดูแลนักเรียน', href: '/admin/safety/van' },
  { id: 'school_infirmary', name: 'ห้องพยาบาล & เฝ้าระวังโรคระบาด', category: 'งานทะเบียน & ดูแลนักเรียน', href: '/admin/health/infirmary' },
  // งานวิชาการและงานวัดผล
  { id: 'academic_hub', name: 'ศูนย์รวมวิชาการ & ตรวจทาน', category: 'งานวิชาการ', href: '/academic' },
  { id: 'academic_gradebook', name: 'Smart Gradebook (ปพ.5)', category: 'งานวิชาการ', href: '/academic/gradebook' },
  { id: 'academic_assignments', name: 'สั่งการบ้าน & ติดตามงานค้าง', category: 'งานวิชาการ', href: '/academic/assignments' },
  { id: 'academic_early_years', name: 'ปฐมวัย (กิจวัตรรายวัน & พัฒนาการ)', category: 'งานวิชาการ', href: '/academic/early-years' },
  { id: 'academic_exams', name: 'คลังข้อสอบ & ตรวจ OMR', category: 'งานวิชาการ', href: '/academic/exams' },
  { id: 'academic_timetable', name: 'ตารางสอน & จัดสอนแทน', category: 'งานวิชาการ', href: '/academic/timetable' },
  { id: 'academic_documents', name: 'เอกสารราชการ (ปพ.1/2/3/6)', category: 'งานวิชาการ', href: '/academic/documents' },
  { id: 'academic_opec', name: 'ส่งออก REGIS (สช.)', category: 'งานวิชาการ', href: '/academic/opec' },
  { id: 'admin_academic', name: 'ตั้งค่าหลักสูตร & ห้องเรียน', category: 'งานวิชาการ', href: '/admin/academic' },
  { id: 'calendar', name: 'ปฏิทินปฏิบัติงาน & เวรครู', category: 'งานวิชาการ', href: '/calendar' },
  // งาน HR และประกันคุณภาพ
  { id: 'admin_users', name: 'จัดการผู้ใช้งาน', category: 'งาน HR & ธรรมาภิบาล', href: '/admin/users' },
  { id: 'admin_attendance', name: 'ข้อมูลการเข้างาน', category: 'งาน HR & ธรรมาภิบาล', href: '/admin/attendance' },
  { id: 'admin_kpi', name: 'ประเมินผลการปฏิบัติงาน (KPI)', category: 'งาน HR & ธรรมาภิบาล', href: '/admin/kpi' },
  { id: 'esar_governance', name: 'รายงานประเมินตนเอง e-SAR & ธรรมาภิบาล', category: 'งาน HR & ธรรมาภิบาล', href: '/admin/governance' },
  // งานประชาสัมพันธ์และผู้ปกครองสัมพันธ์ (PR & Parents Portal)
  { id: 'parent_communications', name: 'ศูนย์สื่อสารผู้ปกครอง & แชทครู', category: 'งานประชาสัมพันธ์ (PR)', href: '/admin/communications' },
  { id: 'parents_portal_preview', name: 'ระบบผู้ปกครอง (Parents Portal PWA)', category: 'งานประชาสัมพันธ์ (PR)', href: '/parents' },
  { id: 'admin_notifications', name: 'ระบบแจ้งเตือนอัจฉริยะ AI', category: 'งานประชาสัมพันธ์ (PR)', href: '/admin/notifications' },
  { id: 'admin_website', name: 'จัดการเว็บไซต์', category: 'งานประชาสัมพันธ์ (PR)', href: '/admin/website' },
  { id: 'admin_forms', name: 'ระบบแบบฟอร์ม (SV-Forms)', category: 'งานประชาสัมพันธ์ (PR)', href: '/admin/forms' },
  { id: 'post_assistant', name: 'Social Post Assistant', category: 'งานประชาสัมพันธ์ (PR)', href: '/post-assistant' },
  { id: 'audio_remote', name: 'ระบบกระจายเสียง (Audio Remote)', category: 'งานประชาสัมพันธ์ (PR)', href: '/audio-remote' },
  { id: 'qr_generator', name: 'สร้าง QR Code', category: 'งานประชาสัมพันธ์ (PR)', href: '/qr-generator' }
];

export function getFeatureName(featureId: string): string {
  const f = SYSTEM_FEATURES.find(item => item.id === featureId);
  return f ? f.name : featureId;
}
