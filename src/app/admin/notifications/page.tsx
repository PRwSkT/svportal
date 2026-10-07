'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Bell, 
  Sparkles, 
  Send, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Smartphone, 
  RefreshCw, 
  FileText, 
  Award, 
  Check, 
  ExternalLink,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface SmartReminder {
  id: string;
  type: string;
  recipientName: string;
  recipientRole: string;
  title: string;
  body: string;
  actionUrl: string;
  urgency: 'normal' | 'urgent';
}

export default function AdminNotificationsPage() {
  const [prompt, setPrompt] = useState('');
  const [targetRole, setTargetRole] = useState<'all' | 'teachers' | 'staff' | 'parents' | 'students'>('all');
  const [category, setCategory] = useState<'general' | 'kpi' | 'forms' | 'announcement' | 'reminder'>('general');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [actionUrl, setActionUrl] = useState('/home');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [nongFahComment, setNongFahComment] = useState('');

  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [smartReminders, setSmartReminders] = useState<SmartReminder[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [subscribedCount, setSubscribedCount] = useState<number>(0);

  // Fetch recent notifications and stats
  const fetchRecent = async () => {
    try {
      const res = await fetch('/api/notifications?limit=10');
      const data = await res.json();
      if (data.success) {
        setRecentNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  // 1. Nong Fah Draft AI
  const handleNongFahDraft = async (customPrompt?: string) => {
    const textToDraft = customPrompt || prompt;
    if (!textToDraft.trim()) {
      toast.warning('กรุณากรอกความต้องการ หรือสิ่งที่ต้องการให้น้องฟ้าช่วยร่างค่ะ');
      return;
    }

    setIsDrafting(true);
    const toastId = toast.loading('น้องฟ้ากำลังวิเคราะห์และร่างข้อความแจ้งเตือนที่เหมาะสม...');

    try {
      const res = await fetch('/api/admin/notifications/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft',
          prompt: textToDraft,
          targetRole,
          contextCategory: category,
          urgency,
          destinationUrl: actionUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'เกิดข้อผิดพลาดในการประมวลผล');
      }

      const draft = json.draft;
      setTitle(draft.title || '');
      setBody(draft.body || '');
      setCategory(draft.category || category);
      if (draft.targetRole) setTargetRole(draft.targetRole);
      if (draft.actionUrl) setActionUrl(draft.actionUrl);
      if (draft.urgency) setUrgency(draft.urgency);
      setNongFahComment(draft.nongFahComment || '');

      toast.success('น้องฟ้าร่างข้อความเสร็จเรียบร้อยแล้วค่ะ!', { id: toastId });
    } catch (err: any) {
      toast.error('ไม่สามารถให้น้องฟ้าร่างข้อความได้', { id: toastId, description: err.message });
    } finally {
      setIsDrafting(false);
    }
  };

  // 2. Nong Fah Scan Pending Reminders
  const handleScanPending = async () => {
    setIsScanning(true);
    const toastId = toast.loading('น้องฟ้ากำลังตรวจสอบรายการ KPI และแบบฟอร์มที่ค้างส่งในระบบ...');

    try {
      const res = await fetch('/api/admin/notifications/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan-reminders' }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถสแกนรายการได้');
      }

      setSmartReminders(json.reminders || []);
      if (json.reminders?.length === 0) {
        toast.info('ยอดเยี่ยมมากค่ะ! ขณะนี้ไม่มีรายการ KPI หรือแบบฟอร์มค้างส่งที่ใกล้กำหนด', { id: toastId });
      } else {
        toast.success(`น้องฟ้าพบ ${json.reminders.length} รายการที่ควรส่งเตือนความจำค่ะ`, { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการสแกน', { id: toastId, description: err.message });
    } finally {
      setIsScanning(false);
    }
  };

  // 3. Send Notification
  const handleSendNotification = async (customPayload?: any) => {
    const finalTitle = customPayload?.title || title;
    const finalBody = customPayload?.body || body;
    const finalRole = customPayload?.recipientRole || targetRole;
    const finalCategory = customPayload?.category || category;
    const finalUrl = customPayload?.actionUrl || actionUrl;

    if (!finalTitle.trim() || !finalBody.trim()) {
      toast.warning('กรุณากรอกหัวข้อและเนื้อหาข้อความแจ้งเตือนให้ครบถ้วน');
      return;
    }

    setIsSending(true);
    const toastId = toast.loading('กำลังจัดส่งการแจ้งเตือนและ Web Push ไปยังอุปกรณ์เป้าหมาย...');

    try {
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          body: finalBody,
          targetRole: finalRole,
          category: finalCategory,
          actionUrl: finalUrl,
          sendPush: true,
          sendInApp: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'การส่งแจ้งเตือนล้มเหลว');
      }

      const push = json.pushResults;
      toast.success(
        `ส่งการแจ้งเตือนสำเร็จ! (Push สำเร็จ ${push?.sent || 0} เครื่อง, In-App บันทึกเรียบร้อย)`,
        { id: toastId }
      );

      // Reset form if manual
      if (!customPayload) {
        setTitle('');
        setBody('');
        setPrompt('');
        setNongFahComment('');
      }

      fetchRecent();
    } catch (err: any) {
      toast.error('ไม่สามารถส่งการแจ้งเตือนได้', { id: toastId, description: err.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface/80 backdrop-blur-xl p-6 rounded-3xl border border-foreground/10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" /> ระบบแจ้งเตือนอัจฉริยะ (PWA & Web Push)
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              ศูนย์การแจ้งเตือนโรงเรียนสมคิดวิทยา
            </h1>
            <p className="text-xs sm:text-sm text-foreground/60 font-medium">
              ส่งแจ้งเตือนเด้งหน้าจอมือถือ (Lock Screen) และในระบบ SV Portal พร้อมผู้ช่วยน้องฟ้า AI
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Nong Fah AI Drafter & Form (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Nong Fah Assistant Card */}
          <div className="bg-gradient-to-br from-primary/5 via-surface/90 to-surface/70 backdrop-blur-xl p-6 sm:p-7 rounded-3xl border border-primary/20 shadow-md relative overflow-hidden">
            <div className="flex items-start gap-4 mb-4">
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  src="/images/nongfah/nongfah-avatar.png?v=5"
                  alt="น้องฟ้า AI"
                  fill
                  className="object-contain drop-shadow"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-base text-primary flex items-center gap-2">
                  ให้น้องฟ้าช่วยร่างข้อความแจ้งเตือน
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-[11px] font-bold text-primary">AI Powered</span>
                </h3>
                <p className="text-xs text-foreground/60 mt-0.5">
                  บอกน้องฟ้าได้เลยค่ะว่าต้องการเตือนเรื่องอะไร น้องฟ้าจะช่วยปรับภาษาให้สุภาพ ชัดเจน และน่าอ่านที่สุดค่ะ
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="ตัวอย่าง: เตือนครูและบุคลากรทุกคนที่ยังไม่ได้ทำแบบประเมิน KPI ไตรมาส 1 ให้รีบส่งก่อนวันศุกร์นี้..."
                className="w-full p-4 rounded-2xl border border-foreground/15 bg-background/80 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
              />

              {/* Quick Prompt Chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleNongFahDraft('เตือนครูและบุคลากรทุกคนที่ยังไม่ได้ส่งผลการประเมินตนเอง KPI ไตรมาส 1')}
                  className="text-xs px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors text-left"
                >
                  📝 เตือนส่งแบบประเมิน KPI
                </button>
                <button
                  type="button"
                  onClick={() => handleNongFahDraft('เตือนผู้ปกครองและนักเรียนให้ตรวจสอบและอัปเดตข้อมูลที่อยู่และเบอร์ติดต่อ')}
                  className="text-xs px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 font-medium transition-colors text-left"
                >
                  👨‍👩‍👧 เตือนอัปเดตข้อมูลผู้ปกครอง
                </button>
                <button
                  type="button"
                  onClick={() => handleNongFahDraft('แจ้งประกาศข่าวสารและปฏิทินกิจกรรมวันสำคัญของโรงเรียนประจำเดือนนี้')}
                  className="text-xs px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 font-medium transition-colors text-left"
                >
                  📢 ประกาศกิจกรรมโรงเรียน
                </button>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleScanPending}
                  disabled={isScanning}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-foreground/70 bg-foreground/5 hover:bg-foreground/10 transition-all disabled:opacity-50"
                >
                  {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>ให้น้องฟ้าสแกนภารกิจที่ค้าง</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNongFahDraft()}
                  disabled={isDrafting || !prompt.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {isDrafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>ให้น้องฟ้าร่างข้อความ</span>
                </button>
              </div>
            </div>

            {nongFahComment && (
              <div className="mt-4 p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary leading-relaxed flex items-start gap-2">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span><strong>คำแนะนำจากน้องฟ้า:</strong> {nongFahComment}</span>
              </div>
            )}
          </div>

          {/* Smart Reminders Found */}
          {smartReminders.length > 0 && (
            <div className="bg-surface/90 backdrop-blur-xl p-6 rounded-3xl border border-amber-500/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> ภารกิจค้างส่งที่น้องฟ้าตรวจพบ ({smartReminders.length} รายการ)
                </h3>
                <button
                  type="button"
                  onClick={() => setSmartReminders([])}
                  className="text-xs text-foreground/50 hover:text-foreground"
                >
                  ซ่อนรายการ
                </button>
              </div>

              <div className="divide-y divide-foreground/5 max-h-72 overflow-y-auto pr-1">
                {smartReminders.map((reminder) => (
                  <div key={reminder.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                          {reminder.type === 'kpi_pending' ? 'KPI' : 'Form'}
                        </span>
                        {reminder.recipientName}
                      </div>
                      <p className="text-xs text-foreground/70 mt-1">{reminder.title}</p>
                      <p className="text-[11px] text-foreground/50">{reminder.body}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendNotification(reminder)}
                      disabled={isSending}
                      className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center gap-1 shadow-sm flex-shrink-0 transition-all"
                    >
                      <Send className="w-3 h-3" /> ส่งเตือน
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification Dispatch Form */}
          <div className="bg-surface/80 backdrop-blur-xl p-6 sm:p-7 rounded-3xl border border-foreground/10 shadow-sm space-y-5">
            <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> ตรวจสอบและส่งการแจ้งเตือน
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground/70 mb-1.5">กลุ่มเป้าหมาย</label>
                <select
                  value={targetRole}
                  onChange={(e: any) => setTargetRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                >
                  <option value="all">ทุกคนในระบบ (All Roles)</option>
                  <option value="teachers">ครูและบุคลากร (Teachers & Staff)</option>
                  <option value="parents">ผู้ปกครอง (Parents)</option>
                  <option value="students">นักเรียน (Students)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground/70 mb-1.5">หมวดหมู่</label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                >
                  <option value="general">ทั่วไป (General)</option>
                  <option value="kpi">การประเมิน KPI</option>
                  <option value="forms">แบบฟอร์มดิจิทัล (Forms)</option>
                  <option value="announcement">ข่าวสารและประกาศ (Announcement)</option>
                  <option value="reminder">เตือนความจำ (Reminder)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground/70 mb-1.5">หัวข้อการแจ้งเตือน (Title)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น: แจ้งเตือน: กำหนดส่งแบบประเมิน KPI ไตรมาส 1"
                className="w-full px-4 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground/70 mb-1.5">ข้อความแจ้งเตือน (Body)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="ข้อความที่จะปรากฏบนหน้าจอมือถือและ Notification Center..."
                className="w-full p-4 rounded-xl border border-foreground/15 bg-background text-sm leading-relaxed focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground/70 mb-1.5">ลิงก์ปลายทางเมื่อกดแจ้งเตือน (Action URL)</label>
              <input
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/home หรือ /admin/kpi หรือ /forms/slug"
                className="w-full px-4 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-mono text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSendNotification()}
                disabled={isSending || !title.trim() || !body.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-extrabold text-sm shadow-lg shadow-primary/25 transition-all disabled:opacity-50"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>ส่งการแจ้งเตือนทันที (Broadcast Web Push)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Preview & History (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Mobile Notification Preview */}
          <div className="bg-surface/80 backdrop-blur-xl p-5 rounded-3xl border border-foreground/10 shadow-sm space-y-3">
            <h4 className="text-xs font-extrabold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" /> ตัวอย่างบนหน้าจอมือถือ (Lock Screen)
            </h4>

            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-inner space-y-2 border border-slate-800">
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded overflow-hidden">
                  <Image src="/logo2.png" alt="Logo" fill className="object-contain" />
                </div>
                <span className="text-[11px] font-bold text-slate-300">SV PORTAL</span>
                <span className="text-[10px] text-slate-400 ml-auto">ตอนนี้</span>
              </div>
              <div className="font-bold text-xs text-white">
                {title || 'หัวข้อการแจ้งเตือนจะแสดงที่นี่'}
              </div>
              <div className="text-[11px] text-slate-300 leading-tight">
                {body || 'ข้อความแจ้งเตือนตัวอย่างที่น้องฟ้าหรือแอดมินร่างจะแสดงบนจอมือถือของผู้ใช้ค่ะ'}
              </div>
            </div>
          </div>

          {/* Recent Dispatches */}
          <div className="bg-surface/80 backdrop-blur-xl p-5 rounded-3xl border border-foreground/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> ประวัติการส่งล่าสุด
              </h4>
              <button
                type="button"
                onClick={fetchRecent}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> รีเฟรช
              </button>
            </div>

            <div className="divide-y divide-foreground/5 space-y-2 text-xs">
              {recentNotifications.length === 0 ? (
                <p className="text-foreground/40 text-center py-4 text-xs">ยังไม่มีประวัติการแจ้งเตือน</p>
              ) : (
                recentNotifications.map((n) => (
                  <div key={n.id} className="pt-2">
                    <div className="font-bold text-foreground text-xs">{n.title}</div>
                    <div className="text-foreground/60 text-[11px] line-clamp-2 mt-0.5">{n.body}</div>
                    <div className="text-[10px] text-foreground/40 mt-1 flex justify-between">
                      <span>กลุ่ม: {n.recipient_role}</span>
                      <span>{new Date(n.created_at).toLocaleDateString('th-TH')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
