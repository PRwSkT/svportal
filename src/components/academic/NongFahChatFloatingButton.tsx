'use client';

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface NongFahChatFloatingButtonProps {
  onClick: () => void;
  isOpen: boolean;
  label?: string;
}

export function NongFahChatFloatingButton({
  onClick,
  isOpen,
  label = 'คุยกับน้องฟ้า AI'
}: NongFahChatFloatingButtonProps) {
  if (isOpen) return null;

  return (
    <div
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 cursor-pointer group select-none"
      title="เปิดกล่องแชทน้องฟ้า AI"
      aria-label="เปิดกล่องแชทน้องฟ้า AI"
    >
      {/* Speech Pill Callout */}
      <div className="hidden sm:flex items-center gap-2 py-2 px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-sky-200 dark:border-sky-800 rounded-2xl shadow-lg shadow-sky-950/10 group-hover:border-sky-400 transition-all text-xs font-bold text-slate-800 dark:text-slate-100">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-medium">
          วิชาการ
        </span>
      </div>

      {/* Round Bot Button */}
      <button
        type="button"
        className="relative w-14 h-14 rounded-2xl bg-linear-to-tr from-sky-600 via-indigo-600 to-[#7B1C3E] p-0.5 shadow-xl shadow-sky-900/20 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform"
      >
        <span className="absolute -inset-1 rounded-2xl bg-linear-to-r from-sky-400 to-indigo-500 opacity-60 blur-xs group-hover:opacity-100 transition-opacity animate-pulse -z-10" />
        <div className="w-full h-full rounded-[14px] bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white">
          <Sparkles className="w-3 h-3 text-amber-300 absolute top-1.5 right-1.5" />
          <Bot className="w-6 h-6 text-white" />
          <span className="text-[8px] font-bold text-sky-200 tracking-tight mt-0.5">
            น้องฟ้า
          </span>
        </div>
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
        </span>
      </button>
    </div>
  );
}
