import { Personnel } from '@/types';
import { getCurrentAcademicYear } from '@/lib/constants/school';

export interface CardValidityInfo {
  academicYear: string;
  issueDate: string;
  expireDate: string;
  isActive: boolean;
}

/**
 * Automatically computes Academic Year, Valid From, and Expire Date.
 * Auto-renews every Thai academic year (May 16) as long as the staff member
 * still has a record in the system (regardless of website visibility `is_active`).
 */
export function getAutoCardValidity(personnel?: Partial<Personnel> | null): CardValidityInfo {
  const academicYear = getCurrentAcademicYear();
  const nextYear = (Number(academicYear) + 1).toString();
  const existsInSystem = Boolean(personnel && (personnel.id || personnel.name_th || personnel.name_en));

  if (!existsInSystem) {
    return {
      academicYear,
      issueDate: '-',
      expireDate: 'พ้นสภาพบุคลากร',
      isActive: false,
    };
  }

  return {
    academicYear,
    issueDate: `16 พ.ค. ${academicYear}`,
    expireDate: `15 พ.ค. ${nextYear}`,
    isActive: true,
  };
}

export interface FormattedStaffName {
  firstName: string;
  lastName: string;
  fullNameEn: string;
  fullNameTh: string;
}

/**
 * Clean and format staff name into First Name and Last Name in English uppercase.
 * Strips common prefixes like Mr, Mrs, Miss, Ms, Dr, etc.
 */
export function formatStaffName(nameEn?: string | null, nameTh?: string | null): FormattedStaffName {
  let rawEn = (nameEn || '').trim();
  const rawTh = (nameTh || '').trim();

  // Strip English prefixes (handles "MR.NATTAWAT", "Mr. Nattawat", "Miss ...", etc.)
  rawEn = rawEn.replace(/^(?:(?:miss|mrs|mr|ms|dr|prof|ajarn|kru)(?:\.|\s)+)+/i, '').trim();

  const parts = rawEn.split(/\s+/).filter(Boolean);

  let firstName = '';
  let lastName = '';

  if (parts.length === 0) {
    firstName = rawTh || 'STAFF';
    lastName = '';
  } else if (parts.length === 1) {
    firstName = parts[0].toUpperCase();
    lastName = '';
  } else {
    firstName = parts[0].toUpperCase();
    lastName = parts.slice(1).join(' ').toUpperCase();
  }

  return {
    firstName,
    lastName,
    fullNameEn: rawEn.toUpperCase(),
    fullNameTh: rawTh,
  };
}

/**
 * Format position in English uppercase (e.g. TEACHER (Primary Section))
 */
export function formatStaffPosition(positionEn?: string | null, positionTh?: string | null): string {
  if (positionEn && positionEn.trim()) {
    return positionEn.trim().toUpperCase();
  }
  if (positionTh && positionTh.trim()) {
    return positionTh.trim().toUpperCase();
  }
  return 'PERSONNEL';
}

/**
 * Generates the public verification URL for a given personnel ID
 */
export function getStaffVerificationUrl(personnelId: string, origin?: string): string {
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://sv-portal.somkidvittaya.ac.th');
  return `${baseUrl}/verify/staff/${personnelId}`;
}

/**
 * Generates standard vCard 3.0 string for contacts
 */
export function generateVCard(personnel: Partial<Personnel>, origin?: string): string {
  const nameInfo = formatStaffName(personnel.name_en, personnel.name_th);
  const verificationUrl = getStaffVerificationUrl(personnel.id || '', origin);

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N;CHARSET=UTF-8:${nameInfo.lastName || ''};${nameInfo.firstName || ''};;;`,
    `FN;CHARSET=UTF-8:${nameInfo.fullNameTh || nameInfo.fullNameEn}`,
    `ORG;CHARSET=UTF-8:โรงเรียนสมคิดวิทยา (Somkidvittaya School)`,
    `TITLE;CHARSET=UTF-8:${personnel.position_th || personnel.position_en || 'Personnel'}`,
  ];

  if (personnel.phone) {
    lines.push(`TEL;TYPE=CELL,VOICE:${personnel.phone.trim()}`);
  }

  if (personnel.email) {
    lines.push(`EMAIL;TYPE=WORK,INTERNET:${personnel.email.trim()}`);
  }

  lines.push(`URL:${verificationUrl}`);

  if (personnel.line_id) {
    lines.push(`X-LINE:${personnel.line_id.trim()}`);
  }

  if (personnel.facebook_url) {
    lines.push(`X-SOCIALPROFILE;type=facebook:${personnel.facebook_url.trim()}`);
  }

  if (personnel.instagram_url) {
    lines.push(`X-SOCIALPROFILE;type=instagram:${personnel.instagram_url.trim()}`);
  }

  if (personnel.office_room || personnel.card_bio) {
    const notes = [
      personnel.office_room ? `ห้องพัก/สถานที่ติดต่อ: ${personnel.office_room}` : '',
      personnel.card_bio ? `เกี่ยวกับ: ${personnel.card_bio}` : '',
    ].filter(Boolean).join(' | ');
    lines.push(`NOTE;CHARSET=UTF-8:${notes}`);
  }

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/**
 * Triggers a download of the .vcf contact card
 */
export function downloadVCard(personnel: Partial<Personnel>, origin?: string) {
  const vcardText = generateVCard(personnel, origin);
  const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const nameInfo = formatStaffName(personnel.name_en, personnel.name_th);
  const filename = `${(nameInfo.fullNameEn || 'staff').toLowerCase().replace(/\s+/g, '_')}.vcf`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

