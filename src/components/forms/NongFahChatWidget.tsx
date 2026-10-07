'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  X,
  Send,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  Maximize2,
  Copy,
  Loader2,
  ListPlus,
} from 'lucide-react';
import { GeneratedFormDefinition } from '@/lib/ai/gemma';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generatedForm?: GeneratedFormDefinition | null;
  suggestions?: string[];
  timestamp: Date;
}

interface NongFahChatWidgetProps {
  onApplyForm?: (formDef: GeneratedFormDefinition, mode: 'replace' | 'append') => void;
  onCreateFromTemplate?: (formDef: GeneratedFormDefinition) => void;
  onOpenStudio?: () => void;
  formTitle?: string;
  pageContext?: 'editor' | 'list' | 'responses';
  defaultOpen?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  'ช่วยสร้างฟอร์มลงทะเบียนเรียนพิเศษ ซัมเมอร์(ตุลาคม)',
  'สร้างแบบสำรวจความพึงพอใจการประชุมผู้ปกครอง',
  'สร้างแบบฟอร์มขออนุญาตไปทัศนศึกษา',
  'สร้างแบบประเมินกิจกรรมนักเรียน',
];

export function NongFahChatWidget({
  onApplyForm,
  onCreateFromTemplate,
  onOpenStudio,
  formTitle,
  pageContext = 'list',
  defaultOpen = false,
}: NongFahChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appliedFormId, setAppliedFormId] = useState<string | null>(null);
  const [expandedFieldListId, setExpandedFieldListId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'สวัสดีค่ะคุณครูและบุคลากรโรงเรียนสมคิดวิทยา น้องฟ้าพร้อมช่วยออกแบบฟอร์ม สรุปผลข้อมูล หรือตอบคำถามการจัดสร้างแบบฟอร์มค่ะ คุณครูสามารถพิมพ์บอกรายละเอียดที่ต้องการ หรือกดเลือกหัวข้อแนะนำด้านล่างได้เลยนะคะ',
      suggestions: DEFAULT_SUGGESTIONS,
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen, messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsgId = 'msg-' + Date.now();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/admin/forms/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          context: {
            page: pageContext,
            formTitle: formTitle || undefined,
          },
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'เกิดข้อผิดพลาดในการประมวลผลคำสั่ง');
      }

      const assistantMsg: ChatMessage = {
        id: 'msg-reply-' + Date.now(),
        role: 'assistant',
        content: json.data?.reply || 'น้องฟ้าประมวลผลข้อมูลเรียบร้อยแล้วค่ะ',
        generatedForm: json.data?.generatedForm || null,
        suggestions: json.data?.suggestions || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        role: 'assistant',
        content: err?.message || 'ขออภัยค่ะ น้องฟ้าไม่สามารถประมวลผลคำสั่งได้ในขณะนี้ กรุณาลองใหม่อีกครั้งนะคะ',
        suggestions: ['กดส่งคำสั่งลองใหม่อีกครั้ง', text],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
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

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content:
          'เริ่มการสนทนาใหม่เรียบร้อยค่ะ คุณครูต้องการให้น้องฟ้าช่วยออกแบบฟอร์มอะไร หรือสอบถามเรื่องใด บอกน้องฟ้าได้เลยนะคะ',
        suggestions: DEFAULT_SUGGESTIONS,
        timestamp: new Date(),
      },
    ]);
  };

  const handleApplyFormClick = (
    msgId: string,
    formDef: GeneratedFormDefinition,
    mode: 'replace' | 'append' = 'append'
  ) => {
    if (onApplyForm) {
      onApplyForm(formDef, mode);
      setAppliedFormId(msgId);
      setTimeout(() => setAppliedFormId(null), 3000);
    }
  };

  const handleCreateFromTemplateClick = (formDef: GeneratedFormDefinition) => {
    if (onCreateFromTemplate) {
      onCreateFromTemplate(formDef);
    }
  };

  const handleCopyJson = (msgId: string, formDef: GeneratedFormDefinition) => {
    navigator.clipboard.writeText(JSON.stringify(formDef, null, 2));
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Floating Trigger Launcher (When chat box is closed) */}
      <AnimatePresence>
        {!isOpen && (
          <aside
            aria-label="ผู้ช่วยอัจฉริยะน้องฟ้า AI"
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2.5 cursor-pointer group select-none pointer-events-auto"
            onClick={() => setIsOpen(true)}
          >
            {/* Desktop Speech Pill */}
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: 0.1 }}
              className="hidden sm:flex items-center gap-2 py-2 px-3.5 bg-white/95 backdrop-blur-md border border-sky-200/90 rounded-2xl shadow-lg shadow-sky-900/10 hover:border-sky-300 transition-all text-xs font-bold text-slate-800"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-sky-900">น้องฟ้า AI แชทสร้างฟอร์ม</span>
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-sky-100 text-sky-700">
                ผู้ช่วยอัจฉริยะ
              </span>
            </motion.div>

            {/* Launcher Bubble Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-[#6E0D22] via-[#8C143B] to-indigo-700 p-0.5 shadow-xl shadow-[#7B1C3E]/25 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-4 focus:ring-sky-300/50"
              title="เปิดช่องแชทน้องฟ้า AI (Nong Fah AI Assistant)"
              aria-label="เปิดช่องแชทน้องฟ้า AI (Nong Fah AI Assistant)"
            >
              <span className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-sky-400 via-pink-400 to-purple-500 opacity-60 blur-xs group-hover:opacity-100 transition-opacity animate-pulse -z-10" />

              <div className="w-full h-full rounded-[22px] bg-gradient-to-br from-[#7B1C3E] to-[#4A0A1C] flex flex-col items-center justify-center text-white relative overflow-hidden">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute top-2 right-2 animate-bounce" />
                <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-xs" />
                <span className="text-[9px] font-bold tracking-tight text-amber-200 mt-0.5">
                  น้องฟ้า
                </span>
              </div>

              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
              </span>
            </motion.button>
          </aside>
        )}
      </AnimatePresence>

      {/* Floating Chat Box Window (When opened) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-50 sm:w-[430px] max-w-full h-[620px] max-h-[calc(100vh-2rem)] bg-white rounded-3xl shadow-2xl shadow-slate-900/25 border border-sky-200/90 flex flex-col overflow-hidden ring-1 ring-slate-900/5 font-sans"
            aria-label="หน้าต่างแชทน้องฟ้า AI"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#6E0D22] via-[#7B1C3E] to-[#8C143B] text-white px-4 py-3.5 sm:px-4.5 sm:py-4 flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-amber-300" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#7B1C3E]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      น้องฟ้า (AI Assistant)
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-white/20 text-white border border-white/20 shrink-0">
                      ออนไลน์
                    </span>
                  </div>
                  <p className="text-[11px] text-white/80 truncate">
                    โรงเรียนสมคิดวิทยา (Somkidvittaya)
                  </p>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {onOpenStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenStudio();
                      setIsOpen(false);
                    }}
                    className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                    title="เปิดโหมด Form Studio แบบเต็มจอ"
                    aria-label="เปิดโหมด Form Studio แบบเต็มจอ"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetChat}
                  className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                  title="เริ่มการสนทนาใหม่"
                  aria-label="เริ่มการสนทนาใหม่"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                  title="ย่อหน้าต่างแชท"
                  aria-label="ย่อหน้าต่างแชท"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-bar: Context indicator */}
            {formTitle && (
              <div className="bg-sky-50 px-4 py-1.5 border-b border-sky-100 flex items-center justify-between text-[11px] text-sky-800">
                <div className="flex items-center gap-1.5 truncate">
                  <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span className="truncate">กำลังแก้ไข: <strong>{formTitle}</strong></span>
                </div>
                <span className="text-[10px] font-semibold text-sky-600 shrink-0">พร้อมแทรกฟิลด์</span>
              </div>
            )}

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 bg-gradient-to-b from-sky-50/40 via-white to-slate-50/50">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Bot Avatar Icon */}
                    {!isUser && (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-[#7B1C3E] to-[#4A0A1C] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                        <Bot className="w-4 h-4 text-amber-200" />
                      </div>
                    )}

                    {/* Message Bubble Content */}
                    <div
                      className={`max-w-[86%] sm:max-w-[82%] space-y-2.5 ${
                        isUser
                          ? 'bg-[#7B1C3E] text-white rounded-2xl rounded-tr-xs px-3.5 py-2.5 shadow-sm text-xs sm:text-sm font-medium leading-relaxed'
                          : 'bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-xs sm:text-sm text-slate-800 leading-relaxed'
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.content}</div>

                      {/* Embedded Interactive Generated Form Card */}
                      {msg.generatedForm && (
                        <div className="mt-3 pt-3 border-t border-sky-200/80 bg-sky-50/70 rounded-2xl p-3 sm:p-3.5 space-y-2.5 text-slate-800">
                          {/* Title & Category Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-sky-200/80 text-sky-800 mb-1">
                                โครงสร้างฟอร์มพร้อมใช้งาน
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                                {msg.generatedForm.title?.th || 'แบบฟอร์มโรงเรียนสมคิดวิทยา'}
                              </h4>
                              {msg.generatedForm.description?.th && (
                                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                                  {msg.generatedForm.description.th}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Fields Count Pill */}
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                            <span className="px-2 py-0.5 bg-white rounded-md border border-sky-200 text-sky-800">
                              {msg.generatedForm.fields?.length || 0} ฟิลด์ข้อมูล
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              เชื่อมโยงระบบสมคิดวิทยา
                            </span>
                          </div>

                          {/* Collapsible Fields List Preview */}
                          <div className="bg-white/90 rounded-xl border border-sky-100 overflow-hidden">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedFieldListId(
                                  expandedFieldListId === msg.id ? null : msg.id
                                )
                              }
                              className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-sky-900 hover:bg-sky-50/50 transition-colors cursor-pointer"
                            >
                              <span>
                                {expandedFieldListId === msg.id
                                  ? 'ซ่อนรายการฟิลด์'
                                  : 'ดูรายการคำถามทั้งหมด'}
                              </span>
                              {expandedFieldListId === msg.id ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {expandedFieldListId === msg.id && (
                              <div className="px-2.5 py-2 border-t border-sky-100 max-h-48 overflow-y-auto space-y-1.5">
                                {msg.generatedForm.fields.map((f, idx) => (
                                  <div
                                    key={f.field_key || idx}
                                    className="flex items-center justify-between gap-1 text-[11px] py-0.5 border-b border-slate-50 last:border-0"
                                  >
                                    <span className="text-slate-800 font-medium truncate">
                                      {idx + 1}. {f.label?.th || f.field_key}
                                      {f.is_required && (
                                        <span className="text-rose-500 ml-0.5">*</span>
                                      )}
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0 font-mono">
                                      {f.field_type}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Primary Actions for Generated Form */}
                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            {/* Option A: If currently in Form Editor page */}
                            {onApplyForm && (
                              <button
                                type="button"
                                onClick={() => handleApplyFormClick(msg.id, msg.generatedForm!)}
                                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                              >
                                {appliedFormId === msg.id ? (
                                  <>
                                    <Check className="w-4 h-4 text-emerald-200" />
                                    <span>แทรกในฟอร์มสำเร็จ</span>
                                  </>
                                ) : (
                                  <>
                                    <ListPlus className="w-4 h-4" />
                                    <span>นำโครงสร้างไปใส่ในฟอร์มนี้</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Option B: If on Forms List page */}
                            {onCreateFromTemplate && !onApplyForm && (
                              <button
                                type="button"
                                onClick={() => handleCreateFromTemplateClick(msg.generatedForm!)}
                                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-[#7B1C3E] to-indigo-800 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                              >
                                <ListPlus className="w-4 h-4" />
                                <span>สร้างฟอร์มใหม่จากโครงสร้างนี้</span>
                              </button>
                            )}

                            {/* Copy JSON Button */}
                            <button
                              type="button"
                              onClick={() => handleCopyJson(msg.id, msg.generatedForm!)}
                              className="inline-flex items-center justify-center gap-1 py-2 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                              title="คัดลอกโครงสร้าง JSON"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-[11px] text-emerald-700 font-bold">คัดลอกแล้ว</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  <span className="text-[11px]">คัดลอก JSON</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Clickable Suggestion Chips under Assistant Message */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1.5">
                          {msg.suggestions.map((sug, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSendMessage(sug)}
                              className="text-[11px] text-sky-800 bg-sky-50/90 hover:bg-sky-100 hover:text-sky-900 border border-sky-200/80 rounded-xl px-2.5 py-1 text-left transition-colors cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Loading State Animation */}
              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-[#7B1C3E] to-[#4A0A1C] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Bot className="w-4 h-4 text-amber-200 animate-pulse" />
                  </div>
                  <div className="bg-white border border-sky-100 rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-xs text-sky-900 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600 shrink-0" />
                    <span>น้องฟ้ากำลังคิดและออกแบบโครงสร้างฟอร์ม...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar & Footer */}
            <div className="bg-white border-t border-slate-200/80 p-2.5 sm:p-3 shrink-0 space-y-2">
              <div className="flex items-end gap-2 bg-slate-50 hover:bg-white focus-within:bg-white border border-slate-200 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 rounded-2xl p-2 transition-all">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  disabled={isLoading}
                  placeholder="พิมพ์ข้อความบอกน้องฟ้า เช่น 'ช่วยสร้างฟอร์มลงทะเบียนเรียนพิเศษ'..."
                  className="w-full resize-none bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none py-1 px-1.5 leading-relaxed max-h-24"
                />

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7B1C3E] to-indigo-700 hover:opacity-95 text-white flex items-center justify-center shrink-0 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="ส่งข้อความ (Enter)"
                  aria-label="ส่งข้อความ"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* PDPA Safeguard Footer Note */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>คุ้มครองข้อมูลส่วนบุคคลตามมาตรฐาน PDPA Zero-PII โรงเรียนสมคิดวิทยา</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
