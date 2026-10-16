/**
 * OPEC REGIS Data Validator & Pre-Flight Audit Engine
 * Specially engineered for Somkidvittaya School (รหัสสถานศึกษา: 1121100013)
 * Compliant with Office of the Private Education Commission (OPEC / สช.) REGIS Specifications.
 */

import { Student, StudentAddress, StudentParent } from '@/types';

export interface OpecIssue {
  field: string;
  fieldLabel: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface StudentAuditResult {
  studentId: string;
  studentName: string;
  grade: string;
  citizenId: string;
  isForeign: boolean;
  canExport: boolean; // false if has any critical errors
  errors: OpecIssue[];
  warnings: OpecIssue[];
}

export interface OpecBatchAuditSummary {
  total: number;
  thaiCount: number;
  foreignCount: number;
  readyCount: number; // 0 errors
  warningCount: number; // has warnings but 0 errors
  errorCount: number; // has at least 1 error
  gradeBreakdown: Record<string, { total: number; ready: number; error: number; warning: number }>;
  studentResults: StudentAuditResult[];
  criticalIssuesList: { studentId: string; studentName: string; grade: string; issues: OpecIssue[] }[];
}

/**
 * Validates a Thai National Citizen ID (13 digits) using standard Modulo 11 algorithm.
 * Formula: sum(d_i * (14 - i)) for i in 1..12
 * remainder = sum % 11
 * check_digit = (11 - remainder) % 10
 * check_digit must equal d_13
 */
export function validateThaiCitizenId(id: string | null | undefined): { isValid: boolean; cleanedId: string; reason?: string } {
  if (!id) {
    return { isValid: false, cleanedId: '', reason: 'ไม่มีเลขประจำตัวประชาชน' };
  }

  // Convert Thai digits if any, strip whitespace and non-digits
  const thaiNumerals = '๐๑๒๓๔๕๖๗๘๙';
  let cleaned = id.toString().replace(/[๐-๙]/g, d => thaiNumerals.indexOf(d).toString()).replace(/\D/g, '');

  if (cleaned.length !== 13) {
    return { isValid: false, cleanedId: cleaned, reason: `ความยาวไม่ครบ 13 หลัก (ปัจจุบันมี ${cleaned.length} หลัก)` };
  }

  // Reject repeating digits like 0000000000000, 1111111111111
  if (/^(\d)\1{12}$/.test(cleaned)) {
    return { isValid: false, cleanedId: cleaned, reason: 'เลขประจำตัวประชาชนเป็นตัวเลขซ้ำกันทั้งหมด' };
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (13 - i);
  }

  const remainder = sum % 11;
  const checkDigit = (11 - remainder) % 10;
  const lastDigit = parseInt(cleaned.charAt(12), 10);

  if (checkDigit !== lastDigit) {
    return { 
      isValid: false, 
      cleanedId: cleaned, 
      reason: `ผลรวมตรวจสอบ (Checksum Modulo 11) ไม่ถูกต้อง (คาดหวัง ${checkDigit} แต่พบ ${lastDigit})` 
    };
  }

  return { isValid: true, cleanedId: cleaned };
}

/**
 * Maps Thai month names/abbreviations to 2-digit month strings (01-12)
 */
const THAI_MONTH_MAP: Record<string, string> = {
  'ม.ค.': '01', 'มกราคม': '01', 'มค': '01', 'jan': '01', 'january': '01',
  'ก.พ.': '02', 'กุมภาพันธ์': '02', 'กพ': '02', 'feb': '02', 'february': '02',
  'มี.ค.': '03', 'มีนาคม': '03', 'มีค': '03', 'mar': '03', 'march': '03',
  'เม.ย.': '04', 'เมษายน': '04', 'เมย': '04', 'apr': '04', 'april': '04',
  'พ.ค.': '05', 'พฤษภาคม': '05', 'พค': '05', 'may': '05',
  'มิ.ย.': '06', 'มิถุนายน': '06', 'มิย': '06', 'jun': '06', 'june': '06',
  'ก.ค.': '07', 'กรกฎาคม': '07', 'กค': '07', 'jul': '07', 'july': '07',
  'ส.ค.': '08', 'สิงหาคม': '08', 'สค': '08', 'aug': '08', 'august': '08',
  'ก.ย.': '09', 'กันยายน': '09', 'กย': '09', 'sep': '09', 'september': '09',
  'ต.ค.': '10', 'ตุลาคม': '10', 'ตค': '10', 'oct': '10', 'october': '10',
  'พ.ย.': '11', 'พฤศจิกายน': '11', 'พย': '11', 'nov': '11', 'november': '11',
  'ธ.ค.': '12', 'ธันวาคม': '12', 'ธค': '12', 'dec': '12', 'december': '12',
};

export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Formats any date input into a readable Thai Buddhist Era date string: e.g. "17 ตุลาคม พ.ศ. 2565"
 */
export function formatThaiDate(dateInput: string | Date | null | undefined, includeYearPrefix: boolean = true): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const day = d.getDate();
  const month = THAI_MONTH_NAMES[d.getMonth()] || '';
  const year = d.getFullYear() > 2400 ? d.getFullYear() : d.getFullYear() + 543;

  return includeYearPrefix ? `${day} ${month} พ.ศ. ${year}` : `${day} ${month} ${year}`;
}

/**
 * Formats any date into the strict OPEC REGIS 8-digit Buddhist Era format: ปปปปดดวว (YYYYMMDD BE).
 * Examples:
 * - '2023-02-27' -> '25660227'
 * - '17 ต.ค. 2565' -> '25651017'
 * - '17/10/2565' -> '25651017'
 * - '25651017' -> '25651017'
 */
export function parseDateToOpecBe8(dateVal: any): { formatted: string; isValid: boolean; raw: string; error?: string } {
  if (!dateVal) {
    return { formatted: '', isValid: false, raw: '', error: 'ไม่มีข้อมูลวันที่' };
  }

  const raw = String(dateVal).trim();
  if (!raw) {
    return { formatted: '', isValid: false, raw: '', error: 'ไม่มีข้อมูลวันที่' };
  }

  // Normalize Thai digits
  const thaiNumerals = '๐๑๒๓๔๕๖๗๘๙';
  const cleanRaw = raw.replace(/[๐-๙]/g, d => thaiNumerals.indexOf(d).toString()).trim();

  // 1. If already 8 contiguous digits: '25651017' or '20221017'
  if (/^\d{8}$/.test(cleanRaw)) {
    let year = parseInt(cleanRaw.substring(0, 4), 10);
    const month = parseInt(cleanRaw.substring(4, 6), 10);
    const day = parseInt(cleanRaw.substring(6, 8), 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (year < 2400) year += 543; // Convert CE to BE if needed
      return {
        formatted: `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
        isValid: true,
        raw
      };
    }
  }

  // 2. ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = cleanRaw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (year < 2400) year += 543; // Convert CE to BE
      return {
        formatted: `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
        isValid: true,
        raw
      };
    }
  }

  // 3. Thai text format: e.g. "17 ต.ค. 2565", "5 ส.ค. 2565", "14 พฤษภาคม 2569", "07 พ.ค. 2569 10:18 น."
  // First strip any trailing time like "10:18 น."
  const dateOnlyStr = cleanRaw.replace(/\s+\d{1,2}:\d{2}(\s*น\.)?.*$/, '').trim();
  // Match: Day (1-2 digits), Month (Thai characters + dots), Year (2-4 digits)
  const thaiTextMatch = dateOnlyStr.match(/^(\d{1,2})\s+([ก-๙.]+)\s+(\d{2,4})/);
  if (thaiTextMatch) {
    const day = parseInt(thaiTextMatch[1], 10);
    const monthRaw = thaiTextMatch[2].trim();
    let year = parseInt(thaiTextMatch[3].trim(), 10);

    // Look up month
    let monthNum = THAI_MONTH_MAP[monthRaw];
    if (!monthNum) {
      // Try normalized without dots
      const monthNoDots = monthRaw.replace(/\./g, '');
      monthNum = THAI_MONTH_MAP[monthNoDots];
    }
    if (!monthNum) {
      // Try searching for partial match in keys
      for (const [key, val] of Object.entries(THAI_MONTH_MAP)) {
        if (monthRaw.startsWith(key) || key.startsWith(monthRaw)) {
          monthNum = val;
          break;
        }
      }
    }

    if (monthNum && day >= 1 && day <= 31) {
      if (year < 100) {
        year += 2500; // e.g. 65 -> 2565
      } else if (year < 2400) {
        year += 543; // CE -> BE
      }
      return {
        formatted: `${year}${monthNum}${String(day).padStart(2, '0')}`,
        isValid: true,
        raw
      };
    }
  }

  // 4. Slash/Dash Thai format: DD/MM/YYYY e.g. "17/10/2565"
  const slashMatch = cleanRaw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (year < 100) year += 2500;
      else if (year < 2400) year += 543;
      return {
        formatted: `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
        isValid: true,
        raw
      };
    }
  }

  // 5. Native Javascript Date fallback
  const parsedDate = new Date(cleanRaw);
  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear() + 543;
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return {
      formatted: `${year}${month}${day}`,
      isValid: true,
      raw
    };
  }

  return { formatted: '', isValid: false, raw, error: `ไม่สามารถแปลงรูปแบบวันที่ได้: "${raw}"` };
}

/**
 * Maps gender string to OPEC standard code: '1' for Male, '2' for Female
 */
export function mapGenderToOpec(genderVal: any): { code: '1' | '2'; label: 'ชาย' | 'หญิง' } {
  const g = String(genderVal || '').trim().toLowerCase();
  if (g === '1' || g === 'ชาย' || g === 'เด็กชาย' || g === 'นาย' || g === 'male' || g === 'm') {
    return { code: '1', label: 'ชาย' };
  }
  return { code: '2', label: 'หญิง' };
}

/**
 * Checks if a student is Foreign / G-Code candidate:
 * - Citizen ID starts with 'G' or 'g'
 * - Citizen ID is non-Thai or length != 13 and not valid Thai ID
 * - Nationality is explicitly non-Thai
 */
export function isForeignOrGCode(student: any): boolean {
  const cid = String(student.citizen_id || '').trim().toUpperCase();
  if (cid.startsWith('G')) return true;

  const nat = String(student.nationality || '').trim().toLowerCase();
  if (nat && nat !== 'ไทย' && nat !== 'thai' && nat !== '099' && nat !== 'th') {
    return true;
  }

  // If no citizen_id or invalid citizen_id that is not 13 digits
  if (cid.length > 0 && cid.length !== 13) {
    return true;
  }

  return false;
}

/**
 * Audits a single student record against all OPEC REGIS requirements.
 */
export function auditStudentForOpec(student: any): StudentAuditResult {
  const errors: OpecIssue[] = [];
  const warnings: OpecIssue[] = [];

  const studentId = student.id ? String(student.id).trim() : '';
  const studentName = student.name ? String(student.name).trim() : `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
  const grade = student.grade ? String(student.grade).trim() : '';
  const citizenId = student.citizen_id ? String(student.citizen_id).trim() : '';

  const isForeign = isForeignOrGCode(student);

  // 1. Student ID Check
  if (!studentId) {
    errors.push({
      field: 'id',
      fieldLabel: 'เลขประจำตัวนักเรียน',
      message: 'ไม่มีเลขประจำตัวนักเรียน',
      severity: 'error'
    });
  }

  // 2. Name Check
  if (!studentName && !student.first_name) {
    errors.push({
      field: 'name',
      fieldLabel: 'ชื่อ-นามสกุล',
      message: 'ไม่มีชื่อ-นามสกุลนักเรียน',
      severity: 'error'
    });
  }

  // 3. Grade / Classroom Check
  if (!grade) {
    errors.push({
      field: 'grade',
      fieldLabel: 'ชั้นเรียน / ห้องเรียน',
      message: 'ไม่มีการระบุระดับชั้นเรียน (เช่น อ.1/1 หรือ ป.1/1)',
      severity: 'error'
    });
  }

  // 4. Citizen ID / G-Code Check
  if (isForeign) {
    if (!citizenId) {
      warnings.push({
        field: 'citizen_id',
        fieldLabel: 'รหัส G-CODE / หนังสือเดินทาง',
        message: 'นักเรียนต่างชาติยังไม่มีรหัส G-Code (ระบบ สช. จะสร้างให้อัตโนมัติ)',
        severity: 'warning'
      });
    }
  } else {
    // Thai Student: Citizen ID is strictly required and must pass Modulo 11
    if (!citizenId) {
      errors.push({
        field: 'citizen_id',
        fieldLabel: 'เลขประจำตัวประชาชน',
        message: 'ไม่มีเลขประจำตัวประชาชน 13 หลักสำหรับนักเรียนไทย',
        severity: 'error'
      });
    } else {
      const idCheck = validateThaiCitizenId(citizenId);
      if (!idCheck.isValid) {
        errors.push({
          field: 'citizen_id',
          fieldLabel: 'เลขประจำตัวประชาชน',
          message: idCheck.reason || 'เลขประจำตัวประชาชนไม่ถูกต้องตามเกณฑ์ Modulo 11',
          severity: 'error'
        });
      }
    }
  }

  // 5. Birth Date Check (Strict 8-digit Buddhist Era)
  const bdateCheck = parseDateToOpecBe8(student.birth_date);
  if (!bdateCheck.isValid) {
    errors.push({
      field: 'birth_date',
      fieldLabel: 'วันเดือนปีเกิด',
      message: bdateCheck.error || 'วันเดือนปีเกิดไม่ถูกต้องตามรูปแบบ สช. (ปปปปดดวว)',
      severity: 'error'
    });
  }

  // 6. Address Checks (Warnings only)
  const addresses: StudentAddress[] = Array.isArray(student.student_addresses)
    ? student.student_addresses
    : (student.student_addresses ? [student.student_addresses] : []);
  const primaryAddr = addresses[0];

  if (!primaryAddr) {
    warnings.push({
      field: 'student_addresses',
      fieldLabel: 'ที่อยู่ตามทะเบียนบ้าน',
      message: 'ยังไม่มีข้อมูลที่อยู่ตามทะเบียนบ้าน',
      severity: 'warning'
    });
  } else {
    if (!primaryAddr.house_code) {
      warnings.push({
        field: 'house_code',
        fieldLabel: 'รหัสประจำบ้าน',
        message: 'ไม่มีรหัสประจำบ้าน (11 หลัก)',
        severity: 'warning'
      });
    }
    if (!primaryAddr.sub_district || !primaryAddr.district || !primaryAddr.province) {
      warnings.push({
        field: 'address_location',
        fieldLabel: 'ตำบล / อำเภอ / จังหวัด',
        message: 'ข้อมูลตำบล อำเภอ หรือจังหวัดยังไม่สมบูรณ์',
        severity: 'warning'
      });
    }
  }

  // 7. Parent Information Checks (Warnings only)
  const parents: StudentParent[] = Array.isArray(student.student_parents)
    ? student.student_parents
    : (student.student_parents ? [student.student_parents] : []);
  const father = parents.find(p => p.relationship === 'บิดา');
  const mother = parents.find(p => p.relationship === 'มารดา');
  const guardian = parents.find(p => p.relationship === 'ผู้ปกครอง') || father || mother;

  if (!father && !mother && !guardian) {
    warnings.push({
      field: 'student_parents',
      fieldLabel: 'ข้อมูลผู้ปกครอง',
      message: 'ไม่มีข้อมูลบิดา มารดา หรือผู้ปกครอง',
      severity: 'warning'
    });
  } else {
    if (father?.citizen_id) {
      const fCheck = validateThaiCitizenId(father.citizen_id);
      if (!fCheck.isValid) {
        warnings.push({
          field: 'father_citizen_id',
          fieldLabel: 'เลขประจำตัวประชาชนบิดา',
          message: `เลขบัตรประชาชนบิดาไม่ถูกต้อง (${fCheck.reason})`,
          severity: 'warning'
        });
      }
    }
    if (mother?.citizen_id) {
      const mCheck = validateThaiCitizenId(mother.citizen_id);
      if (!mCheck.isValid) {
        warnings.push({
          field: 'mother_citizen_id',
          fieldLabel: 'เลขประจำตัวประชาชนมารดา',
          message: `เลขบัตรประชาชนมารดาไม่ถูกต้อง (${mCheck.reason})`,
          severity: 'warning'
        });
      }
    }
  }

  return {
    studentId,
    studentName,
    grade,
    citizenId,
    isForeign,
    canExport: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Audits an entire batch of students and aggregates summary statistics.
 */
export function auditBatchForOpec(students: any[]): OpecBatchAuditSummary {
  let thaiCount = 0;
  let foreignCount = 0;
  let readyCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  const gradeBreakdown: Record<string, { total: number; ready: number; error: number; warning: number }> = {};
  const studentResults: StudentAuditResult[] = [];
  const criticalIssuesList: { studentId: string; studentName: string; grade: string; issues: OpecIssue[] }[] = [];

  students.forEach(student => {
    const audit = auditStudentForOpec(student);
    studentResults.push(audit);

    const grade = audit.grade || 'ไม่ระบุห้อง';
    if (!gradeBreakdown[grade]) {
      gradeBreakdown[grade] = { total: 0, ready: 0, error: 0, warning: 0 };
    }
    gradeBreakdown[grade].total += 1;

    if (audit.isForeign) {
      foreignCount++;
    } else {
      thaiCount++;
    }

    if (audit.errors.length > 0) {
      errorCount++;
      gradeBreakdown[grade].error += 1;
      criticalIssuesList.push({
        studentId: audit.studentId,
        studentName: audit.studentName,
        grade: audit.grade,
        issues: audit.errors
      });
    } else if (audit.warnings.length > 0) {
      warningCount++;
      readyCount++; // Can still export even with warnings
      gradeBreakdown[grade].warning += 1;
      gradeBreakdown[grade].ready += 1;
    } else {
      readyCount++;
      gradeBreakdown[grade].ready += 1;
    }
  });

  return {
    total: students.length,
    thaiCount,
    foreignCount,
    readyCount,
    warningCount,
    errorCount,
    gradeBreakdown,
    studentResults,
    criticalIssuesList
  };
}
