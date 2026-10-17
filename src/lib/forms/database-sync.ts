import { FormDefinition, FormField, FormResponse } from '@/types';

export interface FieldDiff {
  field: string;
  labelTh: string;
  oldValue: any;
  newValue: any;
  rawFormValue?: any;
}

export interface PendingStudentSyncItem {
  responseId: string;
  submittedAt: string;
  syncType: 'update_existing' | 'create_new';
  studentId?: string;
  studentName?: string;
  studentGrade?: string;
  diffs: FieldDiff[];
  newStudentPayload?: {
    name: string;
    grade: string;
    prefix?: string;
    first_name?: string;
    last_name?: string;
    citizen_id?: string;
    gender?: string;
    birth_date?: string;
    status?: string;
    allergies?: string;
    medical_conditions?: string;
    parent_phone?: string;
  };
  isAlreadySynced?: boolean;
  syncedAt?: string | null;
}

/**
 * Normalizes Thai names by stripping honorific prefixes and excessive whitespace.
 */
export function cleanThaiName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = String(rawName)
    .replace(/\u00A0/g, ' ') // replace non-breaking spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Strip common Thai school prefixes
  const prefixes = [
    'เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'ด.ช', 'ด.ญ',
    'นาย', 'นางสาว', 'นาง', 'น.ส.', 'น.ส'
  ];

  for (const p of prefixes) {
    if (cleaned.startsWith(p)) {
      cleaned = cleaned.slice(p.length).trim();
      break;
    }
  }

  return cleaned;
}

/**
 * Identifies if a field corresponds to a student or parent database column.
 */
export function mapFieldToStudentColumn(label: string, fieldKey: string): string | null {
  const text = `${label} ${fieldKey}`.toLowerCase();

  // 1. Parent Information (MUST BE CHECKED FIRST to avoid parent_name matching student name)
  if (
    text.includes('ผู้ปกครอง') ||
    text.includes('parent') ||
    text.includes('guardian')
  ) {
    if (
      text.includes('เบอร์') ||
      text.includes('โทร') ||
      text.includes('phone') ||
      text.includes('mobile') ||
      text.includes('tel')
    ) {
      return 'parent_phone';
    }
    if (
      text.includes('ความเกี่ยวข้อง') ||
      text.includes('ความสัมพันธ์') ||
      text.includes('relation')
    ) {
      return 'parent_relation';
    }
    if (
      text.includes('ชื่อ') ||
      text.includes('name')
    ) {
      return 'parent_name';
    }
  }

  // 2. Student ID / Student Code
  if (
    text.includes('รหัสประจำตัวนักเรียน') ||
    text.includes('รหัสนักเรียน') ||
    text.includes('เลขประจำตัวนักเรียน') ||
    text.includes('เลขประจำตัว') ||
    text === 'student_id' ||
    text === 'field_student_id'
  ) {
    return 'student_id';
  }

  // 3. Nickname (ชื่อเล่น)
  if (text.includes('ชื่อเล่น') || text.includes('nickname')) {
    return 'nickname';
  }

  // 4. English Name (ชื่อภาษาอังกฤษ)
  if (
    text.includes('ภาษาอังกฤษ') ||
    text.includes('english') ||
    text.includes('engname') ||
    text.includes('student_engname')
  ) {
    return 'name_en';
  }

  // 5. Prefix (คำนำหน้าชื่อ)
  if (text.includes('คำนำหน้า') || text.includes('prefix') || text.includes('student_prefix')) {
    return 'prefix';
  }

  // 6. Student Full Name (Thai)
  if (
    text.includes('ชื่อ -นามสกุล') ||
    text.includes('ชื่อ - นามสกุล') ||
    text.includes('ชื่อ-นามสกุล') ||
    text.includes('ชื่อนักเรียน') ||
    text.includes('ชื่อจริง') ||
    text.includes('ชื่อสกุล') ||
    text.includes('student_fullname') ||
    text.includes('fullname') ||
    text === 'student_name' ||
    text === 'name'
  ) {
    return 'name';
  }

  // 7. Health & Allergies (Strictly separated from disability!)
  if (
    text.includes('แพ้อาหาร') ||
    text.includes('แพ้ยา') ||
    text.includes('ประวัติการแพ้') ||
    text.includes('สิ่งที่ไม่รับประทาน') ||
    text.includes('การแพ้') ||
    text.includes('allergies') ||
    text.includes('allergy') ||
    text.includes('field_health_allergies')
  ) {
    return 'allergies';
  }

  // 8. Congenital Diseases / Medical Conditions
  if (
    text.includes('โรคประจำตัว') ||
    text.includes('โรคประจำตัวหรือข้อจำกัด') ||
    text.includes('โรคเรื้อรัง') ||
    text.includes('congenital') ||
    text.includes('medical_condition') ||
    text.includes('field_health_congenital')
  ) {
    return 'medical_conditions';
  }

  // 9. Disability / Physical Constraints
  if (
    text.includes('ความพิการ') ||
    text.includes('ความบกพร่อง') ||
    text.includes('disability')
  ) {
    return 'disability';
  }

  // 10. Physical Measurements
  if (text.includes('ส่วนสูง') || text.includes('ความสูง') || text.includes('height')) return 'height';
  if (text.includes('น้ำหนัก') || text.includes('weight')) return 'weight';

  // 11. Demographics
  if (
    text.includes('วัน เดือน ปี เกิด') ||
    text.includes('วันเดือนปีเกิด') ||
    text.includes('วันเกิด') ||
    text.includes('วัน/เดือน/ปีเกิด') ||
    text.includes('birth_date') ||
    text.includes('student_dob') ||
    text.includes('dob')
  ) {
    return 'birth_date';
  }

  if (text.includes('เพศ') || text.includes('gender') || text.includes('sex')) return 'gender';
  if (text.includes('ศาสนา') || text.includes('religion')) return 'religion';
  if (text.includes('สัญชาติ') || text.includes('nationality')) return 'nationality';

  // 12. Citizen ID
  if (
    text.includes('เลขบัตรประชาชน') ||
    text.includes('เลขประจำตัวประชาชน') ||
    text.includes('เลขบัตรประจำตัวประชาชน') ||
    text.includes('citizen_id') ||
    text.includes('id_card')
  ) {
    return 'citizen_id';
  }

  // 13. Class & Room
  if (
    text.includes('ระดับชั้น') ||
    text.includes('ชั้นเรียน') ||
    text.includes('grade') ||
    text.includes('student_level')
  ) {
    return 'grade';
  }

  if (text.includes('ห้องเรียน') || text.includes('ห้อง') || text.includes('classroom')) return 'classroom';

  return null;
}

/**
 * Intelligent Data Normalizer for School Database Schemas
 * Converts raw user inputs into the exact types and formats required by Supabase.
 */
export function normalizeStudentFieldValue(column: string, rawValue: any): any {
  if (rawValue === undefined || rawValue === null) return null;
  const str = String(rawValue).trim();
  if (str === '') return null;

  switch (column) {
    case 'allergies': {
      // Clean out negative terms ("ไม่มี", "ไม่แพ้", "ไม่ม่", "ปกติ", "-", "none")
      // Do not store negative statements as allergy records in database!
      const lower = str.toLowerCase();
      const negativeTokens = [
        'ไม่มี', 'ไม่แพ้', 'ไม่ม่', 'ไม่มีค่ะ', 'ไม่มีครับ',
        'ไม่มีประวัติการแพ้', 'ไม่พบการแพ้', 'ปกติ', 'ไม่เคยแพ้',
        '-', '--', 'none', 'no', 'n/a', 'nil', 'null', 'ไม่ระบุ'
      ];
      if (negativeTokens.some((tok) => lower === tok || lower === tok + 'ค่ะ' || lower === tok + 'ครับ')) {
        return null;
      }
      if (lower.startsWith('ไม่มี') && !lower.includes('แต่') && !lower.includes('ยกเว้น')) {
        return null;
      }
      return str;
    }

    case 'medical_conditions': {
      const lower = str.toLowerCase();
      const negativeTokens = [
        'ไม่มี', 'ไม่มีค่ะ', 'ไม่มีครับ', 'ไม่มีโรคประจำตัว',
        'ปกติ', 'แข็งแรงดี', 'สุขภาพดี', '-', '--', 'none', 'no', 'n/a', 'nil', 'ไม่ระบุ'
      ];
      if (negativeTokens.some((tok) => lower === tok || lower === tok + 'ค่ะ' || lower === tok + 'ครับ')) {
        return null;
      }
      if (lower.startsWith('ไม่มี') && !lower.includes('แต่') && !lower.includes('ยกเว้น')) {
        return null;
      }
      return str;
    }

    case 'disability': {
      const lower = str.toLowerCase();
      if (lower === 'ไม่มี' || lower === 'ไม่พิการ' || lower === 'ปกติ' || lower === '-') {
        return 'ไม่พิการ';
      }
      return str;
    }

    case 'birth_date': {
      // Support ISO YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [yStr, mStr, dStr] = str.split('-');
        let y = parseInt(yStr, 10);
        if (y > 2400) y -= 543; // Convert Buddhist Era year to CE
        return `${y}-${mStr}-${dStr}`;
      }

      // Support DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        let year = parseInt(dmyMatch[3], 10);
        if (year > 2400) year -= 543;
        return `${year}-${month}-${day}`;
      }

      // Support Thai Date text e.g. "27 กุมภาพันธ์ 2560" or "5 พ.ย. 2564"
      const thaiMonths: Record<string, string> = {
        'มกราคม': '01', 'ม.ค.': '01',
        'กุมภาพันธ์': '02', 'ก.พ.': '02',
        'มีนาคม': '03', 'มี.ค.': '03',
        'เมษายน': '04', 'เม.ย.': '04',
        'พฤษภาคม': '05', 'พ.ค.': '05',
        'มิถุนายน': '06', 'มิ.ย.': '06',
        'กรกฎาคม': '07', 'ก.ค.': '07',
        'สิงหาคม': '08', 'ส.ค.': '08',
        'กันยายน': '09', 'ก.ย.': '09',
        'ตุลาคม': '10', 'ต.ค.': '10',
        'พฤศจิกายน': '11', 'พ.ย.': '11',
        'ธันวาคม': '12', 'ธ.ค.': '12',
      };

      for (const [mName, mNum] of Object.entries(thaiMonths)) {
        if (str.includes(mName)) {
          const parts = str.split(mName);
          const dayMatch = parts[0].match(/\d+/);
          const yearMatch = parts[1].match(/\d{4}/);
          if (dayMatch && yearMatch) {
            const day = dayMatch[0].padStart(2, '0');
            let year = parseInt(yearMatch[0], 10);
            if (year > 2400) year -= 543;
            return `${year}-${mNum}-${day}`;
          }
        }
      }

      return str;
    }

    case 'parent_phone': {
      let digits = str.replace(/\D/g, '');
      if (digits.startsWith('66') && digits.length >= 11) {
        digits = '0' + digits.slice(2);
      }
      if (digits.length === 9 && !digits.startsWith('0')) {
        digits = '0' + digits;
      }
      return digits;
    }

    case 'citizen_id': {
      const digits = str.replace(/\D/g, '');
      return digits.length === 13 ? digits : digits || null;
    }

    case 'height': {
      const num = parseFloat(str.replace(/[^\d.]/g, ''));
      if (!isNaN(num) && num >= 30 && num <= 250) {
        return Math.round(num * 10) / 10;
      }
      return null;
    }

    case 'weight': {
      const num = parseFloat(str.replace(/[^\d.]/g, ''));
      if (!isNaN(num) && num >= 3 && num <= 250) {
        return Math.round(num * 10) / 10;
      }
      return null;
    }

    case 'gender': {
      const lower = str.toLowerCase();
      if (lower.includes('ชาย') || lower === 'male' || lower === 'm' || lower.includes('ด.ช.')) return 'ชาย';
      if (lower.includes('หญิง') || lower === 'female' || lower === 'f' || lower.includes('ด.ญ.')) return 'หญิง';
      return str;
    }

    case 'prefix': {
      const lower = str.toLowerCase();
      if (lower === 'master' || lower === 'mr' || lower.includes('ด.ช')) return 'เด็กชาย';
      if (lower === 'miss' || lower.includes('ด.ญ')) return 'เด็กหญิง';
      return str;
    }

    case 'grade': {
      const lower = str.toLowerCase();
      if (lower === 'kg1' || lower === 'k1') return 'อ.1';
      if (lower === 'kg2' || lower === 'k2') return 'อ.2';
      if (lower === 'kg3' || lower === 'k3') return 'อ.3';
      if (lower === 'p1') return 'ป.1';
      if (lower === 'p2') return 'ป.2';
      if (lower === 'p3') return 'ป.3';
      if (lower === 'p4') return 'ป.4';
      if (lower === 'p5') return 'ป.5';
      if (lower === 'p6') return 'ป.6';
      return str;
    }

    default:
      return str;
  }
}

/**
 * Searches for an existing student in the school database using multi-tier matching:
 * 1. Exact Student ID (e.g. "10248")
 * 2. Exact 13-digit Citizen ID
 * 3. Exact clean Thai full name (first_name + last_name)
 * 4. First name match combined with Grade Level / Classroom
 */
export function matchStudentInDatabase(
  answers: Record<string, any>,
  fields: FormField[],
  existingStudents: any[]
): any | null {
  // Extract values from answers using column mapping
  let rawStudentId = '';
  let rawCitizenId = '';
  let rawFullName = '';
  let rawGrade = '';

  for (const f of fields) {
    const lbl = f.label?.th || f.label?.en || f.field_key;
    const col = mapFieldToStudentColumn(lbl, f.field_key);
    const val = answers[f.field_key];
    if (!val) continue;

    if (col === 'student_id') rawStudentId = String(val).trim();
    if (col === 'citizen_id') rawCitizenId = String(val).replace(/\D/g, '').trim();
    if (col === 'name') rawFullName = String(val).trim();
    if (col === 'grade') rawGrade = String(val).trim();
  }

  // Tier 1: Match by Student ID (numeric 4-5 digits)
  const cleanId = rawStudentId.replace(/\D/g, '');
  if (cleanId.length >= 4 && cleanId.length <= 5) {
    const found = existingStudents.find((s) => s.id === cleanId || s.student_id === cleanId);
    if (found) return found;
  }

  // Tier 1.5: If user typed student name in the student_id field (e.g. "เด็กหญิงธัญชนก ทองดี")
  const cleanedSidText = cleanThaiName(rawStudentId);
  if (cleanedSidText.length >= 3) {
    const foundBySidText = existingStudents.find(
      (s) =>
        cleanThaiName(s.name || '') === cleanedSidText ||
        cleanThaiName(`${s.first_name || ''} ${s.last_name || ''}`) === cleanedSidText
    );
    if (foundBySidText) return foundBySidText;
  }

  // Tier 2: Match by 13-digit Citizen ID
  if (rawCitizenId && rawCitizenId.length === 13) {
    const found = existingStudents.find((s) => s.citizen_id === rawCitizenId);
    if (found) return found;
  }

  // Tier 3: Match by Full Name (Cleaned Thai name)
  const cleanedSearchName = cleanThaiName(rawFullName);
  if (cleanedSearchName.length >= 3) {
    // Check exact first + last name match
    for (const s of existingStudents) {
      const sCleanFullName = cleanThaiName(s.name || `${s.first_name || ''} ${s.last_name || ''}`);
      if (sCleanFullName === cleanedSearchName) {
        return s;
      }
    }

    // Check first name and last name components
    const nameParts = cleanedSearchName.split(' ').filter(Boolean);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      const found = existingStudents.find(
        (s) =>
          cleanThaiName(s.first_name || '') === firstName &&
          cleanThaiName(s.last_name || '') === lastName
      );
      if (found) return found;

      // Minor typo in first name (e.g. ธัญนก vs ธัญชนก) with exact last name
      if (lastName.length >= 3) {
        const lastNameCandidates = existingStudents.filter(
          (s) => cleanThaiName(s.last_name || '') === lastName
        );
        if (lastNameCandidates.length === 1) {
          return lastNameCandidates[0];
        }
        const fuzzyFirst = lastNameCandidates.find((c) => {
          const cFirst = cleanThaiName(c.first_name || '');
          return cFirst.startsWith(firstName.slice(0, 3)) || firstName.startsWith(cFirst.slice(0, 3));
        });
        if (fuzzyFirst) return fuzzyFirst;
      }
    }

    // Check if cleanedSearchName matches single first name + grade
    if (nameParts.length === 1 && rawGrade) {
      const normGrade = normalizeStudentFieldValue('grade', rawGrade);
      const candidates = existingStudents.filter(
        (s) => cleanThaiName(s.first_name || '') === nameParts[0]
      );
      if (candidates.length === 1) return candidates[0];
      const gradeMatched = candidates.find((c) => (c.grade || '').includes(normGrade));
      if (gradeMatched) return gradeMatched;
    }
  }

  return null;
}

/**
 * Scans form responses, compares with existing student records in DB,
 * and generates actionable sync proposals (Diffs and New Enrollments).
 */
export function analyzeStudentSyncOpportunities(
  form: FormDefinition,
  fields: FormField[],
  responses: FormResponse[],
  existingStudents: any[]
): PendingStudentSyncItem[] {
  const syncItems: PendingStudentSyncItem[] = [];

  // Build Field to Column Mapping
  const columnMapping = new Map<string, string>(); // field_key -> db column
  for (const f of fields) {
    const lbl = f.label?.th || f.label?.en || f.field_key;
    const col = mapFieldToStudentColumn(lbl, f.field_key);
    if (col) {
      columnMapping.set(f.field_key, col);
    }
  }

  const isAdmissionForm = form.category === 'admission' || (form.title?.th || '').includes('รับสมัคร');

  for (const resp of responses) {
    const rawAnswers = resp.answers || {};
    const isAlreadySynced = Boolean(rawAnswers._db_synced_at);
    const syncedAt = rawAnswers._db_synced_at || null;

    // Match student using multi-tier intelligence
    const dbStudent = matchStudentInDatabase(rawAnswers, fields, existingStudents);

    // Case A: Existing student matched in database
    if (dbStudent) {
      const diffs: FieldDiff[] = [];

      for (const [fKey, col] of columnMapping.entries()) {
        if (col === 'student_id') continue;
        const rawVal = rawAnswers[fKey];
        if (rawVal === undefined || rawVal === null || rawVal === '') continue;

        const fieldDef = fields.find((f) => f.field_key === fKey);
        const labelTh = fieldDef?.label?.th || fKey;
        const normVal = normalizeStudentFieldValue(col, rawVal);

        // 1. Allergies
        if (col === 'allergies') {
          const currentAllergy = (dbStudent.allergies || '').trim();
          const newAllergy = normVal || '';
          if (newAllergy !== currentAllergy) {
            diffs.push({
              field: 'allergies',
              labelTh: 'ประวัติการแพ้อาหาร/ยา',
              oldValue: currentAllergy || 'ไม่มีข้อมูล',
              newValue: newAllergy || '(ไม่มีการแพ้)',
              rawFormValue: rawVal,
            });
          }
        }

        // 2. Congenital Diseases / Medical Conditions
        else if (col === 'medical_conditions') {
          const currentMed = (dbStudent.medical_conditions || '').trim();
          const newMed = normVal || '';
          if (newMed !== currentMed) {
            diffs.push({
              field: 'medical_conditions',
              labelTh: 'โรคประจำตัว',
              oldValue: currentMed || 'ไม่มีข้อมูล',
              newValue: newMed || '(ไม่มีโรคประจำตัว)',
              rawFormValue: rawVal,
            });
          }
        }

        // 3. Parent Mobile Phone
        else if (col === 'parent_phone') {
          const cleanPhone = normVal || '';
          const currentParentPhone = dbStudent.student_parents?.[0]?.phone_number
            ? String(dbStudent.student_parents[0].phone_number).replace(/\D/g, '').trim()
            : '';
          if (cleanPhone && cleanPhone !== currentParentPhone) {
            diffs.push({
              field: 'parent_phone',
              labelTh: 'เบอร์โทรศัพท์ผู้ปกครอง',
              oldValue: currentParentPhone || 'ยังไม่มีในระบบ',
              newValue: cleanPhone,
              rawFormValue: rawVal,
            });
          }
        }

        // 4. Date of Birth
        else if (col === 'birth_date') {
          const normDob = normVal || '';
          const currentDob = dbStudent.birth_date ? String(dbStudent.birth_date).slice(0, 10) : '';
          if (normDob && normDob !== currentDob) {
            diffs.push({
              field: 'birth_date',
              labelTh: 'วันเกิด (YYYY-MM-DD)',
              oldValue: currentDob || 'ยังไม่มีข้อมูล',
              newValue: normDob,
              rawFormValue: rawVal,
            });
          }
        }

        // 5. Citizen ID
        else if (col === 'citizen_id') {
          const cleanCitId = normVal || '';
          const currentCitId = (dbStudent.citizen_id || '').replace(/\D/g, '');
          if (cleanCitId && cleanCitId !== currentCitId) {
            diffs.push({
              field: 'citizen_id',
              labelTh: 'เลขประจำตัวประชาชน',
              oldValue: currentCitId || 'ยังไม่มีข้อมูล',
              newValue: cleanCitId,
              rawFormValue: rawVal,
            });
          }
        }

        // 6. Height
        else if (col === 'height') {
          if (normVal !== null && normVal !== dbStudent.height) {
            diffs.push({
              field: 'height',
              labelTh: `${labelTh} (ซม.)`,
              oldValue: dbStudent.height ? `${dbStudent.height} ซม.` : 'ยังไม่มีข้อมูล',
              newValue: `${normVal} ซม.`,
              rawFormValue: rawVal,
            });
          }
        }

        // 7. Weight
        else if (col === 'weight') {
          if (normVal !== null && normVal !== dbStudent.weight) {
            diffs.push({
              field: 'weight',
              labelTh: `${labelTh} (กก.)`,
              oldValue: dbStudent.weight ? `${dbStudent.weight} กก.` : 'ยังไม่มีข้อมูล',
              newValue: `${normVal} กก.`,
              rawFormValue: rawVal,
            });
          }
        }

        // 8. Disability
        else if (col === 'disability') {
          const strVal = String(normVal || '').trim();
          if (strVal && strVal !== (dbStudent.disability || '')) {
            diffs.push({
              field: 'disability',
              labelTh: 'ความพิการ/ข้อจำกัด',
              oldValue: dbStudent.disability || 'ไม่มีข้อมูล',
              newValue: strVal,
              rawFormValue: rawVal,
            });
          }
        }

        // 9. Religion
        else if (col === 'religion') {
          const strVal = String(normVal || '').trim();
          if (strVal && strVal !== (dbStudent.religion || '')) {
            diffs.push({
              field: 'religion',
              labelTh: 'ศาสนา',
              oldValue: dbStudent.religion || 'ไม่มีข้อมูล',
              newValue: strVal,
              rawFormValue: rawVal,
            });
          }
        }

        // 10. Gender
        else if (col === 'gender') {
          const strVal = String(normVal || '').trim();
          if (strVal && strVal !== (dbStudent.gender || '')) {
            diffs.push({
              field: 'gender',
              labelTh: 'เพศ',
              oldValue: dbStudent.gender || 'ไม่มีข้อมูล',
              newValue: strVal,
              rawFormValue: rawVal,
            });
          }
        }
      }

      if (diffs.length > 0) {
        syncItems.push({
          responseId: resp.id,
          submittedAt: resp.submitted_at,
          syncType: 'update_existing',
          studentId: dbStudent.id,
          studentName: dbStudent.name,
          studentGrade: dbStudent.grade,
          diffs,
          isAlreadySynced,
          syncedAt,
        });
      }
    }
    // Case B: Admission or Unmatched Student (Create New / Admission)
    else if (isAdmissionForm) {
      let nameVal = '';
      let gradeVal = '';
      let citizenIdVal = '';
      let genderVal = '';
      let birthDateVal = '';
      let allergiesVal = '';
      let medVal = '';
      let phoneVal = '';

      for (const [fKey, col] of columnMapping.entries()) {
        const val = rawAnswers[fKey];
        if (!val) continue;
        if (col === 'name') nameVal = String(val).trim();
        if (col === 'grade') gradeVal = normalizeStudentFieldValue('grade', val);
        if (col === 'citizen_id') citizenIdVal = normalizeStudentFieldValue('citizen_id', val);
        if (col === 'gender') genderVal = normalizeStudentFieldValue('gender', val);
        if (col === 'birth_date') birthDateVal = normalizeStudentFieldValue('birth_date', val);
        if (col === 'allergies') allergiesVal = normalizeStudentFieldValue('allergies', val);
        if (col === 'medical_conditions') medVal = normalizeStudentFieldValue('medical_conditions', val);
        if (col === 'parent_phone') phoneVal = normalizeStudentFieldValue('parent_phone', val);
      }

      if (nameVal) {
        syncItems.push({
          responseId: resp.id,
          submittedAt: resp.submitted_at,
          syncType: 'create_new',
          studentName: nameVal,
          studentGrade: gradeVal || 'อ.1/1',
          diffs: [
            {
              field: 'name',
              labelTh: 'ชื่อ-นามสกุล',
              oldValue: 'นักเรียนใหม่ (ยังไม่มีในระบบ)',
              newValue: nameVal,
            },
            {
              field: 'grade',
              labelTh: 'ระดับชั้นที่สมัคร',
              oldValue: '-',
              newValue: gradeVal || 'อ.1/1',
            },
            ...(allergiesVal
              ? [
                  {
                    field: 'allergies',
                    labelTh: 'ประวัติการแพ้อาหาร/ยา',
                    oldValue: '-',
                    newValue: allergiesVal,
                  },
                ]
              : []),
            ...(phoneVal
              ? [
                  {
                    field: 'parent_phone',
                    labelTh: 'เบอร์โทรผู้ปกครอง',
                    oldValue: '-',
                    newValue: phoneVal,
                  },
                ]
              : []),
          ],
          newStudentPayload: {
            name: nameVal,
            grade: gradeVal || 'อ.1/1',
            citizen_id: citizenIdVal || undefined,
            gender: genderVal || undefined,
            birth_date: birthDateVal || undefined,
            allergies: allergiesVal || undefined,
            medical_conditions: medVal || undefined,
            parent_phone: phoneVal || undefined,
            status: 'นักเรียนเข้าใหม่',
          },
          isAlreadySynced,
          syncedAt,
        });
      }
    }
  }

  return syncItems;
}

