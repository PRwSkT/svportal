/**
 * Zero-Defect Academic Calculation Engine for Thai Ministry of Education & OPEC
 * ตามระเบียบกระทรวงศึกษาธิการว่าด้วยการประเมินผลการเรียนรู้
 * และหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551 (ฉบับปรับปรุง 2560)
 */

import { FinalGradeValue } from '@/types/academic';

/**
 * ตัดเกรด 8 ระดับตามเกณฑ์ สพฐ. (0 - 4.0)
 * 80.00 - 100.00 = 4.0
 * 75.00 - 79.99  = 3.5
 * 70.00 - 74.99  = 3.0
 * 65.00 - 69.99  = 2.5
 * 60.00 - 64.99  = 2.0
 * 55.00 - 59.99  = 1.5
 * 50.00 - 54.99  = 1.0
 * 0.00  - 49.99  = 0
 */
export function calculateEightLevelGrade(totalScore: number): FinalGradeValue {
  if (totalScore < 0) return '0';
  if (totalScore >= 80) return '4';
  if (totalScore >= 75) return '3.5';
  if (totalScore >= 70) return '3';
  if (totalScore >= 65) return '2.5';
  if (totalScore >= 60) return '2';
  if (totalScore >= 55) return '1.5';
  if (totalScore >= 50) return '1';
  return '0';
}

/**
 * คำนวณร้อยละของเวลาเรียน
 */
export function calculateAttendancePercentage(attendedHours: number, totalHours: number): number {
  if (totalHours <= 0) return 100;
  const pct = (attendedHours / totalHours) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
}

/**
 * ตรวจสอบสิทธิ์สอบตามกฎเวลาเรียน 80% (สพฐ.)
 * หากเวลาเรียนน้อยกว่า 80% ของเวลาเรียนทั้งหมด จะถูกตัดสินว่า "มส" (ไม่มีสิทธิ์สอบ)
 */
export function evaluateAttendanceEligibility(attendedHours: number, totalHours: number): {
  isEligible: boolean;
  attendancePercent: number;
  isWarning: boolean; // เวลาเรียน 80% - 85% ถือเป็นกลุ่มเสี่ยง
} {
  const percent = calculateAttendancePercentage(attendedHours, totalHours);
  const isEligible = percent >= 80.0;
  const isWarning = percent >= 80.0 && percent <= 85.0;
  return {
    isEligible,
    attendancePercent: percent,
    isWarning
  };
}

/**
 * คำนวณคะแนนรวมและเกรดสุทธิ พร้อมเช็คสถานะพิเศษ (มส, ร, ขส)
 */
export function evaluateStudentCourseResult(params: {
  formativeScore: number;       // คะแนนเก็บ (ปกติเต็ม 70)
  examScore: number;            // คะแนนสอบ (ปกติเต็ม 30)
  formativeWeight?: number;     // สัดส่วนคะแนนเก็บ
  summativeWeight?: number;     // สัดส่วนคะแนนสอบ
  attendedHours: number;
  totalCourseHours: number;
  isAbsentFromExam?: boolean;   // ขาดสอบ
  isIncompleteWork?: boolean;   // ค้างส่งงานสำคัญ (ติด ร)
  isRemedial?: boolean;
  remedialScore?: number | null;
}): {
  totalScore: number;
  finalGrade: FinalGradeValue;
  attendancePercent: number;
  statusNotes: string[];
} {
  const {
    formativeScore,
    examScore,
    attendedHours,
    totalCourseHours,
    isAbsentFromExam = false,
    isIncompleteWork = false,
    isRemedial = false,
    remedialScore = null
  } = params;

  const { isEligible, attendancePercent } = evaluateAttendanceEligibility(attendedHours, totalCourseHours);
  const statusNotes: string[] = [];

  // กฎเหล็ก 1: เวลาเรียนไม่ถึง 80% ติด "มส" (ไม่มีสิทธิ์สอบ)
  if (!isEligible) {
    statusNotes.push(`เวลาเรียนไม่ถึง 80% (${attendancePercent.toFixed(1)}%) ต้องขึ้นสถานะ 'มส'`);
    return {
      totalScore: Math.round((formativeScore + examScore) * 100) / 100,
      finalGrade: 'มส',
      attendancePercent,
      statusNotes
    };
  }

  // กฎเหล็ก 2: ขาดสอบปลายภาค ติด "ขส"
  if (isAbsentFromExam) {
    statusNotes.push('ขาดสอบปลายภาค ขึ้นสถานะ ขส');
    return {
      totalScore: formativeScore,
      finalGrade: 'ขส',
      attendancePercent,
      statusNotes
    };
  }

  // กฎเหล็ก 3: ส่งงานไม่ครบ/มีเหตุจำเป็นติด "ร"
  if (isIncompleteWork) {
    statusNotes.push('งานสำคัญไม่ครบถ้วน ขึ้นสถานะ ร (รอการตัดสิน)');
    return {
      totalScore: formativeScore,
      finalGrade: 'ร',
      attendancePercent,
      statusNotes
    };
  }

  // คำนวณคะแนนรวมปกติ
  let computedTotal = formativeScore + examScore;
  computedTotal = Math.min(100, Math.max(0, Math.round(computedTotal * 100) / 100));

  // กฎเหล็ก 4: ผลการเรียนหลังซ่อมเสริม (Remediation Rule)
  // หากผ่านการแก้ตัวจาก 0 หรือ มส เกรดที่ได้ต้องล็อกไม่เกิน '1' ตามระเบียบ สพฐ.
  if (isRemedial && remedialScore !== null) {
    const rawRemedialGrade = calculateEightLevelGrade(remedialScore);
    const cappedGrade: FinalGradeValue = rawRemedialGrade === '0' ? '0' : '1';
    statusNotes.push(`ผลการเรียนสอบแก้ตัว ล็อกสูงสุดไม่เกินเกรด 1 (ได้เกรด: ${cappedGrade})`);
    return {
      totalScore: remedialScore,
      finalGrade: cappedGrade,
      attendancePercent,
      statusNotes
    };
  }

  const finalGrade = calculateEightLevelGrade(computedTotal);
  return {
    totalScore: computedTotal,
    finalGrade,
    attendancePercent,
    statusNotes
  };
}

/**
 * คำนวณเกรดเฉลี่ย (GPA) และหน่วยกิตสะสม
 * GPA = sum(credit * grade) / sum(credits)
 * ปัดเศษทศนิยม 2 ตำแหน่งตามหลักคณิตศาสตร์กระทรวงศึกษาธิการ
 */
export function calculateGPA(courses: Array<{
  credits: number;
  finalGrade: FinalGradeValue | null;
  courseType?: string;
}>): {
  gpa: number;
  totalCredits: number;
  earnedCredits: number;
} {
  let weightedPoints = 0;
  let creditSum = 0;
  let earnedCredits = 0;

  for (const c of courses) {
    if (!c.finalGrade || c.finalGrade === 'ร' || c.finalGrade === 'มส' || c.finalGrade === 'ขส') {
      continue; // ยังไม่นำมาคำนวณเกรดเฉลี่ย
    }

    // กิจกรรมพัฒนาผู้เรียน (ผ/มผ) ไม่นำมาคิด GPA
    if (c.finalGrade === 'ผ' || c.finalGrade === 'มผ' || c.courseType === 'activity') {
      continue;
    }

    const numGrade = parseFloat(c.finalGrade);
    if (!isNaN(numGrade)) {
      weightedPoints += c.credits * numGrade;
      creditSum += c.credits;
      if (numGrade > 0) {
        earnedCredits += c.credits;
      }
    }
  }

  if (creditSum === 0) {
    return { gpa: 0.00, totalCredits: 0, earnedCredits: 0 };
  }

  const rawGpa = weightedPoints / creditSum;
  // ปัดทศนิยม 2 ตำแหน่ง
  const gpa = Math.floor(rawGpa * 100 + 0.5) / 100;

  return {
    gpa,
    totalCredits: creditSum,
    earnedCredits
  };
}

/**
 * วิเคราะห์ภาวะโภชนาการและการเจริญเติบโตเด็กปฐมวัยตามเกณฑ์มาตรฐานกรมอนามัย (W/H, BMI)
 */
export function evaluateEarlyYearsGrowth(params: {
  gender: 'male' | 'female' | string;
  ageYears: number;
  weightKg: number;
  heightCm: number;
}): {
  bmi: number;
  growthStatus: 'สมส่วน' | 'เริ่มอ้วน' | 'ท้วม' | 'อ้วน' | 'ผอม' | 'ค่อนข้างผอม' | 'สูงตามเกณฑ์' | 'ค่อนข้างเตี้ย' | 'เตี้ย';
  badgeColor: string;
} {
  const { weightKg, heightCm } = params;
  if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) {
    return { bmi: 0, growthStatus: 'สมส่วน', badgeColor: 'bg-gray-100 text-gray-700' };
  }

  const heightM = heightCm / 100;
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

  // เกณฑ์ประเมินเบื้องต้นเด็ก 2-6 ปีตามแนวทางกรมอนามัย
  let growthStatus: 'สมส่วน' | 'เริ่มอ้วน' | 'ท้วม' | 'อ้วน' | 'ผอม' | 'ค่อนข้างผอม' | 'สูงตามเกณฑ์' | 'ค่อนข้างเตี้ย' | 'เตี้ย' = 'สมส่วน';
  let badgeColor = 'bg-emerald-100 text-emerald-800';

  if (bmi < 13.5) {
    growthStatus = 'ผอม';
    badgeColor = 'bg-amber-100 text-amber-800';
  } else if (bmi < 14.5) {
    growthStatus = 'ค่อนข้างผอม';
    badgeColor = 'bg-yellow-100 text-yellow-800';
  } else if (bmi <= 17.5) {
    growthStatus = 'สมส่วน';
    badgeColor = 'bg-emerald-100 text-emerald-800';
  } else if (bmi <= 19.0) {
    growthStatus = 'ท้วม';
    badgeColor = 'bg-blue-100 text-blue-800';
  } else if (bmi <= 21.0) {
    growthStatus = 'เริ่มอ้วน';
    badgeColor = 'bg-orange-100 text-orange-800';
  } else {
    growthStatus = 'อ้วน';
    badgeColor = 'bg-rose-100 text-rose-800';
  }

  return { bmi, growthStatus, badgeColor };
}
