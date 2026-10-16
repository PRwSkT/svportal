/**
 * SDQ (Strengths and Difficulties Questionnaire) Assessment Engine
 * มาตรฐานแบบประเมินจุดเด่นและจุดบกพร่องของเด็ก (กรมสุขภาพจิต กระทรวงสาธารณสุข ประเทศไทย)
 * รองรับ 3 มุมมอง: ครูประเมิน (Teacher), ผู้ปกครองประเมิน (Parent), นักเรียนประเมินตนเอง (Student)
 */

export type EvaluatorType = 'teacher' | 'parent' | 'student';
export type SDQStatus = 'normal' | 'borderline' | 'abnormal';

export interface SDQQuestionItem {
  id: number;
  text: string;
  subscale: 'emotional' | 'conduct' | 'hyperactivity' | 'peer' | 'prosocial';
  isReversed: boolean; // ข้อที่ต้องกลับคะแนน (0->2, 1->1, 2->0)
}

/**
 * รายการข้อคำถาม SDQ 25 ข้อ มาตรฐานฉบับภาษาไทยของกรมสุขภาพจิต
 */
export const SDQ_QUESTIONS: SDQQuestionItem[] = [
  { id: 1, text: 'ห่วงใยความรู้สึกคนอื่น', subscale: 'prosocial', isReversed: false },
  { id: 2, text: 'อยู่ไม่นิ่ง ลุกนั่งบ่อยๆ สมาธิสั้น', subscale: 'hyperactivity', isReversed: false },
  { id: 3, text: 'มักบ่นว่าปวดศีรษะ ปวดท้อง หรือไม่สบาย', subscale: 'emotional', isReversed: false },
  { id: 4, text: 'เต็มใจแบ่งปันสิ่งของให้เพื่อน (ของเล่น ขนม ดินสอ)', subscale: 'prosocial', isReversed: false },
  { id: 5, text: 'มักโมโห ฉุนเฉียว อาละวาดบ่อยๆ', subscale: 'conduct', isReversed: false },
  { id: 6, text: 'ค่อนข้างแยกตัว ชอบเล่นคนเดียวหรืออยู่ตามลำพัง', subscale: 'peer', isReversed: false },
  { id: 7, text: 'เชื่อฟัง มักทำตามที่ผู้ใหญ่บอก', subscale: 'conduct', isReversed: true },
  { id: 8, text: 'ขี้กังวล มีเรื่องวิตกกังวลหลายเรื่อง', subscale: 'emotional', isReversed: false },
  { id: 9, text: 'ชอบช่วยเหลือเมื่อคนอื่นบาดเจ็บหรือไม่สบายใจ', subscale: 'prosocial', isReversed: false },
  { id: 10, text: 'อยู่ไม่สุข นั่งนิ่งๆ ไม่ได้ ยุกยิกตลอดเวลา', subscale: 'hyperactivity', isReversed: false },
  { id: 11, text: 'มีเพื่อนสนิทอย่างน้อย 1 คน', subscale: 'peer', isReversed: true },
  { id: 12, text: 'มักมีเรื่องชกต่อยหรือรังแกคนอื่น', subscale: 'conduct', isReversed: false },
  { id: 13, text: 'มักดูเศร้าหมอง ซึมเศร้า หรือร้องไห้บ่อย', subscale: 'emotional', isReversed: false },
  { id: 14, text: 'โดยทั่วไปเป็นที่ชื่นชอบของเด็กคนอื่น', subscale: 'peer', isReversed: true },
  { id: 15, text: 'วอกแวกง่าย ขาดสมาธิ วอกแวกตลอดเวลา', subscale: 'hyperactivity', isReversed: false },
  { id: 16, text: 'ขี้กลัว ตกใจง่าย วิตกกังวลกับสถานการณ์ใหม่ๆ', subscale: 'emotional', isReversed: false },
  { id: 17, text: 'ใจดีกับเด็กที่เล็กกว่า', subscale: 'prosocial', isReversed: false },
  { id: 18, text: 'มักโกหกหรือขี้โกง', subscale: 'conduct', isReversed: false },
  { id: 19, text: 'ถูกเด็กคนอื่นล้อเลียนหรือแกล้งรังแก', subscale: 'peer', isReversed: false },
  { id: 20, text: 'ชอบอาสาช่วยเหลือผู้อื่น (พ่อแม่ ครู เด็กคนอื่น)', subscale: 'prosocial', isReversed: false },
  { id: 21, text: 'คิดก่อนทำ ไม่หุนหันพลันแล่น', subscale: 'hyperactivity', isReversed: true },
  { id: 22, text: 'หยิบของคนอื่นโดยไม่ได้รับอนุญาต (ขโมยของ)', subscale: 'conduct', isReversed: false },
  { id: 23, text: 'เข้ากับผู้ใหญ่ได้ดีกว่าเด็กวัยเดียวกัน', subscale: 'peer', isReversed: false },
  { id: 24, text: 'มีความกลัวหลายอย่าง ตื่นตระหนกง่าย', subscale: 'emotional', isReversed: false },
  { id: 25, text: 'ทำงานได้จนเสร็จ มีความตั้งใจทำงาน', subscale: 'hyperactivity', isReversed: true },
];

export interface SDQSubscaleResult {
  score: number;
  maxScore: number;
  status: SDQStatus;
  statusLabel: string;
  badgeColor: string;
}

export interface SDQEvaluationResult {
  evaluatorType: EvaluatorType;
  emotional: SDQSubscaleResult;
  conduct: SDQSubscaleResult;
  hyperactivity: SDQSubscaleResult;
  peer: SDQSubscaleResult;
  prosocial: SDQSubscaleResult;
  totalDifficulties: SDQSubscaleResult;
  summaryRecommendation: string;
}

/**
 * เกณฑ์การตัดคะแนนและแปลผลตามเกณฑ์มาตรฐานกรมสุขภาพจิต (Cut-off Thresholds)
 */
export function evaluateSDQSubscale(
  subscale: 'emotional' | 'conduct' | 'hyperactivity' | 'peer' | 'prosocial' | 'total',
  score: number,
  evaluatorType: EvaluatorType
): { status: SDQStatus; statusLabel: string; badgeColor: string } {
  // Prosocial: Higher is better (คะแนนยิ่งสูงยิ่งดี)
  if (subscale === 'prosocial') {
    if (score >= 6) {
      return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
    }
    if (score === 5) {
      return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
    }
    return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
  }

  // Teacher Cut-offs
  if (evaluatorType === 'teacher') {
    if (subscale === 'emotional') {
      if (score <= 4) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
      if (score === 5) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
      return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
    }
    if (subscale === 'conduct') {
      if (score <= 2) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
      if (score === 3) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
      return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
    }
    if (subscale === 'hyperactivity') {
      if (score <= 5) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
      if (score === 6) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
      return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
    }
    if (subscale === 'peer') {
      if (score <= 3) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
      if (score === 4) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
      return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
    }
    // Total difficulties
    if (score <= 11) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
    if (score <= 15) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
    return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
  }

  // Parent Cut-offs
  if (evaluatorType === 'parent') {
    if (subscale === 'emotional') {
      if (score <= 3) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
      if (score === 4) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
      return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
    }
    if (subscale === 'conduct') {
      if (score <= 2) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
      if (score === 3) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
      return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
    }
    if (subscale === 'hyperactivity') {
      if (score <= 5) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
      if (score === 6) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
      return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
    }
    if (subscale === 'peer') {
      if (score <= 2) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
      if (score === 3) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
      return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
    }
    if (score <= 10) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
    if (score <= 13) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
    return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
  }

  // Student Self-Report Cut-offs (11 - 17 yrs)
  if (subscale === 'emotional') {
    if (score <= 5) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
    if (score === 6) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
    return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
  }
  if (subscale === 'conduct') {
    if (score <= 3) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
    if (score === 4) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
    return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
  }
  if (subscale === 'hyperactivity') {
    if (score <= 5) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
    if (score === 6) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
    return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
  }
  if (subscale === 'peer') {
    if (score <= 3) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
    if (score === 4) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
    return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
  }
  if (score <= 15) return { status: 'normal', statusLabel: 'ปกติ', badgeColor: 'bg-emerald-100 text-emerald-800' };
  if (score <= 19) return { status: 'borderline', statusLabel: 'เสี่ยง', badgeColor: 'bg-amber-100 text-amber-800' };
  return { status: 'abnormal', statusLabel: 'มีปัญหา', badgeColor: 'bg-rose-100 text-rose-800' };
}

/**
 * คำนวณคะแนนและแปลผลชุดคำตอบ SDQ 25 ข้อ
 * @param answers Map ของข้อคำตอบ { "1": 0|1|2, "2": 0|1|2, ... "25": 0|1|2 }
 * 0 = ไม่จริง, 1 = จริงบางครั้ง, 2 = จริงแน่นอน
 */
export function calculateSDQ(answers: Record<string | number, number>, evaluatorType: EvaluatorType): SDQEvaluationResult {
  let emotionalScore = 0;
  let conductScore = 0;
  let hyperactivityScore = 0;
  let peerScore = 0;
  let prosocialScore = 0;

  SDQ_QUESTIONS.forEach(q => {
    let rawVal = Number(answers[q.id] ?? answers[String(q.id)] ?? 0);
    if (rawVal < 0 || rawVal > 2) rawVal = 0;

    // Apply reversed scoring if applicable
    const finalScore = q.isReversed ? (2 - rawVal) : rawVal;

    switch (q.subscale) {
      case 'emotional':
        emotionalScore += finalScore;
        break;
      case 'conduct':
        conductScore += finalScore;
        break;
      case 'hyperactivity':
        hyperactivityScore += finalScore;
        break;
      case 'peer':
        peerScore += finalScore;
        break;
      case 'prosocial':
        prosocialScore += finalScore;
        break;
    }
  });

  const totalDifficultiesScore = emotionalScore + conductScore + hyperactivityScore + peerScore;

  const emotionalEval = evaluateSDQSubscale('emotional', emotionalScore, evaluatorType);
  const conductEval = evaluateSDQSubscale('conduct', conductScore, evaluatorType);
  const hyperEval = evaluateSDQSubscale('hyperactivity', hyperactivityScore, evaluatorType);
  const peerEval = evaluateSDQSubscale('peer', peerScore, evaluatorType);
  const prosocialEval = evaluateSDQSubscale('prosocial', prosocialScore, evaluatorType);
  const totalEval = evaluateSDQSubscale('total', totalDifficultiesScore, evaluatorType);

  // Recommendations summary
  let recommendation = 'นักเรียนมีพัฒนาการทางอารมณ์และพฤติกรรมอยู่ในเกณฑ์ปกติ ควรได้รับการส่งเสริมจุดเด่นอย่างต่อเนื่อง';
  if (totalEval.status === 'abnormal') {
    recommendation = 'นักเรียนมีความยากลำบากในระดับมีปัญหา แนะนำให้ครูประจำชั้นประสานงานร่วมกับผู้ปกครองและครูแนะแนวเพื่อวางแผนดูแลช่วยเหลือเฉพาะราย';
  } else if (totalEval.status === 'borderline') {
    recommendation = 'นักเรียนอยู่ในกลุ่มเสี่ยง แนะนำให้ครูประจำชั้นสังเกตพฤติกรรมในห้องเรียนอย่างใกล้ชิดและให้คำปรึกษาเบื้องต้น';
  }

  return {
    evaluatorType,
    emotional: { score: emotionalScore, maxScore: 10, ...emotionalEval },
    conduct: { score: conductScore, maxScore: 10, ...conductEval },
    hyperactivity: { score: hyperactivityScore, maxScore: 10, ...hyperEval },
    peer: { score: peerScore, maxScore: 10, ...peerEval },
    prosocial: { score: prosocialScore, maxScore: 10, ...prosocialEval },
    totalDifficulties: { score: totalDifficultiesScore, maxScore: 40, ...totalEval },
    summaryRecommendation: recommendation
  };
}

/**
 * เปรียบเทียบผลประเมิน SDQ 3 มุมมอง (Triangulation Comparison)
 * ตรวจจับความขัดแย้ง (Discrepancy) เช่น ครูมองว่าปกติ แต่ผู้ปกครองรายงานความเครียดสูงที่บ้าน
 */
export function compareTriangulatedSDQ(
  teacherRes?: SDQEvaluationResult | null,
  parentRes?: SDQEvaluationResult | null,
  studentRes?: SDQEvaluationResult | null
): {
  overallRisk: 'normal' | 'borderline' | 'high_risk';
  riskLabel: string;
  discrepancies: string[];
  priorityAction: string;
} {
  const discrepancies: string[] = [];
  let isAnyAbnormal = false;
  let isAnyBorderline = false;

  const results = [teacherRes, parentRes, studentRes].filter(Boolean) as SDQEvaluationResult[];
  if (results.length === 0) {
    return {
      overallRisk: 'normal',
      riskLabel: 'ยังไม่มีข้อมูลประเมินครบ',
      discrepancies: [],
      priorityAction: 'รอดำเนินการประเมิน SDQ'
    };
  }

  results.forEach(r => {
    if (r.totalDifficulties.status === 'abnormal') isAnyAbnormal = true;
    if (r.totalDifficulties.status === 'borderline') isAnyBorderline = true;
  });

  // Cross-compare Teacher vs Parent
  if (teacherRes && parentRes) {
    if (teacherRes.totalDifficulties.status === 'normal' && parentRes.totalDifficulties.status === 'abnormal') {
      discrepancies.push('ผู้ปกครองรายงานปัญหาพฤติกรรม/อารมณ์สูงที่บ้าน ในขณะที่พฤติกรรมที่โรงเรียนเป็นปกติ (พิจารณาสภาพแวดล้อมทางบ้าน)');
    } else if (teacherRes.totalDifficulties.status === 'abnormal' && parentRes.totalDifficulties.status === 'normal') {
      discrepancies.push('ครูสังเกตพบปัญหาที่โรงเรียนสูงกว่าที่บ้าน (พิจารณาปัญหาความสัมพันธ์กับกลุ่มเพื่อนหรือการปรับตัว)');
    }
  }

  const overallRisk = isAnyAbnormal ? 'high_risk' : (isAnyBorderline ? 'borderline' : 'normal');
  const riskLabel = overallRisk === 'high_risk' ? 'กลุ่มมีปัญหา (ต้องการการดูแลด่วน)' : (overallRisk === 'borderline' ? 'กลุ่มเสี่ยง (ต้องเฝ้าระวัง)' : 'กลุ่มปกติ');

  const priorityAction = overallRisk === 'high_risk'
    ? 'จัดประชุมส่งต่อข้อมูลครู-ผู้ปกครอง-ครูแนะแนว และวางแผนปรับพฤติกรรมรายบุคคล'
    : (overallRisk === 'borderline' ? 'จัดกิจกรรมกลุ่มเสริมทักษะชีวิตและติดตามผลใน 1 เดือน' : 'ส่งเสริมศักยภาพความเป็นเลิศ');

  return {
    overallRisk,
    riskLabel,
    discrepancies,
    priorityAction
  };
}
