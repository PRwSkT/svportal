import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { cleanThaiName } from './database-sync';

export interface CleansingDiff {
  fieldKey: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  reason: string;
  source: 'database_enrichment' | 'normalization';
}

export interface ResponseCleansingItem {
  responseId: string;
  studentName: string;
  matchedStudentId: string | null;
  changes: CleansingDiff[];
  cleanedAnswers: Record<string, any>;
  isAlreadyCleaned: boolean;
}

export interface FormCleansingAnalysis {
  formId: string;
  formTitle: string;
  totalResponses: number;
  totalNeedingCleansing: number;
  items: ResponseCleansingItem[];
  stats: {
    studentIdsEnriched: number;
    phonesFormatted: number;
    namesCleaned: number;
    allergiesStandardized: number;
    classroomsAligned: number;
  };
}

/**
 * ฟังก์ชันแยกและจัดรูปแบบที่อยู่ภาษาไทยอย่างละเอียด
 */
export function parseThaiAddress(raw: string) {
  if (!raw) return null;
  let text = raw.replace(/\s+/g, ' ').trim();

  // 1. รหัสไปรษณีย์ 5 หลัก
  let zip_code = '';
  const zipMatch = text.match(/\b(1[0-9]{4}|2[0-9]{4}|3[0-9]{4}|4[0-9]{4}|5[0-9]{4}|6[0-9]{4}|7[0-9]{4}|8[0-9]{4}|9[0-9]{4})\b/);
  if (zipMatch) {
    zip_code = zipMatch[1];
    text = text.replace(zipMatch[0], '').trim();
  }

  // 2. จังหวัด
  let province = 'ระยอง';
  const provMatch = text.match(/(?:จังหวัด|จ\.)\s*([ก-๙]+)/);
  if (provMatch) {
    province = provMatch[1].trim();
    text = text.replace(provMatch[0], '').trim();
  } else if (text.includes('ระยอง')) {
    province = 'ระยอง';
    text = text.replace(/ระยอง/g, '').trim();
  }

  // 3. อำเภอ / เขต
  let district = '';
  const distMatch = text.match(/(?:อำเภอ|เขต|อ\.)\s*([ก-๙]+)/);
  if (distMatch) {
    district = distMatch[1].trim();
    text = text.replace(distMatch[0], '').trim();
  }

  // 4. ตำบล / แขวง
  let sub_district = '';
  const subMatch = text.match(/(?:ตำบล\.|ตำบล|แขวง|ต\.)\s*([ก-๙]+)/);
  if (subMatch) {
    sub_district = subMatch[1].trim();
    text = text.replace(subMatch[0], '').trim();
  }

  // 5. หมู่
  let moo = '';
  const mooMatch = text.match(/(?:หมู่ที่|หมู่|ม\.)\s*(\d+)/i);
  if (mooMatch) {
    moo = mooMatch[1].trim();
    text = text.replace(mooMatch[0], '').trim();
  }

  // 6. ซอย
  let soi = '';
  const soiMatch = text.match(/(?:ซอย|ซ\.)\s*([ก-๙0-9/]+)/i);
  if (soiMatch) {
    soi = soiMatch[1].trim();
    text = text.replace(soiMatch[0], '').trim();
  }

  // 7. ถนน
  let road = '';
  const roadMatch = text.match(/(?:ถนน|ถ\.)\s*([ก-๙0-9]+)/);
  if (roadMatch) {
    road = roadMatch[1].trim();
    text = text.replace(roadMatch[0], '').trim();
  }

  // 8. บ้านเลขที่
  let house_number = '';
  const houseMatch = text.match(/^([0-9/]+(?:\s*[0-9/]+)*)/);
  if (houseMatch) {
    house_number = houseMatch[1].trim();
  }

  return {
    house_number,
    moo,
    soi,
    road,
    sub_district,
    district,
    province,
    zip_code,
    full_address: raw.trim(),
  };
}

/**
 * วิเคราะห์และทำความสะอาดผลการตอบกลับของแบบฟอร์ม
 * 1. ดึงข้อมูลนักเรียนจากฐานข้อมูลมาเติมฟิลด์ที่หายไปหรือผิด เช่น รหัสนักเรียน ระดับชั้น
 * 2. ปรับฟอร์แมตเบอร์โทรศัพท์ วันเกิด ชื่อ และประวัติการแพ้ให้อยู่ในมาตรฐานเดียวกัน
 */
export async function analyzeAndCleanseFormResponses(formId: string): Promise<FormCleansingAnalysis> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase admin client not initialized');
  }

  // 1. Fetch form & fields
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('id, title, fields:form_fields(*)')
    .eq('id', formId)
    .single();

  if (formErr || !form) {
    throw new Error(`ไม่พบแบบฟอร์ม: ${formErr?.message || 'Not found'}`);
  }

  const fields = (form.fields || []) as any[];
  const fieldLabelMap: Record<string, string> = {};
  const fieldOptionsMap: Record<string, any[]> = {};
  for (const f of fields) {
    const label = typeof f.label === 'object' ? f.label.th || f.label.en : f.label;
    fieldLabelMap[f.id] = label;
    if (f.field_key) {
      fieldLabelMap[f.field_key] = label;
      if (Array.isArray(f.options)) {
        fieldOptionsMap[f.field_key] = f.options;
      }
    }
    if (Array.isArray(f.options)) {
      fieldOptionsMap[f.id] = f.options;
    }
  }

  // 2. Fetch all responses
  const { data: responses, error: respErr } = await supabase
    .from('form_responses')
    .select('id, answers, submitted_at')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false });

  if (respErr || !responses) {
    throw new Error(`ไม่สามารถดึงข้อมูลการตอบกลับได้: ${respErr?.message}`);
  }

  // 3. Fetch full school student database
  const { data: students } = await supabase
    .from('students')
    .select('id, student_id, name, grade, classroom, citizen_id, birth_date, nickname, gender, prefix, allergies, medical_conditions');

  const studentList = students || [];

  // Helper matching
  function findMatchingStudent(answers: Record<string, any>) {
    // 1. Check student ID direct match
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === 'string' && /^\d{4,5}$/.test(v.trim())) {
        const found = studentList.find(s => s.id === v.trim() || s.student_id === v.trim());
        if (found) return found;
      }
    }

    // 2. Check citizen ID
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === 'string') {
        const cleanDigits = v.replace(/\D/g, '');
        if (cleanDigits.length === 13) {
          const found = studentList.find(s => s.citizen_id === cleanDigits || s.id === cleanDigits);
          if (found) return found;
        }
      }
    }

    // 3. Check student Thai Name
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === 'string' && v.trim().length > 4) {
        const key = k.toLowerCase();
        if (key.includes('parent') || key.includes('ผู้ปกครอง')) continue;

        const candidateName = cleanThaiName(v);
        const found = studentList.find(s => {
          const sName = cleanThaiName(s.name);
          return (
            sName === candidateName ||
            (candidateName.length > 5 && sName.includes(candidateName)) ||
            (candidateName.length > 5 && candidateName.includes(sName))
          );
        });
        if (found) return found;
      }
    }

    return null;
  }

  const items: ResponseCleansingItem[] = [];
  let studentIdsEnriched = 0;
  let phonesFormatted = 0;
  let namesCleaned = 0;
  let allergiesStandardized = 0;
  let classroomsAligned = 0;

  for (const resp of responses) {
    const rawAnswers = (resp.answers || {}) as Record<string, any>;
    const cleanedAnswers = { ...rawAnswers };
    const changes: CleansingDiff[] = [];

    const matchedStudent = findMatchingStudent(rawAnswers);

    // Identify key fields in answers
    for (const [key, val] of Object.entries(rawAnswers)) {
      if (key.startsWith('_')) continue;
      const lowerKey = key.toLowerCase();
      const label = fieldLabelMap[key] || key;

      // 1. Student ID Cleansing & Enrichment
      if (
        lowerKey.includes('student_id') ||
        lowerKey.includes('studentid') ||
        label.includes('รหัสนักเรียน') ||
        label.includes('เลขประจำตัวนักเรียน')
      ) {
        const valStr = typeof val === 'string' ? val.trim() : '';
        const isInvalidId = !valStr || valStr.length > 6 || !/^[A-Za-z]?\d{4,5}$/.test(valStr);

        if (isInvalidId && matchedStudent) {
          const correctId = matchedStudent.student_id || matchedStudent.id;
          if (correctId && correctId !== valStr) {
            changes.push({
              fieldKey: key,
              fieldLabel: label,
              oldValue: valStr || '(ว่าง)',
              newValue: correctId,
              reason: `ดึงรหัสนักเรียนที่ถูกต้อง (${correctId}) จากฐานข้อมูลโรงเรียน`,
              source: 'database_enrichment',
            });
            cleanedAnswers[key] = correctId;
            studentIdsEnriched++;
          }
        }
      }

      // If form didn't have student_id field at all, but matched student exists
      // we check if field_student_id exists in form fields
      const hasStudentIdField = Object.keys(rawAnswers).some(
        k => k.toLowerCase().includes('student_id') || (fieldLabelMap[k] && fieldLabelMap[k].includes('รหัสนักเรียน'))
      );
      if (!hasStudentIdField && matchedStudent) {
        // Find if there is a student id field in form definition
        const idField = fields.find(f => {
          const l = (typeof f.label === 'object' ? f.label.th || f.label.en : f.label) || '';
          const fKey = f.field_key || f.id || '';
          return l.includes('รหัสนักเรียน') || l.includes('เลขประจำตัวนักเรียน') || fKey.includes('student_id');
        });
        const targetIdKey = idField ? (idField.field_key || idField.id) : null;
        if (targetIdKey && !cleanedAnswers[targetIdKey]) {
          const correctId = matchedStudent.student_id || matchedStudent.id;
          changes.push({
            fieldKey: targetIdKey,
            fieldLabel: fieldLabelMap[targetIdKey] || 'เลขประจำตัวนักเรียน',
            oldValue: '(ว่าง)',
            newValue: correctId,
            reason: `ดึงรหัสนักเรียน (${correctId}) จากฐานข้อมูลมาใส่ในช่องรหัสนักเรียน`,
            source: 'database_enrichment',
          });
          cleanedAnswers[targetIdKey] = correctId;
          studentIdsEnriched++;
        }
      }

      // 2. Phone Numbers Normalization
      if (
        typeof val === 'string' &&
        (lowerKey.includes('phone') || lowerKey.includes('tel') || lowerKey.includes('mobile') || label.includes('โทรศัพท์') || label.includes('เบอร์'))
      ) {
        const digits = val.replace(/\D/g, '');
        if (digits.length === 10 && digits.startsWith('0') && val !== digits) {
          changes.push({
            fieldKey: key,
            fieldLabel: label,
            oldValue: val,
            newValue: digits,
            reason: 'ตัดขีดและช่องว่าง จัดรูปแบบเบอร์โทรศัพท์มาตรฐาน 10 หลัก',
            source: 'normalization',
          });
          cleanedAnswers[key] = digits;
          phonesFormatted++;
        }
      }

      // 3. Thai Name Spacing Cleansing
      if (
        typeof val === 'string' &&
        val.length > 3 &&
        (lowerKey.includes('fullname') || lowerKey.includes('name') || label.includes('ชื่อ')) &&
        !lowerKey.includes('nickname') &&
        !label.includes('ชื่อเล่น') &&
        !lowerKey.includes('eng')
      ) {
        // Remove duplicate spaces and zero-width spaces
        const trimmed = val.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
        if (trimmed !== val) {
          changes.push({
            fieldKey: key,
            fieldLabel: label,
            oldValue: val,
            newValue: trimmed,
            reason: 'ตัดช่องว่างซ้ำซ้อน จัดวรรคชื่อ-นามสกุลให้ถูกต้อง',
            source: 'normalization',
          });
          cleanedAnswers[key] = trimmed;
          namesCleaned++;
        }
      }

      // 4. Allergies & Medical Conditions Standardization
      if (
        typeof val === 'string' &&
        (lowerKey.includes('allerg') || lowerKey.includes('congenital') || label.includes('แพ้') || label.includes('โรคประจำตัว'))
      ) {
        const trimmedVal = val.trim();
        const isNegative =
          trimmedVal === 'ไม่มี' ||
          trimmedVal === 'ไม่ม่' ||
          trimmedVal === 'ไม่แพ้' ||
          trimmedVal === 'ไม่มีค่ะ' ||
          trimmedVal === 'ไม่มีครับ' ||
          trimmedVal === 'ยังไม่พบ' ||
          trimmedVal === 'ยังไม่พบว่าแพ้ยา' ||
          trimmedVal === 'ปกติ' ||
          trimmedVal === '-' ||
          trimmedVal.toLowerCase() === 'none' ||
          trimmedVal === 'ไม่มีโรคประจำตัว';

        if (isNegative && trimmedVal !== 'ไม่มี') {
          changes.push({
            fieldKey: key,
            fieldLabel: label,
            oldValue: val,
            newValue: 'ไม่มี',
            reason: 'ปรับคำตอบปฏิเสธให้เป็นมาตรฐานเดียวกัน ("ไม่มี")',
            source: 'normalization',
          });
          cleanedAnswers[key] = 'ไม่มี';
          allergiesStandardized++;
        }
      }

      // 5. Classroom / Level Alignment (preserve actual classroom selected in form!)
      if (
        typeof val === 'string' &&
        (lowerKey.includes('level') || lowerKey.includes('grade') || lowerKey.includes('class') || label.includes('ระดับชั้น') || label.includes('ห้อง'))
      ) {
        const rawLevel = val.trim();
        const opts = fieldOptionsMap[key] || [];
        let normalizedLevel = rawLevel;

        if (opts.length > 0) {
          // If the form field defines select options, normalize text/DB grade to the form option value
          const exactOpt = opts.find((o: any) => o.value === rawLevel);
          if (!exactOpt) {
            const labelMatch = opts.find(
              (o: any) => o.label?.th === rawLevel || o.label?.en === rawLevel
            );
            if (labelMatch) {
              normalizedLevel = labelMatch.value;
            } else {
              const dbToOptMap: Record<string, string> = {
                'อ.1': 'kg1', 'อ.1/1': 'kg1',
                'อ.2': 'kg2', 'อ.2/1': 'kg2',
                'อ.3': 'kg3', 'อ.3/1': 'kg3',
                'ป.1': 'p1', 'ป.1/1': 'p1',
                'ป.2': 'p2', 'ป.2/1': 'p2',
                'ป.3/1': 'p3_1', 'ป.3/2': 'p3_2',
                'ป.4/1': 'p4_1', 'ป.4/2': 'p4_2',
                'ป.5/1': 'p5_1', 'ป.5/2': 'p5_2',
                'ป.6/1': 'p6_1', 'ป.6/2': 'p6_2',
              };
              if (dbToOptMap[rawLevel]) normalizedLevel = dbToOptMap[rawLevel];
            }
          }
        } else {
          // Map option code to DB grade format (keeping the form's room /1 or /2)
          const optToDbMap: Record<string, string> = {
            nursery: 'ต.อ.1/1',
            kg1: 'อ.1/1',
            kg2: 'อ.2/1',
            kg3: 'อ.3/1',
            p1: 'ป.1/1', p1_1: 'ป.1/1',
            p2: 'ป.2/1', p2_1: 'ป.2/1',
            p3_1: 'ป.3/1', p3_2: 'ป.3/2',
            p4_1: 'ป.4/1', p4_2: 'ป.4/2',
            p5_1: 'ป.5/1', p5_2: 'ป.5/2',
            p6_1: 'ป.6/1', p6_2: 'ป.6/2',
          };
          if (optToDbMap[rawLevel]) normalizedLevel = optToDbMap[rawLevel];
        }

        if (normalizedLevel !== rawLevel) {
          changes.push({
            fieldKey: key,
            fieldLabel: label,
            oldValue: rawLevel,
            newValue: normalizedLevel,
            reason: `ปรับรหัสระดับชั้นให้อยู่ในฟอร์แมตมาตรฐาน (${normalizedLevel})`,
            source: 'normalization',
          });
          cleanedAnswers[key] = normalizedLevel;
          classroomsAligned++;
        }
      }

      // 6. Birth Date Format Normalization & Alignment with Original Student Database
      if (
        typeof val === 'string' &&
        (lowerKey.includes('dob') || lowerKey.includes('birth') || label.includes('วันเกิด') || label.includes('วัน เดือน ปี เกิด'))
      ) {
        const valStr = val.trim();
        const dbDob = matchedStudent?.birth_date ? String(matchedStudent.birth_date).slice(0, 10) : '';

        if (dbDob && dbDob !== valStr) {
          changes.push({
            fieldKey: key,
            fieldLabel: label,
            oldValue: valStr,
            newValue: dbDob,
            reason: `อ้างอิงวันเดือนปีเกิดตามข้อมูลทะเบียนนักเรียนเดิม (${dbDob}) เพื่อป้องกันความคลาดเคลื่อนจากการกรอกของผู้ปกครอง`,
            source: 'database_enrichment',
          });
          cleanedAnswers[key] = dbDob;
        } else {
          // Check if BE year like 2555-08-20 or 20/08/2555
          const beYearMatch = valStr.match(/\b(25[0-9]{2})\b/);
          if (beYearMatch) {
            const beYear = parseInt(beYearMatch[1], 10);
            const ceYear = beYear - 543;
            const ceDateStr = valStr.replace(beYearMatch[1], ceYear.toString());
            changes.push({
              fieldKey: key,
              fieldLabel: label,
              oldValue: valStr,
              newValue: ceDateStr,
              reason: `แปลงปี พ.ศ. (${beYear}) เป็น ค.ศ. (${ceYear}) ตามมาตรฐาน ISO`,
              source: 'normalization',
            });
            cleanedAnswers[key] = ceDateStr;
          }
        }
      }
    }

    const studentName =
      matchedStudent?.name ||
      rawAnswers.field_student_fullname ||
      rawAnswers.student_name ||
      'ไม่ระบุชื่อนักเรียน';

    items.push({
      responseId: resp.id,
      studentName,
      matchedStudentId: matchedStudent?.student_id || matchedStudent?.id || null,
      changes,
      cleanedAnswers,
      isAlreadyCleaned: Boolean(rawAnswers._cleansed_at) || changes.length === 0,
    });
  }

  const totalNeedingCleansing = items.filter(i => i.changes.length > 0 && !i.isAlreadyCleaned).length;

  return {
    formId,
    formTitle: typeof form.title === 'object' ? form.title.th || form.title.en : form.title,
    totalResponses: responses.length,
    totalNeedingCleansing,
    items,
    stats: {
      studentIdsEnriched,
      phonesFormatted,
      namesCleaned,
      allergiesStandardized,
      classroomsAligned,
    },
  };
}

/**
 * ดำเนินการอัพเดตคำตอบที่ผ่านการ Cleanse เข้าสู่ตาราง form_responses ใน Supabase
 */
export async function executeCleanseFormResponses(
  formId: string,
  responseItems: { responseId: string; cleanedAnswers: Record<string, any> }[]
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase admin client not initialized');
  }

  const results: { responseId: string; success: boolean; error?: string }[] = [];
  const nowIso = new Date().toISOString();

  for (const item of responseItems) {
    try {
      const answersToSave = {
        ...item.cleanedAnswers,
        _cleansed_at: nowIso,
      };

      const { error } = await supabase
        .from('form_responses')
        .update({ answers: answersToSave })
        .eq('id', item.responseId)
        .eq('form_id', formId);

      if (error) {
        results.push({ responseId: item.responseId, success: false, error: error.message });
      } else {
        results.push({ responseId: item.responseId, success: true });
      }
    } catch (err: any) {
      results.push({ responseId: item.responseId, success: false, error: err?.message });
    }
  }

  const totalSuccess = results.filter(r => r.success).length;
  const totalFailed = results.filter(r => !r.success).length;

  return {
    success: totalFailed === 0,
    totalSuccess,
    totalFailed,
    results,
    message: `ทำความสะอาดและปรับฟอร์แมตข้อมูลสำเร็จ ${totalSuccess} รายการ${totalFailed > 0 ? ` (ไม่สำเร็จ ${totalFailed} รายการ)` : ''}`,
  };
}
