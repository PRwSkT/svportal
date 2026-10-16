/**
 * Unified Document Export & Print System Types
 * มาตรฐานการกำหนดขนาดกระดาษและโปรไฟล์การส่งออกเอกสาร โรงเรียนสมคิดวิทยา
 */

export type PaperSize = 
  | 'A4_PORTRAIT'     // 210mm x 297mm (ปพ.1, อร.1/1, สัญญา, ใบเสร็จทางการ)
  | 'A4_LANDSCAPE'    // 297mm x 210mm (ปพ.2, ปพ.3, ตารางสอน, โภชนาการ)
  | 'A3_LANDSCAPE'    // 420mm x 297mm (ผังแม่บท, ตารางรวม)
  | 'A5_PORTRAIT'     // 148mm x 210mm (ปพ.6 สมุดพกเดี่ยว)
  | 'A5_LANDSCAPE'    // 210mm x 148mm (ใบมอบสอนแทนครึ่ง A4)
  | 'THERMAL_80MM'    // 80mm continuous roll (สลิป POS, สลิปค่าธรรมเนียม)
  | 'THERMAL_58MM';   // 58mm continuous roll (สลิปพกพา/เคาน์เตอร์ย่อย)

export interface PaperDimensions {
  widthMm: number;
  heightMm?: number; // undefined for continuous roll
  cssPageSize: string;
  marginMm: number;
}

export const PAPER_CONFIGS: Record<PaperSize, PaperDimensions> = {
  A4_PORTRAIT: {
    widthMm: 210,
    heightMm: 297,
    cssPageSize: 'A4 portrait',
    marginMm: 0
  },
  A4_LANDSCAPE: {
    widthMm: 297,
    heightMm: 210,
    cssPageSize: 'A4 landscape',
    marginMm: 0
  },
  A3_LANDSCAPE: {
    widthMm: 420,
    heightMm: 297,
    cssPageSize: 'A3 landscape',
    marginMm: 0
  },
  A5_PORTRAIT: {
    widthMm: 148,
    heightMm: 210,
    cssPageSize: 'A5 portrait',
    marginMm: 0
  },
  A5_LANDSCAPE: {
    widthMm: 210,
    heightMm: 148,
    cssPageSize: 'A5 landscape',
    marginMm: 0
  },
  THERMAL_80MM: {
    widthMm: 80,
    cssPageSize: '80mm auto',
    marginMm: 0
  },
  THERMAL_58MM: {
    widthMm: 58,
    cssPageSize: '58mm auto',
    marginMm: 0
  }
};

export interface SchoolIdentityConfig {
  nameTh: string;
  nameEn: string;
  licenseNumber: string;
  taxId: string;
  addressTh: string;
  phone: string;
  website: string;
  directorName: string;
  directorPosition: string;
  logoUrl: string;
}

export const DEFAULT_SCHOOL_IDENTITY: SchoolIdentityConfig = {
  nameTh: 'โรงเรียนสมคิดวิทยา',
  nameEn: 'Somkidvittaya School',
  licenseNumber: 'ลป ๐๑-๐๑๒/๒๕๓๒',
  taxId: '0994000168391',
  addressTh: 'เลขที่ ๓๑ ถนนสุมนเทวราช ตำบลหัวเวียง อำเภอเมืองลำปาง จังหวัดลำปาง ๕๒๐๐๐',
  phone: '054-217-386, 054-224-118',
  website: 'https://sv-portal.somkidvittaya.ac.th',
  directorName: 'ดร.สมคิด บุญประเสริฐ',
  directorPosition: 'ผู้อำนวยการโรงเรียนสมคิดวิทยา',
  logoUrl: '/logo2.png'
};

export interface PrintDocumentOptions {
  title: string;
  paperSize: PaperSize;
  contentHtml: string;
  extraCss?: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
  autoCloseTimeoutMs?: number;
}
