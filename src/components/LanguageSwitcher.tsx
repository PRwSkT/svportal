'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export function LanguageSwitcher({ size = 'md', showIcon = false, className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  const isSmall = size === 'sm';

  return (
    <div
      role="group"
      aria-label="Language Selector"
      className={`inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-inner transition-colors ${className}`}
    >
      {showIcon && (
        <span className="pl-2 pr-1 text-slate-400">
          <Globe className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </span>
      )}
      <button
        type="button"
        onClick={() => setLanguage('th')}
        aria-pressed={language === 'th'}
        className={`font-bold transition-all rounded-xl cursor-pointer ${
          isSmall ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        } ${
          language === 'th'
            ? 'bg-white dark:bg-slate-700 text-[#7B1C3E] dark:text-pink-300 shadow-sm border border-slate-200/50 dark:border-slate-600'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        TH
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={`font-bold transition-all rounded-xl cursor-pointer ${
          isSmall ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        } ${
          language === 'en'
            ? 'bg-white dark:bg-slate-700 text-[#7B1C3E] dark:text-pink-300 shadow-sm border border-slate-200/50 dark:border-slate-600'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  );
}
