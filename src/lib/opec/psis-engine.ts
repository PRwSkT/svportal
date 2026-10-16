/**
 * OPEC PSIS Subsidy Suite Engine
 * Handles statutory subsidy calculations for Somkidvittaya School (1121100013)
 * Compliant with Private Education Commission (สช.) and Cabinet Resolutions (มติ ครม.).
 */

import { Student } from '@/types';
import { screenLunchSubsidy, evaluateWeightForHeight, calculateBMI } from '../pastoral/nutrition';
import ExcelJS from 'exceljs';

export interface SubsidyRates {
  // Before Primary (Kindergarten อ.1 - อ.3)
  kindergarten: {
    salaryAndOperationPerYear: number; // 8,485 THB/year
    lunchPerDay: number; // 27 THB/day (for schools <= 100 students) or 24 THB/day
    uniformPerYear: number; // 325 THB/year
    stationeryPerYear: number; // 290 THB/year
    activitiesPerYear: number; // 430 THB/year
  };
  // Primary (ป.1 - ป.6)
  primary: {
    salaryAndOperationPerYear: number; // 8,610 THB/year
    lunchPerDay: number; // 27 THB/day (targeted)
    uniformPerYear: number; // 360 THB/year
    stationeryPerYear: number; // 440 THB/year
    activitiesPerYear: number; // 480 THB/year
  };
}

export const OFFICIAL_SUBSIDY_RATES: SubsidyRates = {
  kindergarten: {
    salaryAndOperationPerYear: 8485,
    lunchPerDay: 27,
    uniformPerYear: 325,
    stationeryPerYear: 290,
    activitiesPerYear: 430,
  },
  primary: {
    salaryAndOperationPerYear: 8610,
    lunchPerDay: 27,
    uniformPerYear: 360,
    stationeryPerYear: 440,
    activitiesPerYear: 480,
  },
};

export interface On1ReportSummary {
  academicYear: string;
  schoolId: string;
  schoolName: string;
  censusDate: string; // e.g. "10 มิถุนายน 2568"
  // Kindergarten summary
  kindergartenCount: number;
  kindergartenGrant: number;
  kindergartenLunchGrant: number;
  kindergartenFree15YrGrant: number;
  // Primary summary
  primaryCount: number;
  primaryGrant: number;
  primaryLunchCount: number;
  primaryLunchGrant: number;
  primaryFree15YrGrant: number;
  // Totals
  totalStudents: number;
  totalGrant: number;
}

export interface LunchSubsidyStudentRow {
  studentId: string;
  citizenId: string;
  name: string;
  grade: string;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  nutritionStatus: string;
  householdAnnualIncome: number | null;
  qualifyingReason: string;
  subsidyAmount: number; // 27 THB x 200 days = 5,400 THB
}

/**
 * Categorizes grade level into 'kindergarten' or 'primary'
 */
export function getEducationLevel(grade: string | null | undefined): 'kindergarten' | 'primary' | 'other' {
  const g = String(grade || '').trim();
  if (g.startsWith('อ.') || g.includes('อนุบาล')) {
    return 'kindergarten';
  }
  if (g.startsWith('ป.') || g.includes('ประถม')) {
    return 'primary';
  }
  return 'other';
}

/**
 * Calculates Official Form อน.1 (คำขอรับเงินอุดหนุนรายบุคคล ประจำปีการศึกษา)
 */
export function calculateOn1Summary(
  students: any[],
  academicYear: string = '2568',
  censusDate: string = '10 มิถุนายน'
): On1ReportSummary {
  let kindergartenCount = 0;
  let primaryCount = 0;
  let primaryLunchCount = 0;

  students.forEach(student => {
    // Only count active enrolled students
    const status = student.status || 'กำลังศึกษาอยู่';
    if (status !== 'กำลังศึกษาอยู่' && status !== 'นักเรียนเข้าใหม่') return;

    const level = getEducationLevel(student.grade);
    if (level === 'kindergarten') {
      kindergartenCount++;
    } else if (level === 'primary') {
      primaryCount++;
      const lunchCheck = screenLunchSubsidy(student);
      if (lunchCheck.isEligible) {
        primaryLunchCount++;
      }
    }
  });

  const rates = OFFICIAL_SUBSIDY_RATES;
  const SCHOOL_DAYS_PER_YEAR = 200;

  // Kindergarten Calculations (All kindergarteners receive lunch in Thailand standard policy)
  const kindergartenGrant = kindergartenCount * rates.kindergarten.salaryAndOperationPerYear;
  const kindergartenLunchGrant = kindergartenCount * rates.kindergarten.lunchPerDay * SCHOOL_DAYS_PER_YEAR;
  const kindergartenFree15YrGrant = kindergartenCount * (rates.kindergarten.uniformPerYear + rates.kindergarten.stationeryPerYear + rates.kindergarten.activitiesPerYear);

  // Primary Calculations
  const primaryGrant = primaryCount * rates.primary.salaryAndOperationPerYear;
  const primaryLunchGrant = primaryLunchCount * rates.primary.lunchPerDay * SCHOOL_DAYS_PER_YEAR;
  const primaryFree15YrGrant = primaryCount * (rates.primary.uniformPerYear + rates.primary.stationeryPerYear + rates.primary.activitiesPerYear);

  const totalStudents = kindergartenCount + primaryCount;
  const totalGrant = kindergartenGrant + kindergartenLunchGrant + kindergartenFree15YrGrant + primaryGrant + primaryLunchGrant + primaryFree15YrGrant;

  return {
    academicYear,
    schoolId: '1121100013',
    schoolName: 'โรงเรียนสมคิดวิทยา',
    censusDate: `${censusDate} ${academicYear}`,
    kindergartenCount,
    kindergartenGrant,
    kindergartenLunchGrant,
    kindergartenFree15YrGrant,
    primaryCount,
    primaryGrant,
    primaryLunchCount,
    primaryLunchGrant,
    primaryFree15YrGrant,
    totalStudents,
    totalGrant,
  };
}

/**
 * Extracts and filters students qualified for lunch subsidy.
 */
export function getLunchSubsidyList(students: any[]): LunchSubsidyStudentRow[] {
  const list: LunchSubsidyStudentRow[] = [];
  const SCHOOL_DAYS = 200;
  const DAILY_RATE = 27;
  const ANNUAL_SUBSIDY = DAILY_RATE * SCHOOL_DAYS; // 5,400 THB

  students.forEach(s => {
    const status = s.status || 'กำลังศึกษาอยู่';
    if (status !== 'กำลังศึกษาอยู่' && status !== 'นักเรียนเข้าใหม่') return;

    const level = getEducationLevel(s.grade);
    const height = s.height ? Number(s.height) : null;
    const weight = s.weight ? Number(s.weight) : null;
    const bmiObj = calculateBMI(weight, height);
    const wfh = evaluateWeightForHeight(s.gender, height, weight);

    const screening = screenLunchSubsidy(s);

    // Kindergarten students are automatically eligible, primary students must meet criteria
    if (level === 'kindergarten' || screening.isEligible) {
      // Annual income
      let annualIncome: number | null = null;
      const parents = Array.isArray(s.student_parents)
        ? s.student_parents
        : (s.student_parents ? [s.student_parents] : []);
      let totalSalary = 0;
      let hasSalary = false;
      parents.forEach((p: any) => {
        if (p.salary) {
          const val = parseFloat(String(p.salary).replace(/[^0-9.]/g, ''));
          if (!isNaN(val) && val > 0) {
            totalSalary += val;
            hasSalary = true;
          }
        }
      });
      if (hasSalary) annualIncome = totalSalary * 12;

      list.push({
        studentId: String(s.id || '').trim(),
        citizenId: String(s.citizen_id || '').trim(),
        name: s.name || `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim(),
        grade: s.grade || '',
        height,
        weight,
        bmi: bmiObj.bmi,
        nutritionStatus: wfh.status,
        householdAnnualIncome: annualIncome,
        qualifyingReason: level === 'kindergarten' 
          ? 'นักเรียนระดับก่อนประถมศึกษา (ได้รับเงินอาหารกลางวันทุกคน)' 
          : screening.reason,
        subsidyAmount: ANNUAL_SUBSIDY,
      });
    }
  });

  return list;
}

/**
 * Generates an Excel workbook for the Lunch Subsidy List (PSIS format).
 */
export async function generateLunchSubsidyWorkbook(students: any[]): Promise<ExcelJS.Workbook> {
  const rows = getLunchSubsidyList(students);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SVPortal - โรงเรียนสมคิดวิทยา (1121100013)';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('บัญชีคัดกรองเงินอาหารกลางวัน', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'ลำดับ', key: 'no', width: 8 },
    { header: 'เลขประจำตัวนักเรียน', key: 'studentId', width: 16 },
    { header: 'เลขประจำตัวประชาชน', key: 'citizenId', width: 20 },
    { header: 'ชื่อ - นามสกุล', key: 'name', width: 26 },
    { header: 'ชั้นเรียน', key: 'grade', width: 12 },
    { header: 'ส่วนสูง (ซม.)', key: 'height', width: 14 },
    { header: 'น้ำหนัก (กก.)', key: 'weight', width: 14 },
    { header: 'BMI', key: 'bmi', width: 12 },
    { header: 'ภาวะโภชนาการ (กรมอนามัย)', key: 'nutritionStatus', width: 22 },
    { header: 'รายได้ครอบครัว (บ./ปี)', key: 'income', width: 18 },
    { header: 'เกณฑ์ที่ได้รับสิทธิ์', key: 'reason', width: 40 },
    { header: 'ยอดเงินอุดหนุน (บาท)', key: 'amount', width: 18 },
  ];

  // Header style (Emerald / Green for nutrition)
  const header = sheet.getRow(1);
  header.height = 28;
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } }; // Emerald 700
    cell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  rows.forEach((r, idx) => {
    const row = sheet.addRow({
      no: idx + 1,
      studentId: r.studentId,
      citizenId: r.citizenId,
      name: r.name,
      grade: r.grade,
      height: r.height ?? '-',
      weight: r.weight ?? '-',
      bmi: r.bmi ?? '-',
      nutritionStatus: r.nutritionStatus,
      income: r.householdAnnualIncome ? r.householdAnnualIncome.toLocaleString() : 'ไม่ระบุ',
      reason: r.qualifyingReason,
      amount: r.subsidyAmount.toLocaleString(),
    });
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Sarabun', size: 10 };
      cell.alignment = { vertical: 'middle' };
      if (colNumber === 2 || colNumber === 3) {
        cell.numFmt = '@'; // Force text for IDs
      }
    });
  });

  return workbook;
}

/**
 * Generates an Excel workbook for Form อน.1 (Official OPEC Template).
 */
export async function generateOn1Workbook(students: any[], academicYear: string = '2568'): Promise<ExcelJS.Workbook> {
  const summary = calculateOn1Summary(students, academicYear);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SVPortal - โรงเรียนสมคิดวิทยา (1121100013)';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`แบบ อน.1 ปีการศึกษา ${academicYear}`);

  sheet.columns = [
    { header: 'รายการ', key: 'item', width: 45 },
    { header: 'จำนวนนักเรียน (คน)', key: 'count', width: 22 },
    { header: 'อัตราเงินอุดหนุน (บาท/คน)', key: 'rate', width: 24 },
    { header: 'ยอดเงินรวม (บาท)', key: 'total', width: 25 },
  ];

  const header = sheet.getRow(1);
  header.height = 28;
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // OPEC Navy
    cell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const rowsData = [
    { item: '1. ระดับก่อนประถมศึกษา (อนุบาล 1 - 3)', count: '', rate: '', total: '' },
    { item: '  1.1 เงินอุดหนุนรายหัว (สมทบเงินเดือนครูและค่าใช้จ่ายดำเนินงาน)', count: summary.kindergartenCount, rate: '8,485.00', total: summary.kindergartenGrant.toLocaleString() },
    { item: '  1.2 เงินอุดหนุนอาหารกลางวัน (27 บ./วัน x 200 วัน)', count: summary.kindergartenCount, rate: '5,400.00', total: summary.kindergartenLunchGrant.toLocaleString() },
    { item: '  1.3 เงินอุดหนุนเรียนฟรี 15 ปี (เครื่องแบบ, อุปกรณ์, กิจกรรม)', count: summary.kindergartenCount, rate: '1,045.00', total: summary.kindergartenFree15YrGrant.toLocaleString() },
    { item: '2. ระดับประถมศึกษา (ประถม 1 - 6)', count: '', rate: '', total: '' },
    { item: '  2.1 เงินอุดหนุนรายหัว (สมทบเงินเดือนครูและค่าใช้จ่ายดำเนินงาน)', count: summary.primaryCount, rate: '8,610.00', total: summary.primaryGrant.toLocaleString() },
    { item: '  2.2 เงินอุดหนุนอาหารกลางวัน (คัดกรองทุพโภชนาการ/ขาดแคลน)', count: summary.primaryLunchCount, rate: '5,400.00', total: summary.primaryLunchGrant.toLocaleString() },
    { item: '  2.3 เงินอุดหนุนเรียนฟรี 15 ปี (เครื่องแบบ, อุปกรณ์, กิจกรรม)', count: summary.primaryCount, rate: '1,280.00', total: summary.primaryFree15YrGrant.toLocaleString() },
    { item: 'ยอดรวมงบประมาณเงินอุดหนุนที่ขอรับจัดสรรทั้งสิ้น', count: summary.totalStudents, rate: '-', total: summary.totalGrant.toLocaleString() },
  ];

  rowsData.forEach(r => {
    const row = sheet.addRow(r);
    row.height = 24;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Sarabun', size: 10 };
      if (r.item.startsWith('1.') || r.item.startsWith('2.') || r.item.startsWith('ยอดรวม')) {
        cell.font = { name: 'Sarabun', size: 10, bold: true };
      }
      if (colNumber >= 2) {
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  return workbook;
}
