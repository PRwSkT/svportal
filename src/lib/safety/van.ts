/**
 * Child In-Van Safety Alert Engine (ระบบตรวจจับความปลอดภัยรถรับ-ส่งนักเรียน)
 * ป้องกันปัญหาเด็กลืมติดในรถตู้โรงเรียน 100% ด้วยการตรวจทานสถานะขึ้น-ลงแบบสองขั้นตอน
 * พร้อมระบบสัญญาณเตือนฉุกเฉิน (Auditory & Visual Siren)
 */

export type VanPassengerStatus = 'WAITING' | 'BOARDED' | 'DISEMBARKED' | 'ABSENT';

export interface VanRouteItem {
  id: string;
  routeName: string;
  licensePlate: string;
  driverName: string;
  driverPhone?: string;
  teacherSupervisorName?: string;
  maxCapacity: number;
  studentIds: string[];
  isActive: boolean;
}

export interface VanDailyLogItem {
  id?: string;
  routeId: string;
  logDate: string; // YYYY-MM-DD
  tripType: 'morning' | 'evening';
  studentId: string;
  studentName?: string;
  grade?: string;
  boardedAt?: string;
  disembarkedAt?: string;
  status: VanPassengerStatus;
  notes?: string;
}

export interface VanSafetyAuditResult {
  isSafe: boolean;
  totalAssigned: number;
  boardedCount: number;
  disembarkedCount: number;
  absentCount: number;
  waitingCount: number;
  trappedCount: number; // นักเรียนที่ยังค้างอยู่ในรถ (BOARDED แต่ยังไม่ได้ DISEMBARKED)
  trappedStudents: {
    studentId: string;
    studentName: string;
    grade?: string;
    boardedAt?: string;
  }[];
  alarmLevel: 'SAFE' | 'WARNING' | 'EMERGENCY_ALARM';
  message: string;
}

/**
 * ตรวจสอบความปลอดภัยรถตู้โรงเรียนก่อนปิดเที่ยววิ่ง (Audit Child In-Van Safety)
 * หากยังมีเด็กค้างในรถ จะทริกเกอร์สัญญาณฉุกเฉินระดับ EMERGENCY_ALARM ทันที
 */
export function auditVanSafety(logs: VanDailyLogItem[]): VanSafetyAuditResult {
  let boardedCount = 0;
  let disembarkedCount = 0;
  let absentCount = 0;
  let waitingCount = 0;
  const trappedStudents: { studentId: string; studentName: string; grade?: string; boardedAt?: string }[] = [];

  logs.forEach(log => {
    if (log.status === 'BOARDED') {
      boardedCount++;
      trappedStudents.push({
        studentId: log.studentId,
        studentName: log.studentName || 'นักเรียน',
        grade: log.grade,
        boardedAt: log.boardedAt
      });
    } else if (log.status === 'DISEMBARKED') {
      disembarkedCount++;
    } else if (log.status === 'ABSENT') {
      absentCount++;
    } else {
      waitingCount++;
    }
  });

  const trappedCount = trappedStudents.length;

  if (trappedCount > 0) {
    return {
      isSafe: false,
      totalAssigned: logs.length,
      boardedCount,
      disembarkedCount,
      absentCount,
      waitingCount,
      trappedCount,
      trappedStudents,
      alarmLevel: 'EMERGENCY_ALARM',
      message: `[สัญญาณเตือนภัยฉุกเฉิน] ตรวจพบนักเรียนยังค้างอยู่ในรถตู้จำนวน ${trappedCount} คน! กรุณาตรวจค้นทุกที่นั่งและใต้เบาะรถทันทีก่อนดับเครื่อง!`
    };
  }

  if (waitingCount > 0) {
    return {
      isSafe: true,
      totalAssigned: logs.length,
      boardedCount,
      disembarkedCount,
      absentCount,
      waitingCount,
      trappedCount: 0,
      trappedStudents: [],
      alarmLevel: 'WARNING',
      message: `มีนักเรียนที่ยังไม่ได้เช็กชื่อขึ้นรถ ${waitingCount} คน (หากไม่ได้มาเรียนให้กดระบุเป็น 'ขาด/ไม่ขึ้นรถ')`
    };
  }

  return {
    isSafe: true,
    totalAssigned: logs.length,
    boardedCount: 0,
    disembarkedCount,
    absentCount,
    waitingCount: 0,
    trappedCount: 0,
    trappedStudents: [],
    alarmLevel: 'SAFE',
    message: '[ตรวจสอบปลอดภัย 100%] นักเรียนทุกคนลงจากรถอย่างปลอดภัยเรียบร้อยแล้ว'
  };
}
