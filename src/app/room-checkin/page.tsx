'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle2,
  Clock,
  UserCheck,
  GraduationCap,
  ShieldCheck,
  Calendar,
  AlertCircle,
  RefreshCw,
  DoorOpen,
} from 'lucide-react';
import { toast } from 'sonner';

interface BookingItem {
  id: string;
  room_code: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  booker_type: 'TEACHER' | 'STUDENT';
  booker_id: string;
  booker_name: string;
  booker_role_label: string;
  participants_count: number;
  status: 'BOOKED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  checked_in_at?: string | null;
  checked_in_by?: string | null;
}

function RoomCheckinContent() {
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get('room') || 'LLC').toUpperCase();
  const bookingIdParam = searchParams.get('bookingId') || '';

  const { user, appUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [roomName, setRoomName] = useState('ห้อง LLC');
  const [roomNumber, setRoomNumber] = useState('LLC-101');
  const [roomLogoUrl, setRoomLogoUrl] = useState('');
  const [todayBookings, setTodayBookings] = useState<BookingItem[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [userType, setUserType] = useState<'TEACHER' | 'STUDENT'>('STUDENT');
  const [identifier, setIdentifier] = useState('');
  const [checkinSuccess, setCheckinSuccess] = useState<BookingItem | null>(null);

  const loadRoomData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/room-booking?room=${encodeURIComponent(roomCode)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) {
        setRoomName(json.config?.room_name || 'ห้อง LLC');
        setRoomNumber(json.config?.room_number || 'LLC-101');
        setRoomLogoUrl(json.config?.room_logo_url || '');
        const list: BookingItem[] = json.today_bookings || [];
        setTodayBookings(list);

        const preferred =
          list.find((b) => b.id === bookingIdParam) ||
          json.current_booking ||
          json.next_booking ||
          list.find((b) => b.status === 'BOOKED') ||
          list[0];

        if (preferred) {
          setSelectedBookingId(preferred.id);
          setUserType(preferred.booker_type || 'STUDENT');
        }
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลการจองห้องได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoomData();
  }, [roomCode, bookingIdParam]);

  useEffect(() => {
    if (appUser?.full_name || user?.email) {
      setUserType('TEACHER');
      setIdentifier(appUser?.full_name || user?.email || '');
    }
  }, [appUser, user]);

  const selectedBooking = todayBookings.find((b) => b.id === selectedBookingId) || null;

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) {
      toast.error('ไม่พบรายการจองที่เลือก');
      return;
    }

    if (userType === 'STUDENT' && !identifier.trim()) {
      toast.error('กรุณากรอกรหัสนักเรียน หรือชื่อผู้จองเพื่อยืนยันเข้าห้อง');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/room-booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin',
          room_code: roomCode,
          booking_id: selectedBooking.id,
          user_type: userType,
          identifier: identifier.trim() || selectedBooking.booker_name,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'ไม่สามารถเช็คอินเข้าห้องได้');
        return;
      }

      setCheckinSuccess(json.booking);
      toast.success(json.message || 'เช็คอินเข้าใช้งานห้องสำเร็จ!');
      loadRoomData();
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F5F4F2] text-[#1A1A1A] px-4 py-8 flex flex-col items-center justify-center"
      style={{ fontFamily: "'Sukhumvit Set', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="w-full max-w-md bg-white border border-[#E4E0DA] rounded-2xl p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E0DA] pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block bg-[#EEF2F8] text-[#1B3A6B] border border-[#D4DFEE] text-xs font-bold px-2.5 py-0.5 rounded-md">
                {roomNumber}
              </span>
              <span className="text-xs font-bold text-[#7B1C3E]">SV Portal Check-in</span>
            </div>
            <h1 className="text-xl font-bold text-[#1A1A1A]">{roomName}</h1>
            <p className="text-xs text-[#6B6560]">ระบบยืนยันการเข้าใช้งานห้องของโรงเรียนสมคิดวิทยา</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#F5E8ED] border border-[#E8CCD7] flex items-center justify-center text-[#7B1C3E] overflow-hidden shrink-0">
            {roomLogoUrl ? (
              <img src={roomLogoUrl} alt={roomName} className="w-full h-full object-contain p-1.5" />
            ) : (
              <DoorOpen className="w-6 h-6" />
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#6B6560]">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-[#7B1C3E]" />
            <p className="text-sm font-medium">กำลังตรวจสอบตารางการจองห้อง...</p>
          </div>
        ) : checkinSuccess ? (
          <div className="py-5 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#EAF4EF] border border-[#B7DFC9] text-[#2D6A4F] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-bold text-[#2D6A4F]">เช็คอินเข้าห้องสำเร็จ!</h2>
            <p className="text-sm text-[#6B6560]">
              หน้าจอแสดงผลหน้าห้อง <strong className="text-[#1A1A1A]">{roomName}</strong> เปลี่ยนสถานะเป็น{' '}
              <strong className="text-[#7B1C3E]">&quot;กำลังใช้งาน&quot;</strong> เรียบร้อยแล้ว
            </p>
            <div className="bg-[#FAF9F7] border border-[#E4E0DA] rounded-xl p-4 text-left text-sm space-y-1.5">
              <div className="text-[#1A1A1A] font-bold text-base">{checkinSuccess.title}</div>
              <div className="text-[#6B6560]">
                เวลาใช้งาน:{' '}
                <strong className="text-[#1B3A6B]">
                  {checkinSuccess.start_time} – {checkinSuccess.end_time} น.
                </strong>
              </div>
              <div className="text-[#6B6560]">
                ผู้จอง: <strong className="text-[#1A1A1A]">{checkinSuccess.booker_name}</strong>
              </div>
              <div className="text-[#2D6A4F] font-semibold text-xs pt-1">
                ยืนยันเมื่อเวลา {checkinSuccess.checked_in_at} น. ({checkinSuccess.checked_in_by})
              </div>
            </div>
          </div>
        ) : todayBookings.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <AlertCircle className="w-11 h-11 text-[#B45309] mx-auto" />
            <h2 className="text-lg font-bold text-[#1A1A1A]">ยังไม่มีรายการจองล่วงหน้าในวันนี้</h2>
            <p className="text-xs text-[#6B6560] leading-relaxed">
              {roomName} สงวนสิทธิ์การเข้าใช้งานเฉพาะผู้ที่ทำรายการจองล่วงหน้าในระบบ SV Portal เท่านั้น
            </p>
          </div>
        ) : (
          <form onSubmit={handleCheckin} className="space-y-4">
            {/* Select Booking Slot */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#7B1C3E]" />
                เลือกรายการจองของคุณในวันนี้
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {todayBookings.map((b) => {
                  const isSelected = b.id === selectedBookingId;
                  const isAlreadyCheckedIn = b.status === 'CHECKED_IN';
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        setSelectedBookingId(b.id);
                        setUserType(b.booker_type);
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#F5E8ED] border-[#7B1C3E]'
                          : 'bg-[#FAF9F7] border-[#E4E0DA] hover:border-[#ABA49C]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-[#1B3A6B] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#7B1C3E]" />
                          {b.start_time} – {b.end_time} น.
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            isAlreadyCheckedIn
                              ? 'bg-[#EAF4EF] text-[#2D6A4F] border-[#B7DFC9]'
                              : 'bg-[#FEF3E2] text-[#B45309] border-[#F5D6A7]'
                          }`}
                        >
                          {isAlreadyCheckedIn ? 'เช็คอินแล้ว' : 'รอเช็คอิน'}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#1A1A1A]">{b.title}</div>
                      <div className="text-xs text-[#6B6560] mt-0.5">
                        ผู้จอง: {b.booker_name} ({b.booker_role_label})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Role Toggle (Teacher vs Student) */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] mb-1.5">
                สถานะผู้สแกนเข้าใช้งาน
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setUserType('STUDENT')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                    userType === 'STUDENT'
                      ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]'
                      : 'bg-white text-[#6B6560] border-[#E4E0DA] hover:bg-[#FAF9F7]'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  นักเรียน
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('TEACHER')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                    userType === 'TEACHER'
                      ? 'bg-[#7B1C3E] text-white border-[#7B1C3E]'
                      : 'bg-white text-[#6B6560] border-[#E4E0DA] hover:bg-[#FAF9F7]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  ครู / บุคลากร
                </button>
              </div>
            </div>

            {/* Identifier Input */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] mb-1.5">
                {userType === 'STUDENT'
                  ? 'รหัสนักเรียน หรือ ชื่อนักเรียนที่จองห้อง'
                  : 'ชื่อครูผู้จอง หรือ อีเมล (@somkidvittaya.ac.th)'}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  userType === 'STUDENT'
                    ? 'เช่น รหัสนักเรียน หรือ ชื่อจริง'
                    : selectedBooking?.booker_name || 'ระบุชื่อครูผู้จอง'
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#E4E0DA] text-[#1A1A1A] text-sm focus:outline-none focus:border-[#7B1C3E]"
              />
              {userType === 'TEACHER' && selectedBooking && !identifier && (
                <p className="text-[11px] text-[#6B6560] mt-1">
                  * หากเว้นว่าง ระบบจะยืนยันตามชื่อผู้จอง ({selectedBooking.booker_name})
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedBooking}
              className="w-full py-3 bg-[#7B1C3E] hover:bg-[#5E1530] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {submitting ? 'กำลังยืนยัน...' : 'ยืนยันเข้าใช้งานห้อง (Check-in)'}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RoomCheckinPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-[#F5F4F2] text-[#6B6560] flex items-center justify-center text-sm font-medium"
          style={{ fontFamily: "'Sukhumvit Set', -apple-system, BlinkMacSystemFont, sans-serif" }}
        >
          กำลังโหลดหน้าเช็คอินห้องเรียน...
        </div>
      }
    >
      <RoomCheckinContent />
    </Suspense>
  );
}
