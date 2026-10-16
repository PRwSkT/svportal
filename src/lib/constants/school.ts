/**
 * School Identity & Academic Constants for โรงเรียนสมคิดวิทยา (Somkid Wittaya School)
 * Centralizes school metadata, academic year configuration, and date-based term calculations.
 */

export const SCHOOL_INFO = {
  nameTh: 'โรงเรียนสมคิดวิทยา',
  nameEn: 'Somkid Wittaya School',
  shortNameTh: 'สมคิดวิทยา',
  shortNameEn: 'SV',
  schoolCode: '10100001',
  opecCode: '10100001',
  affiliation: 'สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช.)',
  province: 'กรุงเทพมหานคร',
  licenseNo: 'กท. 123/2545',
  taxId: '0994000164891',
  phone: '02-123-4567',
  email: 'info@somkidwittaya.ac.th',
  brandColor: '#7B1C3E',
  brandColorHover: '#681834',
  brandColorLight: '#7B1C3E15',
} as const;

/**
 * Default fallback academic year and term
 */
export const DEFAULT_ACADEMIC_YEAR = '2568';
export const DEFAULT_TERM = '2';

/**
 * Standard list of selectable academic years (Buddhist Era)
 */
export const AVAILABLE_ACADEMIC_YEARS = ['2566', '2567', '2568', '2569', '2570'] as const;
export type AcademicYear = typeof AVAILABLE_ACADEMIC_YEARS[number];

/**
 * Standard terms (Semesters)
 */
export const AVAILABLE_TERMS = [
  { value: '1', labelTh: 'ภาคเรียนที่ 1', labelEn: 'Semester 1' },
  { value: '2', labelTh: 'ภาคเรียนที่ 2', labelEn: 'Semester 2' },
] as const;

/**
 * Computes current Thai Buddhist academic year dynamically based on date.
 * In Thai educational system:
 * - May to December: Current Gregorian Year + 543
 * - January to April: Still belongs to previous academic year (Current Gregorian Year + 542)
 */
export function getCurrentAcademicYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1 - 12
  const buddhistYear = month >= 5 ? year + 543 : year + 542;
  return buddhistYear.toString();
}

/**
 * Computes current term/semester dynamically:
 * - May (5) to October (10): Semester 1
 * - November (11) to April (4): Semester 2
 */
export function getCurrentTerm(date: Date = new Date()): '1' | '2' {
  const month = date.getMonth() + 1;
  return month >= 5 && month <= 10 ? '1' : '2';
}

/**
 * Standard grade levels offered at Somkid Wittaya School
 */
export const GRADE_LEVELS = [
  { code: 'K1', nameTh: 'อนุบาล 1', nameEn: 'Kindergarten 1', department: 'kindergarten' },
  { code: 'K2', nameTh: 'อนุบาล 2', nameEn: 'Kindergarten 2', department: 'kindergarten' },
  { code: 'K3', nameTh: 'อนุบาล 3', nameEn: 'Kindergarten 3', department: 'kindergarten' },
  { code: 'P1', nameTh: 'ประถมศึกษาปีที่ 1', nameEn: 'Primary 1 (Grade 1)', department: 'primary' },
  { code: 'P2', nameTh: 'ประถมศึกษาปีที่ 2', nameEn: 'Primary 2 (Grade 2)', department: 'primary' },
  { code: 'P3', nameTh: 'ประถมศึกษาปีที่ 3', nameEn: 'Primary 3 (Grade 3)', department: 'primary' },
  { code: 'P4', nameTh: 'ประถมศึกษาปีที่ 4', nameEn: 'Primary 4 (Grade 4)', department: 'primary' },
  { code: 'P5', nameTh: 'ประถมศึกษาปีที่ 5', nameEn: 'Primary 5 (Grade 5)', department: 'primary' },
  { code: 'P6', nameTh: 'ประถมศึกษาปีที่ 6', nameEn: 'Primary 6 (Grade 6)', department: 'primary' },
] as const;
