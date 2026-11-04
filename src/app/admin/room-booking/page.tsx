'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DoorOpen,
  Calendar,
  Clock,
  Plus,
  Settings,
  Tablet,
  CheckCircle2,
  XCircle,
  UserCheck,
  Search,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  GraduationCap,
  ShieldCheck,
  Lock,
  Upload,
  Image as ImageIcon,
  Building2,
  Trash2,
  Tv,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';

interface RoomConfig {
  room_code: string;
  room_name: string;
  room_number: string;
  building: string;
  capacity?: number;
  logo_url: string;
  logo_style?: 'rounded' | 'circle' | 'plain';
  open_time: string;
  close_time: string;
  active_days: number[];
  checkin_grace_minutes: number;
  subtitle: string;
}

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

interface LookupPerson {
  type: 'TEACHER' | 'STUDENT';
  id: string;
  code: string;
  name: string;
  role_label: string;
}

const DEFAULT_SCHOOL_EMBLEM = '/tv/assets/images/emblem-navy.png';

const PRESET_LOGOS = [
  { label: 'ตราสัญลักษณ์โรงเรียน (หลัก)', url: '/tv/assets/images/emblem-navy.png' },
  { label: 'ตราโรงเรียน (พื้นกรมท่า)', url: '/qr-generator/logo/sv-logo-social.png' },
  { label: 'ตราโรงเรียน + ชื่อโรงเรียน', url: '/logo2.png' },
  { label: 'โลโก้ SV Portal', url: '/SV-Portal.png' },
  { label: 'ไอคอน SV Portal', url: '/icon.png' },
  { label: 'SV Lion', url: '/qr-generator/logo/SV-lion.png' },
];

export default function AdminRoomBookingPage() {
  const [activeTab, setActiveTab] = useState<'bookings' | 'config' | 'devices'>('bookings');
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<RoomConfig[]>([]);
  const [selectedRoomCode, setSelectedRoomCode] = useState<string>('LLC');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add New Room Modal state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomBuilding, setNewRoomBuilding] = useState('อาคารเรียนโรงเรียนสมคิดวิทยา');
  const [newRoomCapacity, setNewRoomCapacity] = useState(30);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Active Room Config state
  const [config, setConfig] = useState<RoomConfig>({
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
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // New Booking Form state
  const [bookerType, setBookerType] = useState<'TEACHER' | 'STUDENT'>('TEACHER');
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<LookupPerson[]>([]);
  const [bookerId, setBookerId] = useState('');
  const [bookerName, setBookerName] = useState('');
  const [bookerRoleLabel, setBookerRoleLabel] = useState('');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('09:30');
  const [participantsCount, setParticipantsCount] = useState(1);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const fetchRoomData = async (roomOverride?: string, dateOverride?: string) => {
    setLoading(true);
    try {
      const targetRoom = roomOverride || selectedRoomCode || 'LLC';
      const targetDate = dateOverride !== undefined ? dateOverride : selectedDate;
      const url = `/api/room-booking?room=${encodeURIComponent(targetRoom)}${
        targetDate ? `&date=${encodeURIComponent(targetDate)}` : ''
      }`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        if (!selectedDate && json.server_date) {
          setSelectedDate(json.server_date);
        }
        if (Array.isArray(json.rooms)) {
          setRooms(json.rooms);
        }
        if (json.config) {
          setConfig({
            logo_url: '/logo.png',
            logo_style: 'rounded',
            capacity: 30,
            ...json.config,
          });
        }
        setBookings(json.today_bookings || []);
        setPreviewKey((k) => k + 1);
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลห้องและการจองได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomData('LLC');
  }, []);

  const handleSwitchRoom = (code: string) => {
    setSelectedRoomCode(code);
    fetchRoomData(code, selectedDate);
  };

  // Autocomplete search from SVPortal personnel & students
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setLookupResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/room-booking/lookup-user?q=${encodeURIComponent(q)}&type=${bookerType}`
        );
        const json = await res.json();
        if (json.success) {
          setLookupResults(json.results || []);
        }
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, bookerType]);

  const handleSelectPerson = (p: LookupPerson) => {
    setBookerId(p.code);
    setBookerName(p.name);
    setBookerRoleLabel(p.role_label);
    setSearchQuery('');
    setLookupResults([]);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 240;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/png');
          setConfig((prev) => ({ ...prev, logo_url: compressedDataUrl }));
          toast.success('อัปโหลดโลโก้ห้องเรียบร้อยแล้ว (อย่าลืมกดบันทึกการตั้งค่า)');
        } else {
          setConfig((prev) => ({ ...prev, logo_url: dataUrl }));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateNewRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newRoomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode || !newRoomName.trim()) {
      toast.error('กรุณากรอกรหัสห้อง (ภาษาอังกฤษ/ตัวเลข) และชื่อห้อง');
      return;
    }

    setCreatingRoom(true);
    try {
      const res = await fetch('/api/room-booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_room',
          room_code: cleanCode,
          room_name: newRoomName.trim(),
          room_number: newRoomNumber.trim() || cleanCode,
          building: newRoomBuilding.trim() || 'อาคารเรียนโรงเรียนสมคิดวิทยา',
          capacity: Number(newRoomCapacity) || 30,
          logo_url: DEFAULT_SCHOOL_EMBLEM,
          logo_style: 'rounded',
          open_time: '07:30',
          close_time: '17:00',
          active_days: [1, 2, 3, 4, 5],
          checkin_grace_minutes: 15,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'ไม่สามารถสร้างห้องใหม่ได้');
        return;
      }

      toast.success(json.message || 'เพิ่มห้องใหม่สำเร็จ!');
      setShowAddRoomModal(false);
      setNewRoomCode('');
      setNewRoomName('');
      setNewRoomNumber('');
      setSelectedRoomCode(cleanCode);
      fetchRoomData(cleanCode, selectedDate);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการสร้างห้องใหม่');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (selectedRoomCode === 'LLC') {
      toast.error('ไม่สามารถลบห้องหลัก (LLC) ได้ แต่สามารถแก้ไขชื่อและข้อมูลห้องได้');
      return;
    }
    if (!window.confirm(`ยืนยันการลบห้อง "${config.room_name} (${selectedRoomCode})" ออกจากระบบ?`)) {
      return;
    }
    try {
      const res = await fetch('/api/room-booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_room',
          room_code: selectedRoomCode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'ลบห้องไม่สำเร็จ');
        return;
      }
      toast.success(json.message || 'ลบห้องเรียบร้อยแล้ว');
      setSelectedRoomCode('LLC');
      fetchRoomData('LLC', selectedDate);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการลบห้อง');
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !bookerName.trim()) {
      toast.error('กรุณาระบุหัวข้อการใช้ห้อง และชื่อผู้จองให้ครบถ้วน');
      return;
    }

    setSubmittingBooking(true);
    try {
      const res = await fetch('/api/room-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: selectedRoomCode,
          date: selectedDate,
          start_time: startTime,
          end_time: endTime,
          title: title.trim(),
          booker_type: bookerType,
          booker_id: bookerId.trim() || bookerName.trim(),
          booker_name: bookerName.trim(),
          booker_role_label:
            bookerRoleLabel.trim() || (bookerType === 'STUDENT' ? 'นักเรียน' : 'ครู / บุคลากร'),
          participants_count: participantsCount,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'ไม่สามารถบันทึกการจองได้');
        return;
      }

      toast.success(`บันทึกการจอง ${config.room_name} เรียบร้อยแล้ว`);
      setTitle('');
      fetchRoomData(selectedRoomCode, selectedDate);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการบันทึกการจอง');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleBookingAction = async (
    booking: BookingItem,
    action: 'checkin' | 'checkout' | 'cancel'
  ) => {
    try {
      const res = await fetch('/api/room-booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          room_code: selectedRoomCode,
          booking_id: booking.id,
          user_type: booking.booker_type,
          identifier: booking.booker_id || booking.booker_name,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'ดำเนินการไม่สำเร็จ');
        return;
      }
      toast.success(json.message || 'อัปเดตสถานะเรียบร้อยแล้ว');
      fetchRoomData(selectedRoomCode, selectedDate);
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/room-booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          ...config,
          room_code: selectedRoomCode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'บันทึกการตั้งค่าไม่สำเร็จ');
        return;
      }
      setConfig(json.config);
      if (Array.isArray(json.rooms)) setRooms(json.rooms);
      setPreviewKey((k) => k + 1);
      toast.success(`บันทึกการตั้งค่า "${json.config.room_name}" เรียบร้อยแล้ว`);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleActiveDay = (dayNum: number) => {
    setConfig((prev) => {
      const exists = prev.active_days.includes(dayNum);
      const nextDays = exists
        ? prev.active_days.filter((d) => d !== dayNum)
        : [...prev.active_days, dayNum].sort();
      return { ...prev, active_days: nextDays };
    });
  };

  const getDisplayUrl = (preview = false) => {
    const path = `/room-display/index.html?room=${encodeURIComponent(selectedRoomCode)}${
      preview ? '&preview=1' : ''
    }`;
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  };

  const handleCopyDisplayUrl = () => {
    const url = getDisplayUrl(false);
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success(`คัดลอกลิงก์หน้าจอสำหรับ "${config.room_name}" เรียบร้อยแล้ว`);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const DAY_LABELS = [
    { num: 1, label: 'จันทร์' },
    { num: 2, label: 'อังคาร' },
    { num: 3, label: 'พุธ' },
    { num: 4, label: 'พฤหัสบดี' },
    { num: 5, label: 'ศุกร์' },
    { num: 6, label: 'เสาร์' },
    { num: 0, label: 'อาทิตย์' },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Card (Authentic SV Portal Style) */}
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl border border-[#E4E0DA] shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-xl border border-[#E4E0DA] p-1.5 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                <img
                  src={config.logo_url && config.logo_url !== '/logo.png' ? config.logo_url : DEFAULT_SCHOOL_EMBLEM}
                  alt="Room Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                    ระบบจองห้องเรียน/ห้องปฏิบัติการ และจอแสดงผลหน้าห้อง
                  </h1>
                  <span className="bg-[#F5E8ED] text-[#7B1C3E] text-xs px-3 py-0.5 rounded-full font-bold border border-[#7B1C3E]/20">
                    SV Portal
                  </span>
                </div>
                <p className="text-sm text-[#6B6560] mt-0.5">
                  บริหารจัดการตารางจองห้อง ตั้งค่าโลโก้ประจำห้อง และเชื่อมต่อหน้าจอแสดงผลได้ทุกอุปกรณ์
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setShowAddRoomModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1B3A6B] hover:bg-[#142C52] text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                เพิ่มห้องใหม่
              </button>
              <a
                href={getDisplayUrl(true)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#7B1C3E] hover:bg-[#5E1530] text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                เปิดจอแสดงผล ({config.room_number})
              </a>
            </div>
          </div>

          {/* Room Switcher Bar */}
          <div className="mt-5 pt-4 border-t border-[#E4E0DA] flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-[#6B6560] mr-1 flex items-center gap-1.5 shrink-0">
              <Building2 className="w-4 h-4 text-[#7B1C3E]" />
              เลือกห้อง ({rooms.length}):
            </span>
            {rooms.map((r) => {
              const isSelected = r.room_code === selectedRoomCode;
              return (
                <button
                  key={r.room_code}
                  type="button"
                  onClick={() => handleSwitchRoom(r.room_code)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 border ${
                    isSelected
                      ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-xs'
                      : 'bg-[#FAF9F7] text-[#1A1A1A] border-[#E4E0DA] hover:bg-[#F5E8ED]/50'
                  }`}
                >
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#EEF2F8] text-[#1B3A6B]'
                    }`}
                  >
                    {r.room_number}
                  </span>
                  <span>{r.room_name}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-5 border-b border-[#E4E0DA] overflow-x-auto">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`pb-3 px-4 text-sm font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'bookings'
                  ? 'border-[#7B1C3E] text-[#7B1C3E]'
                  : 'border-transparent text-[#6B6560] hover:text-[#1A1A1A]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              จองห้องล่วงหน้า &amp; ตารางการใช้ห้อง ({config.room_name})
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`pb-3 px-4 text-sm font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'config'
                  ? 'border-[#7B1C3E] text-[#7B1C3E]'
                  : 'border-transparent text-[#6B6560] hover:text-[#1A1A1A]'
              }`}
            >
              <Settings className="w-4 h-4" />
              ตั้งค่าโลโก้ห้อง / ข้อมูลห้อง / เวลาเปิด-ปิดจอ
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={`pb-3 px-4 text-sm font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'devices'
                  ? 'border-[#7B1C3E] text-[#7B1C3E]'
                  : 'border-transparent text-[#6B6560] hover:text-[#1A1A1A]'
              }`}
            >
              <Monitor className="w-4 h-4" />
              ลิงก์หน้าจอแสดงผลสำหรับทุกอุปกรณ์
            </button>
          </div>
        </div>

        {/* TAB 1: BOOKINGS & SCHEDULE */}
        {activeTab === 'bookings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Create Advance Booking Form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E4E0DA] shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#7B1C3E]" />
                  ลงเวลาจองห้องล่วงหน้า
                </h2>
                <span className="text-xs font-bold bg-[#F5E8ED] text-[#7B1C3E] px-2.5 py-1 rounded-lg">
                  {config.room_number}
                </span>
              </div>
              <p className="text-xs text-[#6B6560] mb-5">
                เลือกห้องและระบุผู้จอง เพื่อให้สามารถสแกน QR Code หน้าห้องยืนยันเข้าใช้งานได้
              </p>

              <form onSubmit={handleCreateBooking} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                    ห้องที่ต้องการจอง *
                  </label>
                  <select
                    value={selectedRoomCode}
                    onChange={(e) => handleSwitchRoom(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#FAF9F7] border border-[#E4E0DA] rounded-xl text-xs font-bold text-[#1A1A1A]"
                  >
                    {rooms.map((r) => (
                      <option key={r.room_code} value={r.room_code}>
                        [{r.room_number}] {r.room_name} — {r.building}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1.5">
                    ประเภทผู้ขอจองห้อง
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBookerType('TEACHER');
                        setLookupResults([]);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                        bookerType === 'TEACHER'
                          ? 'bg-[#7B1C3E] text-white border-[#7B1C3E]'
                          : 'bg-[#FAF9F7] text-[#6B6560] border-[#E4E0DA]'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      ครู / บุคลากร
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBookerType('STUDENT');
                        setLookupResults([]);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                        bookerType === 'STUDENT'
                          ? 'bg-[#7B1C3E] text-white border-[#7B1C3E]'
                          : 'bg-[#FAF9F7] text-[#6B6560] border-[#E4E0DA]'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      นักเรียน
                    </button>
                  </div>
                </div>

                {/* Smart Search from SVPortal DB */}
                <div className="relative">
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                    ค้นหาชื่อจากฐานข้อมูล SV Portal (อัตโนมัติ)
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#A09890] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        bookerType === 'STUDENT'
                          ? 'พิมพ์รหัสนักเรียน หรือ ชื่อนักเรียน...'
                          : 'พิมพ์ชื่อครู หรือ อีเมลบุคลากร...'
                      }
                      className="w-full pl-9 pr-3 py-2 bg-[#FAF9F7] border border-[#E4E0DA] rounded-xl text-xs focus:outline-none focus:border-[#7B1C3E]"
                    />
                  </div>
                  {lookupResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E4E0DA] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {lookupResults.map((item) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          onClick={() => handleSelectPerson(item)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-[#FAF9F7] border-b border-[#E4E0DA] last:border-none text-xs"
                        >
                          <div className="font-bold text-[#1A1A1A]">{item.name}</div>
                          <div className="text-[11px] text-[#6B6560]">{item.role_label}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Booker Name & ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                      ชื่อ-นามสกุลผู้จอง *
                    </label>
                    <input
                      type="text"
                      required
                      value={bookerName}
                      onChange={(e) => setBookerName(e.target.value)}
                      placeholder="ชื่อครู หรือ นักเรียน"
                      className="w-full px-3 py-2 bg-white border border-[#E4E0DA] rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                      {bookerType === 'STUDENT' ? 'รหัสนักเรียน (ใช้ตอนสแกน)' : 'รหัส/ระดับชั้น/ตำแหน่ง'}
                    </label>
                    <input
                      type="text"
                      value={bookerId}
                      onChange={(e) => setBookerId(e.target.value)}
                      placeholder={bookerType === 'STUDENT' ? 'เช่น 65001' : 'เช่น ครูกลุ่มสาระภาษาฯ'}
                      className="w-full px-3 py-2 bg-white border border-[#E4E0DA] rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Subject / Purpose */}
                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                    วิชา / กิจกรรมที่เข้าใช้งานห้อง *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น ติวสนทนาภาษาอังกฤษ, ประชุมวิชาการ, ทดลองวิทยาศาสตร์"
                    className="w-full px-3 py-2 bg-white border border-[#E4E0DA] rounded-xl text-xs"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">วันที่ใช้งาน</label>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        fetchRoomData(selectedRoomCode, e.target.value);
                      }}
                      className="w-full px-2.5 py-2 bg-white border border-[#E4E0DA] rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">เวลาเริ่ม</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-[#E4E0DA] rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">เวลาสิ้นสุด</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-[#E4E0DA] rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Participants count */}
                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                    จำนวนผู้เข้าใช้งาน (คน)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={participantsCount}
                    onChange={(e) => setParticipantsCount(Number(e.target.value) || 1)}
                    className="w-32 px-3 py-2 bg-white border border-[#E4E0DA] rounded-xl text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingBooking}
                  className="w-full py-3 bg-[#7B1C3E] hover:bg-[#5E1530] text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {submittingBooking ? 'กำลังบันทึก...' : `บันทึกการจอง ${config.room_name}`}
                  </span>
                </button>
              </form>
            </div>

            {/* Right: Schedule List & Universal Display Link */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-2xl border border-[#E4E0DA] shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-[#E4E0DA]">
                  <div>
                    <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#7B1C3E]" />
                      ตารางการจอง {config.room_name} ({config.room_number}) วันที่ {selectedDate || 'วันนี้'}
                    </h3>
                    <p className="text-xs text-[#6B6560] mt-0.5">
                      ซิงค์กับหน้าจอแสดงผลหน้าห้องแบบ Real-time อัตโนมัติทุกๆ 6 วินาที
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        fetchRoomData(selectedRoomCode, e.target.value);
                      }}
                      className="px-3 py-1.5 border border-[#E4E0DA] rounded-lg text-xs"
                    />
                    <button
                      onClick={() => fetchRoomData(selectedRoomCode, selectedDate)}
                      className="p-2 bg-[#FAF9F7] hover:bg-[#E4E0DA]/50 rounded-lg text-[#1A1A1A] border border-[#E4E0DA]"
                      title="รีเฟรชข้อมูล"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {bookings.length === 0 ? (
                  <div className="py-12 text-center text-[#A09890]">
                    <DoorOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <div className="text-sm font-bold text-[#6B6560]">
                      ยังไม่มีรายการจองสำหรับ {config.room_name} ในวันที่เลือก
                    </div>
                    <p className="text-xs text-[#A09890] mt-1">
                      สามารถเพิ่มรายการจองจากแบบฟอร์มด้านซ้ายเพื่อแสดงผลบนจอหน้าห้องได้ทันที
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.map((b) => (
                      <div
                        key={b.id}
                        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                          b.status === 'CHECKED_IN'
                            ? 'bg-[#FDF8FA] border-[#E8C5D1]'
                            : b.status === 'COMPLETED'
                            ? 'bg-[#FAF9F7] border-[#E4E0DA] opacity-75'
                            : 'bg-[#FFFBEB] border-[#FDE68A]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1A1A1A]">
                              {b.start_time} – {b.end_time} น.
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                b.status === 'CHECKED_IN'
                                  ? 'bg-[#7B1C3E] text-white'
                                  : b.status === 'COMPLETED'
                                  ? 'bg-[#E4E0DA] text-[#6B6560]'
                                  : 'bg-[#FEF3C7] text-[#B45309]'
                              }`}
                            >
                              {b.status === 'CHECKED_IN'
                                ? 'กำลังใช้งาน (เช็คอินแล้ว)'
                                : b.status === 'COMPLETED'
                                ? 'เสร็จสิ้นแล้ว'
                                : 'รอสแกน QR หน้าห้อง'}
                            </span>
                          </div>
                          <div className="font-bold text-sm text-[#1A1A1A] mt-1">{b.title}</div>
                          <div className="text-xs text-[#6B6560] mt-0.5">
                            ผู้จอง: <strong className="text-[#1A1A1A]">{b.booker_name}</strong> ({b.booker_role_label}) • จำนวน{' '}
                            {b.participants_count} คน
                          </div>
                          {b.checked_in_at && (
                            <div className="text-[11px] text-[#2D6A4F] font-bold mt-1">
                              ✓ สแกนเข้าห้องเมื่อ {b.checked_in_at} น. โดย {b.checked_in_by}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {b.status === 'BOOKED' && (
                            <button
                              onClick={() => handleBookingAction(b, 'checkin')}
                              className="px-3 py-1.5 bg-[#2D6A4F] hover:bg-[#23533D] text-white text-xs font-bold rounded-lg flex items-center gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              เช็คอินให้ทันที
                            </button>
                          )}
                          {b.status === 'CHECKED_IN' && (
                            <button
                              onClick={() => handleBookingAction(b, 'checkout')}
                              className="px-3 py-1.5 bg-[#1B3A6B] hover:bg-[#142C52] text-white text-xs font-bold rounded-lg flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              คืนห้อง
                            </button>
                          )}
                          <button
                            onClick={() => handleBookingAction(b, 'cancel')}
                            className="px-2.5 py-1.5 bg-[#F5E8ED] hover:bg-[#E8C5D1] text-[#7B1C3E] text-xs font-bold rounded-lg flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Universal Display Link Box */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#E4E0DA]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-[#7B1C3E]">
                      ลิงก์หน้าจอแสดงผลประจำห้อง {config.room_name} (รองรับ iPad / แท็บเล็ต Android / Smart TV)
                    </div>
                    <div className="text-xs text-[#6B6560] mt-0.5 break-all">
                      {getDisplayUrl(false)}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyDisplayUrl}
                    className="px-4 py-2 bg-[#7B1C3E] hover:bg-[#5E1530] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedUrl ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ROOM, LOGO & DISPLAY SETTINGS */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E0DA] shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-[#1A1A1A]">
                  ตั้งค่าโลโก้และข้อมูลประจำห้อง: {config.room_name} ({selectedRoomCode})
                </h2>
                {selectedRoomCode !== 'LLC' && (
                  <button
                    type="button"
                    onClick={handleDeleteRoom}
                    className="px-3 py-1.5 bg-[#F5E8ED] hover:bg-[#E8C5D1] text-[#7B1C3E] text-xs font-bold rounded-xl flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ลบห้องนี้
                  </button>
                )}
              </div>
              <p className="text-xs text-[#6B6560] mb-6">
                แต่ละห้องสามารถมีโลโก้ ชื่อห้อง เลขห้อง และเวลาเปิด-ปิดหน้าจอแยกอิสระจากกันได้
              </p>

              <form onSubmit={handleSaveConfig} className="space-y-5">
                {/* ROOM LOGO CUSTOMIZATION SECTION */}
                <div className="p-4 rounded-2xl bg-[#FAF9F7] border border-[#E4E0DA] space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#7B1C3E]" />
                      ตั้งค่าโลโก้ประจำห้อง ({config.room_name})
                    </h3>
                    <p className="text-xs text-[#6B6560]">
                      อัปโหลดไฟล์ภาพโลโก้ของห้องนี้โดยเฉพาะ หรือเลือกจากตราโรงเรียน
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-white p-2 flex items-center justify-center border border-[#E4E0DA] shadow-xs shrink-0">
                      <div
                        className={`w-full h-full flex items-center justify-center overflow-hidden ${
                          config.logo_style === 'circle'
                            ? 'bg-white rounded-full p-1 border border-[#E4E0DA]'
                            : config.logo_style === 'plain'
                            ? 'bg-transparent'
                            : 'bg-white rounded-xl p-1'
                        }`}
                      >
                        <img
                          src={config.logo_url && config.logo_url !== '/logo.png' ? config.logo_url : DEFAULT_SCHOOL_EMBLEM}
                          alt="Logo Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    </div>

                    <div className="flex-1 space-y-2.5 w-full">
                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-2 bg-[#7B1C3E] hover:bg-[#5E1530] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          อัปโหลดรูปโลโก้จากเครื่อง
                        </button>

                        {PRESET_LOGOS.map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() => setConfig({ ...config, logo_url: preset.url })}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                              config.logo_url === preset.url
                                ? 'bg-[#F5E8ED] border-[#7B1C3E] text-[#7B1C3E]'
                                : 'bg-white border-[#E4E0DA] text-[#6B6560] hover:bg-[#FAF9F7]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="text-xs font-bold text-[#6B6560]">รูปแบบกรอบโลโก้:</span>
                        {[
                          { id: 'rounded', label: 'สี่เหลี่ยมขอบมน' },
                          { id: 'circle', label: 'วงกลม' },
                          { id: 'plain', label: 'ไม่มีพื้นหลัง (โปร่งใส)' },
                        ].map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() =>
                              setConfig({
                                ...config,
                                logo_style: st.id as 'rounded' | 'circle' | 'plain',
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                              (config.logo_style || 'rounded') === st.id
                                ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]'
                                : 'bg-white text-[#6B6560] border-[#E4E0DA]'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                      ชื่อห้อง (แสดงบนจอ) *
                    </label>
                    <input
                      type="text"
                      required
                      value={config.room_name}
                      onChange={(e) => setConfig({ ...config, room_name: e.target.value })}
                      className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                      เลขห้อง / รหัสป้ายหน้าห้อง *
                    </label>
                    <input
                      type="text"
                      required
                      value={config.room_number}
                      onChange={(e) => setConfig({ ...config, room_number: e.target.value })}
                      className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                      ความจุห้อง (ที่นั่ง)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={config.capacity || 30}
                      onChange={(e) =>
                        setConfig({ ...config, capacity: Number(e.target.value) || 30 })
                      }
                      className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                    ชื่อเต็มของศูนย์ / อาคารเรียน / ชั้น (แสดงใต้ชื่อห้อง)
                  </label>
                  <input
                    type="text"
                    value={config.building}
                    onChange={(e) => setConfig({ ...config, building: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                      เวลาเปิดหน้าจออัตโนมัติ
                    </label>
                    <input
                      type="time"
                      value={config.open_time}
                      onChange={(e) => setConfig({ ...config, open_time: e.target.value })}
                      className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                      เวลาตัดเข้าหน้าจอดำ (Sleep)
                    </label>
                    <input
                      type="time"
                      value={config.close_time}
                      onChange={(e) => setConfig({ ...config, close_time: e.target.value })}
                      className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                      เปิดให้เช็คอินล่วงหน้า (นาที)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={config.checkin_grace_minutes}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          checkin_grace_minutes: Number(e.target.value) || 15,
                        })
                      }
                      className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-2">
                    วันทำการที่เปิดแสดงผลหน้าจอ (นอกวันเหล่านี้หน้าจอจะมืดสนิทเพื่อประหยัดพลังงาน)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((d) => {
                      const active = config.active_days.includes(d.num);
                      return (
                        <button
                          key={d.num}
                          type="button"
                          onClick={() => toggleActiveDay(d.num)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                            active
                              ? 'bg-[#7B1C3E] text-white border-[#7B1C3E]'
                              : 'bg-[#FAF9F7] text-[#6B6560] border-[#E4E0DA]'
                          }`}
                        >
                          วัน{d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                    ข้อความคำแนะนำด้านล่างจอ
                  </label>
                  <input
                    type="text"
                    value={config.subtitle}
                    onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                    className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-sm"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-6 py-3 bg-[#7B1C3E] hover:bg-[#5E1530] text-white font-bold rounded-xl text-sm transition shadow-xs"
                  >
                    {savingConfig ? 'กำลังบันทึก...' : `บันทึกการตั้งค่าห้อง ${config.room_name}`}
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Live Screen Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-[#E4E0DA] shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5">
                      <Tablet className="w-4 h-4 text-[#7B1C3E]" />
                      ตัวอย่างหน้าจอแสดงผล ({config.room_name})
                    </div>
                    <div className="text-[11px] text-[#6B6560]">
                      อัปเดตตามการตั้งค่าโลโก้และชื่อห้องแบบสดๆ
                    </div>
                  </div>
                  <a
                    href={getDisplayUrl(true)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#7B1C3E] hover:underline flex items-center gap-1"
                  >
                    ขยายเต็มจอ <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="w-full aspect-[4/3] bg-[#F5F4F2] rounded-xl overflow-hidden border border-[#E4E0DA] relative">
                  <iframe
                    key={`${selectedRoomCode}-${previewKey}`}
                    src={`/room-display/index.html?room=${encodeURIComponent(selectedRoomCode)}&preview=1`}
                    title="Room Display Live Preview"
                    className="w-[1024px] h-[768px] border-none origin-top-left"
                    style={{
                      transform: 'scale(0.42)',
                      width: '1024px',
                      height: '768px',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: UNIVERSAL DEVICE SETUP */}
        {activeTab === 'devices' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E4E0DA] shadow-sm p-6">
              <h3 className="text-base font-bold text-[#1A1A1A] mb-1">
                ลิงก์หน้าจอแสดงผลแยกตามห้อง
              </h3>
              <p className="text-xs text-[#6B6560] mb-4">
                นำลิงก์ของแต่ละห้องไปเปิดบนอุปกรณ์หน้าห้องนั้นๆ ได้ทันที ไม่จำกัดชนิดอุปกรณ์
              </p>
              <div className="space-y-2.5">
                {rooms.map((r) => {
                  const roomUrl =
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/room-display/index.html?room=${encodeURIComponent(r.room_code)}`
                      : `/room-display/index.html?room=${encodeURIComponent(r.room_code)}`;
                  return (
                    <div
                      key={r.room_code}
                      className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E4E0DA] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-[#E4E0DA] p-1 flex items-center justify-center shrink-0">
                          <img
                            src={r.logo_url && r.logo_url !== '/logo.png' ? r.logo_url : DEFAULT_SCHOOL_EMBLEM}
                            alt={r.room_name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#1A1A1A]">
                            [{r.room_number}] {r.room_name}{' '}
                            <span className="text-xs font-normal text-[#6B6560]">({r.building})</span>
                          </div>
                          <div className="text-xs text-[#2D6A4F] font-medium break-all">{roomUrl}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(roomUrl);
                            toast.success(`คัดลอกลิงก์ของ ${r.room_name} แล้ว`);
                          }}
                          className="px-3 py-1.5 bg-[#7B1C3E] text-white text-xs font-bold rounded-lg flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          คัดลอกลิงก์
                        </button>
                        <a
                          href={`/room-display/index.html?room=${encodeURIComponent(r.room_code)}&preview=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-white hover:bg-[#E4E0DA]/40 text-[#1A1A1A] border border-[#E4E0DA] text-xs font-bold rounded-lg flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          เปิดจอ
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-[#E4E0DA] shadow-sm p-6 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-[#EEF2F8] text-[#1B3A6B] flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  1. iPad รุ่นใหม่ / แท็บเล็ต Android ทุกรุ่น
                </h3>
                <p className="text-xs text-[#6B6560] leading-relaxed">
                  เปิดลิงก์ประจำห้องผ่าน Safari หรือ Chrome แล้วกด <strong>Add to Home Screen</strong>{' '}
                  หน้าจอจะปรับขนาดเต็มจออัตโนมัติทุกความละเอียด
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#E4E0DA] shadow-sm p-6 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-[#EAF4EF] text-[#2D6A4F] flex items-center justify-center">
                  <Tv className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  2. สมาร์ททีวี (Android TV) / จอมอนิเตอร์
                </h3>
                <p className="text-xs text-[#6B6560] leading-relaxed">
                  สามารถนำลิงก์ประจำห้องไปใส่ในแอป Signage หรือ Web Browser บนสมาร์ททีวีแนวนอน 16:9 หน้าห้องประชุมหรือห้องปฏิบัติการได้ทันที
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#E4E0DA] shadow-sm p-6 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-[#F5E8ED] text-[#7B1C3E] flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  3. iPad รุ่นเก่า (เช่น iPad mini 1 iOS 9.3.6)
                </h3>
                <p className="text-xs text-[#6B6560] leading-relaxed">
                  รองรับการเปิดผ่าน Safari บน iOS 9 พร้อมล็อกหน้าจอด้วย{' '}
                  <strong>Guided Access</strong> ให้แตะได้เฉพาะปุ่มสแกน QR มุมขวาล่างจุดเดียว
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADD NEW ROOM MODAL */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E4E0DA]">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">เพิ่มห้องใหม่ในระบบ SV Portal</h3>
            <p className="text-xs text-[#6B6560] mb-4">
              เมื่อสร้างเสร็จแล้ว ระบบจะสร้างลิงก์หน้าจอแสดงผลและตารางการจองแยกให้ทันที
            </p>
            <form onSubmit={handleCreateNewRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                  รหัสห้อง (ภาษาอังกฤษ/ตัวเลข ใช้ใน URL) *
                </label>
                <input
                  type="text"
                  required
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                  placeholder="เช่น COMP-01, SCI-LAB, MEETING-1"
                  className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-xs uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                  ชื่อห้อง (แสดงบนหน้าจอ) *
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="เช่น ห้องปฏิบัติการคอมพิวเตอร์ 1, ห้องประชุมใหญ่"
                  className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                    เลขห้อง / ป้ายห้อง
                  </label>
                  <input
                    type="text"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    placeholder="เช่น 301, LAB-1"
                    className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                    ความจุ (ที่นั่ง)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(Number(e.target.value) || 30)}
                    className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                  อาคาร / สถานที่ตั้ง
                </label>
                <input
                  type="text"
                  value={newRoomBuilding}
                  onChange={(e) => setNewRoomBuilding(e.target.value)}
                  placeholder="เช่น อาคารเฉลิมพระเกียรติ ชั้น 3"
                  className="w-full px-3.5 py-2 border border-[#E4E0DA] rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-4 py-2 bg-[#FAF9F7] hover:bg-[#E4E0DA] text-[#6B6560] text-xs font-bold rounded-xl border border-[#E4E0DA]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creatingRoom}
                  className="px-5 py-2 bg-[#7B1C3E] hover:bg-[#5E1530] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {creatingRoom ? 'กำลังสร้าง...' : 'สร้างห้องใหม่'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
