'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Language, translations, Translations } from '@/lib/i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isThai: boolean;
  isEnglish: boolean;
  t: (path: string, fallback?: string) => string;
  dict: Translations;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'svportal_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('th');

  // Load language preference from localStorage or cookie on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved === 'th' || saved === 'en') {
        setLanguageState(saved);
        document.documentElement.lang = saved;
        return;
      }
      // Check cookies
      const match = document.cookie.match(new RegExp('(^| )' + STORAGE_KEY + '=([^;]+)'));
      if (match && (match[2] === 'th' || match[2] === 'en')) {
        setLanguageState(match[2] as Language);
        document.documentElement.lang = match[2];
      }
    } catch {
      // Fallback gracefully in restricted environments
    }
  }, []);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.cookie = `${STORAGE_KEY}=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLang;
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'th' ? 'en' : 'th');
  }, [language, setLanguage]);

  const dict = useMemo(() => translations[language], [language]);

  const t = useCallback((path: string, fallback?: string): string => {
    const parts = path.split('.');
    let current: any = translations[language];
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return fallback !== undefined ? fallback : path;
      }
    }
    return typeof current === 'string' ? current : (fallback !== undefined ? fallback : path);
  }, [language]);

  const formatDate = useCallback((date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
    try {
      const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      const locale = language === 'th' ? 'th-TH' : 'en-US';
      const defaultOptions: Intl.DateTimeFormatOptions = options || {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };
      return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
    } catch {
      return String(date);
    }
  }, [language]);

  const formatCurrency = useCallback((amount: number): string => {
    try {
      const locale = language === 'th' ? 'th-TH' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount || 0);
    } catch {
      return `฿${(amount || 0).toFixed(2)}`;
    }
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    toggleLanguage,
    isThai: language === 'th',
    isEnglish: language === 'en',
    t,
    dict,
    formatDate,
    formatCurrency,
  }), [language, setLanguage, toggleLanguage, t, dict, formatDate, formatCurrency]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
