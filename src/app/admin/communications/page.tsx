'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Send,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  Search,
  ArrowLeft,
  ExternalLink,
  BellRing,
  Sparkles,
  AlertTriangle,
  History,
  FileCheck2,
  Check,
  Info,
  Calendar,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPipelineState,
  PIPELINE_EVENT_NAME,
  sendParentTeacherMessage,
} from '@/lib/pipeline/bidirectional-store';
import {
  BidirectionalPipelineState,
  ParentTeacherMessage,
  ParentTeacherThread,
  SystemDomainEvent,
  ThreadChannelType,
} from '@/types/family-pipeline';

export default function ParentCommunicationsPage() {
  const { isThai } = useLanguage();
  const [pipeline, setPipeline] = useState<BidirectionalPipelineState>(() => getPipelineState());
  const [selectedThreadId, setSelectedThreadId] = useState<string>('thd-67012-homeroom');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [replyText, setReplyText] = useState<string>('');
  const [requireAck, setRequireAck] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'details' | 'audit_events'>('audit_events');

  const syncPipeline = useCallback(() => {
    setPipeline({ ...getPipelineState() });
  }, []);

  useEffect(() => {
    syncPipeline();
    const handleUpdate = () => syncPipeline();
    window.addEventListener(PIPELINE_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(PIPELINE_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [syncPipeline]);

  const threads = pipeline.threads || [];
  const messages = pipeline.messages || [];
  const domainEvents = pipeline.domain_events || [];

  const filteredThreads = threads.filter((t) => {
    if (channelFilter !== 'ALL' && t.channel_type !== channelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.student_name.toLowerCase().includes(q) ||
        t.guardian_name.toLowerCase().includes(q) ||
        t.last_message_text.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeThread =
    threads.find((t) => t.id === selectedThreadId) || (threads.length > 0 ? threads[0] : null);

  const activeMessages = activeThread
    ? messages.filter((m) => m.thread_id === activeThread.id)
    : [];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeThread) return;

    setIsSending(true);
    try {
      const staffName = activeThread.teacher_name || 'ครูประจำชั้นโรงเรียนสมคิดวิทยา';
      const msg = sendParentTeacherMessage({
        thread_id: activeThread.id,
        sender_type: 'STAFF',
        sender_name: staffName,
        body_th: replyText.trim(),
        require_acknowledgement: requireAck,
      });

      if (msg) {
        toast.success(
          isThai
            ? `ส่งข้อความสำเร็จและซิงค์ไปยัง Parents Portal แล้ว`
            : `Message sent & synced to Parents Portal`
        );
        setReplyText('');
        setRequireAck(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  const channelLabel = (type: ThreadChannelType) => {
    switch (type) {
      case 'HOMEROOM':
        return isThai ? 'ครูประจำชั้น' : 'Homeroom';
      case 'ADMIN_OFFICE':
        return isThai ? 'ธุรการ/วิชาการ' : 'Admin Office';
      case 'INFIRMARY':
        return isThai ? 'ห้องพยาบาล' : 'Infirmary';
      case 'FINANCE':
        return isThai ? 'การเงิน/ค่าเทอม' : 'Finance';
      default:
        return type;
    }
  };

  return (
    <div className="sv-container-context min-h-[100dvh] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link
              href="/home"
              className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-amber-300 border border-[#7B1C3E]/20 hover:bg-[#7B1C3E]/20 transition-all inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {isThai ? 'กลับหน้าหลัก' : 'Home'}
            </Link>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {isThai ? 'งานสื่อสารและมวลชนสัมพันธ์' : 'School Communications'}
            </span>
          </div>
          <h1 className="sv-fluid-title text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-[#7B1C3E]" />
            {isThai
              ? 'ศูนย์สื่อสารสองทางครู-ผู้ปกครอง & ระบบควบคุมเวลาทำการ'
              : 'Two-Way Parent-Teacher Communications Hub'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isThai
              ? 'สนทนากับผู้ปกครองรายบุคคลหรือกลุ่มห้องเรียน พร้อมมาตรการคุ้มครองสมดุลเวลาทำงานครู (Quiet Hours Policy)'
              : 'Direct two-way messaging with parents, quiet hours enforcement, and real-time domain event auditing'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/parents"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold shadow-xs transition-all"
            title="ดูมุมมองผู้ปกครองใน Parents Portal"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
            <span>{isThai ? 'เปิดดูแชทใน Parents Portal' : 'Open Parents Portal Chat'}</span>
          </Link>
        </div>
      </div>

      {/* Quiet Hours & Policy Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200 dark:border-indigo-800 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shrink-0 shadow-md">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-indigo-950 dark:text-indigo-200">
                {isThai
                  ? 'นโยบายเวลาทำการสื่อสารและคุ้มครองเวลาพักผ่อนครู (Quiet Hours & Safeguarding Policy)'
                  : 'School Communications & Quiet Hours Policy'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                {isThai ? 'เปิดใช้งานอยู่' : 'Active'}
              </span>
            </div>
            <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 mt-1 leading-relaxed">
              {isThai
                ? 'เวลาทำการตอบกลับของคณะครู: จันทร์-ศุกร์ 07:30 - 17:00 น. | ข้อความที่ผู้ปกครองส่งเข้ามานอกเวลาทำการ ระบบจะรับเข้าคิวและแจ้งเตือนคุณครูในเช้าวันทำการถัดไป เพื่อให้คุณครูได้พักผ่อนอย่างเต็มที่'
                : 'Teacher official office hours: Mon-Fri 07:30 - 17:00. Messages sent outside office hours are queued and delivered the next morning.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{isThai ? 'คุ้มครองสวัสดิภาพครู 100%' : 'Teacher Well-being'}</span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Chat & Audit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Thread List (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-[#7B1C3E]" />
                {isThai ? 'ห้องสนทนากับผู้ปกครอง' : 'Parent Threads'}
              </h2>
              <span className="text-xs text-slate-400 font-medium font-mono">{filteredThreads.length}</span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isThai ? 'ค้นหาชื่อนักเรียน หรือ ผู้ปกครอง...' : 'Search student or parent...'}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {['ALL', 'HOMEROOM', 'ADMIN_OFFICE', 'INFIRMARY'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                    channelFilter === ch
                      ? 'bg-[#7B1C3E] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {ch === 'ALL' ? (isThai ? 'ทั้งหมด' : 'All') : channelLabel(ch as ThreadChannelType)}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto flex-1">
            {filteredThreads.map((t) => {
              const isSelected = t.id === selectedThreadId;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedThreadId(t.id)}
                  className={`w-full text-left p-4 transition-colors flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#7B1C3E]/5 dark:bg-[#7B1C3E]/20 border-l-4 border-[#7B1C3E]'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                        {t.student_name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {t.grade_level}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {isThai ? 'ผู้ปกครอง: ' : 'Guardian: '} {t.guardian_name}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-1">
                      {t.last_message_text}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {t.last_message_at.slice(11, 16)} น.
                    </span>
                    {t.unread_staff_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center">
                        {t.unread_staff_count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle Column: Chat Conversation (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          {activeThread ? (
            <>
              {/* Thread Top Bar */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {activeThread.student_name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-300">
                      {activeThread.grade_level}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {activeThread.guardian_name} • {activeThread.teacher_name}
                  </p>
                </div>

                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {isThai ? 'เชื่อมต่อสด' : 'Live Connected'}
                </span>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[460px] bg-slate-50/30 dark:bg-slate-950/20">
                {activeMessages.map((m) => {
                  const isStaff = m.sender_type === 'STAFF';
                  const isSystem = m.sender_type === 'SYSTEM';

                  if (isSystem) {
                    return (
                      <div key={m.id} className="text-center my-2">
                        <span className="inline-block px-3 py-1 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {m.body_th}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-bold text-slate-500">{m.sender_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {m.created_at.slice(11, 16)} น.
                        </span>
                      </div>

                      <div
                        className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm shadow-2xs ${
                          isStaff
                            ? 'bg-[#7B1C3E] text-white rounded-br-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-xs'
                        }`}
                      >
                        <p className="leading-relaxed">{m.body_th}</p>

                        {m.body_en && (
                          <p className="text-[11px] text-white/80 dark:text-slate-400 mt-1 pt-1 border-t border-white/20 dark:border-slate-700">
                            {m.body_en}
                          </p>
                        )}

                        {m.require_acknowledgement && (
                          <div className="mt-2 pt-2 border-t border-white/20 dark:border-slate-700 flex items-center justify-between text-[11px]">
                            <span className="font-semibold flex items-center gap-1">
                              <BellRing className="w-3.5 h-3.5" />
                              {isThai ? 'ต้องการการรับทราบ' : 'Ack Required'}
                            </span>
                            {m.acknowledged_at ? (
                              <span className="font-bold text-emerald-200 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {isThai ? 'ผู้ปกครองรับทราบแล้ว' : 'Acknowledged'}
                              </span>
                            ) : (
                              <span className="text-amber-200 dark:text-amber-400">
                                {isThai ? 'รอผู้ปกครองกดรับทราบ' : 'Awaiting Ack'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireAck}
                      onChange={(e) => setRequireAck(e.target.checked)}
                      className="rounded text-[#7B1C3E] focus:ring-[#7B1C3E]"
                    />
                    <span>{isThai ? 'กำหนดให้ผู้ปกครองต้องกด "รับทราบ"' : 'Require Parent Acknowledgement'}</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      isThai
                        ? 'พิมพ์ข้อความถึงผู้ปกครอง (จะซิงค์ไปยัง Parents Portal ทันที)...'
                        : 'Type message to parent (syncs live to Parents Portal)...'
                    }
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#7B1C3E]"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !replyText.trim()}
                    className="px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isThai ? 'ส่ง' : 'Send'}</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 p-12 text-center text-slate-400 text-sm flex items-center justify-center">
              {isThai ? 'เลือกห้องสนทนาเพื่อเริ่มต้น' : 'Select a thread to start messaging'}
            </div>
          )}
        </div>

        {/* Right Column: Live Pipeline Domain Events Stream (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              {isThai ? 'บันทึกเหตุการณ์ระบบ (Live Events)' : 'Live Domain Events'}
            </h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>

          <div className="p-3 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto flex-1 max-h-[560px]">
            {domainEvents.map((evt) => {
              const isCrit = evt.severity === 'CRITICAL';
              const isHigh = evt.severity === 'HIGH';

              return (
                <div key={evt.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold ${
                        isCrit
                          ? 'bg-rose-100 text-rose-700'
                          : isHigh
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {evt.event_type}
                    </span>
                    <span className="text-slate-400 font-mono">{evt.created_at.slice(11, 16)} น.</span>
                  </div>

                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {isThai ? evt.title_th : evt.title_en}
                  </p>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {isThai ? evt.body_th : evt.body_en}
                  </p>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                    <span>
                      {evt.actor_role}: {evt.actor_name}
                    </span>
                    {evt.student_name && <span className="font-medium text-slate-600 dark:text-slate-300">{evt.student_name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
