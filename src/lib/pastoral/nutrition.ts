/**
 * Student Nutrition & Growth Assessment Engine
 * Department of Health (กรมอนามัย กระทรวงสาธารณสุข), Thailand Standard
 * Specially built for Somkidvittaya School (โรงเรียนสมคิดวิทยา)
 */

export interface AgeDetail {
  years: number;
  months: number;
  totalMonths: number;
  label: string; // e.g. "5 ปี 8 เดือน"
}

export type WeightForHeightStatus = 'ผอมมาก' | 'ผอม' | 'สมส่วน' | 'ท้วม' | 'เริ่มอ้วน' | 'อ้วน' | 'ยังไม่บันทึก';
export type HeightForAgeStatus = 'เตี้ย' | 'ค่อนข้างเตี้ย' | 'สูงตามเกณฑ์' | 'ค่อนข้างสูง' | 'สูงกว่าเกณฑ์' | 'ยังไม่บันทึก';
export type WeightForAgeStatus = 'น้ำหนักน้อยกว่าเกณฑ์' | 'ค่อนข้างน้อย' | 'น้ำหนักตามเกณฑ์' | 'ค่อนข้างมาก' | 'น้ำหนักมากเกินเกณฑ์' | 'ยังไม่บันทึก';

export interface HealthAssessmentResult {
  studentId: string;
  studentName: string;
  gender: 'ชาย' | 'หญิง';
  age: AgeDetail;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  weightForHeight: {
    status: WeightForHeightStatus;
    color: string;
    bgClass: string;
    textClass: string;
    isMalnourished: boolean; // ผอม หรือ ผอมมาก
    isOverweight: boolean; // เริ่มอ้วน หรือ อ้วน
  };
  heightForAge: {
    status: HeightForAgeStatus;
    color: string;
    bgClass: string;
    textClass: string;
    isStunted: boolean; // เตี้ย หรือ ค่อนข้างเตี้ย
  };
  weightForAge: {
    status: WeightForAgeStatus;
    color: string;
    bgClass: string;
    textClass: string;
  };
  lunchSubsidy: {
    isEligible: boolean;
    reason: string;
    criteriaMet: string[];
    priority: 'high' | 'medium' | 'none';
  };
}

/**
 * Calculates precise chronological age from birth date.
 */
export function calculateAge(birthDateInput: string | Date | null | undefined, referenceDate: Date = new Date()): AgeDetail {
  if (!birthDateInput) {
    return { years: 0, months: 0, totalMonths: 0, label: '-' };
  }

  let birth: Date;
  if (typeof birthDateInput === 'string') {
    const raw = birthDateInput.trim();
    // Check if ISO format YYYY-MM-DD
    const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      let y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10) - 1;
      const d = parseInt(isoMatch[3], 10);
      if (y > 2400) y -= 543; // Convert BE to CE
      birth = new Date(y, m, d);
    } else {
      birth = new Date(raw);
    }
  } else {
    birth = birthDateInput;
  }

  if (isNaN(birth.getTime())) {
    return { years: 0, months: 0, totalMonths: 0, label: '-' };
  }

  const ref = referenceDate;
  let years = ref.getFullYear() - birth.getFullYear();
  let months = ref.getMonth() - birth.getMonth();
  const days = ref.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = Math.max(0, years * 12 + months);

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    totalMonths,
    label: `${years} ปี ${months} เดือน`
  };
}

/**
 * Calculates Body Mass Index (BMI).
 * Formula: weight (kg) / (height (m))^2
 */
export function calculateBMI(weightKg: number | null | undefined, heightCm: number | null | undefined): { bmi: number | null; formatted: string } {
  if (!weightKg || !heightCm || heightCm <= 0 || weightKg <= 0) {
    return { bmi: null, formatted: '-' };
  }

  const heightM = heightCm / 100;
  const bmiVal = weightKg / (heightM * heightM);
  const rounded = Math.round(bmiVal * 10) / 10;

  return {
    bmi: rounded,
    formatted: rounded.toFixed(1)
  };
}

/**
 * Department of Health Standard Benchmark Tables (Weight for Height)
 * [heightCm, -2SD, -1.5SD, Median, +1.5SD, +2SD, +3SD]
 */
const BOY_WFH_BENCHMARKS: [number, number, number, number, number, number, number][] = [
  [75, 8.0, 8.4, 9.6, 11.0, 11.6, 12.8],
  [80, 9.0, 9.4, 10.7, 12.2, 12.8, 14.1],
  [85, 10.0, 10.5, 11.9, 13.5, 14.2, 15.6],
  [90, 11.0, 11.5, 13.0, 14.8, 15.6, 17.2],
  [95, 12.0, 12.6, 14.2, 16.2, 17.1, 18.9],
  [100, 13.1, 13.8, 15.6, 17.8, 18.7, 20.7],
  [105, 14.3, 15.0, 17.0, 19.5, 20.6, 22.8],
  [110, 15.6, 16.4, 18.6, 21.4, 22.7, 25.2],
  [115, 17.0, 17.9, 20.4, 23.6, 25.1, 28.1],
  [120, 18.6, 19.6, 22.4, 26.1, 27.9, 31.5],
  [125, 20.4, 21.6, 24.8, 29.1, 31.2, 35.5],
  [130, 22.5, 23.8, 27.5, 32.5, 35.0, 40.1],
  [135, 24.8, 26.3, 30.6, 36.5, 39.4, 45.4],
  [140, 27.4, 29.1, 34.1, 41.0, 44.4, 51.4],
  [145, 30.3, 32.2, 38.0, 46.1, 50.0, 58.0],
  [150, 33.6, 35.7, 42.4, 51.7, 56.2, 65.2],
  [155, 37.2, 39.6, 47.2, 57.8, 62.9, 73.1],
  [160, 41.2, 43.8, 52.4, 64.3, 70.0, 81.4],
  [165, 45.4, 48.3, 57.8, 71.1, 77.4, 90.0],
  [170, 49.8, 52.9, 63.4, 78.0, 84.9, 98.7],
  [175, 54.3, 57.7, 69.1, 84.8, 92.3, 107.3],
  [180, 58.8, 62.5, 74.8, 91.5, 99.6, 115.8]
];

const GIRL_WFH_BENCHMARKS: [number, number, number, number, number, number, number][] = [
  [75, 7.8, 8.2, 9.4, 10.8, 11.4, 12.6],
  [80, 8.8, 9.2, 10.5, 12.0, 12.6, 13.9],
  [85, 9.8, 10.3, 11.7, 13.3, 14.0, 15.4],
  [90, 10.8, 11.3, 12.8, 14.6, 15.4, 17.0],
  [95, 11.8, 12.4, 14.0, 16.0, 16.9, 18.7],
  [100, 12.9, 13.6, 15.4, 17.6, 18.5, 20.5],
  [105, 14.1, 14.8, 16.8, 19.3, 20.4, 22.6],
  [110, 15.4, 16.2, 18.4, 21.2, 22.5, 25.0],
  [115, 16.8, 17.7, 20.2, 23.4, 24.9, 27.9],
  [120, 18.4, 19.4, 22.2, 25.9, 27.7, 31.3],
  [125, 20.2, 21.4, 24.6, 28.9, 31.0, 35.3],
  [130, 22.3, 23.6, 27.3, 32.3, 34.8, 39.9],
  [135, 24.7, 26.2, 30.5, 36.4, 39.3, 45.3],
  [140, 27.5, 29.2, 34.2, 41.2, 44.6, 51.7],
  [145, 30.7, 32.6, 38.4, 46.6, 50.5, 58.7],
  [150, 34.2, 36.3, 43.0, 52.3, 56.8, 66.0],
  [155, 37.9, 40.2, 47.7, 58.1, 63.1, 73.3],
  [160, 41.6, 44.1, 52.3, 63.7, 69.2, 80.3],
  [165, 45.2, 47.9, 56.7, 68.9, 74.8, 86.8],
  [170, 48.6, 51.5, 60.8, 73.8, 80.0, 92.8]
];

/**
 * Linearly interpolates benchmark curves for any given height.
 */
function interpolateThresholds(
  table: [number, number, number, number, number, number, number][],
  height: number
) {
  if (height <= table[0][0]) {
    const r = table[0];
    return { minus2SD: r[1], minus1_5SD: r[2], median: r[3], plus1_5SD: r[4], plus2SD: r[5], plus3SD: r[6] };
  }
  if (height >= table[table.length - 1][0]) {
    const r = table[table.length - 1];
    return { minus2SD: r[1], minus1_5SD: r[2], median: r[3], plus1_5SD: r[4], plus2SD: r[5], plus3SD: r[6] };
  }

  for (let i = 0; i < table.length - 1; i++) {
    const low = table[i];
    const high = table[i + 1];
    if (height >= low[0] && height <= high[0]) {
      const ratio = (height - low[0]) / (high[0] - low[0]);
      return {
        minus2SD: low[1] + (high[1] - low[1]) * ratio,
        minus1_5SD: low[2] + (high[2] - low[2]) * ratio,
        median: low[3] + (high[3] - low[3]) * ratio,
        plus1_5SD: low[4] + (high[4] - low[4]) * ratio,
        plus2SD: low[5] + (high[5] - low[5]) * ratio,
        plus3SD: low[6] + (high[6] - low[6]) * ratio,
      };
    }
  }

  const r = table[0];
  return { minus2SD: r[1], minus1_5SD: r[2], median: r[3], plus1_5SD: r[4], plus2SD: r[5], plus3SD: r[6] };
}

/**
 * Evaluates Weight for Height (น้ำหนักตามเกณฑ์ส่วนสูง)
 */
export function evaluateWeightForHeight(
  gender: string,
  heightCm: number | null | undefined,
  weightKg: number | null | undefined
): {
  status: WeightForHeightStatus;
  color: string;
  bgClass: string;
  textClass: string;
  isMalnourished: boolean;
  isOverweight: boolean;
} {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
    return {
      status: 'ยังไม่บันทึก',
      color: '#94A3B8',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-600 dark:text-slate-400',
      isMalnourished: false,
      isOverweight: false,
    };
  }

  const isBoy = String(gender).trim().toLowerCase() === '1' || String(gender).includes('ชาย');
  const table = isBoy ? BOY_WFH_BENCHMARKS : GIRL_WFH_BENCHMARKS;
  const curve = interpolateThresholds(table, heightCm);

  if (weightKg < curve.minus2SD) {
    return {
      status: 'ผอมมาก',
      color: '#DC2626',
      bgClass: 'bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800',
      textClass: 'text-rose-700 dark:text-rose-300 font-bold',
      isMalnourished: true,
      isOverweight: false,
    };
  }
  if (weightKg < curve.minus1_5SD) {
    return {
      status: 'ผอม',
      color: '#EA580C',
      bgClass: 'bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800',
      textClass: 'text-amber-700 dark:text-amber-300 font-bold',
      isMalnourished: true,
      isOverweight: false,
    };
  }
  if (weightKg <= curve.plus1_5SD) {
    return {
      status: 'สมส่วน',
      color: '#16A34A',
      bgClass: 'bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800',
      textClass: 'text-emerald-700 dark:text-emerald-300 font-bold',
      isMalnourished: false,
      isOverweight: false,
    };
  }
  if (weightKg <= curve.plus2SD) {
    return {
      status: 'ท้วม',
      color: '#CA8A04',
      bgClass: 'bg-yellow-100 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-800',
      textClass: 'text-yellow-700 dark:text-yellow-300 font-bold',
      isMalnourished: false,
      isOverweight: false,
    };
  }
  if (weightKg <= curve.plus3SD) {
    return {
      status: 'เริ่มอ้วน',
      color: '#D97706',
      bgClass: 'bg-orange-100 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800',
      textClass: 'text-orange-700 dark:text-orange-300 font-bold',
      isMalnourished: false,
      isOverweight: true,
    };
  }
  return {
    status: 'อ้วน',
    color: '#991B1B',
    bgClass: 'bg-purple-100 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800',
    textClass: 'text-purple-700 dark:text-purple-300 font-bold',
    isMalnourished: false,
    isOverweight: true,
  };
}

/**
 * Height for Age Table (ส่วนสูงตามเกณฑ์อายุ)
 * [ageMonths, -2SD, -1.5SD, Median, +1.5SD, +2SD]
 */
const BOY_HFA_BENCHMARKS: [number, number, number, number, number, number][] = [
  [36, 88.7, 90.7, 96.1, 101.5, 103.5], // 3 yrs
  [48, 94.9, 97.2, 103.3, 109.4, 111.7], // 4 yrs
  [60, 100.7, 103.3, 110.0, 116.7, 119.2], // 5 yrs
  [72, 106.1, 109.0, 116.0, 123.1, 125.8], // 6 yrs
  [84, 111.2, 114.3, 121.7, 129.2, 132.0], // 7 yrs
  [96, 116.0, 119.3, 127.3, 135.2, 138.2], // 8 yrs
  [108, 120.8, 124.3, 132.7, 141.2, 144.3], // 9 yrs
  [120, 125.8, 129.5, 138.4, 147.2, 150.5], // 10 yrs
  [132, 131.0, 135.0, 144.3, 153.6, 157.0], // 11 yrs
  [144, 137.0, 141.2, 151.1, 160.9, 164.5], // 12 yrs
];

const GIRL_HFA_BENCHMARKS: [number, number, number, number, number, number][] = [
  [36, 87.4, 89.5, 95.1, 100.7, 102.7],
  [48, 94.1, 96.4, 102.7, 109.0, 111.3],
  [60, 100.0, 102.5, 109.4, 116.2, 118.8],
  [72, 105.4, 108.2, 115.5, 122.7, 125.5],
  [84, 110.7, 113.8, 121.3, 128.8, 131.7],
  [96, 115.7, 119.0, 127.0, 135.0, 138.0],
  [108, 120.8, 124.3, 132.8, 141.3, 144.5],
  [120, 126.6, 130.3, 139.2, 148.1, 151.5],
  [132, 133.0, 136.8, 146.0, 155.1, 158.5],
  [144, 138.8, 142.6, 151.7, 160.7, 164.0],
];

export function evaluateHeightForAge(
  gender: string,
  totalMonths: number,
  heightCm: number | null | undefined
): {
  status: HeightForAgeStatus;
  color: string;
  bgClass: string;
  textClass: string;
  isStunted: boolean;
} {
  if (!heightCm || heightCm <= 0 || totalMonths <= 0) {
    return {
      status: 'ยังไม่บันทึก',
      color: '#94A3B8',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-600 dark:text-slate-400',
      isStunted: false,
    };
  }

  const isBoy = String(gender).trim().toLowerCase() === '1' || String(gender).includes('ชาย');
  const table = isBoy ? BOY_HFA_BENCHMARKS : GIRL_HFA_BENCHMARKS;
  
  // Find nearest benchmark bracket
  let bracket = table[0];
  if (totalMonths >= table[table.length - 1][0]) {
    bracket = table[table.length - 1];
  } else {
    for (let i = 0; i < table.length - 1; i++) {
      if (totalMonths >= table[i][0] && totalMonths <= table[i + 1][0]) {
        const ratio = (totalMonths - table[i][0]) / (table[i + 1][0] - table[i][0]);
        bracket = [
          totalMonths,
          table[i][1] + (table[i + 1][1] - table[i][1]) * ratio,
          table[i][2] + (table[i + 1][2] - table[i][2]) * ratio,
          table[i][3] + (table[i + 1][3] - table[i][3]) * ratio,
          table[i][4] + (table[i + 1][4] - table[i][4]) * ratio,
          table[i][5] + (table[i + 1][5] - table[i][5]) * ratio,
        ];
        break;
      }
    }
  }

  const minus2SD = bracket[1];
  const minus1_5SD = bracket[2];
  const plus1_5SD = bracket[4];
  const plus2SD = bracket[5];

  if (heightCm < minus2SD) {
    return {
      status: 'เตี้ย',
      color: '#DC2626',
      bgClass: 'bg-rose-100 dark:bg-rose-950/40',
      textClass: 'text-rose-700 dark:text-rose-300 font-bold',
      isStunted: true,
    };
  }
  if (heightCm < minus1_5SD) {
    return {
      status: 'ค่อนข้างเตี้ย',
      color: '#EA580C',
      bgClass: 'bg-amber-100 dark:bg-amber-950/40',
      textClass: 'text-amber-700 dark:text-amber-300 font-bold',
      isStunted: true,
    };
  }
  if (heightCm <= plus1_5SD) {
    return {
      status: 'สูงตามเกณฑ์',
      color: '#16A34A',
      bgClass: 'bg-emerald-100 dark:bg-emerald-950/40',
      textClass: 'text-emerald-700 dark:text-emerald-300 font-bold',
      isStunted: false,
    };
  }
  if (heightCm <= plus2SD) {
    return {
      status: 'ค่อนข้างสูง',
      color: '#0284C7',
      bgClass: 'bg-sky-100 dark:bg-sky-950/40',
      textClass: 'text-sky-700 dark:text-sky-300 font-bold',
      isStunted: false,
    };
  }
  return {
    status: 'สูงกว่าเกณฑ์',
    color: '#4F46E5',
    bgClass: 'bg-indigo-100 dark:bg-indigo-950/40',
    textClass: 'text-indigo-700 dark:text-indigo-300 font-bold',
    isStunted: false,
  };
}

/**
 * Weight for Age (น้ำหนักตามเกณฑ์อายุ)
 */
export function evaluateWeightForAge(
  gender: string,
  totalMonths: number,
  weightKg: number | null | undefined
): {
  status: WeightForAgeStatus;
  color: string;
  bgClass: string;
  textClass: string;
} {
  if (!weightKg || weightKg <= 0 || totalMonths <= 0) {
    return {
      status: 'ยังไม่บันทึก',
      color: '#94A3B8',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-600 dark:text-slate-400',
    };
  }

  const isBoy = String(gender).trim().toLowerCase() === '1' || String(gender).includes('ชาย');
  const t = totalMonths / 12;
  const base = isBoy
    ? 3.2 + 2.3 * t + 0.12 * Math.pow(t, 2)
    : 3.1 + 2.2 * t + 0.11 * Math.pow(t, 2);

  const minus2SD = base * 0.78;
  const minus1_5SD = base * 0.85;
  const plus1_5SD = base * 1.20;
  const plus2SD = base * 1.35;

  if (weightKg < minus2SD) {
    return {
      status: 'น้ำหนักน้อยกว่าเกณฑ์',
      color: '#DC2626',
      bgClass: 'bg-rose-100 dark:bg-rose-950/40',
      textClass: 'text-rose-700 dark:text-rose-300 font-bold',
    };
  }
  if (weightKg < minus1_5SD) {
    return {
      status: 'ค่อนข้างน้อย',
      color: '#EA580C',
      bgClass: 'bg-amber-100 dark:bg-amber-950/40',
      textClass: 'text-amber-700 dark:text-amber-300 font-bold',
    };
  }
  if (weightKg <= plus1_5SD) {
    return {
      status: 'น้ำหนักตามเกณฑ์',
      color: '#16A34A',
      bgClass: 'bg-emerald-100 dark:bg-emerald-950/40',
      textClass: 'text-emerald-700 dark:text-emerald-300 font-bold',
    };
  }
  if (weightKg <= plus2SD) {
    return {
      status: 'ค่อนข้างมาก',
      color: '#CA8A04',
      bgClass: 'bg-yellow-100 dark:bg-yellow-950/40',
      textClass: 'text-yellow-700 dark:text-yellow-300 font-bold',
    };
  }
  return {
    status: 'น้ำหนักมากเกินเกณฑ์',
    color: '#991B1B',
    bgClass: 'bg-purple-100 dark:bg-purple-950/40',
    textClass: 'text-purple-700 dark:text-purple-300 font-bold',
  };
}

/**
 * Screen Student for Lunch Subsidy (คัดกรองเงินอาหารกลางวัน)
 * Official OPEC & Ministry of Education criteria:
 * 1. Malnourished (ภาวะทุพโภชนาการ: ผอม หรือ ผอมมาก)
 * 2. Financial Need (ขาดแคลน / รายได้ครอบครัว < 40,000 บาท/ปี)
 * 3. Special criteria (นักเรียนพิการ หรือด้อยโอกาส)
 */
export function screenLunchSubsidy(
  student: any,
  measurement?: { height?: number | null; weight?: number | null }
): {
  isEligible: boolean;
  reason: string;
  criteriaMet: string[];
  priority: 'high' | 'medium' | 'none';
} {
  const height = measurement?.height ?? student.height;
  const weight = measurement?.weight ?? student.weight;
  const criteriaMet: string[] = [];

  // 0. Kindergarten Universal Criterion (ตามประกาศ สช. นักเรียนอนุบาล 1-3 ได้รับจัดสรร 100%)
  const gradeStr = String(student.grade || '').trim();
  if (gradeStr.startsWith('อ.') || gradeStr.startsWith('อนุบาล')) {
    criteriaMet.push('นักเรียนระดับก่อนประถมศึกษา (อนุบาล 1-3 ได้รับจัดสรรทุกคนตามเกณฑ์ สช.)');
  }

  // 1. Nutritional Criterion
  const wfh = evaluateWeightForHeight(student.gender, height, weight);
  if (wfh.status === 'ผอมมาก') {
    criteriaMet.push('ภาวะทุพโภชนาการขั้นรุนแรง (ผอมมาก)');
  } else if (wfh.status === 'ผอม') {
    criteriaMet.push('ภาวะทุพโภชนาการ (ผอมตามเกณฑ์)');
  }

  // 2. Financial Criterion (Parents Salary / Income < 40,000 THB/year)
  const parents = Array.isArray(student.student_parents)
    ? student.student_parents
    : (student.student_parents ? [student.student_parents] : []);

  let totalMonthlySalary = 0;
  let hasSalaryInfo = false;

  parents.forEach((p: any) => {
    if (p.salary) {
      const salaryNum = parseFloat(String(p.salary).replace(/[^0-9.]/g, ''));
      if (!isNaN(salaryNum) && salaryNum > 0) {
        totalMonthlySalary += salaryNum;
        hasSalaryInfo = true;
      }
    }
  });

  const estimatedAnnualIncome = totalMonthlySalary * 12;
  if (hasSalaryInfo && estimatedAnnualIncome > 0 && estimatedAnnualIncome <= 40000) {
    criteriaMet.push(`ครอบครัวยากจน/ขาดแคลน (รายได้เฉลี่ย ${estimatedAnnualIncome.toLocaleString()} บาท/ปี < 40,000 บาท)`);
  }

  // 3. Disability / Special Needs Criterion
  const disability = String(student.disability || '').trim();
  if (disability && disability !== 'ไม่พิการ' && disability !== '-' && disability !== 'ปกติ') {
    criteriaMet.push(`นักเรียนพิการ/ความต้องการพิเศษ (${disability})`);
  }

  if (criteriaMet.length > 0) {
    const isHighPriority = wfh.status === 'ผอมมาก' || criteriaMet.length >= 2;
    return {
      isEligible: true,
      reason: criteriaMet.join(' + '),
      criteriaMet,
      priority: isHighPriority ? 'high' : 'medium',
    };
  }

  return {
    isEligible: false,
    reason: 'ไม่เข้าเกณฑ์รับเงินอุดหนุนอาหารกลางวัน',
    criteriaMet: [],
    priority: 'none',
  };
}

/**
 * Performs a comprehensive health and nutrition evaluation for a single student.
 */
export function evaluateStudentHealth(student: any): HealthAssessmentResult {
  const genderCode = String(student.gender).trim().toLowerCase() === '1' || String(student.gender).includes('ชาย') ? 'ชาย' : 'หญิง';
  const age = calculateAge(student.birth_date);
  const height = student.height ? Number(student.height) : null;
  const weight = student.weight ? Number(student.weight) : null;
  const bmiObj = calculateBMI(weight, height);

  const weightForHeight = evaluateWeightForHeight(genderCode, height, weight);
  const heightForAge = evaluateHeightForAge(genderCode, age.totalMonths, height);
  const weightForAge = evaluateWeightForAge(genderCode, age.totalMonths, weight);
  const lunchSubsidy = screenLunchSubsidy(student, { height, weight });

  const studentName = student.name || `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();

  return {
    studentId: String(student.id || '').trim(),
    studentName,
    gender: genderCode,
    age,
    heightCm: height,
    weightKg: weight,
    bmi: bmiObj.bmi,
    weightForHeight,
    heightForAge,
    weightForAge,
    lunchSubsidy,
  };
}

/**
 * Aggregates nutrition and growth metrics across an entire batch of students.
 */
export function aggregateNutritionBatch(students: any[]) {
  let totalMeasured = 0;
  let unmeasured = 0;

  let normalCount = 0;
  let thinCount = 0; // ผอม + ผอมมาก
  let overweightCount = 0; // ท้วม + เริ่มอ้วน + อ้วน
  let stuntedCount = 0; // เตี้ย + ค่อนข้างเตี้ย

  let lunchSubsidyEligibleCount = 0;

  const results: HealthAssessmentResult[] = [];
  const classBreakdown: Record<string, { total: number; measured: number; normal: number; malnourished: number; overweight: number; subsidy: number }> = {};

  students.forEach(student => {
    const res = evaluateStudentHealth(student);
    results.push(res);

    const grade = student.grade || 'ไม่ระบุห้อง';
    if (!classBreakdown[grade]) {
      classBreakdown[grade] = { total: 0, measured: 0, normal: 0, malnourished: 0, overweight: 0, subsidy: 0 };
    }
    classBreakdown[grade].total++;

    if (res.heightCm && res.weightKg) {
      totalMeasured++;
      classBreakdown[grade].measured++;

      if (res.weightForHeight.status === 'สมส่วน') {
        normalCount++;
        classBreakdown[grade].normal++;
      } else if (res.weightForHeight.isMalnourished) {
        thinCount++;
        classBreakdown[grade].malnourished++;
      } else if (res.weightForHeight.isOverweight || res.weightForHeight.status === 'ท้วม') {
        overweightCount++;
        classBreakdown[grade].overweight++;
      }

      if (res.heightForAge.isStunted) {
        stuntedCount++;
      }
    } else {
      unmeasured++;
    }

    if (res.lunchSubsidy.isEligible) {
      lunchSubsidyEligibleCount++;
      classBreakdown[grade].subsidy++;
    }
  });

  const normalPct = totalMeasured > 0 ? Math.round((normalCount / totalMeasured) * 100) : 0;
  const thinPct = totalMeasured > 0 ? Math.round((thinCount / totalMeasured) * 100) : 0;
  const overweightPct = totalMeasured > 0 ? Math.round((overweightCount / totalMeasured) * 100) : 0;
  const stuntedPct = totalMeasured > 0 ? Math.round((stuntedCount / totalMeasured) * 100) : 0;

  return {
    totalStudents: students.length,
    totalMeasured,
    unmeasured,
    normalCount,
    normalPct,
    thinCount,
    thinPct,
    overweightCount,
    overweightPct,
    stuntedCount,
    stuntedPct,
    lunchSubsidyEligibleCount,
    classBreakdown,
    results,
  };
}
