/**
 * Teacher License Guard Engine (ระบบเฝ้าระวังใบอนุญาตประกอบวิชาชีพครู คุรุสภา)
 * สอดคล้องกับ พ.ร.บ. สภาครูและผู้ประกอบวิชาชีพทางการศึกษา และ พ.ร.บ. โรงเรียนเอกชน พ.ศ. 2550
 * ป้องกันความเสี่ยงจากการถูก สช. ตัดเงินอุดหนุนรายบุคคลและเงินสมทบเงินเดือนครู 100%
 */

export interface TeacherLicenseRecord {
  id?: string;
  teacherName: string;
  teacherUserId?: string;
  citizenId: string;
  licenseType: 'TEACHER' | 'SCHOOL_ADMIN' | 'SPECIAL_PERMISSION';
  licenseNumber: string;
  issueDate: string; // YYYY-MM-DD
  expireDate: string; // YYYY-MM-DD
  cpdHours: number; // ชั่วโมงการพัฒนาวิชาชีพ (CPD)
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
  kspDocumentUrl?: string;
  notes?: string;
}

export type LicenseAlertTier = 'ACTIVE' | 'EXPIRING_180D' | 'EXPIRING_90D' | 'EXPIRING_30D' | 'EXPIRED';

export interface LicenseStatusEvaluation {
  daysLeft: number;
  alertTier: LicenseAlertTier;
  statusLabel: string;
  badgeColor: string;
  actionRequired: string;
  cpdCompliant: boolean;
  cpdShortfall: number;
}

/**
 * คำนวณวันหมดอายุและประเมินระดับความเสี่ยงของใบอนุญาตคุรุสภา
 */
export function evaluateLicenseStatus(expireDateStr: string, cpdHours: number = 0): LicenseStatusEvaluation {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expireDate = new Date(expireDateStr);
  expireDate.setHours(0, 0, 0, 0);

  const diffTime = expireDate.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Minimum recommended CPD training hours for KSP renewal = 20 hours
  const REQUIRED_CPD_HOURS = 20;
  const cpdCompliant = cpdHours >= REQUIRED_CPD_HOURS;
  const cpdShortfall = Math.max(0, REQUIRED_CPD_HOURS - cpdHours);

  if (daysLeft < 0) {
    return {
      daysLeft,
      alertTier: 'EXPIRED',
      statusLabel: `หมดอายุแล้ว (${Math.abs(daysLeft)} วันที่แล้ว)`,
      badgeColor: 'bg-rose-600 text-white font-black',
      actionRequired: '🚨 วิกฤต! สช. จะตัดเงินสมทบเงินเดือนทันที ให้ครูหยุดปฏิบัติการสอนในวิชาการหลักและยื่นหนังสือขออนุญาตผ่อนผันคุรุสภาด่วนที่สุด!',
      cpdCompliant,
      cpdShortfall
    };
  }

  if (daysLeft <= 30) {
    return {
      daysLeft,
      alertTier: 'EXPIRING_30D',
      statusLabel: `ด่วนมาก เหลือ ${daysLeft} วัน`,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold animate-pulse',
      actionRequired: '⚠️ เหลือเวลาไม่ถึง 30 วัน ให้เข้ายื่นคำขอต่ออายุในระบบ KSP e-Service ทันที แนบชั่วโมง CPD และเอกสารรับรองการสอน',
      cpdCompliant,
      cpdShortfall
    };
  }

  if (daysLeft <= 90) {
    return {
      daysLeft,
      alertTier: 'EXPIRING_90D',
      statusLabel: `เหลือ ${daysLeft} วัน (เตือน 90 วัน)`,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      actionRequired: 'เตรียมเอกสารพัฒนาตนเอง (CPD) และยื่นคำขอต่ออายุผ่านระบบ KSP e-Service ล่วงหน้า',
      cpdCompliant,
      cpdShortfall
    };
  }

  if (daysLeft <= 180) {
    return {
      daysLeft,
      alertTier: 'EXPIRING_180D',
      statusLabel: `เหลือ ${daysLeft} วัน (ยื่นล่วงหน้าได้)`,
      badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-200 font-semibold',
      actionRequired: 'คุรุสภาเปิดให้ยื่นต่ออายุล่วงหน้าได้แล้ว (180 วันก่อนหมดอายุ) แนะนำให้เริ่มจัดเตรียมผลงาน',
      cpdCompliant,
      cpdShortfall
    };
  }

  return {
    daysLeft,
    alertTier: 'ACTIVE',
    statusLabel: `ปกติ (เหลือ ${daysLeft} วัน)`,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
    actionRequired: 'ใบอนุญาตมีสถานะปกติ สะสมชั่วโมงการพัฒนาวิชาชีพ (CPD) อย่างต่อเนื่อง',
    cpdCompliant,
    cpdShortfall
  };
}

export const KSP_ESERVICE_URL = 'https://ksp-eservice.ksp.or.th';
