import { SCHOOL_INFO } from '@/lib/constants/school';
import { BrandId, SocialCaptions } from './types';

export interface HeadlineLineSpec {
  x: number;
  y: number;
  size: number;
  weight: 'bold' | '500' | '400';
}

export interface BrandProfile {
  id: BrandId;
  labelTh: string;
  labelEn: string;
  fbPageName: string;
  igHandle: string | null;
  avatarPath: string;
  supportsInstagram: boolean;
  supportsTrilingual: boolean;
  supportsCoverHeadline: boolean;
  supportsWebsiteDefault: boolean;
  defaultSiteTargets: string[];
  /** Default FB Page IDs (non-secret public IDs); env vars override these */
  defaultFbPageId: string;
  defaultIgAccountId: string | null;
  overlays: {
    coverFb: string;
    coverIg: string | null;
    sub1x1: string;
    sub4x3: string;
    sub4x5: string;
  };
  headlineCoords: {
    fb: [HeadlineLineSpec, HeadlineLineSpec, HeadlineLineSpec] | null;
    ig: [HeadlineLineSpec, HeadlineLineSpec, HeadlineLineSpec] | null;
  };
}

export const BRAND_PROFILES: Record<BrandId, BrandProfile> = {
  main: {
    id: 'main',
    labelTh: 'Somkidvittaya School',
    labelEn: 'Somkidvittaya School',
    fbPageName: 'Somkidvittaya School',
    igHandle: 'somkidvittaya_school',
    avatarPath: '/post-assistant/logos/somkidvittaya.jpg',
    supportsInstagram: true,
    supportsTrilingual: true,
    supportsCoverHeadline: true,
    supportsWebsiteDefault: true,
    defaultSiteTargets: ['somkidvittaya'],
    defaultFbPageId: '192831060756593',
    defaultIgAccountId: '17841446069053774',
    overlays: {
      coverFb: '/cover-fb.png',
      coverIg: '/cover-ig.png',
      sub1x1: '/watermark-new.png',
      sub4x3: '/sv-cover-4-3.png',
      sub4x5: '/overlay-ig.png',
    },
    headlineCoords: {
      fb: [
        { x: 217.7505, y: 1910.7412, size: 91.79, weight: 'bold' },
        { x: 217.7505, y: 1991.0234, size: 86.94, weight: '500' },
        { x: 217.7505, y: 2048.3008, size: 49, weight: '400' },
      ],
      ig: [
        { x: 206.6353, y: 2323.6885, size: 91.79, weight: 'bold' },
        { x: 206.6353, y: 2399.8008, size: 82.43, weight: '500' },
        { x: 206.6353, y: 2454.1025, size: 46.45, weight: '400' },
      ],
    },
  },
  football: {
    id: 'football',
    labelTh: 'SV Lion Football Academy',
    labelEn: 'SV Lion Football Academy',
    fbPageName: 'SV Lion Football Academy',
    igHandle: null,
    avatarPath: '/post-assistant/logos/sv-lion.png',
    supportsInstagram: false,
    supportsTrilingual: false,
    supportsCoverHeadline: false,
    supportsWebsiteDefault: false,
    defaultSiteTargets: ['somkidplus'],
    defaultFbPageId: '1204516039414311',
    defaultIgAccountId: null,
    overlays: {
      coverFb: '/lion1-1.png',
      coverIg: null,
      sub1x1: '/lion1-1.png',
      sub4x3: '/lion4-3.png',
      sub4x5: '/lion4-5.png',
    },
    headlineCoords: { fb: null, ig: null },
  },
  swimming: {
    id: 'swimming',
    labelTh: 'SV Aquatics Centre',
    labelEn: 'SV Aquatics Centre',
    fbPageName: 'SV Aquatics Centre',
    igHandle: null,
    avatarPath: '/post-assistant/logos/sv-aquatics.png',
    supportsInstagram: false,
    supportsTrilingual: false,
    supportsCoverHeadline: false,
    supportsWebsiteDefault: false,
    defaultSiteTargets: ['somkidplus'],
    defaultFbPageId: '1188473751019404',
    defaultIgAccountId: null,
    overlays: {
      coverFb: '/aquatics1-1.png',
      coverIg: null,
      sub1x1: '/aquatics1-1.png',
      sub4x3: '/aquatics4-3.png',
      sub4x5: '/aquatics4-5.png',
    },
    headlineCoords: { fb: null, ig: null },
  },
  tutoring: {
    id: 'tutoring',
    labelTh: 'Somkid+',
    labelEn: 'Somkid+',
    fbPageName: 'Somkid+',
    igHandle: null,
    avatarPath: '/post-assistant/logos/somkidplus.png',
    supportsInstagram: false,
    supportsTrilingual: false,
    supportsCoverHeadline: false,
    supportsWebsiteDefault: false,
    defaultSiteTargets: ['somkidplus'],
    defaultFbPageId: '1235898419607130',
    defaultIgAccountId: null,
    overlays: {
      coverFb: '/somkid+1-1.png', // Verified lowercase 's' on disk
      coverIg: null,
      sub1x1: '/somkid+1-1.png',
      sub4x3: '/Somkid+4-3.png',
      sub4x5: '/Somkid+4-5.png',
    },
    headlineCoords: { fb: null, ig: null },
  },
};

export const ACTIVITY_TAGS = [
  { value: 'วิชาการ', labelTh: 'วิชาการ', labelEn: 'Academic' },
  { value: 'กีฬา/สุขภาพ', labelTh: 'กีฬา/สุขภาพ', labelEn: 'Sports & Health' },
  { value: 'ศิลปะ/ดนตรี/การแสดง', labelTh: 'ศิลปะ/ดนตรี', labelEn: 'Arts & Music' },
  { value: 'ทัศนศึกษา/นอกสถานที่', labelTh: 'นอกสถานที่', labelEn: 'Field Trip' },
  { value: 'ค่าย/แคมป์', labelTh: 'ค่าย/แคมป์', labelEn: 'Camp' },
  { value: 'จิตอาสา/เพื่อสังคม', labelTh: 'จิตอาสา', labelEn: 'Volunteer' },
  { value: 'แข่งขัน/ประกวด', labelTh: 'ประกวด/แข่งขัน', labelEn: 'Contest' },
  { value: 'เทศกาล/นานาชาติ', labelTh: 'เทศกาล/นานาชาติ', labelEn: "Festival / Int'l" },
  { value: 'นิทรรศการ/โชว์ผลงาน', labelTh: 'โชว์ผลงาน', labelEn: 'Exhibition' },
  { value: 'ผู้ปกครอง/สัมพันธ์', labelTh: 'ผู้ปกครอง', labelEn: 'Parents' },
  { value: 'พิธีการ/ทางการ', labelTh: 'พิธีการ', labelEn: 'Ceremony' },
  { value: 'อบรม/สัมมนา', labelTh: 'อบรม', labelEn: 'Training' },
  { value: 'ปฐมนิเทศ/ปัจฉิม', labelTh: 'เรียนจบ/รับน้อง', labelEn: 'Graduation / Welcome' },
] as const;

export const CAPTION_TONES = [
  { value: 'อบอุ่น ภาคภูมิใจ เป็นกันเอง', labelTh: 'อบอุ่น/ภาคภูมิใจ', labelEn: 'Warm & Proud' },
  { value: 'สนุกสนาน พลังงานสูง ร่าเริง', labelTh: 'สนุกสนาน/ร่าเริง', labelEn: 'Fun & Energetic' },
  { value: 'เป็นทางการ น่าเชื่อถือ มืออาชีพ', labelTh: 'เป็นทางการ/มืออาชีพ', labelEn: 'Formal & Pro' },
  { value: 'อินเตอร์ ทันสมัย เปิดกว้าง', labelTh: 'อินเตอร์/ทันสมัย', labelEn: 'Modern & Inter' },
  { value: 'ตื่นเต้น เชิญชวน น่าสนใจ', labelTh: 'ตื่นเต้น/เชิญชวน', labelEn: 'Exciting' },
  { value: 'เล่าเรื่องแบบสบายๆ Narrative', labelTh: 'เล่าเรื่องสบายๆ', labelEn: 'Narrative' },
  { value: 'กระชับ ตรงประเด็น อ่านง่าย', labelTh: 'กระชับ/อ่านง่าย', labelEn: 'Concise & Clear' },
  { value: 'ซาบซึ้ง ขอบคุณ ลึกซึ้ง', labelTh: 'ซาบซึ้ง/ขอบคุณ', labelEn: 'Heartfelt & Grateful' },
  { value: 'สร้างแรงบันดาลใจ วิสัยทัศน์ก้าวไกล', labelTh: 'สร้างแรงบันดาลใจ', labelEn: 'Inspiring' },
] as const;

/**
 * Locked official leadership spellings (preserved verbatim in prompts and PDPA allowlist)
 */
export const LEADERSHIP_ROSTER = [
  { th: 'นาย ณัฐวัฒน์ สงเคราะห์ธรรม', en: 'Mr. Nattawat Songkrotham', bareTh: 'ณัฐวัฒน์ สงเคราะห์ธรรม' },
  { th: 'นางสาว อติภา สุขศิริ', en: 'Miss Atipa Sooksiri', bareTh: 'อติภา สุขศิริ' },
  { th: 'นาย พีรวัส สงเคราะห์ธรรม', en: 'Mr. Peerawat Songkrohtham', bareTh: 'พีรวัส สงเคราะห์ธรรม' },
] as const;

export const SCHOOL_TOUR_URL = 'https://calendar.app.google/HhhN11dAj8r3HehM7';
export const SCHOOL_CONTACT_EMAIL = SCHOOL_INFO.email; // mail@somkidvittaya.ac.th
export const SCHOOL_CONTACT_PHONE_INTL = '(+66) 38 611 251';
export const SCHOOL_DOMAIN = 'somkidvittaya.ac.th';

export const CONTACT_BLOCKS = {
  en: `Contact us\nCall ${SCHOOL_CONTACT_PHONE_INTL}\nEmail: ${SCHOOL_CONTACT_EMAIL}\nWebsite: ${SCHOOL_DOMAIN}\nSchool visit: ${SCHOOL_TOUR_URL}`,
  zh: `联系我们\n电话: ${SCHOOL_CONTACT_PHONE_INTL}\n电子邮箱: ${SCHOOL_CONTACT_EMAIL}\n官方网站: ${SCHOOL_DOMAIN}\n预约参观学校: ${SCHOOL_TOUR_URL}`,
  th: `ติดต่อเรา\nโทรศัพท์: ${SCHOOL_CONTACT_PHONE_INTL}\nอีเมล: ${SCHOOL_CONTACT_EMAIL}\nเว็บไซต์: ${SCHOOL_DOMAIN}\nนัดหมายเยี่ยมชมโรงเรียน: ${SCHOOL_TOUR_URL}`,
} as const;

export const DIVIDER_LINE = '_______________';

export const GRADE_RULES_PROMPT = `
[OFFICIAL SCHOOL & GRADE NAMING MATRIX — STRICT]
1. School Names:
   - Thai: โรงเรียนสมคิดวิทยา
   - English: Somkidvittaya School
   - Chinese: somkidvittaya学校 (MUST use lowercase "s" exactly: "somkidvittaya学校". NEVER transliterate as 松吉威提雅学校 or 森吉学校.)
2. Official Leadership Spellings (use exact spellings if mentioned):
   - นาย ณัฐวัฒน์ สงเคราะห์ธรรม = Mr. Nattawat Songkrotham
   - นางสาว อติภา สุขศิริ = Miss Atipa Sooksiri
   - นาย พีรวัส สงเคราะห์ธรรม = Mr. Peerawat Songkrohtham
3. CRITICAL GRADE & LEVEL NOTATION RULES:
   - เตรียมอนุบาล / เนอสเซอรี่ / Nursery:
     * TH: นักเรียนชั้นเตรียมอนุบาล (or น้อง ๆ เตรียมอนุบาล)
     * EN: Prep School students (NEVER write "K. students", NEVER "K.0", NEVER "Pre-K.")
     * ZH: 学前预备班学生 (or Prep School学生)
   - General Kindergarten (when NO specific grade number 1-3 is provided):
     * TH: นักเรียนระดับอนุบาล (or น้อง ๆ ระดับปฐมวัย) — NEVER write "นักเรียน อ."
     * EN: Kindergarten students (or Early Years learners) — NEVER write bare "K. students", "K. artists", or "K. learners"
     * ZH: 幼儿园学生 — NEVER write "K.阶段幼儿"
   - Specific Kindergarten Grades (1-3):
     * TH: อ.1, อ.2, อ.3 (e.g. นักเรียนชั้น อ.1–อ.3)
     * EN: K.1, K.2, K.3 (e.g. K.1 students, K.1–K.3 students)
     * ZH: K.1学生, K.1–K.3学生
   - General Primary (when NO specific grade number 1-6 is provided):
     * TH: นักเรียนระดับประถมศึกษา — NEVER write "นักเรียน ป."
     * EN: Primary students (or Primary School students) — NEVER write bare "G. students"
     * ZH: 小学部学生
   - Specific Primary Grades (1-6):
     * TH: ป.1–ป.6 (e.g. นักเรียนชั้น ป.4)
     * EN: G.1–G.6 (e.g. G.4 students, G.1–G.6 students)
     * ZH: G.1学生–G.6学生
   - Whole School:
     * TH: นักเรียนโรงเรียนสมคิดวิทยา | EN: Somkidvittaya students | ZH: somkidvittaya学校学生
`.trim();

export const ANTI_AI_SLOP_PROMPT = `
[ANTI-AI-SLOP & GLOBAL EDITORIAL STANDARDS]
- NEVER sound like a generic AI bot or Thai government press release.
- Show, Don't Tell: Ground your opening hook in observed micro-moments from the images/context (hands building, focused expressions, teacher mentoring a child, resilient teamwork). Students are the hero; the school is the supportive stage.
- Respect the user's requested <requested_tone> while keeping Somkidvittaya's warm, confident, modern bilingual identity.
- FORBIDDEN THAI CLICHÉS: "โรงเรียนได้จัดกิจกรรม", "เพื่อส่งเสริมและเปิดโอกาส", "เปิดโอกาสให้", "ได้เรียนรู้และฝึกทักษะ", "บรรยากาศเต็มไปด้วยรอยยิ้มและความสนุกสนาน", "นักเรียนได้ร่วมกิจกรรม", "ก้าวสำคัญสู่อนาคต".
- FORBIDDEN ENGLISH CLICHÉS: "delve into", "vibrant tapestry", "testament to", "embark on a journey", "unleash their potential", "in today's fast-paced world", repetitive "not just X, it's Y".
- FORBIDDEN CHINESE CLICHÉS: stiff textbook openers like "通过这次活动，学生们不仅……而且……" on every post; write naturally for bilingual international-school parents (快乐成长, 国际视野, 全人教育, 自主探索, 自信表达).
- Do NOT repeat contact info, hashtags, or separator lines inside body copy (the app assembles contact blocks and hashtags deterministically).
- Do NOT fabricate awards, participant numbers, dates, or quotes not given in the brief or clearly visible in photos.
`.trim();

export function normalizeChineseSchoolName(text: string): string {
  if (!text) return '';
  return text
    .replace(/Somkidvittaya\s*学校/gi, 'somkidvittaya学校')
    .replace(/Somkid\s*Wittaya\s*学校/gi, 'somkidvittaya学校')
    .replace(/松吉威提雅学校|松吉学校|森吉威提雅学校|森吉学校|颂吉威提雅学校/g, 'somkidvittaya学校');
}

/**
 * Repairs and flags illegal bare grade prefixes without a following digit:
 * e.g. "K. students", "K. artists", "K.阶段", "G. learners", "ระดับ อ.", "ระดับ ป."
 * while strictly preserving valid numbered grades like K.1, K.2-K.3, G.4, อ.1-อ.3, ป.4.
 */
export function validateAndFixGradeNotation(text: string): { fixedText: string; warnings: string[] } {
  if (!text) return { fixedText: '', warnings: [] };
  let out = text;
  const warnings: string[] = [];

  // 1. K.0 / Pre-K. -> Prep School students (preserve trailing whitespace if no noun follows)
  if (/(?:^|[\s(\["'“])(?:Pre-?K\.?|K\.?\s*0)(?![A-Za-z0-9])/i.test(out)) {
    warnings.push('Replaced Pre-K/K.0 with Prep School');
    out = out.replace(
      /(^|[\s(\["'“])(?:Pre-?K\.?|K\.?\s*0)(?:\s+(?:students?|learners?|kids?|children))?(?![A-Za-z0-9])/gi,
      '$1Prep School students',
    );
  }

  // 2. Chinese bare "K.阶段" or "K.幼儿" without digit -> "幼儿园阶段" / "幼儿园"
  if (/K\.\s*(?:阶段|幼儿|学生)/i.test(out)) {
    warnings.push('Replaced bare Chinese K. notation with 幼儿园');
    out = out.replace(/K\.\s*(阶段|幼儿|学生)/gi, '幼儿园$1');
  }

  // 3. English bare "K." without digit (e.g. "K. students", "K. artists", "K. learners", or standalone "K.")
  // Negative lookbehind ensures we don't match "U.K." or "O.K."
  const bareKRegex = /(^|[\s(\["'“])(?<![A-Za-z]\.)K\.(?!\s*[1-3]\b)(?:\s+(?:students?|learners?|artists?|kids?|children|pupils?|class))?/gi;
  out = out.replace(bareKRegex, (match, prefix) => {
    warnings.push(`Fixed bare "K." -> "Kindergarten"`);
    const lower = match.toLowerCase();
    if (lower.includes('artist')) return `${prefix}Kindergarten artists`;
    if (lower.includes('learner')) return `${prefix}Kindergarten learners`;
    if (lower.includes('kid')) return `${prefix}Kindergarten kids`;
    if (lower.includes('children')) return `${prefix}Kindergarten children`;
    if (lower.includes('pupil')) return `${prefix}Kindergarten pupils`;
    if (lower.includes('class')) return `${prefix}Kindergarten class`;
    if (lower.includes('student')) return `${prefix}Kindergarten students`;
    return `${prefix}Kindergarten`;
  });

  // 4. English bare "G." without digit (e.g. "G. students", "G. learners")
  const bareGRegex = /(^|[\s(\["'“])(?<![A-Za-z]\.)G\.(?!\s*[1-6]\b)(?:\s+(?:students?|learners?|pupils?|class))?/gi;
  out = out.replace(bareGRegex, (match, prefix) => {
    warnings.push(`Fixed bare "G." -> "Primary"`);
    const lower = match.toLowerCase();
    if (lower.includes('learner')) return `${prefix}Primary learners`;
    if (lower.includes('pupil')) return `${prefix}Primary pupils`;
    if (lower.includes('class')) return `${prefix}Primary class`;
    if (lower.includes('student')) return `${prefix}Primary students`;
    return `${prefix}Primary`;
  });

  // 5. Thai bare "อ." without digit 1-3 (e.g., "นักเรียนระดับ อ. ณ", "ระดับชั้น อ. ")
  const bareThaiKindergarten = /(ระดับ(?:ชั้น)?|นักเรียน(?:ชั้น|ระดับ)?)\s*อ\.(?!\s*[1-3]\b)/g;
  if (bareThaiKindergarten.test(out)) {
    warnings.push('Fixed bare Thai "อ." -> "อนุบาล"');
    out = out.replace(bareThaiKindergarten, '$1อนุบาล');
  }

  // 6. Thai bare "ป." without digit 1-6 (e.g., "นักเรียนระดับ ป. ณ")
  const bareThaiPrimary = /(ระดับ(?:ชั้น)?|นักเรียน(?:ชั้น|ระดับ)?)\s*ป\.(?!\s*[1-6]\b)/g;
  if (bareThaiPrimary.test(out)) {
    warnings.push('Fixed bare Thai "ป." -> "ประถมศึกษา"');
    out = out.replace(bareThaiPrimary, '$1ประถมศึกษา');
  }

  return {
    fixedText: out,
    warnings: Array.from(new Set(warnings)),
  };
}

/**
 * PR-Aware PDPA Sanitizer:
 * Redacts high-risk student/personal PII (citizen IDs, private mobile numbers,
 * student IDs, minor child names) while preserving school phone (038-611251)
 * and official leadership names.
 */
export function sanitizeBriefForAI(text: string): { cleanText: string; redactionCount: number } {
  if (!text || typeof text !== 'string') {
    return { cleanText: '', redactionCount: 0 };
  }

  let count = 0;
  let clean = text;

  // Protect official leadership names with temporary placeholders so they are never redacted
  const placeholders: Array<{ token: string; original: string }> = [];
  LEADERSHIP_ROSTER.forEach((leader, idx) => {
    const escapedFull = leader.th.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedBare = leader.bareTh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:${escapedFull}|(?:นาย|นางสาว|ดร\\.|ผอ\\.)?\\s*${escapedBare})`, 'g');
    clean = clean.replace(regex, (matched) => {
      const token = `__LEADER_${idx}_${placeholders.length}__`;
      placeholders.push({ token, original: matched });
      return token;
    });
  });

  // 1. Thai 13-digit Citizen ID
  clean = clean.replace(/(^|[^\d])(\d{1}[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d{1})(?=$|[^\d])/g, (_, pre) => {
    count++;
    return `${pre}[เลขบัตรประชาชน]`;
  });

  // 2. Personal Thai mobile numbers (06x, 08x, 09x) - leaves school landline 038-611251 intact
  clean = clean.replace(/(^|[^\d])(0[689]\d{1}[-\s]?\d{3}[-\s]?\d{4})(?=$|[^\d])/g, (_, pre) => {
    count++;
    return `${pre}[เบอร์โทรศัพท์ส่วนตัว]`;
  });

  // 3. Personal non-school emails (preserve @somkidvittaya.ac.th)
  clean = clean.replace(/\b[A-Za-z0-9._%+-]+@(?!somkidvittaya\.ac\.th\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, () => {
    count++;
    return '[อีเมลส่วนตัว]';
  });

  // 4. Student IDs (e.g. SV-1234, SV12345, 10xxx)
  clean = clean.replace(/(^|[^\w])(SV-?\d{4,6}|10\d{3})(?=$|[^\w])/gi, (_, pre) => {
    count++;
    return `${pre}[รหัสนักเรียน]`;
  });

  // 5. Minor student names with child prefixes (ด.ช., ด.ญ., เด็กชาย, เด็กหญิง)
  clean = clean.replace(/(?:เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)\s*[ก-๙]+(?:\s+[ก-๙]+)?/g, () => {
    count++;
    return 'นักเรียน';
  });

  // Restore protected leadership names
  for (const item of placeholders) {
    clean = clean.split(item.token).join(item.original);
  }

  return {
    cleanText: clean.replace(/[ \t]{2,}/g, ' ').trim(),
    redactionCount: count,
  };
}

export function formatHashtags(tags: string[]): string {
  const cleaned = tags
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`));
  return Array.from(new Set(cleaned)).join(' ');
}

export function assembleFacebookCaption(brand: BrandId, social: SocialCaptions): string {
  const hashtagsStr = formatHashtags(social.hashtags || []);
  const sig = (social.signature_en || '').trim();

  if (brand !== 'main') {
    const parts = [social.fb_th.trim()];
    if (hashtagsStr) parts.push(hashtagsStr);
    return parts.filter(Boolean).join('\n\n');
  }

  const blocks: string[] = [];
  if (social.fb_en.trim()) {
    blocks.push(`${social.fb_en.trim()}\n\n${CONTACT_BLOCKS.en}`);
  }
  if (social.fb_zh.trim()) {
    blocks.push(`${social.fb_zh.trim()}\n\n${CONTACT_BLOCKS.zh}`);
  }
  if (social.fb_th.trim()) {
    blocks.push(`${social.fb_th.trim()}\n\n${CONTACT_BLOCKS.th}`);
  }

  const tailParts = [hashtagsStr, sig].filter(Boolean);
  if (tailParts.length > 0) {
    blocks.push(tailParts.join('\n\n'));
  }

  return blocks.join(`\n${DIVIDER_LINE}\n\n`).trim();
}

export function assembleInstagramCaption(brand: BrandId, social: SocialCaptions): string {
  if (brand !== 'main') return '';
  const body = (social.ig_en || social.fb_en || '').trim();
  // Select clean IG-focused hashtags (3-6 tags)
  const igTags = formatHashtags((social.hashtags || []).slice(0, 6));
  const blocks = [body, CONTACT_BLOCKS.en];
  if (igTags) blocks.push(igTags);
  return blocks.filter(Boolean).join(`\n${DIVIDER_LINE}\n\n`).trim();
}
