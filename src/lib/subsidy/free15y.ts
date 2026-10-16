/**
 * 15-Year Free Education Subsidy Engine (โครงการเรียนฟรี 15 ปี อย่างมีคุณภาพ)
 * แบบ อร.1/1: หลักฐานการจ่ายเงินค่าเครื่องแบบนักเรียนและอุปกรณ์การเรียน
 * สอดคล้องกับระเบียบกระทรวงศึกษาธิการ และสำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช.)
 */

export interface Free15yRates {
  grade: string;
  uniformYearly: number; // ค่าเครื่องแบบ (จ่ายปีละ 1 ครั้ง เทอม 1)
  stationeryPerTerm: number; // ค่าอุปกรณ์การเรียน (จ่ายเทอมละ 1 ครั้ง)
  booksYearlyApprox: number; // ค่าหนังสือเรียน (โรงเรียนจัดสรร)
  activitiesPerTerm: number; // ค่ากิจกรรมพัฒนาคุณภาพผู้เรียน
}

/**
 * ตารางอัตราเงินอุดหนุนโครงการเรียนฟรี 15 ปี ตามประกาศ สช. / ศธ.
 */
export const FREE_15Y_RATES: Record<string, Free15yRates> = {
  'อ.1': { grade: 'อ.1', uniformYearly: 325, stationeryPerTerm: 145, booksYearlyApprox: 216, activitiesPerTerm: 236 },
  'อ.2': { grade: 'อ.2', uniformYearly: 325, stationeryPerTerm: 145, booksYearlyApprox: 216, activitiesPerTerm: 236 },
  'อ.3': { grade: 'อ.3', uniformYearly: 325, stationeryPerTerm: 145, booksYearlyApprox: 216, activitiesPerTerm: 236 },
  'ป.1': { grade: 'ป.1', uniformYearly: 400, stationeryPerTerm: 220, booksYearlyApprox: 618, activitiesPerTerm: 260 },
  'ป.2': { grade: 'ป.2', uniformYearly: 400, stationeryPerTerm: 220, booksYearlyApprox: 619, activitiesPerTerm: 260 },
  'ป.3': { grade: 'ป.3', uniformYearly: 400, stationeryPerTerm: 220, booksYearlyApprox: 622, activitiesPerTerm: 260 },
  'ป.4': { grade: 'ป.4', uniformYearly: 400, stationeryPerTerm: 220, booksYearlyApprox: 673, activitiesPerTerm: 260 },
  'ป.5': { grade: 'ป.5', uniformYearly: 400, stationeryPerTerm: 220, booksYearlyApprox: 794, activitiesPerTerm: 260 },
  'ป.6': { grade: 'ป.6', uniformYearly: 400, stationeryPerTerm: 220, booksYearlyApprox: 818, activitiesPerTerm: 260 }
};

/**
 * คำนวณยอดเงินที่ต้องจ่ายสดให้ผู้ปกครอง (แบบ อร.1/1)
 * ในเทอม 1: จ่ายค่าเครื่องแบบ (ทั้งปี) + ค่าอุปกรณ์ (เทอม 1)
 * ในเทอม 2: จ่ายเฉพาะค่าอุปกรณ์ (เทอม 2)
 */
export function calculateDisbursementAmount(gradeStr: string, term: string = '1'): {
  uniformAmount: number;
  stationeryAmount: number;
  totalCashDisbursement: number;
  rateInfo: Free15yRates;
} {
  const normalizedGrade = Object.keys(FREE_15Y_RATES).find(g => gradeStr.includes(g)) || 'ป.1';
  const rateInfo = FREE_15Y_RATES[normalizedGrade];

  // Uniform is paid in Term 1 once a year
  const uniformAmount = term === '1' ? rateInfo.uniformYearly : 0;
  const stationeryAmount = rateInfo.stationeryPerTerm;
  const totalCashDisbursement = uniformAmount + stationeryAmount;

  return {
    uniformAmount,
    stationeryAmount,
    totalCashDisbursement,
    rateInfo
  };
}

export interface DisbursementRecord {
  id?: string;
  studentId: string;
  studentName: string;
  grade: string;
  classroom?: string;
  academicYear: string;
  term: string;
  uniformAmount: number;
  stationeryAmount: number;
  totalAmount: number;
  recipientName: string;
  recipientRelation: string;
  recipientCitizenId?: string;
  signatureData: string; // Base64 Data URL
  disbursedAt?: string;
  disbursedBy?: string;
  formOr11Number?: string;
}

/**
 * แปลงจำนวนเงินเป็นภาษาไทย (BahtText) สำหรับเอกสารการเงินทางการของราชการ/สช.
 */
export function formatThaiBahtText(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'ศูนย์บาทถ้วน';

  const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

  const [intPart, decPart] = Math.abs(amount).toFixed(2).split('.');
  const intNum = parseInt(intPart, 10);
  let result = '';

  const convertSixDigits = (str: string): string => {
    const clean = str.replace(/^0+/, '');
    if (!clean) return '';
    let s = '';
    const digits = clean.split('').map(Number);
    const len = digits.length;
    for (let i = 0; i < len; i++) {
      const d = digits[i];
      const pos = len - 1 - i;
      if (d !== 0) {
        if (pos === 0 && d === 1 && len > 1) {
          s += 'เอ็ด';
        } else if (pos === 1 && d === 1) {
          s += 'สิบ';
        } else if (pos === 1 && d === 2) {
          s += 'ยี่สิบ';
        } else {
          s += numbers[d] + units[pos];
        }
      }
    }
    return s;
  };

  const convertLargeInt = (str: string): string => {
    const clean = str.replace(/^0+/, '');
    if (!clean) return '';
    if (clean.length <= 6) return convertSixDigits(clean);
    const head = clean.slice(0, clean.length - 6);
    const tail = clean.slice(clean.length - 6);
    return convertLargeInt(head) + 'ล้าน' + convertSixDigits(tail);
  };

  if (intNum === 0) {
    result = 'ศูนย์บาท';
  } else {
    result = convertLargeInt(intPart) + 'บาท';
  }

  const decNum = parseInt(decPart, 10);
  if (decNum === 0) {
    result += 'ถ้วน';
  } else {
    result += convertSixDigits(decPart) + 'สตางค์';
  }

  return (amount < 0 ? 'ลบ' : '') + result;
}
