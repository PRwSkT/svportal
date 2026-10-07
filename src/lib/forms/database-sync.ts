import { FormDefinition, FormField, FormResponse, Student } from '@/types';

export interface FieldDiff {
  field: string;
  labelTh: string;
  oldValue: any;
  newValue: any;
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
  };
  isAlreadySynced?: boolean;
  syncedAt?: string | null;
}

/**
 * Identifies if a field label corresponds to a student database column
 */
export function mapFieldToStudentColumn(label: string, fieldKey: string): string | null {
  const text = `${label} ${fieldKey}`.toLowerCase();

  if (text.includes('รหัสนักเรียน') || text === 'student_id') return 'student_id';
  if (text.includes('ส่วนสูง') || text.includes('ความสูง') || text === 'height') return 'height';
  if (text.includes('น้ำหนัก') || text === 'weight') return 'weight';
  if (text.includes('โรคประจำตัว') || text.includes('แพ้อาหาร') || text.includes('แพ้ยา') || text.includes('ข้อจำกัดสุขภาพ') || text === 'disability') return 'disability';
  if (text.includes('ศาสนา') || text === 'religion') return 'religion';
  if (text.includes('สัญชาติ') || text === 'nationality') return 'nationality';
  if (text.includes('วันเกิด') || text.includes('วันเดือนปีเกิด') || text === 'birth_date') return 'birth_date';
  if (text.includes('เพศ') || text === 'gender') return 'gender';
  if (text.includes('เบอร์โทร') || text.includes('เบอร์ผู้ปกครอง') || text.includes('เบอร์ติดต่อ') || text === 'phone') return 'parent_phone';
  if (text.includes('ระดับชั้น') || text.includes('ห้องเรียน') || text === 'grade') return 'grade';
  if (text.includes('ชื่อนักเรียน') || text.includes('ชื่อ-นามสกุลนักเรียน') || text === 'student_name') return 'name';
  if (text.includes('เลขบัตรประชาชน') || text.includes('เลขประจำตัวประชาชน') || text === 'citizen_id') return 'citizen_id';

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
  existingStudentsMap: Map<string, any>
): PendingStudentSyncItem[] {
  const syncItems: PendingStudentSyncItem[] = [];

  // 1. Build Field to Column Mapping
  const columnMapping = new Map<string, string>(); // field_key -> db column
  for (const f of fields) {
    const lbl = f.label?.th || f.label?.en || f.field_key;
    const col = mapFieldToStudentColumn(lbl, f.field_key);
    if (col) {
      columnMapping.set(f.field_key, col);
    }
  }

  // Find Student ID field key
  let studentIdFieldKey: string | null = null;
  for (const [fKey, col] of columnMapping.entries()) {
    if (col === 'student_id') {
      studentIdFieldKey = fKey;
      break;
    }
  }

  const isAdmissionForm = form.category === 'admission' || (form.title?.th || '').includes('รับสมัคร');

  for (const resp of responses) {
    const rawAnswers = resp.answers || {};
    const isAlreadySynced = Boolean(rawAnswers._db_synced_at);
    const syncedAt = rawAnswers._db_synced_at || null;

    const rawSid = studentIdFieldKey ? rawAnswers[studentIdFieldKey] : null;
    const cleanSid = rawSid ? String(rawSid).trim() : null;

    // Case A: Existing student record found by ID
    if (cleanSid && existingStudentsMap.has(cleanSid)) {
      const dbStudent = existingStudentsMap.get(cleanSid);
      const diffs: FieldDiff[] = [];

      for (const [fKey, col] of columnMapping.entries()) {
        if (col === 'student_id') continue;
        const formVal = rawAnswers[fKey];
        if (formVal === undefined || formVal === null || formVal === '') continue;

        const fieldDef = fields.find((f) => f.field_key === fKey);
        const labelTh = fieldDef?.label?.th || fKey;

        if (col === 'height') {
          const numVal = Number(formVal);
          if (!isNaN(numVal) && numVal !== dbStudent.height) {
            diffs.push({
              field: 'height',
              labelTh: `${labelTh} (ซม.)`,
              oldValue: dbStudent.height ? `${dbStudent.height} ซม.` : 'ยังไม่มีข้อมูล',
              newValue: `${numVal} ซม.`,
            });
          }
        } else if (col === 'weight') {
          const numVal = Number(formVal);
          if (!isNaN(numVal) && numVal !== dbStudent.weight) {
            diffs.push({
              field: 'weight',
              labelTh: `${labelTh} (กก.)`,
              oldValue: dbStudent.weight ? `${dbStudent.weight} กก.` : 'ยังไม่มีข้อมูล',
              newValue: `${numVal} กก.`,
            });
          }
        } else if (col === 'disability') {
          const strVal = String(formVal).trim();
          if (strVal && strVal !== (dbStudent.disability || '')) {
            diffs.push({
              field: 'disability',
              labelTh: `${labelTh}`,
              oldValue: dbStudent.disability || 'ไม่มีข้อมูล',
              newValue: strVal,
            });
          }
        } else if (col === 'religion') {
          const strVal = String(formVal).trim();
          if (strVal && strVal !== (dbStudent.religion || '')) {
            diffs.push({
              field: 'religion',
              labelTh,
              oldValue: dbStudent.religion || 'ไม่มีข้อมูล',
              newValue: strVal,
            });
          }
        } else if (col === 'parent_phone') {
          const strVal = String(formVal).replace(/[-\s]/g, '').trim();
          const currentParentPhone = dbStudent.student_parents?.[0]?.phone_number
            ? String(dbStudent.student_parents[0].phone_number).replace(/[-\s]/g, '').trim()
            : '';
          if (strVal && strVal !== currentParentPhone) {
            diffs.push({
              field: 'parent_phone',
              labelTh: 'เบอร์โทรผู้ปกครอง',
              oldValue: currentParentPhone || 'ไม่มีข้อมูล',
              newValue: strVal,
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
    // Case B: Admission / New Student application (no existing ID in DB)
    else if (isAdmissionForm || (!cleanSid && rawAnswers.student_name)) {
      let nameVal = '';
      let gradeVal = '';
      let citizenIdVal = '';
      let genderVal = '';
      let birthDateVal = '';

      for (const [fKey, col] of columnMapping.entries()) {
        const val = rawAnswers[fKey];
        if (!val) continue;
        if (col === 'name') nameVal = String(val).trim();
        if (col === 'grade') gradeVal = String(val).trim();
        if (col === 'citizen_id') citizenIdVal = String(val).replace(/[-\s]/g, '').trim();
        if (col === 'gender') genderVal = String(val).trim();
        if (col === 'birth_date') birthDateVal = String(val).trim();
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
          ],
          newStudentPayload: {
            name: nameVal,
            grade: gradeVal || 'อ.1/1',
            citizen_id: citizenIdVal || undefined,
            gender: genderVal || undefined,
            birth_date: birthDateVal || undefined,
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
