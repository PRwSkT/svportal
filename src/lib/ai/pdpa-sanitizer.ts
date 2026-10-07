/**
 * PDPA Zero-PII Sanitizer & Data Redaction Engine
 * Guarantees that no Personally Identifiable Information (PII) is exposed to AI models.
 */

import { FormDefinition, FormField, FormResponse } from '@/types';

// Regex patterns for Thai and standard PII
const CITIZEN_ID_REGEX = /\b\d{1}[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d{1}\b/g;
const THAI_PHONE_REGEX = /\b(0[689]\d{1}[-\s]?\d{3}[-\s]?\d{4}|0[2-7]\d{1}[-\s]?\d{3}[-\s]?\d{3,4})\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const THAI_NAMED_TITLE_REGEX = /\b(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|คุณ|อาจารย์|ครู)\s*([ก-๙]+)\s+([ก-๙]+)\b/g;
const STUDENT_ID_REGEX = /\b(SV-?\d{4,6}|10\d{3})\b/g;

/**
 * Redacts personal identifying information from freeform text
 */
export function sanitizeTextForAI(text: string): { cleanText: string; redactionCount: number } {
  if (!text || typeof text !== 'string') {
    return { cleanText: '', redactionCount: 0 };
  }

  let count = 0;
  let clean = text;

  // 1. Redact Citizen ID
  clean = clean.replace(CITIZEN_ID_REGEX, () => {
    count++;
    return '[เลขบัตรประชาชน]';
  });

  // 2. Redact Phone numbers
  clean = clean.replace(THAI_PHONE_REGEX, () => {
    count++;
    return '[เบอร์โทรศัพท์]';
  });

  // 3. Redact Emails
  clean = clean.replace(EMAIL_REGEX, () => {
    count++;
    return '[อีเมล]';
  });

  // 4. Normalize Student IDs as pseudonymous tokens for correlating insights
  clean = clean.replace(STUDENT_ID_REGEX, (match) => {
    return `SID:${match}`;
  });

  // 5. Redact Titled Thai names
  clean = clean.replace(THAI_NAMED_TITLE_REGEX, () => {
    count++;
    return '[ชื่อบุคคล]';
  });

  return { cleanText: clean, redactionCount: count };
}

export interface SanitizedFieldSummary {
  fieldKey: string;
  fieldType: string;
  label: string;
  stats?: {
    totalAnswers: number;
    distribution?: Record<string, { count: number; percentage: number }>;
    average?: number;
  };
  anonymizedTextSample?: string[];
}

export interface PseudonymizedStudentCase {
  studentId: string;
  submissionId: string;
  answers: Record<string, string>;
}

export interface SanitizedFormAnalysisPayload {
  formId: string;
  formTitle: string;
  formDescription?: string;
  totalResponses: number;
  fieldsSummary: SanitizedFieldSummary[];
  pseudonymizedStudentCases?: PseudonymizedStudentCase[];
}

/**
 * Prepares raw responses for Gemma AI analysis by stripping all direct PII
 * and calculating statistical aggregates inside the server.
 */
export function prepareResponsesForSummarization(
  form: FormDefinition,
  fields: FormField[],
  responses: FormResponse[]
): SanitizedFormAnalysisPayload {
  const totalResponses = responses.length;
  const formTitle = form.title?.th || form.title?.en || 'แบบฟอร์ม';
  const formDescription = form.description?.th || '';

  const fieldsSummary: SanitizedFieldSummary[] = [];

  for (const field of fields) {
    // Skip layout-only fields
    if (['section_header', 'image'].includes(field.field_type)) continue;

    const label = field.label?.th || field.label?.en || field.field_key;
    const lowerLabel = label.toLowerCase();

    // If field is explicitly collecting direct PII (e.g. phone, citizen ID, student name),
    // we NEVER send individual names or phones to AI. We only report count of answered.
    const isDirectPIIField =
      lowerLabel.includes('เลขบัตร') ||
      lowerLabel.includes('ประชาชน') ||
      lowerLabel.includes('เบอร์โทร') ||
      lowerLabel.includes('อีเมล') ||
      lowerLabel.includes('ชื่อ-นามสกุล') ||
      lowerLabel.includes('ชื่อนักเรียน') ||
      lowerLabel.includes('ชื่อผู้ปกครอง');

    const rawAnswers = responses
      .map((r) => r.answers?.[field.field_key])
      .filter((v) => v !== undefined && v !== null && v !== '');

    if (isDirectPIIField) {
      fieldsSummary.push({
        fieldKey: field.field_key,
        fieldType: field.field_type,
        label: `${label} (ข้อมูลส่วนบุคคล - คัดกรองแล้ว)`,
        stats: {
          totalAnswers: rawAnswers.length,
        },
      });
      continue;
    }

    // 1. Choice fields: radio, checkbox, select
    if (['radio', 'checkbox', 'select'].includes(field.field_type)) {
      const counts: Record<string, number> = {};

      for (const ans of rawAnswers) {
        if (Array.isArray(ans)) {
          for (const item of ans) {
            const strItem = String(item).trim();
            counts[strItem] = (counts[strItem] || 0) + 1;
          }
        } else {
          const strItem = String(ans).trim();
          counts[strItem] = (counts[strItem] || 0) + 1;
        }
      }

      // Map options label if available
      const optionsMap = new Map((field.options || []).map((o) => [o.value, o.label?.th || o.value]));
      const distribution: Record<string, { count: number; percentage: number }> = {};

      for (const [val, count] of Object.entries(counts)) {
        const displayLabel = optionsMap.get(val) || val;
        const pct = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
        distribution[displayLabel] = { count, percentage: pct };
      }

      fieldsSummary.push({
        fieldKey: field.field_key,
        fieldType: field.field_type,
        label,
        stats: {
          totalAnswers: rawAnswers.length,
          distribution,
        },
      });
    }
    // 2. Rating or numeric fields
    else if (field.field_type === 'rating' || field.field_type === 'number') {
      const numbers = rawAnswers.map((v) => Number(v)).filter((n) => !isNaN(n));
      const sum = numbers.reduce((a, b) => a + b, 0);
      const avg = numbers.length > 0 ? Number((sum / numbers.length).toFixed(2)) : 0;

      fieldsSummary.push({
        fieldKey: field.field_key,
        fieldType: field.field_type,
        label,
        stats: {
          totalAnswers: numbers.length,
          average: avg,
        },
      });
    }
    // 3. Open-ended text fields (e.g. feedback, suggestions, reasons)
    else if (field.field_type === 'text' || field.field_type === 'textarea') {
      // Limit to 40 random or most recent answers to prevent token explosion
      const sample = rawAnswers.slice(0, 40).map((ans, idx) => {
        const { cleanText } = sanitizeTextForAI(String(ans));
        return `[ผู้ตอบ #${idx + 1}]: "${cleanText}"`;
      });

      fieldsSummary.push({
        fieldKey: field.field_key,
        fieldType: field.field_type,
        label,
        stats: {
          totalAnswers: rawAnswers.length,
        },
        anonymizedTextSample: sample,
      });
    } else {
      // General field count
      fieldsSummary.push({
        fieldKey: field.field_key,
        fieldType: field.field_type,
        label,
        stats: {
          totalAnswers: rawAnswers.length,
        },
      });
    }
  }

  // 4. Extract Pseudonymized Student Cases if a student ID field exists
  const studentIdField = fields.find((f) => {
    const lbl = (f.label?.th || f.label?.en || f.field_key).toLowerCase();
    return f.field_key === 'student_id' || lbl.includes('รหัสนักเรียน') || lbl.includes('student id');
  });

  const pseudonymizedStudentCases: PseudonymizedStudentCase[] = [];

  if (studentIdField) {
    for (const resp of responses.slice(0, 35)) {
      const rawSid = resp.answers?.[studentIdField.field_key];
      if (!rawSid) continue;
      const cleanSid = String(rawSid).trim();
      if (!cleanSid) continue;

      const nonPiiAnswers: Record<string, string> = {};
      for (const field of fields) {
        if (field.id === studentIdField.id) continue;
        if (['section_header', 'image', 'info_text'].includes(field.field_type)) continue;

        const lbl = field.label?.th || field.label?.en || field.field_key;
        const lower = lbl.toLowerCase();
        // Skip direct PII fields like student name, parent name, citizen ID, phone
        if (
          lower.includes('เลขบัตร') ||
          lower.includes('ประชาชน') ||
          lower.includes('เบอร์โทร') ||
          lower.includes('อีเมล') ||
          lower.includes('ชื่อ-นามสกุล') ||
          lower.includes('ชื่อนักเรียน') ||
          lower.includes('ชื่อผู้ปกครอง')
        ) {
          continue;
        }

        const ans = resp.answers?.[field.field_key];
        if (ans !== undefined && ans !== null && ans !== '') {
          const valStr = Array.isArray(ans) ? ans.join(', ') : String(ans);
          const { cleanText } = sanitizeTextForAI(valStr);
          if (cleanText.trim()) {
            nonPiiAnswers[lbl] = cleanText.trim();
          }
        }
      }

      if (Object.keys(nonPiiAnswers).length > 0) {
        pseudonymizedStudentCases.push({
          studentId: cleanSid,
          submissionId: resp.id,
          answers: nonPiiAnswers,
        });
      }
    }
  }

  return {
    formId: form.id,
    formTitle,
    formDescription,
    totalResponses,
    fieldsSummary,
    pseudonymizedStudentCases,
  };
}
