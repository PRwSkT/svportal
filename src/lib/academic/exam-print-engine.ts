import QRCode from 'qrcode';
import katex from 'katex';
import { AcademicExamQuestion } from '@/types/academic';
import { parseImageUrlMeta, isImageChoice, parseChoiceContent } from '@/lib/academic/exam-image-utils';

/**
 * Safely converts LaTeX expressions ($...$ and $$...$$) into KaTeX HTML for sharp vector printing
 */
export function renderMathInHtml(text: string): string {
  if (!text) return '';
  try {
    if (text.includes('$')) {
      // Replace display equations $$...$$
      let res = text.replace(/\$\$([^$]+)\$\$/g, (_, eq) => {
        try {
          return katex.renderToString(eq, { displayMode: true, throwOnError: false, strict: 'ignore' });
        } catch {
          return eq;
        }
      });
      // Replace inline equations $...$
      res = res.replace(/\$([^$]+)\$/g, (_, eq) => {
        try {
          return katex.renderToString(eq, { displayMode: false, throwOnError: false, strict: 'ignore' });
        } catch {
          return eq;
        }
      });
      return res;
    }

    // Fallback: if text has raw LaTeX commands without $ delimiters
    if (/\\(frac|sqrt|times|div|pm|cdot|le|ge|neq|approx|pi|theta|alpha|beta|Delta|Omega|sum|int|infty)/.test(text)) {
      return katex.renderToString(text, { displayMode: false, throwOnError: false, strict: 'ignore' });
    }

    return text;
  } catch {
    return text;
  }
}

export interface ExamPaperMeta {
  id: string;
  title: string;
  total_questions: number;
  duration_minutes: number;
  max_score: number;
  course?: {
    course_code?: string;
    name_th?: string;
    grade_level?: string;
    department?: string;
  };
  gradebook?: {
    class?: {
      name?: string;
      grade_level?: string;
    };
  };
}

export interface ExamPaperOptions {
  schoolName?: string;
  academicYear?: string;
  term?: string;
  setName?: string;
  variantSet?: {
    set_name: string;
    question_order_mapping?: any;
    choice_map?: any;
    answer_key?: Record<string, string>;
    [key: string]: any;
  };
}

export interface StudentRosterItem {
  id: string;
  name: string;
  grade: string;
  roll_number?: number;
  citizen_id?: string;
  student_id?: string;
  assignedSet?: 'A' | 'B' | 'C' | 'D';
}

export interface BatchAnswerSheetsOptions {
  exam: ExamPaperMeta;
  students: StudentRosterItem[];
  setDistribution?: 'alternate_abc' | 'alternate_ab' | 'all_a' | 'all_b' | 'all_c' | 'by_set_3' | 'by_set';
  spareSheetsCount?: number;
  schoolName?: string;
  academicYear?: string;
  term?: string;
  hasSubjective?: boolean;
}

/**
 * Common Print Stylesheet embedded in all exam and answer sheet HTML
 */
export const EXAM_PRINT_BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&display=swap');

@font-face {
  font-family: 'TH Sarabun New';
  src: local('TH Sarabun New'), local('THSarabunNew'), local('Sarabun');
}

* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

html, body {
  margin: 0 !important;
  padding: 0 !important;
  background-color: #ffffff !important;
  color: #0f172a !important;
  font-family: 'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}

@page {
  size: A4 portrait;
  margin: 12mm 14mm 12mm 14mm;
}

.page-break-after {
  page-break-after: always !important;
  break-after: page !important;
}

.page-break-before {
  page-break-before: always !important;
  break-before: page !important;
}

.avoid-break {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

@media screen {
  body {
    background: #e2e8f0 !important;
    padding: 24px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
  .screen-page-sheet {
    background: #ffffff;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
  }
}

.question-image-box {
  margin: 8px 0 10px 24px;
}
.question-image-box.image-align-center {
  text-align: center;
}
.question-image-box.image-align-left {
  text-align: left;
}
.question-image-box.image-align-right {
  text-align: right;
}
.question-image-box img {
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  object-fit: contain;
}
.question-image-box.image-size-sm img {
  max-width: 32%;
  max-height: 130px;
}
.question-image-box.image-size-md img {
  max-width: 58%;
  max-height: 200px;
}
.question-image-box.image-size-lg img {
  max-width: 82%;
  max-height: 300px;
}
.question-image-box.image-size-full img {
  max-width: 98%;
  max-height: 450px;
}
.image-caption {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
  margin-top: 4px;
}

.question-diagram-box {
  margin: 8px 0;
  text-align: center;
  max-width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.question-diagram-box svg {
  max-width: 100% !important;
  max-height: 240px !important;
  height: auto !important;
  margin: 0 auto;
  display: block;
}

.choices-image-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 18px;
  margin-top: 6px;
}
.choice-image-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 8px;
  background-color: #fafbfc;
  break-inside: avoid;
}
.choice-image-card .choice-bullet {
  font-weight: 700;
  font-size: 13px;
  color: #0f172a;
  min-width: 18px;
}
.choice-image-card .choice-image-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.choice-thumbnail-img {
  max-width: 100%;
  max-height: 115px;
  border-radius: 4px;
  object-fit: contain;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
}
.choice-image-label {
  font-size: 11.5px;
  color: #334155;
  margin-top: 4px;
  text-align: center;
}
.choice-text-fallback {
  font-size: 13px;
  color: #334155;
}
`;

/**
 * 1. Generate Exam Paper HTML (A4 Portrait, Multi-page, 1-Column Sequential Layout)
 * จัดหน้าแบบ 1 คอลัมน์เรียงลงมาทีละข้อตามลำดับ เพื่อป้องกันไม่ให้นักเรียนทำข้อสอบสลับข้อ
 */
export function generateExamPaperHtml(
  exam: ExamPaperMeta,
  questions: AcademicExamQuestion[],
  options: ExamPaperOptions = {}
): string {
  const schoolName = options.schoolName || 'โรงเรียนสมคิดวิทยา';
  const academicYear = options.academicYear || '2568';
  const term = options.term || '1';
  const setName = options.setName || options.variantSet?.set_name || 'A';
  const courseCode = exam.course?.course_code || 'ว13101';
  const courseName = exam.course?.name_th || 'วิทยาศาสตร์และเทคโนโลยี';
  const gradeLevel = exam.course?.grade_level || exam.gradebook?.class?.name || 'ประถมศึกษาปีที่ 3';

  // Apply question order and choice shuffling if variantSet is provided
  const variantSet = options.variantSet;

  interface MappedQuestionItem {
    question: AcademicExamQuestion;
    choiceMap: Record<string, string>;
  }

  let mappedQuestions: MappedQuestionItem[] = [];

  if (variantSet?.question_order_mapping && Array.isArray(variantSet.question_order_mapping) && variantSet.question_order_mapping.length > 0) {
    const mapping = variantSet.question_order_mapping;

    // Check Format 1: Array of objects { original_question_number, new_question_number, choice_map }
    if (typeof mapping[0] === 'object' && mapping[0] !== null && 'original_question_number' in mapping[0]) {
      mappedQuestions = mapping.map((m: any) => {
        const found = questions.find(q => q.question_number === m.original_question_number)
          || questions[(m.original_question_number || 1) - 1];
        return {
          question: found,
          choiceMap: m.choice_map || { A: 'A', B: 'B', C: 'C', D: 'D' }
        };
      }).filter(item => Boolean(item.question));
    } else if (typeof mapping[0] === 'number') {
      // Check Format 2: Array of numbers (original 0-based indices)
      mappedQuestions = mapping.map((origIdx: number) => {
        const q = questions[origIdx];
        const choiceMap = variantSet?.choice_map?.[origIdx] || { A: 'A', B: 'B', C: 'C', D: 'D' };
        return { question: q, choiceMap };
      }).filter(item => Boolean(item.question));
    }
  }

  // Fallback to original questions list if no variant mapping was found or empty
  if (mappedQuestions.length === 0) {
    mappedQuestions = questions.map((q, idx) => ({
      question: q,
      choiceMap: variantSet?.choice_map?.[idx] || { A: 'A', B: 'B', C: 'C', D: 'D' }
    }));
  }

  const hasSubjective = mappedQuestions.some(item => (item.question as any).question_type === 'subjective');
  const hasMcq = mappedQuestions.some(item => (item.question as any).question_type !== 'subjective');

  const renderedQuestionsHtml = mappedQuestions.map((item, idx) => {
    const q = item.question;
    const qNum = idx + 1;
    const choiceMap = item.choiceMap;

    const getChoiceText = (letter: string) => {
      const origKey = (choiceMap && choiceMap[letter]) ? choiceMap[letter] : letter;
      const mappedLetter = origKey.toLowerCase();
      return (q as any)[`choice_${mappedLetter}`] || (q as any)[`choice_${letter.toLowerCase()}`] || '';
    };

    const choiceA = getChoiceText('A') || 'ตัวเลือก ก';
    const choiceB = getChoiceText('B') || 'ตัวเลือก ข';
    const choiceC = getChoiceText('C') || 'ตัวเลือก ค';
    const choiceD = getChoiceText('D') || 'ตัวเลือก ง';
    const choiceE = getChoiceText('E');

    // Check if choices are short (fits in 2 columns) or long (1 column)
    const isLongChoice = [choiceA, choiceB, choiceC, choiceD, choiceE].filter(Boolean).some(c => c.length > 35);

    const isMatching = (q as any).question_type === 'matching';
    const isSubjective = (q as any).question_type === 'subjective';

    const isFirstSubjective = isSubjective && (idx === 0 || (mappedQuestions[idx - 1]?.question as any).question_type !== 'subjective');
    const isFirstQuestion = idx === 0;

    const renderSubjectiveAnswerSpace = () => {
      const spaceFormat = (q as any).choice_b || 'lines_5';
      const points = q.points || 5;

      let lineCount = 5;
      if (spaceFormat === 'lines_3') lineCount = 3;
      else if (spaceFormat === 'lines_8') lineCount = 8;
      else if (spaceFormat === 'lines_10') lineCount = 10;

      const isBox = spaceFormat === 'blank_box' || spaceFormat === 'grid_box';

      return `
        <div class="subjective-response-container" style="margin-top: 10px; margin-bottom: 6px;">
          ${isBox ? `
            <div class="subjective-workings-box subjective-box ${spaceFormat === 'grid_box' ? 'grid-box' : 'blank-box'}" style="height: ${spaceFormat === 'grid_box' ? '160px' : '130px'}; border: 1.5px dashed #94a3b8; border-radius: 6px; padding: 10px; background-color: ${spaceFormat === 'grid_box' ? '#f8fafc' : '#ffffff'}; position: relative; overflow: hidden;">
              ${spaceFormat === 'grid_box' ? `
                <svg width="100%" height="100%" style="position: absolute; inset: 0; pointer-events: none;" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="print-grid-${qNum}" width="18" height="18" patternUnits="userSpaceOnUse">
                      <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#cbd5e1" stroke-width="0.7" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#print-grid-${qNum})" />
                </svg>
              ` : ''}
              <span style="position: relative; z-index: 1; font-size: 11px; color: #64748b; font-weight: 600; background: rgba(255,255,255,0.85); padding: 1px 4px; border-radius: 3px;">พื้นที่สำหรับแสดงวิธีทำ / เขียนคำตอบ / วาดภาพ:</span>
            </div>
          ` : `
            <div class="subjective-dotted-lines" style="display: flex; flex-direction: column; gap: 10px; padding: 4px 0;">
              ${Array.from({ length: lineCount }).map((_, lineIdx) => `
                <div class="subjective-line" style="border-bottom: 1px dashed #94a3b8; height: 28px; display: flex; align-items: flex-end;">
                  ${lineIdx === 0 ? '<span style="font-size: 12px; color: #475569; font-weight: 700; padding-right: 8px; padding-bottom: 2px;">ตอบ:</span>' : ''}
                </div>
              `).join('')}
            </div>
          `}

          <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
            <div style="display: inline-flex; align-items: center; gap: 8px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 10px; font-size: 10px; color: #475569; background: #f8fafc;">
              <span>คะแนนเต็ม: <strong>${points} คะแนน</strong></span>
              <span>|</span>
              <span>คะแนนที่ได้: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</span>
              <span>|</span>
              <span>ผู้ตรวจ: ....................</span>
            </div>
          </div>
        </div>
      `;
    };

    const sectionHeader = isFirstQuestion && hasSubjective && hasMcq ? `
      <div class="exam-section-divider avoid-break" style="margin-bottom: 12px; padding: 6px 10px; background: #f8fafc; border-left: 4px solid #1e293b; border-radius: 4px; border: 1px solid #e2e8f0;">
        <strong style="color: #0f172a; font-size: 13px;">ตอนที่ 1: ข้อสอบปรนัย</strong>
        <span style="font-size: 11.5px; color: #64748b; margin-left: 8px;">ให้นักเรียนเลือกคำตอบที่ถูกต้องที่สุดแล้วระบายลงในกระดาษคำตอบ OMR</span>
      </div>
    ` : isFirstSubjective ? `
      <div class="exam-section-divider avoid-break" style="margin: 22px 0 12px 0; padding: 8px 12px; background: #fdf2f4; border-left: 4px solid #7B1C3E; border-radius: 4px; border: 1px solid #fecdd3;">
        <strong style="color: #7B1C3E; font-size: 13.5px;">ตอนที่ 2 ข้อสอบอัตนัย (เขียนตอบ / แสดงวิธีทำ)</strong>
        <span style="font-size: 12px; color: #475569; margin-left: 8px;">ให้นักเรียนเขียนแสดงวิธีทำหรือตอบคำถามลงในกระดาษข้อสอบนี้</span>
      </div>
    ` : '';

    const passageBox = (q as any).passage_text ? `
      <div class="exam-passage-box avoid-break" style="margin-bottom: 10px; padding: 8px 12px; background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 6px; font-size: 12.5px; color: #1e293b; line-height: 1.55;">
        ${(q as any).passage_title ? `<strong style="display: block; color: #92400e; margin-bottom: 3px;">${renderMathInHtml((q as any).passage_title)}</strong>` : ''}
        <div style="white-space: pre-line;">${renderMathInHtml((q as any).passage_text)}</div>
      </div>
    ` : '';

    const formatMatchingItem = (text: string, prefix: string) => {
      const trimmed = (text || '').trim();
      if (!trimmed) return '';
      if (/^(\d+\.|[ก-ฮ]\.|[A-Za-z]\.)/.test(trimmed)) return renderMathInHtml(trimmed);
      return `${prefix} ${renderMathInHtml(trimmed)}`;
    };

    return `
      <tr class="question-table-row avoid-break">
        <td>
          ${sectionHeader}
          ${passageBox}
          <div class="exam-question-item avoid-break ${isSubjective ? 'subjective-question-card' : ''}">
            <div class="question-header">
              <span class="question-num">ข้อที่ ${qNum}.</span>
              ${isSubjective ? `<span class="subjective-pill" style="margin-left: 6px; font-size: 10.5px; font-weight: 700; color: #7B1C3E; background: #fdf2f4; border: 1px solid #fecdd3; border-radius: 4px; padding: 1px 6px;">[ อัตนัย - ${q.points || 5} คะแนน ]</span>` : ''}
              <div class="question-text">${renderMathInHtml(q.question_text || `คำถามข้อที่ ${qNum}`)}</div>
            </div>

            ${(() => {
              if (q.diagram_svg) {
                return `
                  <div class="question-diagram-box" style="margin: 8px 0; text-align: center; max-width: 100%;">
                    ${q.diagram_svg}
                  </div>
                `;
              }
              const rawImgUrl = q.question_image_url || (q as any).image_url;
              if (rawImgUrl) {
                const imgMeta = parseImageUrlMeta(rawImgUrl);
                const alignClass = imgMeta.align === 'left' ? 'image-align-left' : imgMeta.align === 'right' ? 'image-align-right' : 'image-align-center';
                const sizeClass = `image-size-${imgMeta.size}`;
                return `
                  <div class="question-image-box ${alignClass} ${sizeClass}">
                    <img src="${imgMeta.url}" alt="รูปประกอบข้อ ${qNum}" />
                    ${imgMeta.caption ? `<div class="image-caption">${imgMeta.caption}</div>` : ''}
                  </div>
                `;
              }
              return '';
            })()}

            ${isSubjective ? renderSubjectiveAnswerSpace() : isMatching ? `
              <div class="matching-container" style="margin: 8px 0; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 6px; background-color: #f8fafc;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px;">
                  <div>
                    <strong style="display: block; margin-bottom: 4px; color: #1e293b;">คอลัมน์ A (โจทย์)</strong>
                    <div style="margin-bottom: 4px;">${formatMatchingItem(choiceA, '1.')}</div>
                    <div>${formatMatchingItem(choiceB, '2.')}</div>
                  </div>
                  <div>
                    <strong style="display: block; margin-bottom: 4px; color: #1e293b;">คอลัมน์ B (ตัวเลือกจับคู่)</strong>
                    <div style="margin-bottom: 4px;">${formatMatchingItem(choiceC, 'ก.')}</div>
                    <div>${formatMatchingItem(choiceD, 'ข.')}</div>
                  </div>
                </div>
              </div>
            ` : (() => {
              const hasImageChoices = [choiceA, choiceB, choiceC, choiceD, choiceE].some(c => isImageChoice(c));
              if (hasImageChoices) {
                const choiceList = [
                  { bullet: 'ก.', text: choiceA },
                  { bullet: 'ข.', text: choiceB },
                  { bullet: 'ค.', text: choiceC },
                  { bullet: 'ง.', text: choiceD },
                  ...(choiceE ? [{ bullet: 'จ.', text: choiceE }] : [])
                ];
                return `
                  <div class="choices-container choices-image-grid">
                    ${choiceList.map(item => {
                      const parsed = parseChoiceContent(item.text);
                      return `
                        <div class="choice-image-card">
                          <span class="choice-bullet">${item.bullet}</span>
                          <div class="choice-image-content">
                            ${parsed.isImage ? `
                              <img src="${parsed.imageUrl}" alt="${item.bullet}" class="choice-thumbnail-img" />
                              ${parsed.label ? `<div class="choice-image-label">${renderMathInHtml(parsed.label)}</div>` : ''}
                            ` : `
                              <div class="choice-text-fallback">${renderMathInHtml(item.text)}</div>
                            `}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `;
              }
              return `
                <div class="choices-container ${isLongChoice ? 'choices-stacked' : 'choices-grid'}">
                  <div class="choice-row">
                    <span class="choice-bullet">ก.</span>
                    <span class="choice-content">${renderMathInHtml(choiceA)}</span>
                  </div>
                  <div class="choice-row">
                    <span class="choice-bullet">ข.</span>
                    <span class="choice-content">${renderMathInHtml(choiceB)}</span>
                  </div>
                  <div class="choice-row">
                    <span class="choice-bullet">ค.</span>
                    <span class="choice-content">${renderMathInHtml(choiceC)}</span>
                  </div>
                  <div class="choice-row">
                    <span class="choice-bullet">ง.</span>
                    <span class="choice-content">${renderMathInHtml(choiceD)}</span>
                  </div>
                  ${choiceE ? `
                    <div class="choice-row">
                      <span class="choice-bullet">จ.</span>
                      <span class="choice-content">${renderMathInHtml(choiceE)}</span>
                    </div>
                  ` : ''}
                </div>
              `;
            })()}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ข้อสอบ_${exam.title}_ชุด_${setName}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
        <style>
          ${EXAM_PRINT_BASE_CSS}

          .exam-paper-container {
            width: 100%;
            max-width: 180mm;
            margin: 0 auto;
            color: #0f172a;
          }

          @media screen {
            .exam-paper-container {
              width: 210mm;
              max-width: 210mm;
              min-height: 297mm;
              padding: 14mm 16mm;
              background: #ffffff;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
              border-radius: 4px;
              margin: 0 auto 24px auto;
            }
          }

          /* Running Header Table Wrapper for Repeat on Each Page */
          table.exam-layout-table {
            width: 100%;
            border-collapse: collapse;
            border: none;
          }
          table.exam-layout-table tr.question-table-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          table.exam-layout-table thead {
            display: table-header-group;
          }

          table.exam-layout-table tfoot {
            display: table-footer-group;
          }

          table.exam-layout-table tbody tr td {
            padding: 0;
            border: none;
          }

          .running-header {
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 6px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 11px;
            color: #475569;
          }

          .running-header .left-meta {
            font-weight: 600;
            color: #0f172a;
          }

          .running-header .right-badge {
            font-weight: 700;
            color: #7B1C3E;
            background: #fdf2f4;
            border: 1px solid #7B1C3E;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
          }

          /* Main Title Box on First Page */
          .exam-cover-header {
            border: 2px solid #0f172a;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 18px;
            background: #ffffff;
          }

          .exam-cover-header .top-title {
            text-align: center;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
          }

          .exam-cover-header .sub-title {
            text-align: center;
            font-size: 14px;
            font-weight: 700;
            color: #7B1C3E;
            margin-top: 2px;
          }

          .exam-info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px 12px;
            font-size: 12px;
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #cbd5e1;
          }

          .exam-info-item {
            color: #334155;
          }

          .exam-info-item strong {
            color: #0f172a;
          }

          .student-fill-box {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr;
            gap: 12px;
            font-size: 12px;
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid #0f172a;
          }

          .dotted-line-field {
            border-bottom: 1px dotted #64748b;
            padding-bottom: 2px;
          }

          .instructions-box {
            margin-top: 10px;
            padding: 8px 12px;
            background: #f8fafc;
            border-left: 4px solid #7B1C3E;
            font-size: 11px;
            color: #334155;
            line-height: 1.4;
          }

          .instructions-box strong {
            color: #7B1C3E;
          }

          /* 1-Column Sequential Question Styling */
          .questions-stream {
            width: 100%;
          }

          .exam-question-item {
            margin-bottom: 14px;
            padding-bottom: 12px;
            border-bottom: 1px dashed #e2e8f0;
          }

          .exam-question-item:last-child {
            border-bottom: none;
          }

          .question-header {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            font-size: 13.5px;
            line-height: 1.5;
            margin-bottom: 8px;
          }

          .question-num {
            font-weight: 800;
            color: #0f172a;
            white-space: nowrap;
          }

          .question-text {
            font-weight: 600;
            color: #1e293b;
            flex: 1;
          }

          .question-image-box {
            margin: 8px 0 10px 24px;
          }

          .question-image-box.image-align-center {
            text-align: center;
          }

          .question-image-box.image-align-left {
            text-align: left;
          }

          .question-image-box.image-align-right {
            text-align: right;
          }

          .question-image-box img {
            border-radius: 4px;
            border: 1px solid #cbd5e1;
            object-fit: contain;
          }

          .question-image-box.image-size-sm img {
            max-width: 32%;
            max-height: 130px;
          }

          .question-image-box.image-size-md img {
            max-width: 58%;
            max-height: 200px;
          }

          .question-image-box.image-size-lg img {
            max-width: 82%;
            max-height: 300px;
          }

          .question-image-box.image-size-full img {
            max-width: 98%;
            max-height: 450px;
          }

          .image-caption {
            font-size: 11px;
            color: #64748b;
            font-style: italic;
            margin-top: 4px;
          }

          .choices-container {
            margin-left: 24px;
            font-size: 13px;
          }

          .choices-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 16px;
          }

          .choices-stacked {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .choices-image-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 18px;
            margin-top: 6px;
          }

          .choice-image-card {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 8px;
            background-color: #fafbfc;
            break-inside: avoid;
          }

          .choice-image-card .choice-bullet {
            font-weight: 700;
            font-size: 13px;
            color: #0f172a;
            min-width: 18px;
          }

          .choice-image-card .choice-image-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .choice-thumbnail-img {
            height: 95px;
            width: 100%;
            max-width: 100%;
            max-height: 115px;
            border-radius: 4px;
            object-fit: contain;
            background-color: #ffffff;
            border: 1px solid #cbd5e1;
          }

          .choice-image-label {
            font-size: 11.5px;
            color: #334155;
            margin-top: 4px;
            text-align: center;
          }

          .choice-text-fallback {
            font-size: 13px;
            color: #334155;
          }

          .choice-row {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            line-height: 1.4;
          }

          .choice-bullet {
            font-weight: 700;
            color: #0f172a;
            min-width: 18px;
          }

          .choice-content {
            color: #334155;
            flex: 1;
          }

          /* Footer */
          .running-footer {
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
            margin-top: 16px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="exam-paper-container">
          <table class="exam-layout-table">
            <thead>
              <tr>
                <td>
                  <div class="running-header">
                    <span class="left-meta">${schoolName} | ${courseName} (${courseCode}) - ภาคเรียนที่ ${term}/${academicYear}</span>
                    <span class="right-badge">ข้อสอบชุด ${setName}</span>
                  </div>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <!-- Cover & Instructions Header -->
                  <div class="exam-cover-header">
                    <div class="top-title">${schoolName}</div>
                    <div class="sub-title">${exam.title} (ข้อสอบชุด ${setName})</div>
                    <div class="exam-info-grid">
                      <div class="exam-info-item"><strong>วิชา:</strong> ${courseName} (${courseCode})</div>
                      <div class="exam-info-item"><strong>ระดับชั้น:</strong> ${gradeLevel}</div>
                      <div class="exam-info-item"><strong>ภาคเรียน:</strong> ${term}/${academicYear}</div>
                      <div class="exam-info-item"><strong>เวลาสอบ:</strong> ${exam.duration_minutes} นาที</div>
                      <div class="exam-info-item"><strong>คะแนนเต็ม:</strong> ${exam.max_score} คะแนน</div>
                      <div class="exam-info-item"><strong>จำนวนข้อสอบ:</strong> ${mappedQuestions.length} ข้อ</div>
                    </div>
                    <div class="student-fill-box">
                      <div class="dotted-line-field">ชื่อ-นามสกุล: ................................................................</div>
                      <div class="dotted-line-field">เลขที่: ....................</div>
                      <div class="dotted-line-field">ห้อง: ....................</div>
                    </div>
                    <div class="instructions-box">
                      <strong>คำชี้แจง:</strong> ให้นักเรียนอ่านโจทย์และตัวเลือกให้รอบคอบ เลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว แล้วใช้ดินสอ 2B ฝนลงในกระดาษคำตอบ OMR ให้เต็มวงกลม (ห้ามขีดเขียนลงในกระดาษคำตอบนอกเหนือจากที่กำหนด)
                    </div>
                  </div>
                </td>
              </tr>
              <!-- 1-Column Sequential Question List Rows -->
              ${renderedQuestionsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <div class="running-footer">
                    <span>${schoolName} - แบบวัดผลสัมฤทธิ์ทางการเรียน</span>
                    <span>ข้อสอบชุด ${setName} (จำนวน ${mappedQuestions.length} ข้อ)</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </body>
    </html>
  `;
}

/**
 * 2. Generate Batch OMR Answer Sheets HTML
 * 1 หน้า A4 จุได้ 2 แผ่นคำตอบ (ครึ่ง A4 / A5 แนวนอน) พอดี
 * มีเส้นประกรรไกรตรงกลางสำหรับตัดแบ่งให้นักเรียน 2 คน
 * ฝัง QR Code รายบุคคล, มาร์กเกอร์สี่มุม OMR, รายละเอียดนักเรียนจริง และสลับชุด A/B อัตโนมัติ
 */
export async function generateBatchAnswerSheetsHtml(
  options: BatchAnswerSheetsOptions
): Promise<string> {
  const {
    exam,
    students,
    setDistribution = 'alternate_abc',
    spareSheetsCount = 2,
    schoolName = 'โรงเรียนสมคิดวิทยา',
    academicYear = '2568',
    term = '1',
    hasSubjective: hasSubjectiveOpt
  } = options;

  const hasSubjective = Boolean(
    hasSubjectiveOpt || 
    (exam as any).has_subjective || 
    (exam as any).hasSubjective || 
    (exam.title && exam.title.includes('อัตนัย'))
  );

  const totalQuestions = Math.min(Math.max(exam.total_questions || 20, 10), 60);

  // Assign Sets to Students (Supports 3-set A/B/C rotation, 2-set A/B rotation, and block partitioning)
  const assignedList: Array<{
    student: StudentRosterItem | null;
    setName: 'A' | 'B' | 'C' | 'D';
    isSpare?: boolean;
    indexNumber: number;
  }> = [];

  students.forEach((student, idx) => {
    let assignedSet: 'A' | 'B' | 'C' = 'A';
    if (setDistribution === 'alternate_abc') {
      const mod = idx % 3;
      assignedSet = mod === 0 ? 'A' : mod === 1 ? 'B' : 'C';
    } else if (setDistribution === 'alternate_ab') {
      assignedSet = idx % 2 === 0 ? 'A' : 'B';
    } else if (setDistribution === 'all_b') {
      assignedSet = 'B';
    } else if (setDistribution === 'all_c') {
      assignedSet = 'C';
    } else if (setDistribution === 'by_set_3') {
      const oneThird = Math.ceil(students.length / 3);
      if (idx < oneThird) {
        assignedSet = 'A';
      } else if (idx < oneThird * 2) {
        assignedSet = 'B';
      } else {
        assignedSet = 'C';
      }
    } else if (setDistribution === 'by_set') {
      const half = Math.ceil(students.length / 2);
      assignedSet = idx < half ? 'A' : 'B';
    } else {
      assignedSet = 'A';
    }

    assignedList.push({
      student,
      setName: assignedSet,
      isSpare: false,
      indexNumber: idx + 1
    });
  });

  // Add Spare Sheets (if requested)
  for (let i = 0; i < spareSheetsCount; i++) {
    let spareSet: 'A' | 'B' | 'C' = 'A';
    if (setDistribution === 'alternate_abc' || setDistribution === 'by_set_3') {
      const mod = i % 3;
      spareSet = mod === 0 ? 'A' : mod === 1 ? 'B' : 'C';
    } else if (setDistribution === 'all_b') {
      spareSet = 'B';
    } else if (setDistribution === 'all_c') {
      spareSet = 'C';
    } else {
      spareSet = i % 2 === 0 ? 'A' : 'B';
    }

    assignedList.push({
      student: null,
      setName: spareSet,
      isSpare: true,
      indexNumber: assignedList.length + 1
    });
  }

  // Pre-generate QR Codes in SVG for each sheet
  const qrCodes: Record<string, string> = {};
  for (const item of assignedList) {
    const studentId = item.student?.id || item.student?.student_id || `SPARE_${item.indexNumber}`;
    const qrData = `EXAM:${exam.id}:${item.setName}:${studentId}`;
    try {
      const svg = await QRCode.toString(qrData, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      qrCodes[studentId] = svg;
    } catch (e) {
      console.error('Error generating QR code SVG:', e);
      qrCodes[studentId] = `<div style="width:22mm;height:22mm;border:1px dashed #000;display:flex;align-items:center;justify-content:center;font-size:9px;">QR</div>`;
    }
  }

  // Collate into pairs (2 half-A4 sheets per 1 A4 page)
  const pages: Array<[typeof assignedList[0], typeof assignedList[0] | null]> = [];
  for (let i = 0; i < assignedList.length; i += 2) {
    pages.push([assignedList[i], assignedList[i + 1] || null]);
  }

  // Determine Bubble Grid Columns (based on question count)
  let gridColumns = 4;
  let itemsPerCol = 10;
  if (totalQuestions <= 20) {
    gridColumns = 2;
    itemsPerCol = 10;
  } else if (totalQuestions <= 30) {
    gridColumns = 3;
    itemsPerCol = 10;
  } else if (totalQuestions <= 40) {
    gridColumns = 4;
    itemsPerCol = 10;
  } else if (totalQuestions <= 50) {
    gridColumns = 5;
    itemsPerCol = 10;
  } else {
    gridColumns = 5;
    itemsPerCol = 12;
  }

  function renderHalfSheet(
    item: typeof assignedList[0] | null,
    position: 'top' | 'bottom'
  ): string {
    if (!item) {
      // Empty half sheet (blank fallback)
      return `<div class="half-sheet half-${position} empty-half"></div>`;
    }

    const { student, setName, isSpare } = item;
    const studentId = student?.student_id || student?.id || '';
    const studentName = isSpare ? '..........................................................' : (student?.name || 'นักเรียน');
    const studentGrade = student?.grade || exam.course?.grade_level || exam.gradebook?.class?.name || 'ป.3/1';
    const rollNumber = isSpare ? '........' : (student?.roll_number !== undefined ? String(student?.roll_number) : '-');
    const qrSvg = qrCodes[student?.id || studentId] || '';

    // Generate Question Bubble Columns
    const columnsHtml: string[] = [];
    for (let c = 0; c < gridColumns; c++) {
      const startQ = c * itemsPerCol + 1;
      const endQ = Math.min((c + 1) * itemsPerCol, totalQuestions);

      if (startQ > totalQuestions) break;

      let columnRowsHtml = '';
      for (let q = startQ; q <= endQ; q++) {
        columnRowsHtml += `
          <div class="bubble-row">
            <span class="q-label">${q}.</span>
            <div class="bubble-group">
              <span class="bubble-circle"><span class="th-c">ก</span><span class="en-c">A</span></span>
              <span class="bubble-circle"><span class="th-c">ข</span><span class="en-c">B</span></span>
              <span class="bubble-circle"><span class="th-c">ค</span><span class="en-c">C</span></span>
              <span class="bubble-circle"><span class="th-c">ง</span><span class="en-c">D</span></span>
            </div>
          </div>
        `;
      }

      columnsHtml.push(`
        <div class="omr-grid-col">
          ${columnRowsHtml}
        </div>
      `);
    }

    return `
      <div class="half-sheet half-${position}">
        <!-- 4 Corner OMR Alignment Markers (6mm x 6mm Solid Squares) -->
        <div class="omr-corner corner-tl"></div>
        <div class="omr-corner corner-tr"></div>
        <div class="omr-corner corner-bl"></div>
        <div class="omr-corner corner-br"></div>

        <div class="sheet-content">
          <!-- Header Area -->
          <div class="sheet-header">
            <div class="header-titles">
              <div class="school-name">${schoolName}</div>
              <div class="sheet-badge-line">
                <span class="doc-title">กระดาษคำตอบแบบวัดผล (OMR Answer Sheet)</span>
                <span class="exam-title-badge">${exam.course?.name_th || 'วิชาสอบ'} (${exam.course?.course_code || 'รหัส'}) - ${term}/${academicYear}</span>
              </div>
            </div>
            <div class="set-indicator-box">
              <div class="set-badge-tag set-${setName}">ชุด ${setName}</div>
              <div class="exam-id-tag">EXAM:${exam.id.slice(0, 6)}</div>
            </div>
          </div>

          <!-- Student Info and QR Code Bar -->
          <div class="student-meta-strip">
            <div class="student-info-col">
              <div class="info-row">
                <span class="info-label">ชื่อ-สกุล:</span>
                <span class="info-value name-value ${isSpare ? 'spare-line' : ''}">${studentName}</span>
                <span class="info-label ml-2">เลขที่:</span>
                <span class="info-value roll-value">${rollNumber}</span>
              </div>
              <div class="info-row mt-1">
                <span class="info-label">รหัสประจำตัว:</span>
                <span class="info-value id-value">${isSpare ? '....................' : studentId}</span>
                <span class="info-label ml-2">ชั้น:</span>
                <span class="info-value grade-value">${studentGrade}</span>
                ${isSpare ? '<span class="spare-chip">แผ่นสำรอง</span>' : ''}
              </div>
              <div class="instructions-strip">
                <span class="inst-icon">[คำชี้แจง]</span>
                <span class="inst-text"><strong>วิธีฝน:</strong> ใช้ดินสอ 2B ฝนให้ดำเข้มเต็มวงกลม ห้ามพับหรือทำให้กระดาษยับ</span>
                <div class="sample-bubbles">
                  <span class="sample-circle sample-ok">● ถูก</span>
                  <span class="sample-circle sample-bad">X ผิด</span>
                </div>
              </div>
            </div>

            <!-- Personalized SVG QR Code for Scanner Lookup -->
            <div class="qr-col">
              <div class="qr-svg-wrapper">
                ${qrSvg}
              </div>
              <div class="qr-label">${isSpare ? 'SPARE SHEET' : studentId}</div>
            </div>
          </div>

          <!-- OMR Answer Bubble Grid -->
          <div class="omr-grid-container grid-cols-${gridColumns}">
            ${columnsHtml.join('')}
          </div>

          ${hasSubjective ? `
            <!-- Notice: Exam includes Subjective Questions answered on exam paper -->
            <div class="subjective-notice-strip" style="margin-top: 5px; margin-bottom: 3px; padding: 3px 8px; background: #fffbeb; border: 1px dashed #d97706; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-size: 9.5px; color: #92400e;">
              <span>[ข้อควรทราบ] การสอบนี้ <strong>มีข้อสอบอัตนัย (เขียนตอบ/แสดงวิธีทำ)</strong></span>
              <span style="font-weight: 600;">ให้นักเรียนเขียนตอบลงในกระดาษข้อสอบโดยตรง</span>
            </div>
          ` : ''}

          <!-- Signatures & Verification Footer -->
          <div class="sheet-footer">
            <div class="signature-line">ลายเซ็นผู้เข้าสอบ: .......................................</div>
            <div class="signature-line">ลายเซ็นกรรมการคุมสอบ: .......................................</div>
            <div class="system-code">SV-OMR-V2 | ID:${exam.id.slice(0, 8)}-${setName}-${studentId || 'SPARE'}</div>
          </div>
        </div>
      </div>
    `;
  }

  const pagesHtml = pages.map((pair, pIdx) => {
    const isLastPage = pIdx === pages.length - 1;
    return `
      <div class="a4-print-page ${!isLastPage ? 'page-break-after' : ''} screen-page-sheet">
        ${renderHalfSheet(pair[0], 'top')}
        
        <!-- Scissor Cut Guideline (Exact Center 148.5mm) -->
        <div class="center-cut-guide">
          <div class="cut-line"></div>
          <div class="cut-badge">
            <span class="cut-scissors">[รอยตัด]</span>
            <span class="cut-label">ตัดตามรอยประ (แบ่งครึ่งกระดาษ A4 สำหรับนักเรียน 2 คน)</span>
          </div>
          <div class="cut-line"></div>
        </div>

        ${renderHalfSheet(pair[1], 'bottom')}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>กระดาษคำตอบ_OMR_${exam.title}_ล็อต_${students.length}คน</title>
        <style>
          ${EXAM_PRINT_BASE_CSS}

          /* Force exact A4 Page Boundary with Zero Margin */
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          .a4-print-page {
            width: 210mm;
            height: 297mm;
            max-height: 297mm;
            position: relative;
            background: #ffffff;
            box-sizing: border-box;
            overflow: hidden;
          }

          /* Half Sheet Dimensions: 210mm wide x 148.5mm high (A5 landscape layout) */
          .half-sheet {
            width: 210mm;
            height: 148.5mm;
            max-height: 148.5mm;
            position: relative;
            box-sizing: border-box;
            padding: 7mm 9mm 6mm 9mm;
            overflow: hidden;
            background: #ffffff;
          }

          /* 4 Corner OMR Fiducial Alignment Markers (6mm x 6mm Solid Black) */
          .omr-corner {
            position: absolute;
            width: 6mm;
            height: 6mm;
            background-color: #000000;
            z-index: 10;
          }

          .corner-tl { top: 6mm; left: 7mm; }
          .corner-tr { top: 6mm; right: 7mm; }
          .corner-bl { bottom: 6mm; left: 7mm; }
          .corner-br { bottom: 6mm; right: 7mm; }

          .sheet-content {
            margin: 0 10mm;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          /* Header Section */
          .sheet-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 4px;
          }

          .header-titles .school-name {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.2;
          }

          .sheet-badge-line {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 2px;
          }

          .doc-title {
            font-size: 11px;
            font-weight: 700;
            color: #1e293b;
          }

          .exam-title-badge {
            font-size: 10px;
            color: #64748b;
            background: #f1f5f9;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
          }

          .set-indicator-box {
            text-align: right;
          }

          .set-badge-tag {
            font-size: 13px;
            font-weight: 800;
            padding: 2px 10px;
            border-radius: 6px;
            letter-spacing: 0.5px;
            display: inline-block;
          }

          .set-A {
            background: #7B1C3E;
            color: #ffffff;
            border: 1.5px solid #7B1C3E;
          }

          .set-B {
            background: #0284c7;
            color: #ffffff;
            border: 1.5px solid #0284c7;
          }

          .set-C {
            background: #059669;
            color: #ffffff;
            border: 1.5px solid #059669;
          }

          .set-D {
            background: #d97706;
            color: #ffffff;
            border: 1.5px solid #d97706;
          }

          .exam-id-tag {
            font-size: 9px;
            color: #64748b;
            font-family: monospace;
            margin-top: 2px;
          }

          /* Student Info & QR Strip */
          .student-meta-strip {
            display: flex;
            justify-content: space-between;
            align-items: stretch;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 4px 8px;
            margin: 4px 0;
            gap: 8px;
          }

          .student-info-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            font-size: 11px;
          }

          .info-row {
            display: flex;
            align-items: center;
            gap: 4px;
            line-height: 1.3;
          }

          .info-label {
            color: #475569;
            font-weight: 600;
          }

          .info-value {
            color: #0f172a;
            font-weight: 700;
          }

          .name-value {
            font-size: 12px;
          }

          .spare-line {
            font-family: monospace;
            color: #94a3b8;
          }

          .spare-chip {
            background: #fef3c7;
            color: #92400e;
            font-size: 9px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #fde68a;
            margin-left: 8px;
          }

          .instructions-strip {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 9.5px;
            color: #475569;
            margin-top: 3px;
            padding-top: 3px;
            border-top: 1px dashed #e2e8f0;
          }

          .sample-bubbles {
            display: flex;
            gap: 6px;
            margin-left: auto;
          }

          .sample-circle {
            font-size: 9px;
            font-weight: 700;
            padding: 0 4px;
            border-radius: 3px;
          }

          .sample-ok {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
          }

          .sample-bad {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
          }

          .qr-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding-left: 6px;
            border-left: 1px dashed #cbd5e1;
          }

          .qr-svg-wrapper {
            width: 22mm;
            height: 22mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .qr-svg-wrapper svg {
            width: 100%;
            height: 100%;
            display: block;
          }

          .qr-label {
            font-size: 8px;
            font-family: monospace;
            font-weight: 700;
            color: #0f172a;
            margin-top: 1px;
          }

          /* OMR Grid Columns */
          .omr-grid-container {
            display: grid;
            gap: 4px 10px;
            flex: 1;
            margin: 2px 0;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 4px 8px;
          }

          .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
          .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
          .grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
          .grid-cols-5 { grid-template-columns: repeat(5, 1fr); }

          .omr-grid-col {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .bubble-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1px 2px;
            border-bottom: 1px dotted #f1f5f9;
          }

          .q-label {
            font-weight: 800;
            font-size: 10.5px;
            color: #0f172a;
            width: 18px;
            text-align: right;
            margin-right: 4px;
          }

          .bubble-group {
            display: flex;
            gap: 4px;
          }

          .bubble-circle {
            width: 17px;
            height: 17px;
            border-radius: 50%;
            border: 1.5px solid #000000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            background: #ffffff;
            line-height: 1;
          }

          .bubble-circle .th-c {
            font-size: 9px;
            color: #000000;
          }

          .bubble-circle .en-c {
            display: none;
          }

          /* Footer Area */
          .sheet-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            color: #475569;
            border-top: 1px solid #0f172a;
            padding-top: 3px;
          }

          .signature-line {
            font-weight: 500;
          }

          .system-code {
            font-family: monospace;
            font-size: 8px;
            color: #64748b;
          }

          /* Scissor Cut Line in the Exact Middle (148.5mm) */
          .center-cut-guide {
            position: absolute;
            top: 148.5mm;
            left: 0;
            right: 0;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            z-index: 20;
          }

          .cut-line {
            flex: 1;
            border-top: 1.5px dashed #94a3b8;
          }

          .cut-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 1px 12px;
            background: #ffffff;
            border: 1px dashed #94a3b8;
            border-radius: 12px;
            font-size: 9px;
            color: #64748b;
            font-weight: 600;
            margin: 0 8px;
          }

          .cut-scissors {
            font-size: 13px;
            color: #7B1C3E;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;
}
