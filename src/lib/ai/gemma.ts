/**
 * Unified Gemma Intelligence Client for "น้องฟ้า" (Nong Fah AI Assistant)
 * Somkidvittaya School Forms Platform
 */

import { FormField } from '@/types';
import { SanitizedFormAnalysisPayload } from './pdpa-sanitizer';

const GEMMA_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
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
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('ยังไม่ได้กำหนด GEMINI_API_KEY หรือ GOOGLE_API_KEY ในระบบ Netlify Environment Variables');
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
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`Model ${model} returned error ${res.status}:`, errorText.slice(0, 150));
        lastError = new Error(`AI Model (${model}) สถานะ ${res.status}: ${errorText.slice(0, 100)}`);
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

  throw new Error(lastError?.message || 'ไม่สามารถติดต่อระบบน้องฟ้า AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
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
    maxTokens: 1800,
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
 * Individual student insight identified by Nong Fah using pseudonymous student ID
 * Enriched on the school server with real database profile
 */
export interface StudentSpecificInsight {
  student_id: string;
  category: 'urgent_followup' | 'health_allergy' | 'update_record' | 'special_request' | 'general';
  topic: string;
  details: string;
  suggested_action: string;
  student_profile?: {
    id: string;
    name: string;
    grade: string;
    status: string;
    current_height?: number | null;
    current_weight?: number | null;
    current_disability?: string | null;
    parent_phone?: string | null;
  } | null;
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
  studentSpecificInsights?: StudentSpecificInsight[];
}

/**
 * 2. "น้องฟ้า" ช่วยสรุปผลการตอบแบบฟอร์ม (Zero-PII Analytics Summarizer)
 */
export async function summarizeResponsesWithNongFah(
  payload: SanitizedFormAnalysisPayload
): Promise<NongFahAnalyticsSummary> {
  const systemPrompt = `You are "น้องฟ้า" (Nong Fah), an analytical AI Assistant for Somkidvittaya School administrators and teachers.
You are given aggregated statistical summaries, anonymized text samples, and pseudonymous student response cases (identified strictly by student ID).
All personal names, citizen IDs, and phone numbers have been pre-filtered.
Your goal is to write a high-level Executive Summary, actionable insights, and identify any specific student cases that require attention or record updates.
Strict requirements:
1. Output MUST be valid JSON only. Do not wrap in markdown or backticks.
2. In Chinese translations or school references, use "Somkidvittaya" or "โรงเรียนสมคิดวิทยา".
3. Strictly NO EMOJIS anywhere!
4. Tone must be formal, objective, encouraging, and highly professional.
5. In "studentSpecificInsights", if there are student IDs (e.g. "10270") with notable items (allergies, health issues, leaves, record updates, urgent follow-ups), extract them cleanly.

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
  ],
  "studentSpecificInsights": [
    {
      "student_id": "10270",
      "category": "health_allergy",
      "topic": "แจ้งการแพ้อาหารหรือปัญหาสุขภาพ",
      "details": "ผู้ปกครองระบุว่าแพ้ถั่วลิสง...",
      "suggested_action": "ประสานงานครูประจำชั้นและห้องพยาบาล"
    }
  ]
}`;

  const studentCasesSection = (payload.pseudonymizedStudentCases && payload.pseudonymizedStudentCases.length > 0)
    ? `\nPseudonymized Student Submissions (Student ID only):\n${JSON.stringify(payload.pseudonymizedStudentCases.slice(0, 25), null, 2)}\n`
    : '';

  const userPrompt = `Form Title: ${payload.formTitle}
Total Respondents: ${payload.totalResponses}
Aggregated Field Summaries:
${JSON.stringify(payload.fieldsSummary, null, 2)}
${studentCasesSection}
Analyze this data, extract executive insights, and return the report in JSON.`;

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
    return parsed as NongFahAnalyticsSummary;
  } catch (err: any) {
    console.error('Failed to parse Nong Fah summary JSON:', rawJson);
    throw new Error('ผลลัพธ์บทวิเคราะห์จาก AI ไม่อยู่ในรูปแบบ JSON ที่ถูกต้อง');
  }
}

/**
 * 3. "น้องฟ้า" Chat Interface (Conversational Assistant & Interactive Form Builder)
 */
export interface NongFahChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface NongFahChatResponse {
  reply: string;
  actionType: 'form_generated' | 'chat';
  generatedForm?: GeneratedFormDefinition | null;
  suggestions?: string[];
}

export async function chatWithNongFah(
  message: string,
  history: NongFahChatMessageItem[] = [],
  context?: { page?: string; formTitle?: string }
): Promise<NongFahChatResponse> {
  const systemPrompt = `You are "น้องฟ้า" (Nong Fah), the intelligent, polite, friendly, and expert educational AI Assistant for Somkidvittaya School (โรงเรียนสมคิดวิทยา).
Strict rules to follow:
1. NEVER mention Gemma, internal model names, or technical API backends. You are simply "น้องฟ้า" (Nong Fah AI Assistant).
2. Strictly NO EMOJIS anywhere in your responses (Strict zero-emoji compliance).
3. In Chinese, the school name is ALWAYS "Somkidvittaya学校".
4. Output MUST be valid JSON only. Do not wrap in markdown or markdown backticks.
5. If the user message is asking to create, draft, design, or generate a form (e.g. contains words like "สร้างฟอร์ม", "ขอแบบฟอร์ม", "ทำฟอร์ม", "แบบฟอร์ม", "ลงทะเบียน", "แบบสำรวจ", "สร้าง", "ออกแบบ"):
   - Set "actionType": "form_generated"
   - In "reply": Give a warm, polite Thai response explaining what form you designed, what fields were included, and how it matches the school's context.
   - In "generatedForm": Return a complete form definition conforming to the GeneratedFormDefinition schema (title in th/en/zh, description, category, and complete fields array with localized th/en/zh, field_key, field_type, label, help_text, is_required, width, options).
   - Somkidvittaya School grades are Kindergarten 1 to Primary 6 (อ.1 - ป.6).
6. If the user message is a general question, greeting, advice on forms, PDPA guidelines, or inquiry:
   - Set "actionType": "chat"
   - In "reply": Answer warmly, politely, and informatively in Thai.
   - Set "generatedForm": null
7. In "suggestions": Provide 2-4 short, helpful follow-up phrases that the user can click.

JSON schema:
{
  "reply": "string (polite Thai response, strictly no emojis)",
  "actionType": "form_generated" | "chat",
  "generatedForm": {
    "title": { "th": "...", "en": "...", "zh": "..." },
    "description": { "th": "...", "en": "...", "zh": "..." },
    "category": "general" | "academic" | "activity" | "finance" | "survey",
    "fields": [
      {
        "field_key": "field_...",
        "field_type": "section_header" | "text" | "textarea" | "number" | "radio" | "checkbox" | "select" | "date" | "time" | "file_upload" | "rating",
        "label": { "th": "...", "en": "...", "zh": "..." },
        "help_text": { "th": "", "en": "", "zh": "" },
        "is_required": true,
        "width": "full" | "half",
        "options": [
          { "value": "opt_1", "label": { "th": "...", "en": "...", "zh": "..." } }
        ]
      }
    ]
  } | null,
  "suggestions": ["string", "string"]
}`;

  const conversationHistoryText = (history || [])
    .slice(-6)
    .map(h => `${h.role === 'user' ? 'User' : 'น้องฟ้า'}: ${h.content}`)
    .join('\n');
  const contextNote = context?.formTitle
    ? `\nCurrent Context: Editing form "${context.formTitle}" (Page: ${context.page || 'editor'})`
    : '';

  const userPrompt = `${contextNote}
Conversation History:
${conversationHistoryText || '(No previous history)'}

Current User Message: "${message.trim()}"
Analyze the message and return strictly JSON.`;

  const rawJson = await callGemma({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 2200,
    responseMimeType: 'application/json',
  });

  try {
    const cleaned = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed as NongFahChatResponse;
  } catch (err: any) {
    console.error('Failed to parse Nong Fah chat response:', rawJson);
    throw new Error('ผลลัพธ์จากน้องฟ้า AI ไม่อยู่ในรูปแบบ JSON ที่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
  }
}

