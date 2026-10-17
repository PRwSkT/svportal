'use client';

import React, { useState, useEffect, useMemo } from 'react';
import katex from 'katex';
import { 
  Calculator, 
  X, 
  Check, 
  HelpCircle, 
  Copy, 
  Sparkles,
  ArrowRight,
  Divide,
  Percent
} from 'lucide-react';

interface MathEquationEditorProps {
  isOpen: boolean;
  initialValue?: string;
  onClose: () => void;
  onInsert: (latex: string) => void;
}

/**
 * Component to safely render text with inline ($...$) or display ($$...$$) math
 */
export function KaTeXInline({ content, className = '' }: { content: string; className?: string }) {
  const rendered = useMemo(() => {
    if (!content) return '';
    try {
      // If content has $ or $$, parse and replace
      if (content.includes('$')) {
        return content.replace(/\$\$([^$]+)\$\$/g, (_, eq) => {
          try {
            return katex.renderToString(eq, { displayMode: true, throwOnError: false });
          } catch {
            return eq;
          }
        }).replace(/\$([^$]+)\$/g, (_, eq) => {
          try {
            return katex.renderToString(eq, { displayMode: false, throwOnError: false });
          } catch {
            return eq;
          }
        });
      }
      // If starts with LaTeX commands like \frac, \sqrt
      if (/^\s*\\(frac|sqrt|times|div|pm|approx|leq|geq|angle|pi|alpha|beta|sum|int)/.test(content)) {
        return katex.renderToString(content, { displayMode: false, throwOnError: false });
      }
      return content;
    } catch (e) {
      return content;
    }
  }, [content]);

  if (!rendered) return null;

  return (
    <span 
      className={`inline-math-container ${className}`} 
      dangerouslySetInnerHTML={{ __html: rendered }} 
    />
  );
}

export function MathEquationEditorModal({
  isOpen,
  initialValue = '',
  onClose,
  onInsert
}: MathEquationEditorProps) {
  const [latexInput, setLatexInput] = useState(initialValue);
  const [activeCategory, setActiveCategory] = useState<'basic' | 'fractions' | 'geometry' | 'science'>('basic');
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLatexInput(initialValue);
    }
  }, [isOpen, initialValue]);

  const previewHtml = useMemo(() => {
    if (!latexInput.trim()) return '';
    try {
      const clean = latexInput.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '');
      const html = katex.renderToString(clean, {
        displayMode: true,
        throwOnError: true
      });
      setPreviewError(null);
      return html;
    } catch (err: any) {
      setPreviewError(err?.message || 'รูปแบบสูตรไม่ถูกต้อง');
      try {
        return katex.renderToString(latexInput, { displayMode: true, throwOnError: false });
      } catch {
        return '';
      }
    }
  }, [latexInput]);

  const insertSnippet = (snippet: string) => {
    setLatexInput(prev => {
      if (!prev) return snippet;
      return prev + ' ' + snippet;
    });
  };

  const handleApply = () => {
    if (!latexInput.trim()) return;
    // Format with $...$ for inline insertion
    const trimmed = latexInput.trim();
    const formatted = trimmed.startsWith('$') ? trimmed : `$${trimmed}$`;
    onInsert(formatted);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">โปรแกรมสร้างสมการคณิตศาสตร์และวิทยาศาสตร์</h3>
              <p className="text-xs text-stone-400">ระบบจำลองสูตรและสมการเวกเตอร์ KaTeX คมชัดระดับ A4</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveCategory('basic')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
              activeCategory === 'basic'
                ? 'bg-white text-stone-900 border-t-2 border-primary shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            ทั่วไปและการคำนวณ
          </button>
          <button
            onClick={() => setActiveCategory('fractions')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
              activeCategory === 'fractions'
                ? 'bg-white text-stone-900 border-t-2 border-primary shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            เศษส่วนและราก
          </button>
          <button
            onClick={() => setActiveCategory('geometry')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
              activeCategory === 'geometry'
                ? 'bg-white text-stone-900 border-t-2 border-primary shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            เรขาคณิตและมุม
          </button>
          <button
            onClick={() => setActiveCategory('science')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
              activeCategory === 'science'
                ? 'bg-white text-stone-900 border-t-2 border-primary shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            วิทยาศาสตร์และเคมี
          </button>
        </div>

        {/* Toolbar Buttons */}
        <div className="p-4 bg-stone-100/70 border-b border-stone-200">
          <div className="flex flex-wrap gap-2">
            {activeCategory === 'basic' && (
              <>
                <button onClick={() => insertSnippet('\\times')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  × คูณ (\times)
                </button>
                <button onClick={() => insertSnippet('\\div')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ÷ หาร (\div)
                </button>
                <button onClick={() => insertSnippet('\\pm')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ± บวก/ลบ (\pm)
                </button>
                <button onClick={() => insertSnippet('x^{2}')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  x² ยกกำลัง
                </button>
                <button onClick={() => insertSnippet('x_{1}')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  x₁ ดัชนีล่าง
                </button>
                <button onClick={() => insertSnippet('\\leq')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ≤ น้อยกว่าเท่ากับ
                </button>
                <button onClick={() => insertSnippet('\\geq')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ≥ มากกว่าเท่ากับ
                </button>
                <button onClick={() => insertSnippet('\\neq')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ≠ ไม่เท่ากับ
                </button>
                <button onClick={() => insertSnippet('\\approx')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ≈ ค่าประมาณ
                </button>
              </>
            )}

            {activeCategory === 'fractions' && (
              <>
                <button onClick={() => insertSnippet('\\frac{a}{b}')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  a/b เศษส่วนแท้
                </button>
                <button onClick={() => insertSnippet('2\\frac{1}{2}')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  2½ จำนวนคละ
                </button>
                <button onClick={() => insertSnippet('\\sqrt{x}')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  √x สแควรูท
                </button>
                <button onClick={() => insertSnippet('\\sqrt[3]{x}')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ∛x รากที่สาม
                </button>
                <button onClick={() => insertSnippet('\\left( \\frac{a}{b} \\right)')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  (a/b) วงเล็บยืดหยุ่น
                </button>
              </>
            )}

            {activeCategory === 'geometry' && (
              <>
                <button onClick={() => insertSnippet('\\angle ABC = 90^\\circ')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ∠ABC = 90° มุม
                </button>
                <button onClick={() => insertSnippet('\\triangle ABC')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  △ABC สามเหลี่ยม
                </button>
                <button onClick={() => insertSnippet('\\pi r^2')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  πr² พื้นที่วงกลม
                </button>
                <button onClick={() => insertSnippet('2\\pi r')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  2πr เส้นรอบวง
                </button>
                <button onClick={() => insertSnippet('a^2 + b^2 = c^2')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  a² + b² = c² พีทาโกรัส
                </button>
                <button onClick={() => insertSnippet('^\\circ')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ° องศา
                </button>
              </>
            )}

            {activeCategory === 'science' && (
              <>
                <button onClick={() => insertSnippet('\\rightarrow')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  → ลูกศรปฏิกิริยา
                </button>
                <button onClick={() => insertSnippet('\\rightleftharpoons')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  ⇌ สมดุลเคมี
                </button>
                <button onClick={() => insertSnippet('\\text{H}_2\\text{O}')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  H₂O น้ำ
                </button>
                <button onClick={() => insertSnippet('\\text{CO}_2')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  CO₂ คาร์บอนไดออกไซด์
                </button>
                <button onClick={() => insertSnippet('\\vec{v}')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  v เวกเตอร์ความเร็ว
                </button>
                <button onClick={() => insertSnippet('V = IR')} className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 shadow-xs">
                  V = IR กฎของโอห์ม
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Input Area */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              โค้ดสมการ (LaTeX Code)
            </label>
            <textarea
              value={latexInput}
              onChange={(e) => setLatexInput(e.target.value)}
              placeholder="ตัวอย่าง: \frac{3}{4} + \frac{1}{2} = x"
              rows={3}
              className="w-full px-3 py-2 text-sm font-mono border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-stone-50"
            />
            {previewError && (
              <p className="text-xs text-rose-600 mt-1">แจ้งเตือน: {previewError}</p>
            )}
          </div>

          {/* Live Preview Area */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              การแสดงผลจริง (Live KaTeX Preview)
            </label>
            <div className="min-h-[90px] p-4 bg-stone-50/80 border border-stone-200 rounded-xl flex items-center justify-center text-center overflow-x-auto">
              {previewHtml ? (
                <div 
                  className="text-stone-900 text-lg"
                  dangerouslySetInnerHTML={{ __html: previewHtml }} 
                />
              ) : (
                <span className="text-stone-400 text-xs italic">
                  พิมพ์สูตรหรือกดปุ่มเครื่องมือด้านบนเพื่อแสดงสมการตัวอย่าง
                </span>
              )}
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div>
            <span className="text-xs font-medium text-stone-500 mb-1.5 block">
              ตัวอย่างโจทย์คณิตศาสตร์ที่พบบ่อย:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'บวกเศษส่วน', code: '\\frac{3}{5} + \\frac{1}{2} = \\frac{11}{10}' },
                { label: 'สมการเชิงเส้น', code: '3x + 12 = 45' },
                { label: 'พื้นที่สี่เหลี่ยม', code: 'A = \\text{กว้าง} \\times \\text{ยาว}' },
                { label: 'ทฤษฎีบทพีทาโกรัส', code: 'c = \\sqrt{a^2 + b^2}' },
                { label: 'สมการการสังเคราะห์แสง', code: '6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\rightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2' }
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setLatexInput(p.code)}
                  className="px-2.5 py-1 text-xs bg-stone-200/70 hover:bg-stone-200 text-stone-700 rounded-md transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <button
            onClick={() => setLatexInput('')}
            className="text-xs text-stone-500 hover:text-stone-800 underline"
          >
            ล้างข้อมูล
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleApply}
              disabled={!latexInput.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              แทรกสมการลงในข้อสอบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
