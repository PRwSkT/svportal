/**
 * ปพ.2 (Certificate of Graduation) Engine
 * หลักฐานแสดงวุฒิการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน (ระดับประถมศึกษา)
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { formatThaiDate } from '@/lib/opec/regis-validator';

export interface PP2CertificateData {
  certificateNumber: string; // เช่น 1121100013/2568/001
  studentId: string;
  citizenId: string;
  fullNameTh: string;
  fullNameEn: string;
  birthDateTh: string;
  graduationDateTh: string;
  curriculumName: string;
  schoolName: string;
  district: string;
  province: string;
  directorName: string;
  chairmanName: string;
}

/**
 * ดึงและจัดเตรียมข้อมูลประกาศนียบัตร ปพ.2 รายบุคคล
 */
export async function getPP2DataByStudentId(studentId: string, customClient?: any): Promise<PP2CertificateData> {
  const supabase = customClient || getAdminClient();

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();

  if (error || !student) {
    throw new Error(`ไม่พบข้อมูลนักเรียนรหัส ${studentId}`);
  }

  // Generate certificate sequence number
  const paddedId = String(student.id).padStart(4, '0');
  const certificateNumber = `1121100013/2568/${paddedId}`;

  const birthDateTh = student.birth_date ? formatThaiDate(student.birth_date) : 'ไม่ระบุ';

  return {
    certificateNumber,
    studentId: student.id,
    citizenId: student.citizen_id || '',
    fullNameTh: student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim(),
    fullNameEn: student.name_en || 'Somkid Student',
    birthDateTh,
    graduationDateTh: '31 มีนาคม พ.ศ. 2568',
    curriculumName: 'หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช 2551 (ฉบับปรับปรุง 2560)',
    schoolName: 'โรงเรียนสมคิดวิทยา',
    district: 'อำเภอเมืองลำปาง',
    province: 'จังหวัดลำปาง',
    directorName: 'นายพิศาล เครือคงคา',
    chairmanName: 'นายสมคิด วิทยานุสรณ์'
  };
}
