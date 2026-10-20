/**
 * School Infirmary Hub & Outbreak Early-Warning Engine
 * (ระบบห้องพยาบาลอัจฉริยะ และระบบเตือนภัยโรคระบาดในโรงเรียน)
 * ตามมาตรฐานกระทรวงสาธารณสุข (สธ.) และสำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช.)
 */

export type ContagiousDiseaseType = 'NONE' | 'HFMD' | 'RSV' | 'INFLUENZA' | 'COVID' | 'CHICKENPOX' | 'OTHER';

export interface InfirmaryVisitRecord {
  id?: string;
  studentId: string;
  studentName?: string;
  grade?: string;
  classroom?: string;
  visitDate: string; // YYYY-MM-DD
  visitTime?: string; // HH:mm
  symptoms: string[];
  temperatureCelsius?: number;
  treatmentGiven?: string;
  medicationGiven?: string;
  diagnosedContagiousDisease: ContagiousDiseaseType;
  restInBed: boolean;
  timeLeft?: string;
  nurseTeacherName?: string;
  parentContacted: boolean;
  notes?: string;
}

export const COMMON_SYMPTOMS = [
  'ปวดศีรษะ (Headache)',
  'มีไข้ / ตัวร้อน (Fever)',
  'แผลถลอก / อุบัติเหตุเล็กน้อย (Wound / Injury)',
  'ปวดท้อง (Stomachache)',
  'คลื่นไส้ / อาเจียน (Vomiting)',
  'ท้องเสีย / ถ่ายเหลว (Diarrhea)',
  'มีผื่นคัน / ลมพิษ (Rash / Allergy)',
  'เจ็บคอ / ไอ / มีน้ำมูก (Cold / Sore throat)',
  'มีตุ่มน้ำใสที่ปาก มือ หรือเท้า (HFMD Suspect)',
  'หอบเหนื่อย / หายใจมีเสียงหวีด (Asthma Suspect)',
  'ปวดตา / ตาแดง (Conjunctivitis)'
];

export const CONTAGIOUS_DISEASES_MAP: Record<ContagiousDiseaseType, { nameTh: string; quarantineDays: number; severity: 'MEDIUM' | 'HIGH' }> = {
  NONE: { nameTh: 'ไม่มีโรคติดต่อ', quarantineDays: 0, severity: 'MEDIUM' },
  HFMD: { nameTh: 'โรคมือ เท้า ปาก (HFMD)', quarantineDays: 7, severity: 'HIGH' },
  RSV: { nameTh: 'เชื้อไวรัส RSV', quarantineDays: 7, severity: 'HIGH' },
  INFLUENZA: { nameTh: 'ไข้หวัดใหญ่ (Influenza)', quarantineDays: 5, severity: 'HIGH' },
  COVID: { nameTh: 'โรคโควิด-19 (COVID-19)', quarantineDays: 5, severity: 'HIGH' },
  CHICKENPOX: { nameTh: 'โรคอีสุกอีใส (Chickenpox)', quarantineDays: 10, severity: 'HIGH' },
  OTHER: { nameTh: 'โรคติดต่ออื่น ๆ', quarantineDays: 5, severity: 'MEDIUM' }
};

/**
 * ตรวจสอบความปลอดภัยในการจ่ายยาเทียบกับประวัติการแพ้ยาของนักเรียน (Drug Allergy Guard)
 */
export function checkMedicationAllergy(
  medication: string,
  knownAllergies: string[] = []
): { isSafe: boolean; warning?: string } {
  if (!medication || medication.trim() === '' || medication === 'ไม่จ่ายยา') {
    return { isSafe: true };
  }

  // Tokenizer helper that strips noise words (e.g. แพ้ยา, แพ้, อย่างรุนแรง, dosage units)
  const extractTokens = (str: string) => {
    return str
      .replace(/แพ้ยา|แพ้|ยา|อย่างรุนแรง|มก\.?|mg|cc|ml|\d+/gi, ' ')
      .split(/[\s,()\/]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length >= 3);
  };

  const medLower = medication.toLowerCase();
  const medTokens = extractTokens(medication);

  for (const allergy of knownAllergies) {
    const allergyLower = allergy.toLowerCase();
    const allergyTokens = extractTokens(allergy);

    // Direct substring check
    if (allergyLower && (medLower.includes(allergyLower) || allergyLower.includes(medLower))) {
      return {
        isSafe: false,
        warning: `[คำเตือนความปลอดภัย] นักเรียนมีประวัติแพ้ยาหรือสาร: "${allergy}" ซึ่งตรงกับหรือใกล้เคียงกับยาที่กำลังจะจ่าย ("${medication}")`
      };
    }

    // Token intersection check (e.g. "พาราเซตามอล" in both "พาราเซตามอล 250 มก." and "แพ้ยาพาราเซตามอลอย่างรุนแรง")
    for (const aToken of allergyTokens) {
      if (medLower.includes(aToken)) {
        return {
          isSafe: false,
          warning: `[คำเตือนความปลอดภัย] นักเรียนมีประวัติแพ้ยาหรือสาร: "${allergy}" (พบคำสำคัญ: "${aToken}") ซึ่งตรงกับยาที่กำลังจะจ่าย ("${medication}")`
        };
      }
    }

    for (const mToken of medTokens) {
      if (allergyLower.includes(mToken)) {
        return {
          isSafe: false,
          warning: `[คำเตือนความปลอดภัย] นักเรียนมีประวัติแพ้ยาหรือสาร: "${allergy}" ซึ่งตรงกับยาที่กำลังจะจ่าย ("${medication}")`
        };
      }
    }
  }

  return { isSafe: true };
}

/**
 * ประเมินภาวะไข้ตามอุณหภูมิร่างกาย (°C)
 */
export function evaluateBodyTemperature(temp?: number): {
  status: 'NORMAL' | 'LOW_FEVER' | 'HIGH_FEVER' | 'UNKNOWN';
  label: string;
  badgeColor: string;
} {
  if (!temp || isNaN(temp)) {
    return { status: 'UNKNOWN', label: 'ไม่ได้วัดไข้', badgeColor: 'bg-slate-100 text-slate-600' };
  }
  if (temp >= 38.5) {
    return { status: 'HIGH_FEVER', label: `ไข้สูง (${temp}°C)`, badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' };
  }
  if (temp >= 37.5) {
    return { status: 'LOW_FEVER', label: `มีไข้ต่ำ (${temp}°C)`, badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  return { status: 'NORMAL', label: `อุณหภูมิปกติ (${temp}°C)`, badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
}

export interface OutbreakAlertItem {
  disease: ContagiousDiseaseType;
  diseaseNameTh: string;
  classroomOrGrade: string;
  caseCount: number;
  alertLevel: 'WARNING' | 'CRITICAL_OUTBREAK';
  actionRequired: string[];
}

/**
 * ระบบตรวจจับโรคระบาด (Outbreak Early-Warning Engine)
 * วิเคราะห์บันทึกห้องพยาบาลย้อนหลัง 7 วันเพื่อหาคลัสเตอร์การระบาด
 */
export function detectOutbreakClusters(visits: InfirmaryVisitRecord[]): {
  hasOutbreak: boolean;
  alerts: OutbreakAlertItem[];
} {
  const alerts: OutbreakAlertItem[] = [];

  // Group visits by disease and classroom / grade (tracking unique studentIds)
  const clusterMap: Record<string, { disease: ContagiousDiseaseType; location: string; studentIds: Set<string>; count: number }> = {};

  visits.forEach(v => {
    if (v.diagnosedContagiousDisease && v.diagnosedContagiousDisease !== 'NONE') {
      const loc = v.grade?.includes('/') ? v.grade : (v.classroom ? `${v.grade || ''}/${v.classroom}` : (v.grade || 'ไม่ระบุชั้น'));
      const key = `${v.diagnosedContagiousDisease}__${loc}`;

      if (!clusterMap[key]) {
        clusterMap[key] = {
          disease: v.diagnosedContagiousDisease,
          location: loc,
          studentIds: new Set<string>(),
          count: 0
        };
      }
      clusterMap[key].count++;
      if (v.studentId) {
        clusterMap[key].studentIds.add(v.studentId);
      }
    }
  });

  Object.values(clusterMap).forEach(cluster => {
    const diseaseMeta = CONTAGIOUS_DISEASES_MAP[cluster.disease];
    const uniqueStudents = cluster.studentIds.size > 0 ? cluster.studentIds.size : cluster.count;
    
    // Threshold: >= 3 unique cases in 1 classroom or grade
    if (uniqueStudents >= 3) {
      const isCritical = uniqueStudents >= 4;
      alerts.push({
        disease: cluster.disease,
        diseaseNameTh: diseaseMeta.nameTh,
        classroomOrGrade: cluster.location,
        caseCount: uniqueStudents,
        alertLevel: isCritical ? 'CRITICAL_OUTBREAK' : 'WARNING',
        actionRequired: [
          `แยกนักเรียนที่ป่วยออกจากห้องเรียนทันที และให้กักตัวที่บ้านอย่างน้อย ${diseaseMeta.quarantineDays} วัน`,
          `ดำเนินการทำความสะอาดฆ่าเชื้อ (Big Cleaning) ห้องเรียน ${cluster.location}, โต๊ะ เก้าอี้ และอุปกรณ์การเรียน`,
          isCritical 
            ? `ตรวจพบระบาดหนัก (${cluster.count} ราย) แนะนำให้ผู้อำนวยการสั่งปิดเรียนห้อง ${cluster.location} ชั่วคราว 3 วันทำการ เพื่อตัดวงจรการระบาด`
            : 'คัดกรองวัดไข้และตรวจดูตุ่มในปาก/ฝ่ามือของนักเรียนทุกคนในห้องเรียนก่อนเข้าห้องทุกเช้า',
          'รายงานสถานการณ์ต่อหน่วยงานสาธารณสุขในพื้นที่ (รพ.สต.) และสำนักงานการศึกษาเอกชน (สช.)'
        ]
      });
    }
  });

  return {
    hasOutbreak: alerts.length > 0,
    alerts
  };
}
