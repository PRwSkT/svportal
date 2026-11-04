import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export interface RoomDisplayConfig {
  room_code: string;
  room_name: string;
  room_number: string;
  building: string;
  capacity?: number;
  logo_url: string;
  logo_style?: 'rounded' | 'circle' | 'plain';
  open_time: string;              // e.g. "07:30"
  close_time: string;             // e.g. "17:00"
  active_days: number[];          // 1 = Mon ... 5 = Fri
  checkin_grace_minutes: number;  // allow check-in X mins before start_time
  subtitle: string;
  is_active?: boolean;
  updated_at: string;
}

export interface RoomBookingItem {
  id: string;
  room_code: string;
  date: string;            // "YYYY-MM-DD" in Asia/Bangkok
  start_time: string;      // "HH:mm"
  end_time: string;        // "HH:mm"
  title: string;           // Subject / Activity purpose
  booker_type: 'TEACHER' | 'STUDENT';
  booker_id: string;       // student_id or teacher personnel id / email
  booker_name: string;
  booker_role_label: string;
  participants_count: number;
  notes?: string;
  status: 'BOOKED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  created_at: string;
}

export const DEFAULT_SCHOOL_EMBLEM = '/tv/assets/images/emblem-navy.png';

function normalizeLogoUrl(url?: string): string {
  if (!url || url === '/logo.png') {
    return DEFAULT_SCHOOL_EMBLEM;
  }
  return url;
}

export const DEFAULT_LLC_CONFIG: RoomDisplayConfig = {
  room_code: 'LLC',
  room_name: 'ห้อง LLC',
  room_number: 'LLC-101',
  building: 'ศูนย์การเรียนรู้ภาษา (Language Learning Center)',
  capacity: 30,
  logo_url: DEFAULT_SCHOOL_EMBLEM,
  logo_style: 'rounded',
  open_time: '07:30',
  close_time: '17:00',
  active_days: [1, 2, 3, 4, 5],
  checkin_grace_minutes: 15,
  subtitle: 'กรุณาจองล่วงหน้าในระบบ SV Portal และสแกน QR Code หน้าห้องเพื่อยืนยันเข้าใช้งาน',
  is_active: true,
  updated_at: new Date().toISOString(),
};

const ROOM_DIRECTORY_KEY = 'room_booking:directory';

/**
 * Helper to get current Thailand date/time components (UTC+7)
 */
export function getBangkokNow() {
  const now = new Date();
  const bangkokTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = bangkokTime.getUTCFullYear();
  const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bangkokTime.getUTCDate()).padStart(2, '0');
  const hours = String(bangkokTime.getUTCHours()).padStart(2, '0');
  const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(bangkokTime.getUTCSeconds()).padStart(2, '0');
  const dayOfWeek = bangkokTime.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${minutes}`,
    fullTimeStr: `${hours}:${minutes}:${seconds}`,
    dayOfWeek,
    totalMinutes: bangkokTime.getUTCHours() * 60 + bangkokTime.getUTCMinutes(),
    isoNow: now.toISOString(),
  };
}

export function timeToMinutes(t: string): number {
  const parts = (t || '00:00').split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

export function generateQrToken(roomCode: string, dateStr: string, bookingId?: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'svportal-room-secret';
  const payload = `${roomCode.toUpperCase()}|${dateStr}|${bookingId || 'GENERAL'}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
}

/**
 * Retrieves all configured rooms in SV Portal
 */
export async function getAllRooms(): Promise<RoomDisplayConfig[]> {
  const supabase = getAdminClient();
  const { data: dirRow } = await supabase
    .from('signage_settings')
    .select('value')
    .eq('key', ROOM_DIRECTORY_KEY)
    .maybeSingle();

  let codes: string[] = ['LLC'];
  if (dirRow?.value) {
    try {
      const parsed = JSON.parse(dirRow.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        codes = parsed.map((c: string) => String(c).toUpperCase());
      }
    } catch {
      // fallback to LLC
    }
  }

  const keys = codes.map((c) => `room_config:${c}`);
  const { data: rows } = await supabase
    .from('signage_settings')
    .select('key, value')
    .in('key', keys);

  const map = new Map<string, RoomDisplayConfig>();
  for (const r of rows || []) {
    try {
      const parsed = JSON.parse(r.value);
      if (parsed?.room_code) {
        map.set(String(parsed.room_code).toUpperCase(), {
          ...DEFAULT_LLC_CONFIG,
          ...parsed,
          logo_url: normalizeLogoUrl(parsed.logo_url),
          room_code: String(parsed.room_code).toUpperCase(),
        });
      }
    } catch {
      // ignore
    }
  }

  const result: RoomDisplayConfig[] = [];
  for (const code of codes) {
    if (map.has(code)) {
      result.push(map.get(code)!);
    } else if (code === 'LLC') {
      result.push(DEFAULT_LLC_CONFIG);
    }
  }

  if (result.length === 0) {
    result.push(DEFAULT_LLC_CONFIG);
  }

  return result;
}

export async function getRoomConfig(roomCode = 'LLC'): Promise<RoomDisplayConfig> {
  const cleanCode = (roomCode || 'LLC').trim().toUpperCase();
  const supabase = getAdminClient();
  const key = `room_config:${cleanCode}`;
  const { data } = await supabase
    .from('signage_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (data?.value) {
    try {
      const parsed = JSON.parse(data.value);
      return {
        ...DEFAULT_LLC_CONFIG,
        ...parsed,
        logo_url: normalizeLogoUrl(parsed.logo_url),
        room_code: cleanCode,
      };
    } catch {
      // ignore
    }
  }

  if (cleanCode === 'LLC') return DEFAULT_LLC_CONFIG;

  return {
    ...DEFAULT_LLC_CONFIG,
    room_code: cleanCode,
    room_name: `ห้อง ${cleanCode}`,
    room_number: cleanCode,
    building: 'อาคารเรียนโรงเรียนสมคิดวิทยา',
  };
}

export async function saveRoomConfig(
  config: Partial<RoomDisplayConfig>,
  roomCode = 'LLC'
): Promise<RoomDisplayConfig> {
  const cleanCode = (config.room_code || roomCode || 'LLC')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  const supabase = getAdminClient();
  const current = await getRoomConfig(cleanCode);
  const updated: RoomDisplayConfig = {
    ...current,
    ...config,
    room_code: cleanCode,
    updated_at: new Date().toISOString(),
  };

  // Save room config
  const key = `room_config:${cleanCode}`;
  await supabase.from('signage_settings').upsert({
    key,
    value: JSON.stringify(updated),
    updated_at: updated.updated_at,
  });

  // Ensure roomCode is in the directory list
  const existingRooms = await getAllRooms();
  const codeSet = new Set(existingRooms.map((r) => r.room_code.toUpperCase()));
  codeSet.add(cleanCode);
  await supabase.from('signage_settings').upsert({
    key: ROOM_DIRECTORY_KEY,
    value: JSON.stringify(Array.from(codeSet)),
    updated_at: updated.updated_at,
  });

  return updated;
}

export async function deleteRoomConfig(roomCode: string): Promise<void> {
  const cleanCode = roomCode.trim().toUpperCase();
  if (cleanCode === 'LLC') {
    throw new Error('ไม่สามารถลบห้องหลัก (LLC) ได้ แต่สามารถแก้ไขชื่อและข้อมูลห้องได้');
  }
  const supabase = getAdminClient();
  const existingRooms = await getAllRooms();
  const remaining = existingRooms
    .map((r) => r.room_code.toUpperCase())
    .filter((c) => c !== cleanCode);

  await supabase.from('signage_settings').upsert({
    key: ROOM_DIRECTORY_KEY,
    value: JSON.stringify(remaining.length ? remaining : ['LLC']),
    updated_at: new Date().toISOString(),
  });
}

export async function getAllRoomBookings(roomCode = 'LLC'): Promise<RoomBookingItem[]> {
  const cleanCode = (roomCode || 'LLC').trim().toUpperCase();
  const supabase = getAdminClient();
  const key = `room_bookings:${cleanCode}`;
  const { data } = await supabase
    .from('signage_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (data?.value) {
    try {
      const list = JSON.parse(data.value);
      if (Array.isArray(list)) return list;
    } catch {
      // ignore parse error
    }
  }
  return [];
}

export async function saveAllRoomBookings(
  bookings: RoomBookingItem[],
  roomCode = 'LLC'
): Promise<void> {
  const cleanCode = (roomCode || 'LLC').trim().toUpperCase();
  const supabase = getAdminClient();
  const key = `room_bookings:${cleanCode}`;
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const trimmed = bookings
    .filter((b) => b.date >= cutoffDate)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

  await supabase.from('signage_settings').upsert({
    key,
    value: JSON.stringify(trimmed),
    updated_at: new Date().toISOString(),
  });
}

/**
 * Computes live state for any room display (works on iPad mini iOS 9.3.6, modern tablets, Smart TVs, & browsers)
 */
export async function getRoomDisplayState(roomCode = 'LLC', targetDate?: string) {
  const cleanCode = (roomCode || 'LLC').trim().toUpperCase();
  const nowInfo = getBangkokNow();
  const dateStr = targetDate || nowInfo.dateStr;
  const config = await getRoomConfig(cleanCode);
  const allBookings = await getAllRoomBookings(cleanCode);
  const allRooms = await getAllRooms();

  // Filter bookings for target date (excluding cancelled)
  const dayBookings = allBookings
    .filter((b) => b.date === dateStr && b.status !== 'CANCELLED')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nowMin = nowInfo.totalMinutes;
  const openMin = timeToMinutes(config.open_time);
  const closeMin = timeToMinutes(config.close_time);
  const isWorkday = config.active_days.includes(nowInfo.dayOfWeek);
  const isWithinHours = isWorkday && nowMin >= openMin && nowMin < closeMin;

  let currentBooking: RoomBookingItem | null = null;
  let nextBooking: RoomBookingItem | null = null;

  for (const b of dayBookings) {
    const startMin = timeToMinutes(b.start_time);
    const endMin = timeToMinutes(b.end_time);
    const checkinWindowStart = startMin - (config.checkin_grace_minutes || 15);

    if (dateStr === nowInfo.dateStr) {
      if (nowMin >= checkinWindowStart && nowMin < endMin) {
        if (!currentBooking) {
          currentBooking = b;
        }
      } else if (nowMin < startMin && !nextBooking && (!currentBooking || b.id !== currentBooking.id)) {
        nextBooking = b;
      }
    }
  }

  let roomStatus: 'AVAILABLE' | 'WAITING_CHECKIN' | 'IN_USE' | 'SLEEP' = 'AVAILABLE';
  if (!isWithinHours) {
    roomStatus = 'SLEEP';
  } else if (currentBooking) {
    roomStatus = currentBooking.status === 'CHECKED_IN' ? 'IN_USE' : 'WAITING_CHECKIN';
  } else {
    roomStatus = 'AVAILABLE';
  }

  const activeBookingForQr = currentBooking || nextBooking || null;
  const qrToken = generateQrToken(
    config.room_code,
    nowInfo.dateStr,
    activeBookingForQr ? activeBookingForQr.id : 'GENERAL'
  );

  return {
    server_time: nowInfo.fullTimeStr,
    server_date: nowInfo.dateStr,
    day_of_week: nowInfo.dayOfWeek,
    is_within_operating_hours: isWithinHours,
    room_status: roomStatus,
    config,
    rooms_list: allRooms.map((r) => ({
      room_code: r.room_code,
      room_name: r.room_name,
      room_number: r.room_number,
      building: r.building,
      logo_url: r.logo_url,
    })),
    current_booking: currentBooking,
    next_booking: nextBooking,
    today_bookings: dayBookings,
    qr_token: qrToken,
    qr_booking_id: activeBookingForQr ? activeBookingForQr.id : null,
  };
}
