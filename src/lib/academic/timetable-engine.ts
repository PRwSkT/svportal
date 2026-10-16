import { 
  TimetableSlot, 
  TimetableScheduleSlot,
  TeacherCompetency, 
  TeacherSubstitution,
  GradeLevel 
} from '@/types/academic';

export interface TimetableCollision {
  type: 'TEACHER_COLLISION' | 'CLASS_COLLISION' | 'ROOM_COLLISION';
  description: string;
  slot1: TimetableSlot;
  slot2: TimetableSlot;
}

export interface TeacherWorkloadSummary {
  teacherId: string;
  totalWeeklyHours: number;
  maxWeeklyHours: number;
  isOverloaded: boolean;
  dailyLoads: Record<number, number>; // day (1-5) -> count of periods
  consecutiveWarnings: string[];
}

export interface SubstituteCandidateResult {
  teacherId: string;
  teacherName: string;
  tier: 'TIER_1_SAME_SUBJECT' | 'TIER_2_SAME_GRADE' | 'TIER_3_FAIR_WORKLOAD' | 'TIER_4_LEAN_FALLBACK';
  matchScore: number;
  reason: string;
  todayTeachingHours: number;
  totalSubstitutionsThisMonth: number;
  readyToTeachWorksheet: string;
}

const CORE_SUBJECT_GROUPS = [
  'คณิตศาสตร์',
  'ภาษาไทย',
  'วิทยาศาสตร์และเทคโนโลยี',
  'ภาษาต่างประเทศ'
];

/**
 * Validates a timetable for any collisions (Teacher, Class, or Special Room)
 */
export function detectCollisions(slots: TimetableSlot[]): TimetableCollision[] {
  const collisions: TimetableCollision[] = [];

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const s1 = slots[i];
      const s2 = slots[j];

      // Must be on same day and same period
      if (s1.day_of_week !== s2.day_of_week || s1.period_number !== s2.period_number) {
        continue;
      }

      // 1. Teacher Collision
      if (s1.teacher_id === s2.teacher_id && s1.teacher_id) {
        collisions.push({
          type: 'TEACHER_COLLISION',
          description: `ครูสอนซ้อนกันในคาบที่ ${s1.period_number} วัน ${getDayName(s1.day_of_week)}`,
          slot1: s1,
          slot2: s2
        });
      }

      // 2. Class Collision
      if (s1.class_id === s2.class_id && s1.class_id) {
        collisions.push({
          type: 'CLASS_COLLISION',
          description: `ห้องเรียนมี 2 วิชาซ้อนกันในคาบที่ ${s1.period_number} วัน ${getDayName(s1.day_of_week)}`,
          slot1: s1,
          slot2: s2
        });
      }

      // 3. Room Collision (e.g. Computer lab, Gym, Science lab)
      if (s1.room_name && s2.room_name && s1.room_name === s2.room_name) {
        collisions.push({
          type: 'ROOM_COLLISION',
          description: `ห้องพิเศษ ${s1.room_name} มีการจองซ้อนกันในคาบที่ ${s1.period_number} วัน ${getDayName(s1.day_of_week)}`,
          slot1: s1,
          slot2: s2
        });
      }
    }
  }

  return collisions;
}

export function getDayName(day: number): string {
  switch (day) {
    case 1: return 'จันทร์';
    case 2: return 'อังคาร';
    case 3: return 'พุธ';
    case 4: return 'พฤหัสบดี';
    case 5: return 'ศุกร์';
    default: return `วันที่ ${day}`;
  }
}

/**
 * Calculates teacher workload and checks for overload and consecutive period stress
 */
export function calculateTeacherWorkloads(
  slots: TimetableSlot[],
  competencies: TeacherCompetency[]
): Map<string, TeacherWorkloadSummary> {
  const compMap = new Map<string, TeacherCompetency>();
  competencies.forEach(c => compMap.set(c.teacher_id, c));

  const workloadMap = new Map<string, TeacherWorkloadSummary>();

  slots.forEach(slot => {
    if (!slot.teacher_id) return;
    let summary = workloadMap.get(slot.teacher_id);
    if (!summary) {
      const comp = compMap.get(slot.teacher_id);
      summary = {
        teacherId: slot.teacher_id,
        totalWeeklyHours: 0,
        maxWeeklyHours: comp?.max_weekly_hours || 22,
        isOverloaded: false,
        dailyLoads: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        consecutiveWarnings: []
      };
      workloadMap.set(slot.teacher_id, summary);
    }

    summary.totalWeeklyHours += 1;
    summary.dailyLoads[slot.day_of_week] = (summary.dailyLoads[slot.day_of_week] || 0) + 1;
  });

  // Evaluate overload & consecutive stress (> 3 periods back-to-back)
  workloadMap.forEach(summary => {
    summary.isOverloaded = summary.totalWeeklyHours > summary.maxWeeklyHours;

    // Check consecutive periods per day
    for (let day = 1; day <= 5; day++) {
      const daySlots = slots
        .filter(s => s.teacher_id === summary.teacherId && s.day_of_week === day)
        .map(s => s.period_number)
        .sort((a, b) => a - b);

      let consecutive = 1;
      for (let i = 1; i < daySlots.length; i++) {
        if (daySlots[i] === daySlots[i - 1] + 1) {
          consecutive++;
          if (consecutive >= 4) {
            summary.consecutiveWarnings.push(
              `สอนติดต่อกัน ${consecutive} คาบ ในวัน${getDayName(day)} (คาบ ${daySlots[i - consecutive + 1]}-${daySlots[i]})`
            );
          }
        } else {
          consecutive = 1;
        }
      }
    }
  });

  return workloadMap;
}

/**
 * 5-Tier Smart Substitute Engine (น้องฟ้าจัดครูสอนแทนไม่มั่ว)
 */
export function findBestTeacherSubstitute(params: {
  dayOfWeek: number;
  periodNumber: number;
  classId: string;
  courseId: string;
  courseSubjectGroup: string;
  courseGradeLevel: GradeLevel;
  originalTeacherId: string;
  allTeachers: Array<{ id: string; name_th: string }>;
  timetables: TimetableSlot[];
  competencies: TeacherCompetency[];
  recentSubstitutions: TeacherSubstitution[];
}): SubstituteCandidateResult {
  const {
    dayOfWeek,
    periodNumber,
    courseSubjectGroup,
    courseGradeLevel,
    originalTeacherId,
    allTeachers,
    timetables,
    competencies,
    recentSubstitutions
  } = params;

  // Pre-calculate competencies map
  const compMap = new Map<string, TeacherCompetency>();
  competencies.forEach(c => compMap.set(c.teacher_id, c));

  // 1. Identify which teachers are BUSY at this specific day and period
  const busyTeacherIds = new Set<string>();
  timetables.forEach(s => {
    if (s.day_of_week === dayOfWeek && s.period_number === periodNumber && s.teacher_id) {
      busyTeacherIds.add(s.teacher_id);
    }
  });
  busyTeacherIds.add(originalTeacherId); // Cannot substitute themselves

  // 2. Filter available free teachers (must be active and not in unavailable_slots)
  const slotKey = `${dayOfWeek}_${periodNumber}`;
  const freeTeachers = allTeachers.filter(t => {
    if (busyTeacherIds.has(t.id)) return false;
    const comp = compMap.get(t.id);
    if (comp?.is_active === false) return false;
    if (comp?.unavailable_slots && comp.unavailable_slots.includes(slotKey)) return false;
    return true;
  });

  // If nobody is free -> Tier 4: Lean Staffing Fallback
  if (freeTeachers.length === 0) {
    return {
      teacherId: '',
      teacherName: 'ไม่มีครูว่างในคาบนี้',
      tier: 'TIER_4_LEAN_FALLBACK',
      matchScore: 0,
      reason: 'ครูทุกคนติดสอนในคาบนี้ แนะนำให้รวมห้องทำกิจกรรมร่วมกับห้องข้างเคียง หรือมอบหมายครูห้องติดกันช่วยดูแล',
      todayTeachingHours: 0,
      totalSubstitutionsThisMonth: 0,
      readyToTeachWorksheet: `ใบงานกิจกรรมเสริมตัวชี้วัดกลุ่มสาระ ${courseSubjectGroup} ชั้น ${courseGradeLevel} (ทำแบบฝึกหัดในห้องเรียน/ห้องสมุด)`
    };
  }

  // Substitutions count per teacher in recent history
  const subCountMap = new Map<string, number>();
  recentSubstitutions.forEach(s => {
    subCountMap.set(s.substitute_teacher_id, (subCountMap.get(s.substitute_teacher_id) || 0) + 1);
  });

  // Today teaching load per teacher
  const todayLoadMap = new Map<string, number>();
  timetables.forEach(s => {
    if (s.day_of_week === dayOfWeek && s.teacher_id) {
      todayLoadMap.set(s.teacher_id, (todayLoadMap.get(s.teacher_id) || 0) + 1);
    }
  });

  // Evaluate candidates
  const evaluatedCandidates: SubstituteCandidateResult[] = freeTeachers.map(teacher => {
    const comp = compMap.get(teacher.id);
    const todayLoad = todayLoadMap.get(teacher.id) || 0;
    const subMonthCount = subCountMap.get(teacher.id) || 0;

    const isSameSubject = comp?.eligible_subject_groups?.includes(courseSubjectGroup) || false;
    const isSameGrade = comp?.eligible_grade_levels?.includes(courseGradeLevel) || false;

    let tier: SubstituteCandidateResult['tier'] = 'TIER_3_FAIR_WORKLOAD';
    let baseScore = 50;
    let reason = '';

    if (isSameSubject) {
      tier = 'TIER_1_SAME_SUBJECT';
      baseScore = 100;
      reason = `ครูกลุ่มสาระเดียวกัน (${courseSubjectGroup}) สามารถสอนเนื้อหาต่อได้ทันที`;
    } else if (isSameGrade) {
      tier = 'TIER_2_SAME_GRADE';
      baseScore = 80;
      reason = `ครูผู้สอนในสายชั้น ${courseGradeLevel} คุ้นเคยกับเด็ก สามารถควบคุมชั้นเรียนได้ดี`;
    } else {
      tier = 'TIER_3_FAIR_WORKLOAD';
      baseScore = 60;
      reason = `เกลี่ยภาระงานเป็นธรรม (วันนี้สอนไปแล้ว ${todayLoad} คาบ, สอนแทนเดือนนี้ ${subMonthCount} ครั้ง)`;
    }

    // Workload penalty to avoid burning out the same teacher
    const finalScore = baseScore - (todayLoad * 4) - (subMonthCount * 3);

    return {
      teacherId: teacher.id,
      teacherName: teacher.name_th,
      tier,
      matchScore: finalScore,
      reason,
      todayTeachingHours: todayLoad,
      totalSubstitutionsThisMonth: subMonthCount,
      readyToTeachWorksheet: `แผนการสอนฉุกเฉินและใบงานวิชา ${courseSubjectGroup} (${courseGradeLevel}) พร้อมใช้งานทันที`
    };
  });

  // Sort descending by matchScore
  evaluatedCandidates.sort((a, b) => b.matchScore - a.matchScore);

  return evaluatedCandidates[0];
}

/**
 * Constraint Solver: Solves a weekly timetable automatically with zero collisions
 * and pedagogical optimization (Core subjects in morning, Activities in afternoon).
 */
export function generateZeroCollisionTimetable(params: {
  academicYear: string;
  term: string;
  classes: Array<{ id: string; name: string; grade_level: GradeLevel }>;
  courses: Array<{ id: string; name_th: string; subject_group: string; grade_level: GradeLevel; annual_hours: number }>;
  teachers: Array<{ id: string; name_th: string }>;
  competencies: TeacherCompetency[];
  periodsPerDay?: number; // default 6
}): {
  slots: TimetableSlot[];
  unassignedCourses: Array<{ classId: string; courseId: string; reason: string }>;
} {
  const {
    academicYear,
    term,
    classes,
    courses,
    teachers,
    competencies,
    periodsPerDay = 6
  } = params;

  const slots: TimetableSlot[] = [];
  const unassignedCourses: Array<{ classId: string; courseId: string; reason: string }> = [];

  // Track busy states and weekly hours
  // Key format: `${day}_${period}_${id}`
  const teacherBusy = new Set<string>();
  const classBusy = new Set<string>();
  const teacherHoursMap = new Map<string, number>();

  const compMap = new Map<string, TeacherCompetency>();
  competencies.forEach(c => compMap.set(c.teacher_id, c));

  for (const cls of classes) {
    // Get courses for this grade level
    const classCourses = courses.filter(c => c.grade_level === cls.grade_level);

    for (const course of classCourses) {
      // Find eligible teachers for this course (excluding inactive)
      const eligibleTeachers = teachers.filter(t => {
        const comp = compMap.get(t.id);
        if (comp?.is_active === false) return false;
        if (!comp) return true; // if no competency configured, allow as general teacher
        const matchesSubject = !comp.eligible_subject_groups || comp.eligible_subject_groups.length === 0 || 
          comp.eligible_subject_groups.includes(course.subject_group);
        const matchesGrade = !comp.eligible_grade_levels || comp.eligible_grade_levels.length === 0 || 
          comp.eligible_grade_levels.includes(cls.grade_level);
        return matchesSubject && matchesGrade;
      });

      if (eligibleTeachers.length === 0) {
        unassignedCourses.push({
          classId: cls.id,
          courseId: course.id,
          reason: `ไม่พบครูที่มีคุณสมบัติสอนกลุ่มสาระ ${course.subject_group} ชั้น ${cls.grade_level}`
        });
        continue;
      }

      // Determine required weekly periods (approx annual_hours / 40 weeks, min 1, max 4)
      const weeklyPeriods = Math.max(1, Math.min(3, Math.round((course.annual_hours || 40) / 40)));
      const isCore = CORE_SUBJECT_GROUPS.includes(course.subject_group);

      let scheduledPeriods = 0;

      // Preferred period range: Core in 1-3 (morning), Activities in 4-6 (afternoon)
      const periodOrder = isCore 
        ? [1, 2, 3, 4, 5, 6] // morning first
        : [4, 5, 6, 3, 2, 1]; // afternoon first

      // Try each day of week (1 to 5)
      for (let day = 1; day <= 5 && scheduledPeriods < weeklyPeriods; day++) {
        for (const period of periodOrder) {
          if (scheduledPeriods >= weeklyPeriods) break;

          const classKey = `${day}_${period}_${cls.id}`;
          if (classBusy.has(classKey)) continue;

          // Find free eligible teachers who are not in unavailable_slots and under max weekly hours
          const candidates = eligibleTeachers.filter(t => {
            const comp = compMap.get(t.id);
            if (comp?.is_active === false) return false;
            if (comp?.unavailable_slots && comp.unavailable_slots.includes(`${day}_${period}`)) return false;
            const tKey = `${day}_${period}_${t.id}`;
            if (teacherBusy.has(tKey)) return false;
            const currentHours = teacherHoursMap.get(t.id) || 0;
            const maxHours = comp?.max_weekly_hours || 24;
            if (currentHours >= maxHours) return false;
            return true;
          });

          // Workload balancing: pick teacher with the least scheduled hours
          candidates.sort((a, b) => {
            const loadA = teacherHoursMap.get(a.id) || 0;
            const loadB = teacherHoursMap.get(b.id) || 0;
            return loadA - loadB;
          });

          const availableTeacher = candidates[0];

          if (availableTeacher) {
            // Assign slot
            const tKey = `${day}_${period}_${availableTeacher.id}`;
            teacherBusy.add(tKey);
            classBusy.add(classKey);
            teacherHoursMap.set(availableTeacher.id, (teacherHoursMap.get(availableTeacher.id) || 0) + 1);

            slots.push({
              id: '',
              academic_year: academicYear,
              term,
              class_id: cls.id,
              course_id: course.id,
              teacher_id: availableTeacher.id,
              day_of_week: day,
              period_number: period,
              room_name: cls.name,
              created_at: new Date().toISOString()
            });

            scheduledPeriods++;
            break; // Move to next day for this course so course isn't doubled on the same day if possible
          }
        }
      }

      if (scheduledPeriods < weeklyPeriods) {
        unassignedCourses.push({
          classId: cls.id,
          courseId: course.id,
          reason: `ลงตารางได้เพียง ${scheduledPeriods}/${weeklyPeriods} คาบเนื่องจากตารางครูหรือห้องเต็ม`
        });
      }
    }
  }

  return {
    slots,
    unassignedCourses
  };
}

/**
 * Standard Daily Periods & Break Configurations for Primary (ป.1 - ป.6)
 */
export const PRIMARY_SCHEDULE_SLOTS: TimetableScheduleSlot[] = [
  {
    key: 'period_1',
    type: 'period',
    periodNumber: 1,
    label: 'คาบที่ 1',
    sublabel: 'วิชาหลักช่วงเช้า',
    startTime: '08:30',
    endTime: '09:30',
    timeRange: '08:30 - 09:30',
    durationMinutes: 60
  },
  {
    key: 'period_2',
    type: 'period',
    periodNumber: 2,
    label: 'คาบที่ 2',
    sublabel: 'วิชาหลักช่วงเช้า',
    startTime: '09:30',
    endTime: '10:30',
    timeRange: '09:30 - 10:30',
    durationMinutes: 60
  },
  {
    key: 'break_morning',
    type: 'break',
    label: 'พักเบรกเช้า',
    sublabel: 'ดื่มนม / ของว่าง',
    startTime: '10:30',
    endTime: '10:45',
    timeRange: '10:30 - 10:45',
    durationMinutes: 15,
    icon: 'coffee',
    breakType: 'morning_snack'
  },
  {
    key: 'period_3',
    type: 'period',
    periodNumber: 3,
    label: 'คาบที่ 3',
    sublabel: 'วิชาหลักช่วงเช้า',
    startTime: '10:45',
    endTime: '11:45',
    timeRange: '10:45 - 11:45',
    durationMinutes: 60
  },
  {
    key: 'break_lunch',
    type: 'break',
    label: 'พักกลางวัน',
    sublabel: 'รับประทานอาหารกลางวัน',
    startTime: '11:45',
    endTime: '12:45',
    timeRange: '11:45 - 12:45',
    durationMinutes: 60,
    icon: 'utensils',
    breakType: 'lunch'
  },
  {
    key: 'period_4',
    type: 'period',
    periodNumber: 4,
    label: 'คาบที่ 4',
    sublabel: 'เสริมทักษะช่วงบ่าย',
    startTime: '12:45',
    endTime: '13:45',
    timeRange: '12:45 - 13:45',
    durationMinutes: 60
  },
  {
    key: 'period_5',
    type: 'period',
    periodNumber: 5,
    label: 'คาบที่ 5',
    sublabel: 'เสริมทักษะช่วงบ่าย',
    startTime: '13:45',
    endTime: '14:45',
    timeRange: '13:45 - 14:45',
    durationMinutes: 60
  },
  {
    key: 'period_6',
    type: 'period',
    periodNumber: 6,
    label: 'คาบที่ 6',
    sublabel: 'กิจกรรมพัฒนาผู้เรียน',
    startTime: '14:45',
    endTime: '15:45',
    timeRange: '14:45 - 15:45',
    durationMinutes: 60
  }
];

/**
 * Standard Daily Periods & Break Configurations for Early Childhood (อ.1 - อ.3)
 */
export const KINDERGARTEN_SCHEDULE_SLOTS: TimetableScheduleSlot[] = [
  {
    key: 'period_1',
    type: 'period',
    periodNumber: 1,
    label: 'คาบที่ 1',
    sublabel: 'เสริมประสบการณ์',
    startTime: '08:30',
    endTime: '09:30',
    timeRange: '08:30 - 09:30',
    durationMinutes: 60
  },
  {
    key: 'period_2',
    type: 'period',
    periodNumber: 2,
    label: 'คาบที่ 2',
    sublabel: 'สร้างสรรค์ศิลปะ',
    startTime: '09:30',
    endTime: '10:15',
    timeRange: '09:30 - 10:15',
    durationMinutes: 45
  },
  {
    key: 'break_morning',
    type: 'break',
    label: 'พักดื่มนม',
    sublabel: 'ดื่มนมและอาหารว่าง',
    startTime: '10:15',
    endTime: '10:45',
    timeRange: '10:15 - 10:45',
    durationMinutes: 30,
    icon: 'coffee',
    breakType: 'morning_snack'
  },
  {
    key: 'period_3',
    type: 'period',
    periodNumber: 3,
    label: 'คาบที่ 3',
    sublabel: 'กิจกรรมเสรีตามมุม',
    startTime: '10:45',
    endTime: '11:15',
    timeRange: '10:45 - 11:15',
    durationMinutes: 30
  },
  {
    key: 'break_lunch',
    type: 'break',
    label: 'พักกลางวัน',
    sublabel: 'อาหารกลางวัน & แปรงฟัน',
    startTime: '11:15',
    endTime: '12:15',
    timeRange: '11:15 - 12:15',
    durationMinutes: 60,
    icon: 'utensils',
    breakType: 'lunch'
  },
  {
    key: 'break_nap',
    type: 'break',
    label: 'พักผ่อนนอนกลางวัน',
    sublabel: 'นอนหลับกลางวันปฐมวัย',
    startTime: '12:15',
    endTime: '14:00',
    timeRange: '12:15 - 14:00',
    durationMinutes: 105,
    icon: 'moon',
    breakType: 'nap'
  },
  {
    key: 'period_4',
    type: 'period',
    periodNumber: 4,
    label: 'คาบที่ 4',
    sublabel: 'กิจกรรมกลางแจ้ง',
    startTime: '14:00',
    endTime: '14:45',
    timeRange: '14:00 - 14:45',
    durationMinutes: 45
  },
  {
    key: 'period_5',
    type: 'period',
    periodNumber: 5,
    label: 'คาบที่ 5',
    sublabel: 'เกมการศึกษา / นิทาน',
    startTime: '14:45',
    endTime: '15:30',
    timeRange: '14:45 - 15:30',
    durationMinutes: 45
  }
];

export const DAILY_ROUTINE_CONFIG = {
  primary: {
    morningAssembly: { label: 'เคารพธงชาติ & โฮมรูม', timeRange: '08:00 - 08:30', icon: 'flag' },
    dismissal: { label: 'โฮมรูมท้ายวัน & เลิกเรียน', timeRange: '15:45 - 16:15', icon: 'bell' }
  },
  kindergarten: {
    morningAssembly: { label: 'เคารพธงชาติ & กายบริหาร', timeRange: '08:00 - 08:30', icon: 'flag' },
    dismissal: { label: 'เตรียมตัวกลับบ้าน', timeRange: '15:30 - 16:00', icon: 'bell' }
  }
};

