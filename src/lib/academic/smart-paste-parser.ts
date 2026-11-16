/**
 * Smart Paste Parser for SVPortal Exam Studio
 * Parses single or bulk copied questions from Word, Google Docs, PDF, or text files
 * with comprehensive support for Thai and English numbering and choice formats.
 */

import type { ChoiceOption, ExamQuestionType } from '@/types/academic';
import { isPinnedOption } from './exam-engine';

export interface ParsedQuestion {
  question_text: string;
  question_type: ExamQuestionType;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  choice_e?: string;
  correct_choice: ChoiceOption;
  explanation?: string;
  points?: number;
  indicator_code?: string;
  pin_choice_position: boolean;
  question_meta?: Record<string, any>;
}

export interface SmartPasteResult {
  success: boolean;
  questions: ParsedQuestion[];
  rawItemCount: number;
  parseWarnings: string[];
}

/**
 * Normalizes choice letters (ก->A, ข->B, ค->C, ง->D, จ->E, 1->A, 2->B, etc.)
 */
export function normalizeChoiceLetter(raw: string): ChoiceOption {
  const clean = raw.trim().toUpperCase();
  if (['ก', '1', 'A'].includes(clean)) return 'A';
  if (['ข', '2', 'B'].includes(clean)) return 'B';
  if (['ค', '3', 'C'].includes(clean)) return 'C';
  if (['ง', '4', 'D'].includes(clean)) return 'D';
  if (['จ', '5', 'E'].includes(clean)) return 'E';
  return 'A';
}

/**
 * Splits raw pasted text into individual question blocks
 */
function splitQuestionBlocks(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  // Question header patterns:
  // "1.", "ข้อ 1.", "ข้อที่ 1", "1)", "Q1:", "Item 1.", "[1]"
  const questionHeaderRegex = /^\s*(?:ข้อ(?:\s*ที่)?\s*\d+|\d+[\.\)]|Q\s*\d+[\.:]|Item\s*\d+[\.:]|\[\d+\])\s+/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNewQuestion = questionHeaderRegex.test(line);

    if (isNewQuestion && currentBlock.length > 0) {
      // Check if current block has substance
      const blockText = currentBlock.join('\n').trim();
      if (blockText) {
        blocks.push(blockText);
      }
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    const blockText = currentBlock.join('\n').trim();
    if (blockText) {
      blocks.push(blockText);
    }
  }

  // Fallback: If only 1 block resulted, check if double newlines separate questions
  if (blocks.length <= 1) {
    const doubleNewlineBlocks = rawText
      .split(/\n\s*\n/)
      .map(b => b.trim())
      .filter(b => b.length > 0);

    if (doubleNewlineBlocks.length > 1) {
      // If each block has choice patterns, use double newlines
      const hasChoicesInBlocks = doubleNewlineBlocks.filter(b => 
        /(?:[ก-งa-d]\.|\([ก-งa-d]\)|[1-4]\))/i.test(b)
      ).length >= 2;

      if (hasChoicesInBlocks) {
        return doubleNewlineBlocks;
      }
    }
  }

  return blocks.length > 0 ? blocks : [rawText.trim()];
}

/**
 * Parses a single question block
 */
export function parseSingleQuestionBlock(block: string): ParsedQuestion {
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  let questionText = '';
  let choiceA = '';
  let choiceB = '';
  let choiceC = '';
  let choiceD = '';
  let choiceE = '';
  let correctChoice: ChoiceOption = 'A';
  let explanation = '';
  let points: number | undefined;
  let indicatorCode: string | undefined;
  let isSubjective = false;

  // Patterns for choices:
  // ก. / ข. / ค. / ง.
  // 1. / 2. / 3. / 4. (or 1) / 2) / 3) / 4))
  // A. / B. / C. / D. (or (A) / (B) / (C) / (D))
  const choicePatternA = /^(?:[กaA1][\.\)]|\([กaA1]\))\s*(.*)$/;
  const choicePatternB = /^(?:[ขbB2][\.\)]|\([ขbB2]\))\s*(.*)$/;
  const choicePatternC = /^(?:[คcC3][\.\)]|\([คcC3]\))\s*(.*)$/;
  const choicePatternD = /^(?:[งdD4][\.\)]|\([งdD4]\))\s*(.*)$/;
  const choicePatternE = /^(?:[จeE5][\.\)]|\([จeE5]\))\s*(.*)$/;

  // Answer patterns:
  // เฉลย: ก, ตอบ: B, ตอบข้อ 2, Ans: C
  const answerPattern = /^(?:เฉลย|ตอบ(?:\s*ข้อ)?|คำตอบ|ans(?:wer)?|key)\s*[:\-\s]\s*([ก-จa-eA-E1-5])/i;

  // Explanation patterns:
  const explanationPattern = /^(?:คำอธิบาย|วิธีทำ|เหตุผล|explanation|reason)\s*[:\-\s]\s*(.*)$/i;

  // Indicator patterns:
  const indicatorPattern = /(?:ตัวชี้วัด|มาตรฐาน|indicator)\s*[:\-\s]\s*([ก-ฮa-zA-Z0-9\.\/\s]+)/i;

  // Points patterns: (2 คะแนน), [5 points]
  const pointsPattern = /(?:\((\d+(?:\.\d+)?)\s*(?:คะแนน|points?)\)|\[(\d+(?:\.\d+)?)\s*(?:คะแนน|points?)\])/i;

  let currentTarget: 'question' | 'A' | 'B' | 'C' | 'D' | 'E' | 'explanation' = 'question';
  const questionLines: string[] = [];

  for (const line of lines) {
    // Check for indicator
    const indMatch = line.match(indicatorPattern);
    if (indMatch && indMatch[1]) {
      indicatorCode = indMatch[1].trim();
      continue;
    }

    // Check for points
    const ptsMatch = line.match(pointsPattern);
    if (ptsMatch && (ptsMatch[1] || ptsMatch[2])) {
      points = parseFloat(ptsMatch[1] || ptsMatch[2]);
    }

    // Check for answer
    const ansMatch = line.match(answerPattern);
    if (ansMatch && ansMatch[1]) {
      correctChoice = normalizeChoiceLetter(ansMatch[1]);
      continue;
    }

    // Check for explanation
    const expMatch = line.match(explanationPattern);
    if (expMatch) {
      currentTarget = 'explanation';
      explanation = expMatch[1] || '';
      continue;
    }

    // Question header line (e.g. "3. จงอธิบาย...") must be captured as question text, not choice C/3
    const questionHeaderRegex = /^\s*(?:ข้อ(?:\s*ที่)?\s*\d+|\d+[\.\)]|Q\s*\d+[\.:]|Item\s*\d+[\.:]|\[\d+\])\s+/i;
    if (questionLines.length === 0 && questionHeaderRegex.test(line)) {
      currentTarget = 'question';
      questionLines.push(line);
      continue;
    }

    // Check for choices
    const matchA = line.match(choicePatternA);
    if (matchA) {
      currentTarget = 'A';
      choiceA = matchA[1] || '';
      continue;
    }

    const matchB = line.match(choicePatternB);
    if (matchB) {
      currentTarget = 'B';
      choiceB = matchB[1] || '';
      continue;
    }

    const matchC = line.match(choicePatternC);
    if (matchC) {
      currentTarget = 'C';
      choiceC = matchC[1] || '';
      continue;
    }

    const matchD = line.match(choicePatternD);
    if (matchD) {
      currentTarget = 'D';
      choiceD = matchD[1] || '';
      continue;
    }

    const matchE = line.match(choicePatternE);
    if (matchE) {
      currentTarget = 'E';
      choiceE = matchE[1] || '';
      continue;
    }

    // If none of the headers matched, append to current target
    if (currentTarget === 'question') {
      questionLines.push(line);
    } else if (currentTarget === 'A') {
      choiceA = choiceA ? `${choiceA} ${line}` : line;
    } else if (currentTarget === 'B') {
      choiceB = choiceB ? `${choiceB} ${line}` : line;
    } else if (currentTarget === 'C') {
      choiceC = choiceC ? `${choiceC} ${line}` : line;
    } else if (currentTarget === 'D') {
      choiceD = choiceD ? `${choiceD} ${line}` : line;
    } else if (currentTarget === 'E') {
      choiceE = choiceE ? `${choiceE} ${line}` : line;
    } else if (currentTarget === 'explanation') {
      explanation = explanation ? `${explanation}\n${line}` : line;
    }
  }

  // Clean up question text: remove leading "1.", "ข้อ 1." if present
  questionText = questionLines.join('\n').trim();
  questionText = questionText.replace(/^\s*(?:ข้อ(?:\s*ที่)?\s*\d+|\d+[\.\)]|Q\s*\d+[\.:]|Item\s*\d+[\.:]|\[\d+\])\s*/i, '').trim();

  // If no choices were detected at all, classify as subjective
  if (!choiceA && !choiceB && !choiceC && !choiceD) {
    isSubjective = true;
    choiceA = explanation || 'แนวคำตอบที่ถูกต้อง';
    choiceB = 'lines_5';
    choiceC = 'เกณฑ์คะแนน (5 คะแนน): ตอบถูกต้อง ครบถ้วนตามประเด็นสำคัญ';
    choiceD = '-';
  } else {
    // Fill empty choices with fallback if missing
    if (!choiceA) choiceA = 'ตัวเลือก ก';
    if (!choiceB) choiceB = 'ตัวเลือก ข';
    if (!choiceC) choiceC = 'ตัวเลือก ค';
    if (!choiceD) choiceD = 'ตัวเลือก ง';
  }

  // Check pin position (e.g. choice D contains "ถูกทุกข้อ" or "ไม่มีข้อถูก")
  const pinChoice = isPinnedOption(choiceD) || (choiceE ? isPinnedOption(choiceE) : false);

  return {
    question_text: questionText || 'คำถามข้อสอบ',
    question_type: isSubjective ? 'subjective' : 'mcq',
    choice_a: choiceA.trim(),
    choice_b: choiceB.trim(),
    choice_c: choiceC.trim(),
    choice_d: choiceD.trim(),
    choice_e: choiceE ? choiceE.trim() : undefined,
    correct_choice: correctChoice,
    explanation: explanation.trim() || undefined,
    points: points || (isSubjective ? 5 : 1),
    indicator_code: indicatorCode,
    pin_choice_position: pinChoice
  };
}

/**
 * Main Smart Paste function: parses clipboard text into 1 or multiple questions
 */
export function parseSmartPaste(rawText: string): SmartPasteResult {
  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      questions: [],
      rawItemCount: 0,
      parseWarnings: ['ข้อความว่างเปล่า']
    };
  }

  const blocks = splitQuestionBlocks(rawText);
  const questions: ParsedQuestion[] = [];
  const parseWarnings: string[] = [];

  blocks.forEach((block, idx) => {
    try {
      const q = parseSingleQuestionBlock(block);
      questions.push(q);
    } catch (err: any) {
      parseWarnings.push(`ข้อที่ ${idx + 1}: ไม่สามารถแยกวิเคราะห์ได้ (${err.message})`);
    }
  });

  return {
    success: questions.length > 0,
    questions,
    rawItemCount: blocks.length,
    parseWarnings
  };
}
