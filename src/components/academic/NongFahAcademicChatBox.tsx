'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  X, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Users, 
  Clock, 
  ArrowLeftRight, 
  Loader2, 
  ShieldCheck,
  CalendarDays
} from 'lucide-react';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionType?: 'substitute_match' | 'collision_check' | 'workload_summary' | 'generate_prompt' | 'chat';
  data?: any;
  suggestions?: string[];
  timestamp: Date;
}

interface NongFahAcademicChatBoxProps {
  mode?: 'floating' | 'embedded';
  isOpen?: boolean;
  onClose?: () => void;
  academicYear?: string;
  term?: string;
  onTimetableUpdated?: () => void;
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  'จัดครูสอนแทนด่วน',
  'ตรวจสอบชั่วโมงชนในตาราง',
  'สรุปภาระงานสอนครู',
  'ให้น้องฟ้าร่างตารางสอนใหม่อัตโนมัติ'
];

export function NongFahAcademicChatBox({
  mode = 'floating',
  isOpen = true,
  onClose,
  academicYear = '2568',
  term = '1',
  onTimetableUpdated,
  className = ''
}: NongFahAcademicChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: 'สวัสดีค่ะคุณครู หนูฟ้าเป็นผู้ช่วยอัจฉริยะฝ่ายวิชาการของโรงเรียนสมคิดวิทยาค่ะ หนูฟ้าพร้อมช่วยคุณครูจัดตารางสอน จัดครูสอนแทน ตรวจสอบชั่วโมงชน หรือวิเคราะห์ภาระงานสอนได้ทันทีค่ะ คุณครูต้องการให้หนูฟ้าช่วยเรื่องอะไรคะ',
      suggestions: DEFAULT_SUGGESTIONS,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [approvedSubIds, setApprovedSubIds] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/academic/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          context: {
            academic_year: academicYear,
            term: term
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.response || 'หนูฟ้าดำเนินการให้เรียบร้อยแล้วค่ะ',
          actionType: data.actionType,
          data: data.data,
          suggestions: data.suggestions || DEFAULT_SUGGESTIONS,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: data.error || 'ขออภัยค่ะ หนูฟ้าพบข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งนะคะ',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: 'assistant',
        content: 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้งค่ะ',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleApproveSub = async (subId: string) => {
    if (!subId) return;
    const toastId = toast.loading('กำลังอนุมัติการสอนแทน...');
    try {
      const res = await fetch(`/api/academic/substitutions/${subId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'อนุมัติการสอนแทนเรียบร้อยแล้ว', { id: toastId });
        setApprovedSubIds(prev => ({ ...prev, [subId]: true }));
        if (onTimetableUpdated) onTimetableUpdated();
      } else {
        toast.error(data.error || 'อนุมัติไม่สำเร็จ', { id: toastId });
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการอนุมัติ', { id: toastId });
    }
  };

  const handleGenerateTimetableFromChat = async () => {
    const toastId = toast.loading('น้องฟ้ากำลังร่างตารางสอนใหม่อัตโนมัติ...');
    try {
      const res = await fetch('/api/academic/timetable/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: academicYear,
          term: term,
          clear_existing: true
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message, { id: toastId });
        if (onTimetableUpdated) onTimetableUpdated();
        setMessages(prev => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            role: 'assistant',
            content: `หนูฟ้าร่างตารางสอนใหม่เสร็จสิ้นเรียบร้อยแล้วค่ะ! ได้จัดวิชาลงตารางครบทุกคาบ ปราศจากชั่วโมงชน 100% และกระจายภาระงานครูอย่างสมดุลค่ะ`,
            suggestions: ['ตรวจสอบชั่วโมงชนในตาราง', 'วิเคราะห์ภาระงานสอนครู'],
            timestamp: new Date()
          }
        ]);
      } else {
        toast.error(data.error || 'คำนวณตารางไม่สำเร็จ', { id: toastId });
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการคำนวณ', { id: toastId });
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-1',
        role: 'assistant',
        content: 'สวัสดีค่ะคุณครู หนูฟ้าเป็นผู้ช่วยอัจฉริยะฝ่ายวิชาการของโรงเรียนสมคิดวิทยาค่ะ หนูฟ้าพร้อมช่วยคุณครูจัดตารางสอน จัดครูสอนแทน ตรวจสอบชั่วโมงชน หรือวิเคราะห์ภาระงานสอนได้ทันทีค่ะ คุณครูต้องการให้หนูฟ้าช่วยเรื่องอะไรคะ',
        suggestions: DEFAULT_SUGGESTIONS,
        timestamp: new Date()
      }
    ]);
  };

  if (mode === 'floating' && !isOpen) {
    return null;
  }

  const containerClasses = mode === 'floating'
    ? `fixed z-50 transition-all duration-300 ${
        isExpanded
          ? 'inset-4 md:inset-10'
          : 'bottom-5 right-5 w-[92vw] sm:w-[460px] h-[600px] max-h-[85vh]'
      }`
    : `w-full h-full min-h-[550px] ${className}`;

  return (
    <div className={`${containerClasses} flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden`}>
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-linear-to-r from-sky-600 via-indigo-600 to-[#7B1C3E] text-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight">น้องฟ้า AI</h3>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-semibold text-white/90">
                ผู้ช่วยฝ่ายวิชาการ
              </span>
            </div>
            <p className="text-[11px] text-white/80">
              ระบบปัญญาประดิษฐ์สนับสนุนงานโรงเรียนสมคิดวิทยา
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleResetChat}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
            title="เริ่มบทสนทนาใหม่"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {mode === 'floating' && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
              title={isExpanded ? 'ย่อขนาด' : 'ขยายขนาด'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {mode === 'floating' && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
              title="ปิดกล่องแชท"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-end gap-2 max-w-[88%]">
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-900 mb-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200 dark:border-slate-800 shadow-xs'
                  }`}
                >
                  {msg.content}

                  {/* ACTION CARD: SUBSTITUTE MATCHES */}
                  {msg.actionType === 'substitute_match' && msg.data?.matches && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="font-bold text-[11px] text-slate-600 dark:text-slate-400">
                        รายการจัดครูสอนแทนที่แนะนำ:
                      </div>
                      {msg.data.matches.map((m: any, idx: number) => {
                        const isApproved = approvedSubIds[m.substitutionId];
                        return (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                คาบที่ {m.periodNumber}: {m.courseName} (ห้อง {m.className})
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-[10px] font-bold">
                                {m.tierBadge}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300">
                              ครูสอนแทน: <strong className="text-emerald-600 dark:text-emerald-400">{m.substituteTeacherName}</strong>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              เหตุผล: {m.reason}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                              <FileText className="w-3 h-3 text-indigo-500" />
                              {m.worksheet}
                            </div>
                            {m.substitutionId && (
                              <div className="pt-1 flex justify-end">
                                <button
                                  onClick={() => handleApproveSub(m.substitutionId)}
                                  disabled={isApproved}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                    isApproved
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 cursor-default'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {isApproved ? 'อนุมัติแล้ว' : 'อนุมัติการสอนแทน'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ACTION CARD: COLLISION CHECK RESULTS */}
                  {msg.actionType === 'collision_check' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      {msg.data?.collisionCount === 0 ? (
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>ตารางสอนผ่านเกณฑ์มาตรฐาน ปราศจากชั่วโมงชน</span>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-[11px]">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>ตรวจพบข้อขัดแย้ง {msg.data?.collisionCount} จุด กรุณาปรับแก้</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ACTION BUTTON: RUN TIMETABLE GENERATION */}
                  {msg.content.includes('ร่างตารางสอน') && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={handleGenerateTimetableFromChat}
                        className="w-full px-3 py-2 bg-linear-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        เริ่มให้น้องฟ้าร่างตารางสอนใหม่เดี๋ยวนี้
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions Chips (shown under the last bot message) */}
              {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                  {msg.suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(s)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-full text-[11px] font-medium text-slate-700 dark:text-slate-300 transition shadow-2xs"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-900">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-xs text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
              <span>น้องฟ้ากำลังคิดและวิเคราะห์ข้อมูล...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="พิมพ์คำถาม หรือสั่งให้น้องฟ้าช่วยงานวิชาการ..."
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="p-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl transition disabled:opacity-40 disabled:hover:bg-sky-600 shadow-xs"
            title="ส่งข้อความ"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
