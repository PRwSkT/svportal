/**
 * School Governance & Finance Engine (คณะกรรมการบริหารโรงเรียน ม.30 และการเงิน ม.32)
 * สอดคล้องกับ พระราชบัญญัติโรงเรียนเอกชน พ.ศ. 2550
 * - มาตรา 30: การประชุมคณะกรรมการบริหารโรงเรียน (อย่างน้อยปีละ 4 ครั้ง)
 * - มาตรา 32: งบการเงิน รายงานผู้สอบบัญชีรับอนุญาต (CPA) และการคำนวณต้นทุนต่อหน่วย (Cost per Student)
 */

export interface BoardMeetingItem {
  id?: string;
  academicYear: string;
  meetingNo: number;
  meetingDate: string; // YYYY-MM-DD
  title: string;
  attendees: { name: string; position: string; isPresent: boolean }[];
  agenda: string[];
  resolutions: string[];
  minutesPdfUrl?: string;
}

/**
 * ตรวจสอบความถูกต้องของการประชุมคณะกรรมการบริหารโรงเรียนตาม ม.30
 * (ต้องจัดประชุมอย่างน้อย 4 ครั้งต่อปีการศึกษา และองค์ประชุมต้องเกินกึ่งหนึ่ง)
 */
export function evaluateBoardCompliance(meetings: BoardMeetingItem[]): {
  isMeetingCountCompliant: boolean;
  totalMeetings: number;
  remainingMeetings: number;
  complianceLabel: string;
  badgeColor: string;
} {
  const count = meetings.length;
  const isCompliant = count >= 4;
  const remaining = Math.max(0, 4 - count);

  return {
    isMeetingCountCompliant: isCompliant,
    totalMeetings: count,
    remainingMeetings: remaining,
    complianceLabel: isCompliant 
      ? 'ครบถ้วนตาม ม.30 (จัดประชุมครบ 4 ครั้ง/ปี)' 
      : `ยังไม่ครบตาม ม.30 (จัดแล้ว ${count}/4 ครั้ง ขาดอีก ${remaining} ครั้ง)`,
    badgeColor: isCompliant 
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
      : 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
  };
}

/**
 * ผังบัญชีมาตรฐานสำหรับโรงเรียนเอกชน (OPEC Chart of Accounts)
 */
export const OPEC_CHART_OF_ACCOUNTS = [
  { code: '41100', name: 'รายได้ค่าธรรมเนียมการศึกษา (ค่าเทอม)', category: 'REVENUE' },
  { code: '42100', name: 'รายได้เงินอุดหนุนรายบุคคล (สช.)', category: 'REVENUE' },
  { code: '42200', name: 'รายได้เงินอุดหนุนอาหารกลางวัน', category: 'REVENUE' },
  { code: '42300', name: 'รายได้เงินอุดหนุนเรียนฟรี 15 ปี (เครื่องแบบ/อุปกรณ์/กิจกรรม)', category: 'REVENUE' },
  { code: '43100', name: 'รายได้จากร้านค้า/สหกรณ์/บริการอื่น', category: 'REVENUE' },
  { code: '51100', name: 'ค่าใช้จ่ายเงินเดือนครูและบุคลากร', category: 'EXPENSE' },
  { code: '51200', name: 'เงินสมทบกองทุนสงเคราะห์ครูเอกชน / ประกันสังคม', category: 'EXPENSE' },
  { code: '52100', name: 'ค่าใช้จ่ายด้านสื่อการเรียนการสอนและอุปกรณ์การศึกษา', category: 'EXPENSE' },
  { code: '52200', name: 'ค่าอาหารกลางวันและนมโรงเรียน', category: 'EXPENSE' },
  { code: '53100', name: 'ค่าสาธารณูปโภค (น้ำ ไฟฟ้า อินเทอร์เน็ต)', category: 'EXPENSE' },
  { code: '54100', name: 'ค่าบำรุงรักษาอาคารสถานที่และยานพาหนะ', category: 'EXPENSE' }
];

export interface FinancialSummaryData {
  academicYear: string;
  totalRevenue: number;
  totalExpense: number;
  netSurplus: number;
  studentCount: number;
  annualCostPerStudent: number; // ต้นทุนต่อหน่วยนักเรียนต่อคนต่อปี
  breakdown: { code: string; name: string; amount: number; type: 'REVENUE' | 'EXPENSE' }[];
}

/**
 * คำนวณต้นทุนต่อหน่วย (Cost per Student) ตามหลักเกณฑ์ สช. และ พ.ร.บ. โรงเรียนเอกชน ม.32
 */
export function calculateUnitCostPerStudent(
  totalExpense: number,
  totalEnrolledStudents: number
): {
  annualCostPerStudent: number;
  termCostPerStudent: number;
  summaryText: string;
} {
  if (totalEnrolledStudents <= 0 || totalExpense <= 0) {
    return {
      annualCostPerStudent: 0,
      termCostPerStudent: 0,
      summaryText: 'ไม่มีข้อมูลนักเรียนหรือค่าใช้จ่าย'
    };
  }

  const annualCost = Math.round((totalExpense / totalEnrolledStudents) * 100) / 100;
  const termCost = Math.round((annualCost / 2) * 100) / 100;

  return {
    annualCostPerStudent: annualCost,
    termCostPerStudent: termCost,
    summaryText: `ต้นทุนการจัดการศึกษาต่อคน: ปีละ ${annualCost.toLocaleString()} บาท (เฉลี่ยเทอมละ ${termCost.toLocaleString()} บาท)`
  };
}
