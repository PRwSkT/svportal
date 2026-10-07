/**
 * Unified Gemma Intelligence Client for "น้องฟ้า" (Nong Fah AI Assistant)
 * Somkidvittaya School Forms Platform
 */

import { FormField } from '@/types';
import { SanitizedFormAnalysisPayload } from './pdpa-sanitizer';

const GEMMA_MODELS = [
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

interface GemmaCallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: string;
}

/**
 * Low-level caller to Gemma / Google Generative AI API with fallback hierarchy
 */
export async function callGemma(options: GemmaCallOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('ยังไม่ได้กำหนด GEMINI_API_KEY หรือ GOOGLE_API_KEY ในระบบ');
  }

  const {
    systemPrompt,
    userPrompt,
    temperature = 0.2,
    maxTokens = 2048,
    responseMimeType,
  } = options;

  let lastError: Error | null = null;

  for (const model of GEMMA_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      };

      if (responseMimeType === 'application/json') {
        requestBody.generationConfig.responseMimeType = 'application/json';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Client': 'svportal-forms/1.0',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`Model ${model} returned error ${res.status}:`, errorText.slice(0, 150));
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (rawText) {
        return rawText;
      }
    } catch (err: any) {
      console.warn(`Model ${model} request failed:`, err?.message);
      lastError = err;
    }
  }

  throw new Error(lastError?.message || 'ไม่สามารถติดต่อ AI Engine (Gemma) ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
}

/**
 * Result structure when Nong Fah designs a new form
 */
export interface GeneratedFormDefinition {
  title: { th: string; en: string; zh: string };
  description: { th: string; en: string; zh: string };
  category: string;
  fields: FormField[];
}

/**
 * 1. "น้องฟ้า" ช่วยสร้างแบบฟอร์ม (Prompt-to-Form Generator)
 */
export async function generateFormWithNongFah(userRequirement: string): Promise<GeneratedFormDefinition> {
  const systemPrompt = `You are "น้องฟ้า" (Nong Fah), an intelligent, polite, and expert educational AI Assistant for Somkidvittaya School (โรงเรียนสมคิดวิทยา).
Your task is to design an optimal, professional online form structure based on the user's prompt.
Strict requirements:
1. Output MUST be valid JSON only. Do not wrap in markdown or backticks.
2. In Chinese translations, ALWAYS use "Somkidvittaya学校" for the school name.
3. Every field MUST have valid multi-language support (th, en, zh).
4. Strictly NO EMOJIS anywhere in the output!
5. Field types can be: 'section_header', 'text', 'textarea', 'number', 'radio', 'checkbox', 'select', 'date', 'time', 'file_upload', 'rating'.
6. For choices (radio, checkbox, select), provide clear options with values like 'opt_1', 'opt_2' and localized labels.
7. Remember the school grades are Nursery to Grade 6: อ.1 - ป.6.

JSON Schema to follow:
{
  "title": { "th": "...", "en": "...", "zh": "..." },
  "description": { "th": "...", "en": "...", "zh": "..." },
  "category": "general" | "academic" | "activity" | "finance" | "survey",
  "fields": [
    {
      "field_key": "field_...",
      "field_type": "section_header" | "text" | "radio" | "checkbox" | "select" | "number" | "file_upload" | "date",
      "label": { "th": "...", "en": "...", "zh": "..." },
      "help_text": { "th": "", "en": "", "zh": "" },
      "is_required": boolean,
      "width": "full" | "half",
      "options": [
        { "value": "opt_1", "label": { "th": "...", "en": "...", "zh": "..." } }
      ]
    }
  ]
}`;

  const userPrompt = `User Prompt: "${userRequirement.trim()}"
Design a complete, comprehensive form structure for this requirement. Return strictly JSON.`;

  const rawJson = await callGemma({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 3000,
    responseMimeType: 'application/json',
  });

  try {
    const cleaned = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed as GeneratedFormDefinition;
  } catch (err: any) {
    console.error('Failed to parse Gemma generated form JSON:', rawJson);
    throw new Error('ผลลัพธ์จาก AI ไม่อยู่ในรูปแบบ JSON ที่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * Result structure when Nong Fah summarizes form responses
 */
export interface NongFahAnalyticsSummary {
  executiveSummary: string;
  keyFindings: string[];
  sentimentOverview: {
    positivePercentage: number;
    neutralPercentage: number;
    negativePercentage: number;
    summary: string;
  };
  highlightedQuotes: {
    topic: string;
    quote: string;
  }[];
  actionableRecommendations: string[];
}

/**
 * 2. "น้องฟ้า" ช่วยสรุปผลการตอบแบบฟอร์ม (Zero-PII Analytics Summarizer)
 */
export async function summarizeResponsesWithNongFah(
  payload: SanitizedFormAnalysisPayload
): Promise<NongFahAnalyticsSummary> {
  const systemPrompt = `You are "น้องฟ้า" (Nong Fah), an analytical AI Assistant for Somkidvittaya School administrators and teachers.
You are given aggregated statistical summaries and anonymized text samples from form respondents.
All personal data has been pre-filtered and redacted.
Your goal is to write a high-level Executive Summary and actionable insights for school leadership.
Strict requirements:
1. Output MUST be valid JSON only. Do not wrap in markdown or backticks.
2. In Chinese translations or school references, use "Somkidvittaya" or "โรงเรียนสมคิดวิทยา".
3. Strictly NO EMOJIS anywhere!
4. Tone must be formal, objective, encouraging, and highly professional.

JSON Schema:
{
  "executiveSummary": "สรุปภาพรวมผู้ตอบแบบฟอร์ม ประเด็นหลัก และแนวโน้มสำคัญ...",
  "keyFindings": [
    "ข้อค้นพบสำคัญข้อที่ 1 พร้อมตัวเลขสถิติ",
    "ข้อค้นพบสำคัญข้อที่ 2",
    "ข้อค้นพบสำคัญข้อที่ 3"
  ],
  "sentimentOverview": {
    "positivePercentage": 85,
    "neutralPercentage": 10,
    "negativePercentage": 5,
    "summary": "ความพึงพอใจโดยรวมอยู่ในระดับดีเยี่ยม..."
  },
  "highlightedQuotes": [
    { "topic": "หัวข้อความคิดเห็น", "quote": "ข้อความอ้างอิงจากผู้ตอบที่สลัดชื่อแล้ว" }
  ],
  "actionableRecommendations": [
    "ข้อเสนอแนะเชิงปฏิบัติการสำหรับโรงเรียนเพื่อนำไปปรับปรุง 1",
    "ข้อเสนอแนะ 2"
  ]
}`;

  const userPrompt = `Form Title: ${payload.formTitle}
Total Respondents: ${payload.totalResponses}
Aggregated Field Summaries:
${JSON.stringify(payload.fieldsSummary, null, 2)}

Analyze this data and return the executive report in JSON.`;

  const rawJson = await callGemma({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 2500,
    responseMimeType: 'application/json',
  });

  try {
    const cleaned = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed as NongFahAnalyticsSummary;
  } catch (err: any) {
    console.error('Failed to parse Gemma summary JSON:', rawJson);
    throw new Error('ผลลัพธ์บทวิเคราะห์จาก AI ไม่อยู่ในรูปแบบ JSON ที่ถูกต้อง');
  }
}
