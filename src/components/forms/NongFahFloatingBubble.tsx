'use client';

import { motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';

interface NongFahFloatingBubbleProps {
  onClick: () => void;
  label?: string;
  badge?: string;
}

export function NongFahFloatingBubble({
  onClick,
  label = 'น้องฟ้า AI ช่วยสร้างฟอร์ม',
  badge = 'ออนไลน์',
}: NongFahFloatingBubbleProps) {
  return (
    <aside
      aria-label="ผู้ช่วยอัจฉริยะน้องฟ้า AI"
      className="fixed bottom-5 right-4 sm:bottom-7 sm:right-7 z-50 flex items-center gap-2.5 cursor-pointer group select-none pointer-events-auto"
      onClick={onClick}
    >
      {/* Speech Pill Callout */}
      <motion.div
        initial={{ opacity: 0, x: 10, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="hidden sm:flex items-center gap-2 py-2 px-3.5 bg-white/95 backdrop-blur-md border border-sky-200/90 rounded-2xl shadow-lg shadow-sky-900/10 hover:border-sky-300 transition-all text-xs font-bold text-slate-800"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold text-sky-900">{label}</span>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-sky-100 text-sky-700">
          AI Assistant
        </span>
      </motion.div>

      {/* Main Cute Chatbot Bubble Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-[#6E0D22] via-[#8C143B] to-indigo-700 p-0.5 shadow-xl shadow-[#7B1C3E]/25 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-4 focus:ring-sky-300/50"
        title="เปิดผู้ช่วยอัจฉริยะน้องฟ้า (Nong Fah AI Assistant)"
        aria-label="เปิดผู้ช่วยอัจฉริยะน้องฟ้า (Nong Fah AI Assistant)"
      >
        {/* Soft Glowing Ambient Ring */}
        <span className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-sky-400 via-pink-400 to-purple-500 opacity-60 blur-xs group-hover:opacity-100 transition-opacity animate-pulse -z-10" />

        {/* Inner Content */}
        <div className="w-full h-full rounded-[22px] bg-gradient-to-br from-[#7B1C3E] to-[#4A0A1C] flex flex-col items-center justify-center text-white relative overflow-hidden">
          {/* Sparkle highlight */}
          <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute top-2 right-2 animate-bounce" />

          {/* Cute Robot / AI Icon */}
          <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-xs" />

          {/* Label underneath */}
          <span className="text-[9px] font-bold tracking-tight text-amber-200 mt-0.5">
            น้องฟ้า
          </span>
        </div>

        {/* Active Ping Indicator */}
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
        </span>
      </motion.button>
    </aside>
  );
}
