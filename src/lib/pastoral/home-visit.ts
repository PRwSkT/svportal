/**
 * Home Visit Engine (ระบบเยี่ยมบ้านนักเรียนอัจฉริยะ)
 * มาตรฐานระบบดูแลช่วยเหลือนักเรียน สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)
 * และสำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช.)
 */

export interface HomeVisitRecord {
  id?: string;
  studentId: string;
  academicYear: string;
  term: string;
  visitDate: string; // YYYY-MM-DD
  visitorTeacherId?: string;
  visitorTeacherName: string;
  gpsLat?: number;
  gpsLng?: number;
  addressVisited: string;
  livingEnvironment: string;
  familyRelationship: string;
  economicStatus: string;
  livingWith?: string; // พักอาศัยอยู่กับใคร
  commuteMethod?: string; // การเดินทางมาโรงเรียน
  riskIssues: string[];
  audioTranscript?: string;
  aiSummary?: string;
  photos: { url: string; caption?: string; timestamp?: string }[];
  guardianMet: string;
  guardianSignatureUrl?: string;
  status: 'DRAFT' | 'COMPLETED';
}

export const LIVING_ENVIRONMENT_OPTIONS = [
  'บ้านเดี่ยว/ทาวน์เฮาส์สภาพมั่นคงถาวร ปลอดภัย',
  'ห้องแถว/ตึกแถว สภาพเรียบร้อย',
  'ห้องเช่า/อพาร์ตเมนต์ สภาพปานกลาง',
  'บ้านพักคนงาน/แคมป์ สภาพชั่วคราว',
  'ชุมชนแออัด มีความเสี่ยงต่อความปลอดภัย',
  'ที่พักอาศัยชั่วคราว/กระต๊อบ สภาพทรุดโทรม'
];

export const FAMILY_RELATIONSHIP_OPTIONS = [
  'อบอุ่น ใกล้ชิด ให้ความสำคัญกับการเรียนรู้และการสื่อสารที่ดี',
  'ปานกลาง สื่อสารกันตามปกติ บรรยากาศเป็นกันเอง',
  'ห่างเหิน ผู้ปกครองทำงานหนัก ไม่มีเวลาพูดคุยใกล้ชิด',
  'ขัดแย้งบ่อยครั้ง มีการใช้คำพูดรุนแรงหรือมีภาวะตึงเครียด',
  'พ่อแม่แยกทางกัน/หย่าร้าง เด็กอยู่กับปู่ย่าตายายหรือญาติ',
  'ขาดผู้ดูแลใกล้ชิด เด็กต้องดูแลตนเองเป็นหลัก'
];

export const ECONOMIC_STATUS_OPTIONS = [
  'มั่นคง มีรายได้เพียงพอและสนับสนุนการศึกษาอย่างเต็มที่',
  'ปานกลาง รายได้พอเหมาะ พอมีพอกิน ไม่มีหนี้สินล้นพ้นตัว',
  'ยากจน รายได้ไม่แน่นอน พอประทังชีพ ค่าใช้จ่ายตึงตัว',
  'ยากจนพิเศษ/ขาดแคลนมาก ขาดแคลนอาหาร อุปกรณ์การเรียน หรือค่าเดินทาง'
];

export const STANDARD_RISK_FACTORS = [
  'ฐานะยากจน/ขาดแคลนทุนการศึกษา',
  'ที่พักอาศัยอยู่ในแหล่งชุมชนเสี่ยงสารเสพติด/อบายมุข',
  'ครอบครัวมีความขัดแย้ง/หย่าร้าง/แยกทาง',
  'เด็กขาดผู้ปกครองดูแลใกล้ชิด (อยู่กับผู้สูงอายุ/ญาติ)',
  'มีพฤติกรรมติดเกม/สมาร์ตโฟน/ใช้เวลากับหน้าจอเกินขนาด',
  'ขาดเรียนบ่อย/มาสายเป็นประจำโดยไม่มีเหตุจำเป็น',
  'มีปัญหาสุขภาพเรื้อรัง/ความบกพร่องทางร่างกาย',
  'มีภาวะซึมเศร้า วิตกกังวล หรือแยกตัวจากสังคม',
  'ระยะทางจากบ้านมาโรงเรียนไกลมาก/การเดินทางยากลำบาก'
];

/**
 * ตรวจสอบความถูกต้องของพิกัด GPS (ประเทศไทย: Lat ~5.5 ถึง 20.5, Lng ~97.0 ถึง 106.0)
 */
export function validateThailandGPS(lat?: number, lng?: number): { isValid: boolean; message: string } {
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    return { isValid: false, message: 'ไม่มีข้อมูลพิกัด GPS' };
  }
  if (isNaN(lat) || isNaN(lng)) {
    return { isValid: false, message: 'พิกัด GPS ไม่ถูกต้อง' };
  }
  if (lat < 5.0 || lat > 21.0 || lng < 96.0 || lng > 107.0) {
    return { isValid: false, message: 'พิกัดอยู่นอกขอบเขตประเทศไทย' };
  }
  return { isValid: true, message: 'พิกัดถูกต้อง' };
}

/**
 * สร้าง Google Maps navigation URL
 */
export function getGoogleMapsUrl(lat?: number, lng?: number): string | null {
  if (lat === undefined || lng === undefined || lat === null || lng === null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * ประเมินระดับความเร่งด่วนในการช่วยเหลือจากผลการเยี่ยมบ้าน
 */
export function evaluateHomeVisitRisk(riskIssues: string[], economicStatus: string): {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  label: string;
  badgeColor: string;
  actionRequired: string;
} {
  const isExtremePoverty = economicStatus.includes('ยากจนพิเศษ') || economicStatus.includes('ขาดแคลนมาก');
  const count = riskIssues.length;

  if (count >= 4 || (isExtremePoverty && count >= 2)) {
    return {
      riskLevel: 'CRITICAL',
      label: 'วิกฤต (ต้องการช่วยเหลือเร่งด่วน)',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      actionRequired: 'ประสานครูแนะแนวและฝ่ายกิจการนักเรียนประชุมกรณีพิเศษ จัดสรรทุนการศึกษาฉุกเฉินและเยี่ยมซ้ำใน 2 สัปดาห์'
    };
  }

  if (count >= 2 || isExtremePoverty) {
    return {
      riskLevel: 'HIGH',
      label: 'มีความเสี่ยงสูง',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      actionRequired: 'พิจารณาเสนอชื่อรับทุนอุดหนุนปัจจัยพื้นฐาน ติดตามการมาเรียนและพฤติกรรมอย่างใกล้ชิด'
    };
  }

  if (count === 1) {
    return {
      riskLevel: 'MEDIUM',
      label: 'เฝ้าระวัง',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      actionRequired: 'ให้คำปรึกษาและพูดคุยสอบถามเป็นระยะ ให้กำลังใจในการเรียน'
    };
  }

  return {
    riskLevel: 'LOW',
    label: 'ปกติ/เกื้อหนุนดี',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    actionRequired: 'ส่งเสริมการมีส่วนร่วมของครอบครัวและพัฒนาทักษะความเป็นเลิศของนักเรียน'
  };
}

/**
 * น้องฟ้า AI สรุปและถอดบทความจากการเยี่ยมบ้าน (AI Synthesis)
 */
export function synthesizeHomeVisitSummary(input: {
  studentName: string;
  guardianMet: string;
  livingEnvironment: string;
  familyRelationship: string;
  economicStatus: string;
  riskIssues: string[];
  rawNotesOrTranscript?: string;
}): string {
  const { studentName, guardianMet, livingEnvironment, familyRelationship, economicStatus, riskIssues, rawNotesOrTranscript } = input;
  
  const riskSection = riskIssues.length > 0 
    ? `จากการประเมินพบจุดเสี่ยงที่ต้องเฝ้าระวัง ได้แก่: ${riskIssues.join(', ')}`
    : 'จากการประเมินไม่พบจุดเสี่ยงที่มีนัยสำคัญ ครอบครัวมีความพร้อมในการดูแลนักเรียนเป็นอย่างดี';

  let rawSection = '';
  if (rawNotesOrTranscript && rawNotesOrTranscript.trim().length > 0) {
    rawSection = `\n\nบันทึกเพิ่มเติมจากการสนทนา: "${rawNotesOrTranscript.trim()}"`;
  }

  return `ครูได้เดินทางไปเยี่ยมบ้านของ ${studentName} และได้พบกับ ${guardianMet || 'ผู้ปกครอง'} โดยได้ตรวจเยี่ยมสภาพความเป็นอยู่และพูดคุยแลกเปลี่ยนข้อมูลด้านการเรียนและพฤติกรรมของนักเรียน\n\nสภาพแวดล้อมที่อยู่อาศัย: ${livingEnvironment}\nความสัมพันธ์ในครอบครัว: ${familyRelationship}\nสถานภาพทางเศรษฐกิจ: ${economicStatus}\n\n${riskSection}${rawSection}\n\nข้อเสนอแนะในการดูแลร่วมกัน: โรงเรียนและผู้ปกครองเห็นพ้องในการประสานการสื่อสารอย่างสม่ำเสมอ เพื่อส่งเสริมพัฒนาการทั้งด้านการเรียนและทักษะชีวิตของนักเรียนอย่างต่อเนื่อง`;
}
