'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  Minimize2,
  Copy,
  Check,
  FileSpreadsheet,
  Calendar,
  Users,
  GraduationCap,
  ClipboardList,
  Utensils,
  Wallet,
  Compass,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  actionButton?: {
    label: string;
    url: string;
    description?: string;
  } | null;
  timestamp: Date;
}

export function GlobalNongFahBot() {
  const pathname = usePathname() || '/';
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [botState, setBotState] = useState<'idle' | 'thinking' | 'cheer'>('idle');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic context derived from current pathname
  const pageContext = useMemo(() => {
    if (pathname.includes('/forms')) {
      return {
        key: 'forms',
        title: 'ระบบแบบฟอร์ม',
        icon: ClipboardList,
        tag: 'Forms Studio',
        pillText: 'น้องฟ้าช่วยออกแบบฟอร์มได้นะคะ',
        greeting:
          'สวัสดีค่ะ หนูฟ้ายินดีให้บริการนะคะ ขณะนี้คุณครูกำลังอยู่ในหน้าแบบฟอร์ม หนูฟ้าสามารถช่วยออกแบบข้อสอบ ร่างคำถามฟอร์มใหม่ ตรวจสอบความสมบูรณ์ PDPA หรือสรุปแนวโน้มการตอบกลับให้ได้ทันทีเลยค่ะ',
        suggestions: [
          'ช่วยแนะนำข้อคำถามสำหรับฟอร์มนี้',
          'ตรวจสอบความสมบูรณ์และข้อกำหนด PDPA',
          'สรุปแนวโน้มการตอบกลับของผู้ปกครอง',
        ],
      };
    }
    if (pathname.includes('/academic/timetable')) {
      return {
        key: 'timetable',
        title: 'ตารางเรียนตารางสอน',
        icon: Calendar,
        tag: 'Timetable Engine',
        pillText: 'น้องฟ้าช่วยตรวจตารางสอนได้นะคะ',
        greeting:
          'สวัสดีค่ะ หนูฟ้าพร้อมช่วยดูแลระบบตารางสอนค่ะ คุณครูสามารถสั่งให้หนูฟ้าตรวจสอบชั่วโมงชนในตาราง จัดหาครูสอนแทนด่วนตามกลุ่มสาระ หรือสรุปภาระงานสอนเกินเพดานได้ทันทีค่ะ',
        suggestions: [
          'ตรวจสอบชั่วโมงชนในตารางสอน',
          'จัดหาครูสอนแทนด่วน',
          'สรุปภาระงานสอนของคณะครู',
        ],
      };
    }
    if (pathname.includes('/academic')) {
      return {
        key: 'academic',
        title: 'วิชาการ & ปพ.5',
        icon: GraduationCap,
        tag: 'Academic Hub',
        pillText: 'น้องฟ้าช่วยตรวจ ปพ.5 ได้นะคะ',
        greeting:
          'สวัสดีค่ะ หนูฟ้าพร้อมช่วยเหลืองานวิชาการค่ะ ไม่ว่าจะเป็นการตัดเกรด ตรวจสอบเล่ม ปพ.5 วิเคราะห์ตัวชี้วัดที่เด็กยังไม่ผ่าน เฝ้าระวังเด็กเสี่ยงติด มส. หรือช่วยออกข้อสอบปรนัยพร้อมช้อยส์หลอก 4 ตัวเลือกและเฉลยค่ะ',
        suggestions: [
          'ช่วยออกข้อสอบปรนัย 5 ข้อพร้อมช้อยส์หลอก',
          'ตรวจสอบนักเรียนเสี่ยงติด มส. เวลาเรียนไม่ถึง 80%',
          'ขั้นตอนการตรวจและลงนามเล่ม ปพ.5',
        ],
      };
    }
    if (pathname.includes('/admin/students') || pathname.includes('/opec')) {
      return {
        key: 'students',
        title: 'ทะเบียนนักเรียน & สช.',
        icon: Users,
        tag: 'OPEC REGIS',
        pillText: 'น้องฟ้าช่วยตรวจข้อมูล สช. ได้นะคะ',
        greeting:
          'สวัสดีค่ะ หนูฟ้าพร้อมช่วยงานทะเบียนและข้อมูลส่ง สช. ค่ะ หนูฟ้าจำกฎเหล็กของ สช. REGIS ได้แม่นยำ เช่น วันที่ต้องเป็นตัวเลข 8 หลักพุทธศักราช "ปปปปดดวว" (ห้ามมีขีด/ทับ), การตรวจเลขบัตรประชาชน 13 หลัก, และเกณฑ์รหัส G นักเรียนต่างชาติค่ะ',
        suggestions: [
          'กฎเหล็กการจัดไฟล์ Excel ส่ง สช. REGIS',
          'ขั้นตอนการขอรหัส G ให้นักเรียนต่างชาติ',
          'สถิตินักเรียนแยกชั้นเรียนและสถานะ',
        ],
      };
    }
    if (pathname.includes('/attendance')) {
      return {
        key: 'attendance',
        title: 'เวลาเรียน & โภชนาการ',
        icon: Utensils,
        tag: 'Attendance & Health',
        pillText: 'น้องฟ้าช่วยตรวจโภชนาการและเวลาเรียนค่ะ',
        greeting:
          'สวัสดีค่ะ หนูฟ้าช่วยดูแลระบบเช็กชื่อเวลาเรียนและสุขภาพนักเรียนค่ะ คุณครูสามารถสอบถามเกณฑ์คัดกรองเด็กทุพโภชนาการ (น้ำหนัก-ส่วนสูง BMI กรมอนามัย) หรือเกณฑ์ขอรับเงินอุดหนุนอาหารกลางวัน สช. (รายได้ครอบครัว < 40,000 บาท/ปี) ได้ทันทีค่ะ',
        suggestions: [
          'เกณฑ์คัดกรองเด็กรับเงินอาหารกลางวัน สช.',
          'วิธีคำนวณและประเมินภาวะโภชนาการ BMI',
          'สรุปแนวโน้มการขาดเรียนของนักเรียน',
        ],
      };
    }
    if (pathname.includes('/fees') || pathname.includes('/pos') || pathname.includes('/wallet')) {
      return {
        key: 'finance',
        title: 'การเงิน & สวัสดิการ',
        icon: Wallet,
        tag: 'Finance & Free 15Y',
        pillText: 'น้องฟ้าช่วยงานการเงินและเรียนฟรีได้นะคะ',
        greeting:
          'สวัสดีค่ะ หนูฟ้าพร้อมช่วยงานการเงินและโครงการเรียนฟรี 15 ปีค่ะ ไม่ว่าจะเป็นการจัดทำแบบ อร.1, อร.1/1 การจัดการใบเสร็จรับเงินค่าธรรมเนียม หรือการตรวจสอบเงินคงเหลือในกระเป๋าเงินนักเรียนค่ะ',
        suggestions: [
          'ระเบียบการเบิกจ่ายเงินเรียนฟรี 15 ปี 4 หมวด',
          'เอกสารแบบ อร.1/1 และการลงลายมือชื่อผู้ปกครอง',
          'ตรวจสอบยอดเงินคงเหลือกระเป๋านักเรียน',
        ],
      };
    }
    if (pathname.includes('/calendar')) {
      return {
        key: 'calendar',
        title: 'ปฏิทินปฏิบัติงาน',
        icon: Calendar,
        tag: 'Calendar & Duty',
        pillText: 'น้องฟ้าช่วยตรวจปฏิทินและเวรครูค่ะ',
        greeting:
          'สวัสดีค่ะ หนูฟ้าพร้อมช่วยตรวจเช็กปฏิทินโรงเรียน เวรปฏิบัติหน้าที่ประจำวัน และกำหนดการส่งงานสำคัญของโรงเรียนสมคิดวิทยาค่ะ',
        suggestions: [
          'ตรวจสอบรายชื่อครูเวรวันนี้',
          'กำหนดการสำคัญของภาคเรียนนี้',
          'วันหยุดและกิจกรรมประจำเดือน',
        ],
      };
    }

    return {
      key: 'general',
      title: 'ผู้ช่วยอัจฉริยะ',
      icon: Compass,
      tag: 'School Copilot',
      pillText: 'คุยกับน้องฟ้า AI',
      greeting:
        'สวัสดีค่ะ หนูฟ้ายินดีให้บริการค่ะ หนูฟ้าเป็น AI ผู้ช่วยอัจฉริยะประจำโรงเรียนสมคิดวิทยา พร้อมช่วยงานคุณครูทุกแผนก ไม่ว่าจะเป็นวิชาการ ทะเบียน ออกข้อสอบ โภชนาการ หรือข้อมูลระเบียบ สช. ล่าสุดค่ะ คุณครูสามารถพิมพ์คำถามหรือเลือกหัวข้อด้านล่างได้เลยนะคะ',
      suggestions: [
        'สรุปภารกิจและสิ่งที่ครูต้องทำวันนี้',
        'น้องฟ้าช่วยงานอะไรในระบบได้บ้าง',
        'สอบถามระเบียบ สช. และกระทรวงศึกษาธิการล่าสุด',
      ],
    };
  }, [pathname]);

  // Reset or initialize greeting when module context changes
  useEffect(() => {
    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: pageContext.greeting,
        suggestions: pageContext.suggestions,
        timestamp: new Date(),
      },
    ]);
  }, [pageContext.key]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Hide global bot on routes that have dedicated AI widgets or where AI should not be present (exams/login)
  const isHiddenRoute = 
    !user ||
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/forms') ||
    pathname.startsWith('/admin/forms') ||
    pathname.startsWith('/academic/timetable');

  // Listen for global custom events to open Nong Fah from anywhere
  useEffect(() => {
    if (isHiddenRoute) return;
    const handleOpenEvent = (e: any) => {
      setIsOpen(true);
      const prompt = e?.detail?.prompt;
      if (prompt) {
        setTimeout(() => {
          handleSendMessage(prompt);
        }, 150);
      }
    };
    window.addEventListener('open-nongfah-chat', handleOpenEvent);
    return () => window.removeEventListener('open-nongfah-chat', handleOpenEvent);
  }, [isHiddenRoute]);

  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputMessage).trim();
    if (!message || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    setBotState('thinking');

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'msg-welcome')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch('/api/ai/nongfah/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: historyPayload,
          context: {
            pathname,
            pageTitle: typeof document !== 'undefined' ? document.title : '',
            userName: (user as any)?.name || '',
          },
        }),
      });

      const rawText = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error('ระบบเซิร์ฟเวอร์ตอบกลับล่าช้าหรือขัดข้องชั่วคราว กรุณากดส่งคำสั่งลองใหม่อีกครั้งนะคะ');
      }

      if (json.success && json.data) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: json.data.reply,
          suggestions: json.data.suggestions || pageContext.suggestions,
          actionButton: json.data.actionButton || null,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setBotState('cheer');
        setTimeout(() => setBotState('idle'), 3500);
      } else {
        throw new Error(json.error || 'เกิดข้อผิดพลาดในการตอบกลับ');
      }
    } catch (err: any) {
      console.error('[NongFah Chat Error]:', err);
      let errorText =
        err?.message ||
        'ขออภัยค่ะ หนูฟ้าไม่สามารถประมวลผลข้อความได้ในขณะนี้ กรุณาลองใหม่อีกครั้งนะคะ';
      if (
        typeof errorText === 'string' &&
        (errorText.includes('did not match the expected pattern') ||
          errorText.includes('JSON') ||
          errorText.includes('SyntaxError'))
      ) {
        errorText =
          'ขออภัยค่ะ ระบบประมวลผล AI ตอบกลับล่าช้าหรือขัดข้องชั่วคราว กรุณากดส่งคำสั่งลองใหม่อีกครั้งนะคะ';
      }
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: errorText,
        suggestions: pageContext.suggestions,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setBotState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: pageContext.greeting,
        suggestions: pageContext.suggestions,
        timestamp: new Date(),
      },
    ]);
  };

  // Expression Image Selector for Nong Fah
  const characterAvatarSrc = useMemo(() => {
    if (botState === 'thinking') return '/images/nongfah/nongfah-thinking.png';
    if (botState === 'cheer') return '/images/nongfah/nongfah-cheer.png';
    if (isHovered && !isOpen) return '/images/nongfah/nongfah-wave.png';
    return '/images/nongfah/nongfah-friendly.png';
  }, [botState, isHovered, isOpen]);

  const ContextIcon = pageContext.icon;

  if (isHiddenRoute) {
    return null;
  }

  return (
    <>
      {/* 1. Floating Trigger Button (Always Bottom-Right) */}
      <aside
        aria-label="ผู้ช่วยอัจฉริยะน้องฟ้า AI ประจำโรงเรียนสมคิดวิทยา"
        className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 cursor-pointer group select-none pointer-events-auto print:hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Dynamic Context Speech Bubble Pill (Hidden when chat is open) */}
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2.5 py-2 px-3.5 bg-white/95 backdrop-blur-md border border-rose-200/80 rounded-2xl shadow-xl shadow-rose-950/10 hover:border-rose-400 hover:shadow-rose-900/15 transition-all text-xs font-semibold text-slate-800"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[12px] font-bold text-[#7B1C3E]">
                {pageContext.pillText}
              </span>
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              {pageContext.tag}
            </span>
          </motion.div>
        )}

        {/* Circular Authentic Nong Fah Character Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-gradient-to-tr from-[#6E0D22] via-[#8C143B] to-amber-500 shadow-2xl shadow-[#7B1C3E]/35 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-300/60"
          title="เปิดคุยกับน้องฟ้า AI (Nong Fah School Copilot)"
          aria-label="เปิดคุยกับน้องฟ้า AI (Nong Fah School Copilot)"
        >
          {/* Glowing Ambient Ring */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-rose-400 via-pink-400 to-amber-400 opacity-60 blur-xs group-hover:opacity-100 transition-opacity animate-pulse -z-10" />

          {/* Inner Avatar Container */}
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden relative border-2 border-white shadow-inner">
            <Image
              src="/images/nongfah/nongfah-avatar.png"
              alt="น้องฟ้า AI โรงเรียนสมคิดวิทยา"
              width={64}
              height={64}
              priority
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          </div>

          {/* Live Online Badge Indicator */}
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-xs" />
          </span>
        </motion.button>
      </aside>

      {/* 2. Expandable Intelligent Floating Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.94 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-20 right-3 sm:bottom-24 sm:right-6 z-50 w-[94vw] sm:w-[440px] h-[640px] max-h-[82vh] bg-white rounded-3xl shadow-2xl shadow-rose-950/25 border border-rose-100 flex flex-col overflow-hidden backdrop-blur-xl print:hidden"
          >
            {/* Header: School Branding & Character Profile */}
            <div className="bg-gradient-to-r from-[#6E0D22] via-[#7B1C3E] to-[#9E1B46] text-white p-3.5 px-4 flex items-center justify-between border-b border-rose-900/20 shadow-md">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-2xl bg-white/10 p-0.5 border border-white/20 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
                  <Image
                    src={characterAvatarSrc}
                    alt="น้องฟ้า AI"
                    width={44}
                    height={44}
                    className="w-full h-full object-cover transition-all"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-1">
                      น้องฟ้า (Nong Fah AI)
                    </h3>
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-200 border border-amber-300/30">
                      Super-Agent
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-100/90 font-medium">
                    ผู้ช่วยอัจฉริยะประจำโรงเรียนสมคิดวิทยา
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 text-rose-100">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  title="เริ่มบทสนทนาใหม่"
                  className="p-1.5 rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="ย่อหน้าต่าง"
                  className="p-1.5 rounded-xl hover:bg-white/15 active:bg-white/20 transition-colors"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Department Context Banner */}
            <div className="bg-rose-50/90 border-b border-rose-100/80 px-4 py-2 flex items-center justify-between text-xs text-rose-900">
              <div className="flex items-center gap-1.5 font-medium truncate">
                <ContextIcon className="w-3.5 h-3.5 text-[#7B1C3E] shrink-0" />
                <span className="text-[11px] font-semibold text-rose-950">
                  บริบทหน้าจอ:
                </span>
                <span className="text-[11px] text-slate-700 truncate">
                  {pageContext.title}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ทันโลก ทันเหตุการณ์
              </span>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`flex gap-2 max-w-[88%] ${
                      msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-rose-100 shrink-0 border border-rose-200 mt-0.5">
                        <Image
                          src="/images/nongfah/nongfah-avatar.png"
                          alt="น้องฟ้า"
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div
                      className={`relative group rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-[#7B1C3E] to-[#9E1B46] text-white rounded-br-xs font-medium'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                      }`}
                    >
                      {/* Copy message button */}
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          title="คัดลอกข้อความ"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}

                      <div className="whitespace-pre-line font-normal pr-3">
                        {msg.content}
                      </div>

                      {/* 1-Click Interactive Action Button */}
                      {msg.actionButton && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                          {msg.actionButton.description && (
                            <p className="text-[11px] text-slate-500 font-normal">
                              {msg.actionButton.description}
                            </p>
                          )}
                          <Link
                            href={msg.actionButton.url}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#7B1C3E] to-[#9E1B46] text-white text-xs font-semibold hover:opacity-95 shadow-xs transition-all group/btn"
                          >
                            <span>{msg.actionButton.label}</span>
                            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                          </Link>
                        </div>
                      )}

                      <div
                        className={`text-[9px] mt-1.5 flex justify-end font-light ${
                          msg.role === 'user' ? 'text-rose-200' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp.toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Suggestion Chips */}
                  {msg.role === 'assistant' &&
                    msg.suggestions &&
                    msg.suggestions.length > 0 && (
                      <div className="mt-2.5 pl-10 flex flex-wrap gap-1.5 max-w-[95%]">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleSendMessage(sug)}
                            className="text-[11px] font-medium py-1 px-2.5 rounded-full bg-white border border-rose-200/90 text-[#7B1C3E] hover:bg-rose-50 hover:border-rose-400 active:scale-95 transition-all text-left shadow-2xs"
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              ))}

              {/* Thinking Indicator */}
              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-rose-100 shrink-0 border border-rose-200 animate-pulse">
                    <Image
                      src="/images/nongfah/nongfah-thinking.png"
                      alt="น้องฟ้ากำลังคิด"
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-white border border-rose-200/70 rounded-2xl rounded-bl-xs px-4 py-2.5 text-xs text-slate-600 shadow-xs flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#7B1C3E] rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-[#7B1C3E] rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-[#7B1C3E] rounded-full animate-bounce" />
                    </span>
                    <span className="text-[11px] font-medium text-rose-900">
                      หนูฟ้ากำลังคิดและสืบค้นข้อมูลล่าสุดนะคะ...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer Area */}
            <div className="p-3 bg-white border-t border-slate-100 flex flex-col gap-1.5">
              <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-200/50 transition-all">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`ถามหรือสั่งน้องฟ้าในหน้านี้ (เช่น ${pageContext.suggestions[0] || 'พิมพ์ข้อความ...'})`}
                  className="w-full bg-transparent resize-none border-0 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none p-1.5 max-h-24 font-normal"
                />

                <button
                  type="button"
                  disabled={!inputMessage.trim() || isLoading}
                  onClick={() => handleSendMessage()}
                  className="p-2 rounded-xl bg-gradient-to-r from-[#7B1C3E] to-[#9E1B46] text-white hover:opacity-95 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all shrink-0 cursor-pointer shadow-xs"
                  title="ส่งข้อความ (Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                <span>กด Enter เพื่อส่ง, Shift + Enter เพื่อขึ้นบรรทัดใหม่</span>
                <span className="text-[#7B1C3E] font-medium">โรงเรียนสมคิดวิทยา</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
