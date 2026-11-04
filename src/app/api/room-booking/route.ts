import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  getRoomDisplayState,
  getAllRoomBookings,
  saveAllRoomBookings,
  saveRoomConfig,
  deleteRoomConfig,
  getAllRooms,
  getBangkokNow,
  timeToMinutes,
  RoomBookingItem,
} from '@/lib/room-booking/service';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = (searchParams.get('room') || 'LLC').trim().toUpperCase();
    const dateParam = searchParams.get('date') || undefined;
    const includeAll = searchParams.get('include_all') === '1';

    const state = await getRoomDisplayState(roomCode, dateParam);
    const rooms = await getAllRooms();

    let allBookings: RoomBookingItem[] | undefined = undefined;
    if (includeAll) {
      allBookings = await getAllRoomBookings(roomCode);
    }

    // Detect LAN IP when running locally so mobile QR scanning works even from localhost
    let lanHost = '';
    try {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            lanHost = net.address;
            break;
          }
        }
        if (lanHost) break;
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        success: true,
        lan_ip: lanHost || null,
        rooms,
        ...state,
        all_bookings: allBookings,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('GET /api/room-booking error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomCode = (body.room_code || 'LLC').trim().toUpperCase();
    const date = (body.date || getBangkokNow().dateStr).trim();
    const startTime = (body.start_time || '').trim();
    const endTime = (body.end_time || '').trim();
    const title = (body.title || '').trim();
    const bookerType: 'TEACHER' | 'STUDENT' = body.booker_type === 'STUDENT' ? 'STUDENT' : 'TEACHER';
    const rawBookerId = (body.booker_id || '').trim();
    let bookerName = (body.booker_name || '').trim();
    let bookerRoleLabel = (body.booker_role_label || '').trim();
    const participantsCount = Math.max(1, Number(body.participants_count) || 1);
    const notes = (body.notes || '').trim();

    if (!date || !startTime || !endTime || !title) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกวันที่ เวลาเริ่ม-สิ้นสุด และหัวข้อการจองให้ครบถ้วน' },
        { status: 400 }
      );
    }

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      return NextResponse.json(
        { success: false, error: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น' },
        { status: 400 }
      );
    }

    // Lookup student or personnel from SVPortal DB if needed
    const supabase = getAdminClient();
    if (bookerType === 'STUDENT' && rawBookerId) {
      const { data: student } = await supabase
        .from('students')
        .select('student_id, name, prefix, first_name, last_name, grade, classroom')
        .or(`student_id.eq.${rawBookerId},id.eq.${rawBookerId}`)
        .maybeSingle();

      if (student) {
        const fullName =
          student.name ||
          `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
        if (!bookerName && fullName) bookerName = fullName;
        if (!bookerRoleLabel) {
          bookerRoleLabel = `นักเรียน ${student.grade || ''}${student.classroom ? '/' + student.classroom : ''} (${student.student_id || rawBookerId})`.trim();
        }
      }
    } else if (bookerType === 'TEACHER' && rawBookerId) {
      const { data: person } = await supabase
        .from('personnel')
        .select('id, name_th, position_th, email')
        .or(`id.eq.${rawBookerId},email.ilike.${rawBookerId}`)
        .maybeSingle();

      if (person) {
        if (!bookerName && person.name_th) bookerName = person.name_th;
        if (!bookerRoleLabel) bookerRoleLabel = person.position_th || 'ครู / บุคลากร';
      }
    }

    if (!bookerName) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อผู้จอง (ครู หรือ นักเรียน)' },
        { status: 400 }
      );
    }

    if (!bookerRoleLabel) {
      bookerRoleLabel = bookerType === 'STUDENT' ? `นักเรียน (${rawBookerId || '-'})` : 'ครู / บุคลากร';
    }

    const allBookings = await getAllRoomBookings(roomCode);

    // Check overlap on the same date in this room
    const conflict = allBookings.find((b) => {
      if (b.date !== date || b.status === 'CANCELLED' || b.status === 'COMPLETED') return false;
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return startMin < bEnd && endMin > bStart;
    });

    if (conflict) {
      return NextResponse.json(
        {
          success: false,
          error: `ห้อง ${roomCode} ช่วงเวลา ${startTime} - ${endTime} น. มีการจองแล้วโดย "${conflict.booker_name}" (${conflict.title} เวลา ${conflict.start_time}-${conflict.end_time} น.)`,
        },
        { status: 409 }
      );
    }

    const newBooking: RoomBookingItem = {
      id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      room_code: roomCode,
      date,
      start_time: startTime,
      end_time: endTime,
      title,
      booker_type: bookerType,
      booker_id: rawBookerId || bookerName,
      booker_name: bookerName,
      booker_role_label: bookerRoleLabel,
      participants_count: participantsCount,
      notes,
      status: 'BOOKED',
      checked_in_at: null,
      checked_in_by: null,
      created_at: new Date().toISOString(),
    };

    allBookings.push(newBooking);
    await saveAllRoomBookings(allBookings, roomCode);

    return NextResponse.json({
      success: true,
      booking: newBooking,
      message: `บันทึกการจองห้อง ${roomCode} เรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    console.error('POST /api/room-booking error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;
    const roomCode = (body.room_code || 'LLC').trim().toUpperCase();

    // 1. Create or Update Room Config
    if (action === 'update_config' || action === 'create_room') {
      if (!roomCode) {
        return NextResponse.json({ success: false, error: 'กรุณาระบุรหัสห้อง (Room Code)' }, { status: 400 });
      }
      const updated = await saveRoomConfig(
        {
          room_code: roomCode,
          room_name: body.room_name || `ห้อง ${roomCode}`,
          room_number: body.room_number || roomCode,
          building: body.building || 'อาคารเรียนโรงเรียนสมคิดวิทยา',
          capacity: Number(body.capacity) || 30,
          logo_url: body.logo_url || '/logo.png',
          logo_style: body.logo_style || 'rounded',
          open_time: body.open_time || '07:30',
          close_time: body.close_time || '17:00',
          active_days: Array.isArray(body.active_days) ? body.active_days : [1, 2, 3, 4, 5],
          checkin_grace_minutes: Number(body.checkin_grace_minutes) || 15,
          subtitle:
            body.subtitle ||
            'กรุณาจองล่วงหน้าในระบบ SV Portal และสแกน QR Code หน้าห้องเพื่อยืนยันเข้าใช้งาน',
        },
        roomCode
      );
      const rooms = await getAllRooms();
      return NextResponse.json({
        success: true,
        config: updated,
        rooms,
        message:
          action === 'create_room'
            ? `เพิ่มห้องใหม่ "${updated.room_name}" เรียบร้อยแล้ว`
            : `บันทึกการตั้งค่าห้อง "${updated.room_name}" เรียบร้อยแล้ว`,
      });
    }

    // 1b. Delete Room
    if (action === 'delete_room') {
      await deleteRoomConfig(roomCode);
      const rooms = await getAllRooms();
      return NextResponse.json({
        success: true,
        rooms,
        message: `ลบห้อง ${roomCode} ออกจากระบบเรียบร้อยแล้ว`,
      });
    }

    const allBookings = await getAllRoomBookings(roomCode);
    const nowInfo = getBangkokNow();

    // 2. QR Check-in (Only for advance bookings in SVPortal)
    if (action === 'checkin') {
      const bookingId = body.booking_id;
      const userType: 'TEACHER' | 'STUDENT' = body.user_type === 'STUDENT' ? 'STUDENT' : 'TEACHER';
      const identifier = (body.identifier || '').trim();

      let target = allBookings.find((b) => b.id === bookingId && b.status !== 'CANCELLED');

      if (!target) {
        const todayBookings = allBookings.filter(
          (b) => b.date === nowInfo.dateStr && (b.status === 'BOOKED' || b.status === 'CHECKED_IN')
        );
        const nowMin = nowInfo.totalMinutes;
        target = todayBookings.find((b) => {
          const sMin = timeToMinutes(b.start_time) - 20;
          const eMin = timeToMinutes(b.end_time);
          return nowMin >= sMin && nowMin <= eMin;
        });
      }

      if (!target) {
        return NextResponse.json(
          {
            success: false,
            error: 'ไม่พบรายการจองล่วงหน้าในรอบเวลานี้ กรุณาจองห้องล่วงหน้าในระบบ SV Portal ก่อนเข้าใช้งาน',
          },
          { status: 404 }
        );
      }

      let verifiedByLabel = identifier || target.booker_name;
      const supabase = getAdminClient();

      if (userType === 'STUDENT') {
        if (!identifier) {
          return NextResponse.json(
            { success: false, error: 'กรุณากรอกรหัสนักเรียน หรือชื่อผู้จองเพื่อยืนยันเข้าใช้งาน' },
            { status: 400 }
          );
        }

        const { data: student } = await supabase
          .from('students')
          .select('student_id, name, prefix, first_name, last_name, grade, classroom')
          .or(`student_id.eq.${identifier},name.ilike.%${identifier}%,first_name.ilike.%${identifier}%`)
          .limit(1)
          .maybeSingle();

        const matchesBooking =
          target.booker_id.toLowerCase() === identifier.toLowerCase() ||
          target.booker_name.toLowerCase().includes(identifier.toLowerCase());

        if (!student && !matchesBooking) {
          return NextResponse.json(
            {
              success: false,
              error: `ไม่พบรหัสนักเรียน "${identifier}" ในระบบ หรือไม่ตรงกับชื่อผู้จอง (${target.booker_name})`,
            },
            { status: 403 }
          );
        }

        if (student) {
          const sName =
            student.name ||
            `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
          verifiedByLabel = `${sName} (${student.student_id || identifier})`;
        } else {
          verifiedByLabel = `${target.booker_name} (${identifier})`;
        }
      } else {
        if (identifier) {
          const { data: teacher } = await supabase
            .from('personnel')
            .select('name_th, position_th, email')
            .or(`email.ilike.${identifier},name_th.ilike.%${identifier}%`)
            .limit(1)
            .maybeSingle();

          if (teacher?.name_th) {
            verifiedByLabel = teacher.name_th;
          } else {
            verifiedByLabel = identifier;
          }
        } else {
          verifiedByLabel = target.booker_name;
        }
      }

      target.status = 'CHECKED_IN';
      target.checked_in_at = nowInfo.timeStr;
      target.checked_in_by = verifiedByLabel;

      await saveAllRoomBookings(allBookings, roomCode);

      return NextResponse.json({
        success: true,
        booking: target,
        message: `เช็คอินเข้าใช้งานห้อง ${roomCode} สำเร็จ! (${verifiedByLabel})`,
      });
    }

    // 3. Checkout / End early
    if (action === 'checkout') {
      const target = allBookings.find((b) => b.id === body.booking_id);
      if (!target) {
        return NextResponse.json({ success: false, error: 'ไม่พบรายการจอง' }, { status: 404 });
      }
      target.status = 'COMPLETED';
      await saveAllRoomBookings(allBookings, roomCode);
      return NextResponse.json({
        success: true,
        booking: target,
        message: 'สิ้นสุดการใช้งานและคืนห้องเรียบร้อยแล้ว',
      });
    }

    // 4. Cancel booking
    if (action === 'cancel') {
      const target = allBookings.find((b) => b.id === body.booking_id);
      if (!target) {
        return NextResponse.json({ success: false, error: 'ไม่พบรายการจอง' }, { status: 404 });
      }
      target.status = 'CANCELLED';
      await saveAllRoomBookings(allBookings, roomCode);
      return NextResponse.json({
        success: true,
        booking: target,
        message: 'ยกเลิกรายการจองเรียบร้อยแล้ว',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('PUT /api/room-booking error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
