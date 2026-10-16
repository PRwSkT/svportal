/**
 * OPEC REGIS Excel Generator (1-Click Engine)
 * Built with ExcelJS for Somkidvittaya School (1121100013)
 * Generates official 2-tab .xlsx workbook compliant with OPEC REGIS specifications.
 */

import ExcelJS from 'exceljs';
import { 
  parseDateToOpecBe8, 
  mapGenderToOpec, 
  isForeignOrGCode, 
  validateThaiCitizenId 
} from './regis-validator';

export interface OpecExcelOptions {
  schoolId?: string;
  schoolName?: string;
  gradeFilter?: string;
  includeInstructionsSheet?: boolean;
}

const OPEC_COLUMNS = [
  { header: 'เลขประจำตัวประชาชน', key: 'citizen_id', width: 22 },
  { header: 'เลขประจำตัวนักเรียน', key: 'student_id', width: 18 },
  { header: 'คำนำหน้าชื่อ', key: 'prefix', width: 14 },
  { header: 'ชื่อ (ภาษาไทย)', key: 'first_name', width: 20 },
  { header: 'นามสกุล (ภาษาไทย)', key: 'last_name', width: 22 },
  { header: 'เพศ (1=ชาย, 2=หญิง)', key: 'gender', width: 16 },
  { header: 'วันเดือนปีเกิด (ปปปปดดวว)', key: 'birth_date', width: 20 },
  { header: 'สัญชาติ', key: 'nationality', width: 16 },
  { header: 'เชื้อชาติ', key: 'race', width: 16 },
  { header: 'ศาสนา', key: 'religion', width: 14 },
  { header: 'ชั้นเรียน', key: 'grade', width: 14 },
  { header: 'วันที่เข้าเรียน (ปปปปดดวว)', key: 'enrolled_date', width: 20 },
  { header: 'สถานะนักเรียน', key: 'status', width: 18 },
  { header: 'ประเภทความพิการ', key: 'disability', width: 18 },
  { header: 'รหัสประจำบ้าน', key: 'house_code', width: 18 },
  { header: 'บ้านเลขที่', key: 'house_number', width: 14 },
  { header: 'หมู่ที่', key: 'moo', width: 10 },
  { header: 'ซอย', key: 'soi', width: 16 },
  { header: 'ถนน', key: 'road', width: 16 },
  { header: 'ตำบล', key: 'sub_district', width: 18 },
  { header: 'อำเภอ', key: 'district', width: 18 },
  { header: 'จังหวัด', key: 'province', width: 18 },
  { header: 'รหัสไปรษณีย์', key: 'zip_code', width: 14 },
  { header: 'เบอร์โทรศัพท์', key: 'phone_number', width: 16 },
  { header: '[บิดา] เลขประจำตัวประชาชน', key: 'father_citizen_id', width: 22 },
  { header: '[บิดา] คำนำหน้าชื่อ', key: 'father_prefix', width: 14 },
  { header: '[บิดา] ชื่อ', key: 'father_first_name', width: 18 },
  { header: '[บิดา] นามสกุล', key: 'father_last_name', width: 20 },
  { header: '[บิดา] สถานภาพ', key: 'father_status', width: 14 },
  { header: '[บิดา] อาชีพ', key: 'father_occupation', width: 18 },
  { header: '[มารดา] เลขประจำตัวประชาชน', key: 'mother_citizen_id', width: 22 },
  { header: '[มารดา] คำนำหน้าชื่อ', key: 'mother_prefix', width: 14 },
  { header: '[มารดา] ชื่อ', key: 'mother_first_name', width: 18 },
  { header: '[มารดา] นามสกุล', key: 'mother_last_name', width: 20 },
  { header: '[มารดา] สถานภาพ', key: 'mother_status', width: 14 },
  { header: '[มารดา] อาชีพ', key: 'mother_occupation', width: 18 },
  { header: '[ผู้ปกครอง] เลขประจำตัวประชาชน', key: 'guardian_citizen_id', width: 22 },
  { header: '[ผู้ปกครอง] คำนำหน้าชื่อ', key: 'guardian_prefix', width: 14 },
  { header: '[ผู้ปกครอง] ชื่อ', key: 'guardian_first_name', width: 18 },
  { header: '[ผู้ปกครอง] นามสกุล', key: 'guardian_last_name', width: 20 },
  { header: '[ผู้ปกครอง] ความสัมพันธ์', key: 'guardian_relation', width: 16 },
  { header: '[ผู้ปกครอง] เบอร์โทรศัพท์', key: 'guardian_phone', width: 16 },
];

/**
 * Normalizes phone numbers with leading zero (e.g. '812394498' -> '0812394498')
 */
function normalizePhoneNumber(raw: any): string {
  if (!raw) return '';
  let str = String(raw).replace(/\D/g, '');
  if (str.length === 9 && !str.startsWith('0')) {
    str = '0' + str;
  }
  return str;
}

/**
 * Extracts and separates prefix, first_name, and last_name if not already populated.
 */
function parseStudentName(student: any): { prefix: string; firstName: string; lastName: string } {
  let prefix = student.prefix ? String(student.prefix).trim() : '';
  let firstName = student.first_name ? String(student.first_name).trim() : '';
  let lastName = student.last_name ? String(student.last_name).trim() : '';

  if (!firstName && student.name) {
    let fullName = String(student.name).replace(/\s+/g, ' ').trim();
    // Known prefixes
    const prefixes = ['เด็กหญิง', 'เด็กชาย', 'ด.ญ.', 'ด.ช.', 'นาย', 'นางสาว', 'นาง'];
    for (const p of prefixes) {
      if (fullName.startsWith(p)) {
        prefix = p;
        fullName = fullName.substring(p.length).trim();
        break;
      }
    }
    const parts = fullName.split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }

  // Normalize prefix shorthand
  if (prefix === 'ด.ช.') prefix = 'เด็กชาย';
  if (prefix === 'ด.ญ.') prefix = 'เด็กหญิง';

  return { prefix, firstName, lastName };
}

/**
 * Transforms a raw student object into a standardized OPEC row object
 */
function transformToOpecRow(student: any) {
  const { prefix, firstName, lastName } = parseStudentName(student);
  const gender = mapGenderToOpec(student.gender || (prefix === 'เด็กหญิง' || prefix === 'นางสาว' || prefix === 'นาง' ? '2' : '1'));
  
  // Date formatting (Strict 8-digit Buddhist Era: ปปปปดดวว)
  const bdate = parseDateToOpecBe8(student.birth_date);
  const enrolledDate = parseDateToOpecBe8(student.enrolled_date || student.created_at || '25670516');

  // Address
  const addresses = Array.isArray(student.student_addresses)
    ? student.student_addresses
    : (student.student_addresses ? [student.student_addresses] : []);
  const primaryAddr = addresses[0] || {};

  // Parents
  const parents = Array.isArray(student.student_parents)
    ? student.student_parents
    : (student.student_parents ? [student.student_parents] : []);
  const father = parents.find((p: any) => p.relationship === 'บิดา') || {};
  const mother = parents.find((p: any) => p.relationship === 'มารดา') || {};
  const guardian = parents.find((p: any) => p.relationship === 'ผู้ปกครอง') || father || mother || {};

  // Clean citizen id
  const rawCid = String(student.citizen_id || '').trim();
  const cidCheck = validateThaiCitizenId(rawCid);
  const cleanCid = cidCheck.cleanedId || rawCid;

  return {
    citizen_id: cleanCid,
    student_id: String(student.id || '').trim(),
    prefix: prefix || (gender.code === '1' ? 'เด็กชาย' : 'เด็กหญิง'),
    first_name: firstName,
    last_name: lastName,
    gender: gender.code, // '1' or '2'
    birth_date: bdate.formatted || '',
    nationality: student.nationality || 'ไทย',
    race: student.race || student.nationality || 'ไทย',
    religion: student.religion || 'พุทธ',
    grade: student.grade || '',
    enrolled_date: enrolledDate.formatted || '',
    status: student.status || 'กำลังศึกษาอยู่',
    disability: student.disability || 'ไม่พิการ',
    house_code: primaryAddr.house_code || '',
    house_number: primaryAddr.house_number || '',
    moo: primaryAddr.moo || '',
    soi: primaryAddr.soi || '-',
    road: primaryAddr.road || '-',
    sub_district: primaryAddr.sub_district || '',
    district: primaryAddr.district || '',
    province: primaryAddr.province || '',
    zip_code: primaryAddr.zip_code || '',
    phone_number: normalizePhoneNumber(student.phone_number || primaryAddr.phone_number),
    father_citizen_id: father.citizen_id || '',
    father_prefix: father.prefix || 'นาย',
    father_first_name: father.first_name || '',
    father_last_name: father.last_name || '',
    father_status: father.status || 'มีชีวิต',
    father_occupation: father.occupation || '',
    mother_citizen_id: mother.citizen_id || '',
    mother_prefix: mother.prefix || 'นาง',
    mother_first_name: mother.first_name || '',
    mother_last_name: mother.last_name || '',
    mother_status: mother.status || 'มีชีวิต',
    mother_occupation: mother.occupation || '',
    guardian_citizen_id: guardian.citizen_id || '',
    guardian_prefix: guardian.prefix || '',
    guardian_first_name: guardian.first_name || '',
    guardian_last_name: guardian.last_name || '',
    guardian_relation: guardian.relationship || 'บิดา',
    guardian_phone: normalizePhoneNumber(guardian.phone_number),
  };
}

/**
 * Builds and returns an ExcelJS Workbook populated with Thai & Foreign student sheets.
 */
export async function generateOpecRegisWorkbook(
  students: any[],
  options: OpecExcelOptions = {}
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SVPortal - โรงเรียนสมคิดวิทยา (1121100013)';
  workbook.lastModifiedBy = 'น้องฟ้า AI Super-Agent (SVPortal)';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Segregate Thai vs Foreign (G-Code) students
  const thaiStudents: any[] = [];
  const foreignStudents: any[] = [];

  students.forEach(student => {
    if (isForeignOrGCode(student)) {
      foreignStudents.push(student);
    } else {
      thaiStudents.push(student);
    }
  });

  // Setup Sheet 1: ข้อมูลนักเรียนไทย
  const thaiSheet = workbook.addWorksheet('ข้อมูลนักเรียนไทย', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  thaiSheet.columns = OPEC_COLUMNS;

  // Header Styling for Sheet 1 (OPEC Navy / Burgundy Theme)
  const headerRow1 = thaiSheet.getRow(1);
  headerRow1.height = 28;
  headerRow1.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7B1C3E' } // Somkid Burgundy
    };
    cell.font = {
      name: 'Sarabun',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Populate Sheet 1 Rows
  thaiStudents.forEach(s => {
    const rowData = transformToOpecRow(s);
    const row = thaiSheet.addRow(rowData);
    row.height = 22;
    // Format all cells as text to prevent Excel scientific notation & leading zero loss
    row.eachCell((cell) => {
      cell.numFmt = '@';
      cell.font = { name: 'Sarabun', size: 10 };
      cell.alignment = { vertical: 'middle' };
    });
  });

  // Setup Sheet 2: ข้อมูลนักเรียนต่างชาติ (G-CODE)
  const foreignColumns = OPEC_COLUMNS.map(col => {
    if (col.key === 'citizen_id') {
      return { ...col, header: 'รหัส G-CODE / เลขประจำตัว' };
    }
    return col;
  });

  const foreignSheet = workbook.addWorksheet('ข้อมูลนักเรียนต่างชาติ (G-CODE)', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  foreignSheet.columns = foreignColumns;

  // Header Styling for Sheet 2 (Teal / Slate Theme to clearly distinguish)
  const headerRow2 = foreignSheet.getRow(1);
  headerRow2.height = 28;
  headerRow2.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' } // Teal 700
    };
    cell.font = {
      name: 'Sarabun',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Populate Sheet 2 Rows
  foreignStudents.forEach(s => {
    const rowData = transformToOpecRow(s);
    const row = foreignSheet.addRow(rowData);
    row.height = 22;
    row.eachCell((cell) => {
      cell.numFmt = '@';
      cell.font = { name: 'Sarabun', size: 10 };
      cell.alignment = { vertical: 'middle' };
    });
  });

  // Setup Sheet 3: คำแนะนำการนำเข้า (Instructions Guide)
  if (options.includeInstructionsSheet !== false) {
    const infoSheet = workbook.addWorksheet('คำแนะนำการนำเข้า สช. REGIS');
    infoSheet.columns = [
      { header: 'หัวข้อ', key: 'topic', width: 25 },
      { header: 'รายละเอียด', key: 'detail', width: 65 }
    ];

    const infoRows = [
      { topic: 'รหัสสถานศึกษา', detail: '1121100013 (โรงเรียนสมคิดวิทยา)' },
      { topic: 'ระบบปลายทาง', detail: 'สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (regis.opec.go.th)' },
      { topic: 'ข้อกำหนดรูปแบบวันที่', detail: 'ต้องเป็นตัวเลข 8 หลักติดกัน รูปแบบ พ.ศ. ปปปปดดวว (เช่น 25651017) โดยไม่มีเครื่องหมาย / หรือ -' },
      { topic: 'การแยกประเภทนักเรียน', detail: 'ชีต 1 = ข้อมูลนักเรียนไทย (มีบัตรประชาชน 13 หลัก) | ชีต 2 = ข้อมูลนักเรียนต่างชาติ (G-CODE)' },
      { topic: 'จำนวนนักเรียนไทยในไฟล์นี้', detail: `${thaiStudents.length} คน` },
      { topic: 'จำนวนนักเรียนต่างชาติในไฟล์นี้', detail: `${foreignStudents.length} คน` },
      { topic: 'ยอดรวมนักเรียนทั้งหมด', detail: `${students.length} คน` },
      { topic: 'สร้างโดยระบบ', detail: 'SVPortal Smart School Management & น้องฟ้า AI Super-Agent' },
      { topic: 'วันที่ส่งออก', detail: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) },
    ];

    const headerInfo = infoSheet.getRow(1);
    headerInfo.height = 26;
    headerInfo.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    });

    infoRows.forEach(item => {
      const r = infoSheet.addRow(item);
      r.height = 22;
      r.eachCell(cell => {
        cell.font = { name: 'Sarabun', size: 10 };
      });
    });
  }

  return workbook;
}

/**
 * Generates and returns a Buffer of the Excel file for API streaming.
 */
export async function generateOpecRegisBuffer(
  students: any[],
  options: OpecExcelOptions = {}
): Promise<Buffer> {
  const workbook = await generateOpecRegisWorkbook(students, options);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
