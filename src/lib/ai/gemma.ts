/**
 * Unified Gemma Intelligence Client for "น้องฟ้า" (Nong Fah AI Assistant)
 * Somkidvittaya School Forms Platform
 */

import { FormField } from '@/types';
import { SanitizedFormAnalysisPayload } from './pdpa-sanitizer';

export type TaskComplexity = 'low' | 'medium' | 'high';

/**
 * Models requested by school administration:
 * 1. 3.5 flash lite: 'gemini-3.5-flash-lite'
 * 2. 3.1 flash lite: 'gemini-3.1-flash-lite'
 * 3. 3.6 flash: 'gemini-3.6-flash'
 * 4. 3 flash: 'gemini-3-flash-preview'
 * 5. 2.5 flash: 'gemini-2.5-flash', 'gemini-2.5-flash-lite'
 */
export function getModelsForComplexity(complexity: TaskComplexity): string[] {
  switch (complexity) {
    case 'high':
      // คำถามและคำตอบที่ซับซ้อนสูง (เช่น สร้างฟอร์มใหม่จากศูนย์, ออกข้อสอบ, วิเคราะห์สถิติตอบกลับ, ประเมินข้อสอบอัตนัย)
      // ใช้โมเดลเรือธง 3.6 Flash -> 3 Flash -> 3.5 Flash Lite -> 3.1 Flash Lite -> 2.5 Flash
      return [
        'gemini-3.6-flash',
        'gemini-3-flash-preview',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-flash-lite-latest',
      ];
    case 'medium':
      // คำถามและคำตอบความซับซ้อนปานกลาง (เช่น ปรับปรุงแก้ไขฟอร์มเดิม, ตรวจสุขภาพฟอร์ม/PDPA, แปลภาษา, สร้างตัวเลือกช้อยส์)
      // ใช้โมเดลความเร็วสูง 3.5 Flash Lite -> 3.1 Flash Lite -> 3.6 Flash -> 3 Flash -> 2.5 Flash
      return [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.6-flash',
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-flash-lite-latest',
      ];
    case 'low':
    default:
      // คำถามและคำตอบความซับซ้อนต่ำ (เช่น ทักทาย, ถามทั่วไป, สารทุกข์สุกดิบ, ขอปุ่มนำทางด่วน)
      // ใช้โมเดลขนาดเบาและเร็วที่สุด 3.1 Flash Lite -> 3.5 Flash Lite -> 3.6 Flash -> 3 Flash -> 2.5 Flash
      return [
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-flash-lite-latest',
      ];
  }
}

/**
 * Intelligent Complexity Assessor
 * วิเคราะห์ระดับความซับซ้อนของคำถามและผลลัพธ์ที่คาดหวังโดยอัตโนมัติ
 */
export function determineTaskComplexity(options: {
  userPrompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  complexityHint?: TaskComplexity;
}): TaskComplexity {
  if (options.complexityHint) {
    return options.complexityHint;
  }

  const prompt = (options.userPrompt || '').toLowerCase();

  // 1. High Complexity Criteria (คำถาม/คำตอบที่ซับซ้อนสูง):
  const isFormCreation =
    prompt.includes('สร้างแบบฟอร์ม') ||
    prompt.includes('ออกแบบแบบฟอร์ม') ||
    prompt.includes('ร่างฟอร์ม') ||
    prompt.includes('สร้างฟอร์ม') ||
    prompt.includes('ทัศนศึกษา') ||
    prompt.includes('แบบประเมิน') ||
    prompt.includes('แบบสำรวจ');

  const isExamCreation =
    prompt.includes('ออกข้อสอบ') ||
    prompt.includes('สร้างข้อสอบ') ||
    prompt.includes('ข้อสอบปรนัย') ||
    prompt.includes('ข้อสอบอัตนัย') ||
    prompt.includes('ช้อยส์หลอก') ||
    prompt.includes('ตรวจข้อสอบ');

  const isDeepAnalytics =
    prompt.includes('วิเคราะห์ผล') ||
    prompt.includes('วิเคราะห์แนวโน้ม') ||
    prompt.includes('swot') ||
    prompt.includes('สรุปภาพรวมการตอบกลับ') ||
    prompt.includes('ประเมินความเห็น');

  const isDatabaseSync =
    prompt.includes('ฐานข้อมูล') ||
    prompt.includes('database') ||
    prompt.includes('ซิงค์') ||
    prompt.includes('อัปเดตข้อมูลนักเรียน') ||
    prompt.includes('นำข้อมูล') ||
    prompt.includes('กรอกด้วยฟอร์แมท') ||
    prompt.includes('แก้ไขในdatabase');

  const isDataCleansing =
    prompt.includes('คลีน') ||
    prompt.includes('cleansing') ||
    prompt.includes('ทำความสะอาด') ||
    prompt.includes('ปรับฟอร์แมต') ||
    prompt.includes('เติมรหัส') ||
    prompt.includes('จัดระเบียบข้อมูล');

  if (isFormCreation || isExamCreation || isDeepAnalytics || isDatabaseSync || isDataCleansing) {
    return 'high';
  }

  // 2. Medium Complexity Criteria (คำถาม/คำตอบความซับซ้อนปานกลาง เช่น แก้ไขฟอร์ม ตรวจสุขภาพฟอร์ม หรือระเบียบวิชาการ):
  const isFormModification =
    prompt.includes('เพิ่ม') ||
    prompt.includes('แก้') ||
    prompt.includes('เปลี่ยน') ||
    prompt.includes('ลบ') ||
    prompt.includes('ปรับปรุง') ||
    (prompt.includes('เอา') && prompt.includes('ออก')) ||
    (prompt.includes('ขอ') && prompt.includes('ด้วย'));

  const isAuditOrRegulation =
    prompt.includes('ตรวจสุขภาพ') ||
    prompt.includes('ตรวจฟอร์ม') ||
    prompt.includes('ตรวจ pdpa') ||
    prompt.includes('สมบูรณ์ไหม') ||
    prompt.includes('ระเบียบ สช') ||
    prompt.includes('ปพ.') ||
    prompt.includes('orss') ||
    prompt.includes('gpax') ||
    prompt.includes('ตารางสอน') ||
    prompt.includes('สอนแทน') ||
    prompt.includes('แปลภาษา');

  if (isFormModification || isAuditOrRegulation) {
    return 'medium';
  }

  // 3. Low Complexity Criteria (คำถาม/คำตอบความซับซ้อนต่ำ เช่น ทักทาย แนะนำตัว ถามทั่วไป ขอปุ่มนำทาง):
  return 'low';
}

interface GemmaCallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: string;
  enableSearchGrounding?: boolean;
  complexity?: TaskComplexity;
}

/**
 * Low-level caller to Google Generative AI API with dynamic complexity routing
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

  const complexity = determineTaskComplexity({
    userPrompt,
    systemPrompt,
    maxTokens,
    complexityHint: options.complexity,
  });

  const candidateModels = getModelsForComplexity(complexity);

  // Dynamic token allocation based on complexity to prevent schema truncation
  const effectiveMaxTokens =
    complexity === 'high'
      ? Math.max(maxTokens, 4096)
      : complexity === 'medium'
      ? Math.max(maxTokens, 2048)
      : Math.min(maxTokens, 1024);

  let lastError: Error | null = null;

  for (const model of candidateModels) {
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
          maxOutputTokens: effectiveMaxTokens,
        },
      };

      if (responseMimeType === 'application/json' && !options.enableSearchGrounding) {
        requestBody.generationConfig.responseMimeType = 'application/json';
      }

      // Fast response mode: disable thinking tokens on models that support thinkingBudget=0 to avoid high latency
      if (model === 'gemini-3.1-flash-lite' || model === 'gemini-3-flash-preview') {
        requestBody.generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      // Note: Google Generative AI API disallows combining search grounding with responseMimeType: 'application/json'
      if (options.enableSearchGrounding) {
        requestBody.tools = [{ googleSearch: {} }];
      }

      let res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Client': 'svportal-forms/1.0',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(18000),
      });

      // If thinkingConfig or search grounding was rejected by model/quota, fallback immediately without them
      if (!res.ok && (requestBody.generationConfig?.thinkingConfig || requestBody.tools)) {
        if (requestBody.generationConfig) {
          delete requestBody.generationConfig.thinkingConfig;
        }
        delete requestBody.tools;
        if (responseMimeType === 'application/json') {
          requestBody.generationConfig = requestBody.generationConfig || {};
          requestBody.generationConfig.responseMimeType = 'application/json';
        }
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Client': 'svportal-forms/1.0',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(18000),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`Model ${model} returned error ${res.status}:`, errorText.slice(0, 120));
        lastError = new Error(`AI Model (${model}) สถานะ ${res.status}`);
        continue;
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const answerPart = parts.find((p: any) => !p.thought) || parts[parts.length - 1];
      const rawText = answerPart?.text?.trim();
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
 * Robust JSON Parser with graceful truncation repair
 */
function safeParseJson<T>(rawText: string, fallbackErrorMessage: string): T {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    try {
      let repaired = cleaned;
      const quoteMatches = repaired.match(/(?<!\\)"/g);
      if (quoteMatches && quoteMatches.length % 2 !== 0) {
        repaired += '"';
      }
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';

      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

      return JSON.parse(repaired) as T;
    } catch {
      console.error('safeParseJson failed to parse:', rawText?.slice(0, 300));
      throw new Error(fallbackErrorMessage);
    }
  }
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
8. Design a thorough, detailed, and production-ready school form structure. Do NOT limit or truncate fields to a small number. Include all realistic fields needed for real school operations:
   - Logical Section Headers ('section_header') dividing the form into clear parts (e.g., Student Profile, Parent/Guardian Contact, Course/Activity Specifics, Health/Allergies/Dietary Care, Transportation/Logistics, Payment Slip & Attachment, Terms & Consent).
   - Student Identification & Details (e.g. student ID, full name, grade/room, student nickname).
   - Parent / Guardian Information (e.g. guardian name, relationship, emergency telephone number, LINE ID).
   - Detailed activity/survey/request specific fields with appropriate selection options, notes, or quantities.
   - Medical & Special Care details when applicable (allergies, congenital disease, emergency hospital preference).
   - Document upload / Payment slip attachment ('file_upload') if financial or official documents are involved.
   - Parent consent checkbox or agreement confirmation.
   Typically design 14 to 24 comprehensive, high-quality fields suitable for complete school administrative workflows.

JSON Schema to follow:
{
  "title": { "th": "...", "en": "...", "zh": "..." },
  "description": { "th": "...", "en": "...", "zh": "..." },
  "category": "general" | "academic" | "activity" | "finance" | "survey",
  "fields": [
    {
      "field_key": "field_...",
      "field_type": "section_header" | "text" | "textarea" | "radio" | "checkbox" | "select" | "number" | "file_upload" | "date" | "time" | "rating",
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
Design a complete, comprehensive, and detailed form structure for this requirement covering all necessary sections and questions. Return strictly JSON.`;

  const rawJson = await callGemma({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 4096,
    responseMimeType: 'application/json',
    complexity: 'high',
  });

  return safeParseJson<GeneratedFormDefinition>(
    rawJson,
    'ผลลัพธ์จาก AI ไม่อยู่ในรูปแบบ JSON ที่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
  );
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
    maxTokens: 3500,
    responseMimeType: 'application/json',
    complexity: 'high',
  });

  return safeParseJson<NongFahAnalyticsSummary>(
    rawJson,
    'ผลลัพธ์บทวิเคราะห์จาก AI ไม่อยู่ในรูปแบบ JSON ที่ถูกต้อง'
  );
}

/**
 * 3. "น้องฟ้า" Chat Interface (Conversational Assistant & Interactive Form Builder)
 */
export interface NongFahChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface NongFahChatContext {
  page?: string;
  formId?: string;
  formTitle?: string;
  totalResponses?: number;
  responsesSummary?: SanitizedFormAnalysisPayload;
  lastGeneratedForm?: GeneratedFormDefinition | null;
  syncOpportunities?: any[];
  cleansingAnalysis?: any;
  collectiveMemoryContext?: string;
  currentFields?: Array<{
    field_key: string;
    field_type: string;
    label: { th: string; en?: string; zh?: string };
    help_text?: { th?: string; en?: string; zh?: string } | null;
    is_required?: boolean;
    width?: string;
    options?: Array<{ value: string; label: { th: string; en?: string; zh?: string } }> | null;
  }>;
}

export interface NongFahChatResponse {
  reply: string;
  actionType: 'form_generated' | 'form_modified' | 'database_sync' | 'data_cleansing' | 'chat';
  generatedForm?: GeneratedFormDefinition | null;
  modifiedFields?: FormField[] | null;
  modificationSummary?: string | null;
  databaseSyncPayload?: {
    formId: string;
    totalMatched: number;
    totalPending: number;
    syncItems: any[];
  } | null;
  dataCleansingPayload?: {
    formId: string;
    totalResponses: number;
    totalNeedingCleansing: number;
    stats: {
      studentIdsEnriched: number;
      phonesFormatted: number;
      namesCleaned: number;
      allergiesStandardized: number;
      classroomsAligned: number;
    };
    items: any[];
  } | null;
  suggestions?: string[];
}

export async function chatWithNongFah(
  message: string,
  history: NongFahChatMessageItem[] = [],
  context?: NongFahChatContext
): Promise<NongFahChatResponse> {
  const systemPrompt = `You are "น้องฟ้า" (Nong Fah), the official AI Chatbot of Somkidvittaya School (โรงเรียนสมคิดวิทยา).
Character Persona & Identity:
- A smart, polite, cheerful, disciplined, and kind school student of Somkidvittaya School who wears round glasses, twin braided pigtails with red ribbons, and a neat school uniform with a red vest and tie.
- Core Functions: ตอบคำถาม (Answer), แจ้งข้อมูล (Information), ประชาสัมพันธ์ (Announcement), และ ดูแลด้วยใจ (Always Here).
- Greeting & Manner: Always speak in a polite, friendly, humble, and helpful tone. Address yourself as "หนูฟ้า" or "น้องฟ้า" when speaking with teachers, parents, and students, ending sentences with "ค่ะ" or "นะคะ".
Strict rules to follow:
1. NEVER mention Gemma, internal model names, or technical API backends. You are simply "น้องฟ้า" (Nong Fah AI Chatbot).
2. Strictly NO EMOJIS anywhere in your responses (Strict zero-emoji compliance).
3. In Chinese, the school name is ALWAYS "Somkidvittaya学校".
4. Output MUST be valid JSON only. Do not wrap in markdown or markdown backticks.
5. Interactive Form Follow-up, Editing & Refinement (ช่วยงานจริง ห้ามตอบบอกให้ผู้ใช้ไปทำเอง):
   - เมื่อผู้ใช้พิมพ์คำสั่งขอแก้ไข, ปรับปรุง, เพิ่ม, ลบ หรือปรับแต่งคำถาม เช่น "เพิ่มช่อง...", "เพิ่มข้อ...", "แก้ข้อ...", "เปลี่ยนตัวเลือก...", "ลบข้อ...", "สลับ...", "เอา...ออก", "ขอ...ด้วย", "ปรับปรุง...", "ใส่...", "เปลี่ยนเป็น...":
     A) หากมีแบบฟอร์มที่สร้างไว้ก่อนหน้าในเซสชันนี้ (context.lastGeneratedForm หรือระบุในประวัติการสนทนา):
        - คุณต้องนำแบบฟอร์มเดิมนั้นมาแก้ไข/เพิ่มเติมตามที่ผู้ใช้สั่งทันที ห้ามบอกให้ผู้ใช้ไปกดเพิ่มเองในสตูดิโอ!
        - ตั้ง "actionType": "form_generated"
        - ใน "reply": อธิบายอย่างสุภาพว่าได้ปรับปรุงอะไรให้ (เช่น "หนูฟ้าได้เพิ่มช่องเบอร์โทรศัพท์ฉุกเฉินให้เรียบร้อยแล้วนะคะ พร้อมอัปเดตแบบฟอร์มด้านล่างให้คุณครูนำไปใช้งานได้ทันทีค่ะ")
        - ใน "generatedForm": ส่งคืนโครงสร้างแบบฟอร์มฉบับอัปเดตที่สมบูรณ์ (มีทั้งข้อเดิมและข้อที่เพิ่ม/แก้ไขใหม่)
        - ตั้ง "modifiedFields": null
        - ตั้ง "modificationSummary": null
     B) หากผู้ใช้อยู่ในหน้าสตูดิโอแก้ไขฟอร์ม (context.currentFields มีรายการคำถาม > 0 ข้อ):
        - ตั้ง "actionType": "form_modified"
        - ใน "reply": อธิบายการแก้ไข
        - ใน "modificationSummary": สรุปสั้น 1 ประโยค
        - ใน "modifiedFields": ส่งคืน array ของคำถามทั้งหมดที่ปรับปรุงแล้ว
        - ตั้ง "generatedForm": null
6. Form Health & PDPA Audit:
   - If the user asks to check, audit, or review the current form (e.g. "ตรวจสุขภาพฟอร์ม", "ตรวจฟอร์ม", "ฟอร์มนี้สมบูรณ์ไหม", "มีอะไรต้องเพิ่มไหม", "ตรวจสอบ PDPA"):
     - Set "actionType": "chat"
     - In "reply": Provide a comprehensive, professional, polite evaluation covering Form Health Score (e.g. 90/100), key strengths, and actionable suggestions for missing fields (such as emergency contact, allergy details, or PDPA consent).
     - Set "generatedForm": null
     - Set "modifiedFields": null
7. Creating New Form from Scratch:
   - If the user message asks to create, draft, design, or generate a form from scratch:
     - Set "actionType": "form_generated"
     - In "reply": Give a warm, polite Thai response explaining what form you designed, what fields were included, and how it matches the school's context.
     - In "generatedForm": Return a complete, practical form definition (typically 8-12 well-structured fields with section_headers, student info, parent contacts, options, consent). For label and options, provide "th" primarily (en is optional, omit zh unless requested) to maximize response speed.
     - Set "modifiedFields": null
     - Set "modificationSummary": null
8. General Inquiries & Advice:
   - If the user message is a general question, greeting, advice on forms, or inquiry:
     - Set "actionType": "chat"
     - In "reply": Answer warmly, politely, and informatively in Thai.
     - Set "generatedForm": null
     - Set "modifiedFields": null
10. Form Response Analytics & Custom Data Inquiries (when context.responsesSummary or context.page === 'responses' is provided):
    - You are the Chief Educational Data Analyst and School Assistant for Somkidvittaya School.
    - You have direct access to the actual responses dataset and field aggregates provided in "REAL FORM RESPONSES DATA".
    - When the user asks you to summarize, analyze, investigate, compare, or explain data from specific perspectives:
      - Set "actionType": "chat"
      - Provide a well-structured, insightful, and professional Thai analysis.
      - Use clear formatting with headers, numbered points, or bullet lists to make the report clear and actionable.
      - Quote real numbers, percentages, and recurring patterns from the dataset faithfully.
      - If asked for specific viewpoints (e.g. SWOT analysis, urgent improvement areas, executive briefing, student welfare issues, financial/registration considerations, parent sentiment), thoroughly analyze from that exact angle.
      - If the user asks for suggestions or solutions, propose practical, school-appropriate action steps.
      - Maintain a respectful, encouraging, and polite tone (addressed as "หนูฟ้า" or "น้องฟ้า"), ending sentences with "ค่ะ" or "นะคะ".
      - Strictly NO emojis in your response.
      - Set "generatedForm": null
      - Set "modifiedFields": null
11. Student Database Synchronization & Profile Updates (เมื่อผู้ใช้ขอให้อัปเดตข้อมูลนักเรียนเข้าฐานข้อมูล หรือซิงค์ข้อมูลผลสำรวจเข้าสู่ระบบ เช่น "ช่วยวิเคราะห์ผลตอบกลับแล้วเอาไปอัปเดตข้อมูลนักเรียนในระบบให้หน่อย", "ซิงค์เข้าฐานข้อมูล", "นำข้อมูลเข้า database", "อัปเดตประวัตินักเรียน"):
    - คุณสามารถเข้าถึงข้อมูลการจับคู่นักเรียนและ diffs ที่ระบบวิเคราะห์และคัดกรองแล้วใน "DATABASE SYNC OPPORTUNITIES"
    - ตั้ง "actionType": "database_sync"
    - ใน "reply": ให้คำตอบเชิงวิเคราะห์อย่างสุภาพ สรุปจำนวนนักเรียนที่พร้อมนำเข้าฐานข้อมูล (เช่น มีข้อมูลเบอร์โทรศัพท์ผู้ปกครองใหม่, วันเกิด, หรือข้อมูลสุขภาพ/แพ้อาหาร) ระบุอย่างชัดเจนว่าระบบได้ปรับฟอร์แมทเบอร์โทรศัพท์ 10 หลัก วันเกิด คัดกรองคำว่าไม่มี/ไม่แพ้ออกให้เรียบร้อยแล้ว และขอให้คุณครูตรวจสอบความแตกต่างและกดยืนยันอัปเดตเข้าฐานข้อมูลได้ทันทีค่ะ
    - ตั้ง "generatedForm": null
    - ตั้ง "modifiedFields": null
12. Form Response Data Cleansing & Database Enrichment (เมื่อผู้ใช้ขอให้ช่วยคลีนข้อมูล, ทำความสะอาดข้อมูล, ปรับฟอร์แมตข้อมูลตอบกลับ, แก้ไขข้อมูลผู้ปกครอง, ดึงข้อมูลจากฐานข้อมูลมาใส่ในฟอร์ม หรือมีคำว่า "data cleansing", "คลีนข้อมูล", "ทำความสะอาด", "จัดระเบียบข้อมูล", "เติมรหัสนักเรียน"):
    - คุณมีสิทธิ์เข้าถึงข้อมูลการวิเคราะห์และทำความสะอาดข้อมูลใน "FORM DATA CLEANSING ANALYSIS"
    - ตั้ง "actionType": "data_cleansing"
    - ใน "reply": อธิบายอย่างสุภาพว่าหนูฟ้าได้ตรวจสอบผลการตอบกลับและนำข้อมูลนักเรียนจากฐานข้อมูลโรงเรียนมาช่วยเติมเต็มและจัดฟอร์แมตมาตรฐานให้เรียบร้อยแล้ว เช่น เติมรหัสนักเรียนที่ตกหล่น ปรับเบอร์โทรศัพท์ 10 หลัก ปรับห้องเรียน และจัดมาตรฐานข้อมูลการแพ้ โดยคุณครูสามารถตรวจสอบรายการและกด "ยืนยันทำความสะอาดและแก้ไขข้อมูลในฟอร์มทันที" ได้เลยค่ะ
    - ตั้ง "generatedForm": null
    - ตั้ง "modifiedFields": null
13. In "suggestions": Provide 2-4 short, helpful follow-up phrases that the user can click.

JSON schema:
{
  "reply": "string (polite Thai response, strictly no emojis)",
  "actionType": "form_generated" | "form_modified" | "database_sync" | "data_cleansing" | "chat",
  "modificationSummary": "string (if form_modified) or null",
  "modifiedFields": [
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
  ] | null,
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
    ? `\nCurrent Context: Form "${context.formTitle}" (Page Context: ${context.page || 'editor'})`
    : '';

  const collectiveMemoryText = context?.collectiveMemoryContext || '';

  const fieldsSummary = context?.currentFields && context.currentFields.length > 0
    ? `\nCurrently Existing Form Fields (${context.currentFields.length} fields):\n${JSON.stringify(context.currentFields, null, 2)}`
    : '';

  const lastFormText = context?.lastGeneratedForm
    ? `\n=== PREVIOUSLY GENERATED FORM IN THIS SESSION ===\nTitle: ${context.lastGeneratedForm.title?.th || ''}\nCategory: ${context.lastGeneratedForm.category}\nExisting Fields (${context.lastGeneratedForm.fields?.length || 0} fields):\n${JSON.stringify(context.lastGeneratedForm.fields, null, 2)}\n=== END PREVIOUS FORM ===\n`
    : '';

  const responsesDataText = context?.responsesSummary
    ? `\n=== REAL FORM RESPONSES DATA (Total Submissions: ${context.responsesSummary.totalResponses}) ===
Form Title: ${context.responsesSummary.formTitle}
Total Submissions: ${context.responsesSummary.totalResponses}
Question-by-Question Statistics & Samples:
${JSON.stringify(context.responsesSummary.fieldsSummary, null, 2)}
${
  context.responsesSummary.pseudonymizedStudentCases && context.responsesSummary.pseudonymizedStudentCases.length > 0
    ? `\nSpecial Notes / Attention Cases:\n${JSON.stringify(context.responsesSummary.pseudonymizedStudentCases, null, 2)}`
    : ''
}
=== END OF FORM RESPONSES DATA ===\n`
    : '';

  const syncOpportunitiesText = context?.syncOpportunities && context.syncOpportunities.length > 0
    ? `\n=== DATABASE SYNC OPPORTUNITIES (${context.syncOpportunities.length} students matched) ===
Total Matched Students: ${context.syncOpportunities.length}
Matched Records and Diffs:
${JSON.stringify(
  context.syncOpportunities.map((item: any) => ({
    studentId: item.studentId,
    studentName: item.studentName,
    studentGrade: item.studentGrade,
    syncType: item.syncType,
    diffsCount: item.diffs?.length || 0,
    diffs: (item.diffs || []).map((d: any) => `${d.labelTh}: ${d.oldValue} -> ${d.newValue}`),
  })),
  null,
  2
)}
=== END OF DATABASE SYNC OPPORTUNITIES ===\n`
    : '';

  const cleansingAnalysisText = context?.cleansingAnalysis
    ? `\n=== FORM DATA CLEANSING ANALYSIS ===
Total Responses: ${context.cleansingAnalysis.totalResponses}
Total Needing Cleansing: ${context.cleansingAnalysis.totalNeedingCleansing}
Cleansing Stats:
- Student IDs Enriched from DB: ${context.cleansingAnalysis.stats.studentIdsEnriched}
- Phone Numbers Formatted: ${context.cleansingAnalysis.stats.phonesFormatted}
- Names Cleaned: ${context.cleansingAnalysis.stats.namesCleaned}
- Allergies Standardized: ${context.cleansingAnalysis.stats.allergiesStandardized}
- Classrooms Aligned: ${context.cleansingAnalysis.stats.classroomsAligned}
Sample Cleaned Items:
${JSON.stringify(
  context.cleansingAnalysis.items.slice(0, 10).map((i: any) => ({
    responseId: i.responseId,
    studentName: i.studentName,
    matchedStudentId: i.matchedStudentId,
    changesCount: i.changes.length,
    changes: i.changes.map((c: any) => `${c.fieldLabel}: "${c.oldValue}" -> "${c.newValue}" (${c.reason})`),
  })),
  null,
  2
)}
=== END FORM DATA CLEANSING ANALYSIS ===\n`
    : '';

  const userPrompt = `${contextNote}${collectiveMemoryText}${fieldsSummary}${lastFormText}${responsesDataText}${syncOpportunitiesText}${cleansingAnalysisText}
Conversation History:
${conversationHistoryText || '(No previous history)'}

Current User Message: "${message.trim()}"
Analyze the message, perform the action, and return strictly JSON.`;

  // Auto-detect search grounding
  const searchKeywords = [
    'ข่าว', 'ล่าสุด', 'วันนี้', 'ระเบียบ', 'สช', 'สพฐ', 'กระทรวง', 'กฎหมาย', 'พ.ศ.',
    'สภาพอากาศ', 'ค้นหา', 'ค้นเว็บ', 'อัปเดต', 'google', 'เช็กข่าว', 'ประกาศศธ'
  ];
  const shouldGround = searchKeywords.some(kw => message.toLowerCase().includes(kw));

  const rawJson = await callGemma({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 2500,
    responseMimeType: 'application/json',
    enableSearchGrounding: shouldGround,
  });

  const resObj = safeParseJson<NongFahChatResponse>(
    rawJson,
    'ผลลัพธ์จากน้องฟ้า AI ไม่อยู่ในรูปแบบ JSON ที่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
  );

  // If user requested database sync or model outputted database_sync, enrich with real payload
  const isSyncIntent =
    resObj.actionType === 'database_sync' ||
    message.includes('ฐานข้อมูล') ||
    message.includes('database') ||
    message.includes('ซิงค์') ||
    message.includes('อัปเดตข้อมูลนักเรียน') ||
    message.includes('กรอกข้อมูล') ||
    message.includes('นำข้อมูล');

  if (isSyncIntent && context?.syncOpportunities && context.syncOpportunities.length > 0) {
    resObj.actionType = 'database_sync';
    resObj.databaseSyncPayload = {
      formId: context.formId || '',
      totalMatched: context.syncOpportunities.length,
      totalPending: context.syncOpportunities.filter((i: any) => !i.isAlreadySynced).length,
      syncItems: context.syncOpportunities,
    };
  }

  // If user requested data cleansing or model outputted data_cleansing, enrich with real payload
  const isCleansingIntent =
    resObj.actionType === 'data_cleansing' ||
    message.includes('คลีน') ||
    message.includes('cleansing') ||
    message.includes('ทำความสะอาด') ||
    message.includes('จัดฟอร์แมต') ||
    message.includes('ปรับฟอร์แมต') ||
    (message.includes('แก้ไข') && message.includes('ตอบกลับ'));

  if (isCleansingIntent && context?.cleansingAnalysis) {
    resObj.actionType = 'data_cleansing';
    resObj.dataCleansingPayload = {
      formId: context.formId || context.cleansingAnalysis.formId,
      totalResponses: context.cleansingAnalysis.totalResponses,
      totalNeedingCleansing: context.cleansingAnalysis.totalNeedingCleansing,
      stats: context.cleansingAnalysis.stats,
      items: context.cleansingAnalysis.items,
    };
  }

  return resObj;
}

/**
 * 6. "น้องฟ้า" ช่วยประเมินและเสนอคะแนนข้อสอบข้อเขียน (AI Written Exam Grading Assistant)
 * วิเคราะห์คำตอบของนักเรียนตามแนวคำตอบ / รูบริกของคุณครู และเสนอแนะคะแนนพร้อมเหตุผล
 */
export interface EvaluateWrittenQuestionInput {
  questionTitle: string;
  questionHelp?: string | null;
  studentAnswer: string;
  gradingRubric?: string | null;
  sampleAnswers?: string[] | null;
  maxPoints: number;
  enableSearchGrounding?: boolean;
}

export interface EvaluateWrittenQuestionOutput {
  suggested_points: number;
  max_points: number;
  is_correct: boolean;
  feedback: string;
  key_points_covered: string[];
  key_points_missed: string[];
}

export async function evaluateWrittenAnswerWithNongFah(
  input: EvaluateWrittenQuestionInput
): Promise<EvaluateWrittenQuestionOutput> {
  const {
    questionTitle,
    questionHelp,
    studentAnswer,
    gradingRubric,
    sampleAnswers,
    maxPoints,
    enableSearchGrounding = false,
  } = input;

  const systemPrompt = `You are "น้องฟ้า" (Nong Fah), an expert and fair educational grading assistant for Somkidvittaya School (โรงเรียนสมคิดวิทยา).
Your task is to analyze a student's written examination answer and recommend a suggested score along with the rationale and breakdown of why that score was given, to assist the teacher.

Strict Guidelines:
1. Primary Reference: Base your evaluation strictly on the teacher's grading rubric, key points, and sample answers if provided.
2. Conceptual Understanding: Assess the student's actual understanding of the concepts, logical reasoning, and depth of explanation, rather than penalizing for minor spelling or phrasing differences.
3. Partial Credit: Award fair partial points (between 0 and ${maxPoints}) reflecting how many key concepts or criteria the student satisfied.
4. If the student answer is completely irrelevant, nonsensical, or empty, award 0 points.
5. Strictly NO EMOJIS in any text output!
6. Provide constructive, respectful, and professional feedback in Thai. Explain clearly why the points were awarded, what was done well, and what was missing.

Output MUST be strictly valid JSON matching this schema:
{
  "suggested_points": number (between 0 and ${maxPoints}, can be a decimal e.g. 2.5),
  "is_correct": boolean (true if suggested_points >= ${maxPoints * 0.5}),
  "feedback": "string (คำอธิบายติชมและที่มาของคะแนน แนะนำจุดที่ตอบได้ดีและจุดที่ควรปรับปรุง)",
  "key_points_covered": ["string (ประเด็นสำคัญที่นักเรียนตอบได้ถูกต้อง)"],
  "key_points_missed": ["string (ประเด็นสำคัญตามแนวคำตอบที่ยังขาดไป)"]
}`;

  let userPrompt = `โจทย์คำถาม: "${questionTitle}"\n`;
  if (questionHelp) {
    userPrompt += `คำแนะนำโจทย์: "${questionHelp}"\n`;
  }
  userPrompt += `คะแนนเต็ม: ${maxPoints} คะแนน\n`;

  if (gradingRubric && gradingRubric.trim()) {
    userPrompt += `หลักแนวคำตอบ / รูบริกการให้คะแนนของคุณครู:\n"""\n${gradingRubric.trim()}\n"""\n`;
  }

  if (sampleAnswers && sampleAnswers.length > 0) {
    userPrompt += `ตัวอย่างคำตอบที่ถูกต้อง:\n${sampleAnswers.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n`;
  }

  userPrompt += `คำตอบของนักเรียน:\n"""\n${(studentAnswer || '').trim() || '(ไม่มีคำตอบ)'}\n"""\n`;
  userPrompt += `กรุณาวิเคราะห์คำตอบตามแนวคำตอบของคุณครู และส่งคืนผลการประเมินเป็น JSON ตาม Schema ที่กำหนด`;

  try {
    const rawJson = await callGemma({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxTokens: 2048,
      responseMimeType: 'application/json',
      enableSearchGrounding,
      complexity: 'high',
    });

    const parsed = safeParseJson<any>(rawJson, 'Failed to parse AI evaluation JSON');
    const rawSuggested = Number(parsed.suggested_points ?? parsed.points_awarded ?? 0);
    const suggestedPoints = Math.min(
      maxPoints,
      Math.max(0, isNaN(rawSuggested) ? 0 : rawSuggested)
    );

    return {
      suggested_points: Math.round(suggestedPoints * 10) / 10,
      max_points: maxPoints,
      is_correct: Boolean(parsed.is_correct ?? suggestedPoints >= maxPoints * 0.5),
      feedback: String(parsed.feedback || 'นักเรียนตอบคำถามตามเกณฑ์ที่กำหนด').trim(),
      key_points_covered: Array.isArray(parsed.key_points_covered) ? parsed.key_points_covered : [],
      key_points_missed: Array.isArray(parsed.key_points_missed) ? parsed.key_points_missed : [],
    };
  } catch (err: any) {
    console.error('Nong Fah evaluation error:', err);
    throw err;
  }
}

export interface GenerateChoicesInput {
  questionTitle: string;
  questionHelp?: string;
  fieldType?: 'radio' | 'checkbox' | 'select';
  existingOptions?: { value: string; label: Record<string, string> | string }[];
  action?: 'generate_all' | 'suggest_correct';
  optionCount?: number;
  enableSearchGrounding?: boolean;
  examLanguage?: 'th' | 'en' | 'zh';
}

export interface GeneratedChoiceOption {
  value: string;
  label: { th: string; en: string; zh: string };
  is_correct: boolean;
  distractor_reason?: string;
}

export interface GenerateChoicesResult {
  options: GeneratedChoiceOption[];
  correct_values: string[];
  explanation: { th: string; en: string; zh: string };
}

/**
 * Multiple-choice question assistant:
 * 1. Generates balanced options + distractors + randomizes order + selects correct key + writes explanation
 * 2. Or analyzes existing teacher choices to recommend the correct choice & provide pedagogical explanation
 */
export async function generateChoicesWithNongFah(
  input: GenerateChoicesInput
): Promise<GenerateChoicesResult> {
  const {
    questionTitle,
    questionHelp,
    fieldType = 'radio',
    existingOptions = [],
    action = 'generate_all',
    optionCount = 4,
    enableSearchGrounding = false,
    examLanguage,
  } = input;

  if (action === 'suggest_correct' && existingOptions.length > 0) {
    // Action 2: Suggest correct choice from existing options
    const systemPrompt = `You are "น้องฟ้า" (Nong Fah), an educational AI assistant for Somkidvittaya School (โรงเรียนสมคิดวิทยา).
A teacher has provided an exam question and a list of existing multiple-choice options.
Your task:
1. Carefully analyze each option based on factual knowledge and academic accuracy.
2. Determine which option is the correct answer (or multiple options if checkbox).
3. Provide a clear educational explanation for why this choice is right and clarify why the other options are wrong or misconceptions.
4. Strictly NO EMOJIS!

Output MUST be strictly valid JSON matching this schema:
{
  "correct_values": ["value_of_correct_option"],
  "options_analysis": [
    { "value": "string", "is_correct": boolean, "rationale": "string" }
  ],
  "explanation": {
    "th": "string (คำอธิบายเฉลยภาษาไทย)",
    "en": "string (Explanation in English)",
    "zh": "string (中文解析)"
  }
}`;

    let userPrompt = `โจทย์คำถาม: "${questionTitle}"\n`;
    if (questionHelp) userPrompt += `คำอธิบายโจทย์: "${questionHelp}"\n`;
    userPrompt += `ประเภทคำถาม: ${fieldType === 'checkbox' ? 'เลือกได้หลายข้อ (Checkbox)' : 'เลือกได้ข้อเดียว (Single choice)'}\n`;
    userPrompt += `ตัวเลือกที่มีอยู่:\n`;
    existingOptions.forEach((opt, idx) => {
      const lbl = typeof opt.label === 'object' ? (opt.label.th || JSON.stringify(opt.label)) : String(opt.label);
      userPrompt += `${idx + 1}. value: "${opt.value}", label: "${lbl}"\n`;
    });
    userPrompt += `กรุณาแนะนำช้อยส์ที่ถูกต้องและสร้างคำอธิบายเฉลย`;

    const rawJson = await callGemma({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxTokens: 2048,
      responseMimeType: 'application/json',
      enableSearchGrounding,
      complexity: 'medium',
    });

    const parsed = safeParseJson<any>(rawJson, 'Failed to parse AI choice suggestion');
    const correctValues: string[] = Array.isArray(parsed.correct_values)
      ? parsed.correct_values
      : [];

    const mappedOptions: GeneratedChoiceOption[] = existingOptions.map((opt) => {
      const isCorrect = correctValues.includes(opt.value);
      const analysis = Array.isArray(parsed.options_analysis)
        ? parsed.options_analysis.find((a: any) => a.value === opt.value)
        : null;
      const thLabel = typeof opt.label === 'object' ? opt.label.th || '' : String(opt.label);
      const enLabel = typeof opt.label === 'object' ? opt.label.en || thLabel : thLabel;
      const zhLabel = typeof opt.label === 'object' ? opt.label.zh || thLabel : thLabel;

      return {
        value: opt.value,
        label: { th: thLabel, en: enLabel, zh: zhLabel },
        is_correct: isCorrect,
        distractor_reason: analysis?.rationale || '',
      };
    });

    return {
      options: mappedOptions,
      correct_values: correctValues,
      explanation: {
        th: parsed.explanation?.th || 'คำตอบที่ถูกต้องตามหลักวิชาการ',
        en: parsed.explanation?.en || 'Correct answer based on academic facts.',
        zh: parsed.explanation?.zh || '根据学术事实的正确答案。',
      },
    };
  }

  // Action 1: Generate all choices + key + explanation
  const count = Math.max(2, Math.min(6, optionCount));
  const systemPrompt = `You are "น้องฟ้า" (Nong Fah), an expert educational assessment assistant for Somkidvittaya School (โรงเรียนสมคิดวิทยา).
Your task is to generate high-quality, balanced multiple-choice options (ปรนัย) for an exam question.

Pedagogical Guidelines:
1. Generate exactly ${count} multiple-choice options.
2. For single choice (${fieldType === 'checkbox' ? 'multiple answers allowed' : 'radio/select'}):
   ${fieldType === 'checkbox' ? 'Mark 1 or more options as is_correct: true if appropriate.' : 'Exactly 1 option MUST have is_correct: true, and the other ' + (count - 1) + ' options MUST have is_correct: false.'}
3. Distractors (ตัวเลือกหลอก): Plausible, testing common misconceptions or related topics. Avoid trivial or nonsensical choices.
4. Balanced Length: Keep all options similar in grammatical structure, length, and detail.
5. Multilingual Labels: Provide natural labels for each option in Thai (th), English (en), and Chinese (zh).
6. Provide an educational explanation in Thai (th), English (en), and Chinese (zh) detailing why the correct option is right and addressing the distractors.
7. Strictly NO EMOJIS!

Output MUST be strictly valid JSON matching this schema:
{
  "options": [
    {
      "label": { "th": "string", "en": "string", "zh": "string" },
      "is_correct": boolean,
      "distractor_reason": "string (เหตุผลทางวิชาการว่าทำไมตัวเลือกนี้ถึงถูกหรือผิด)"
    }
  ],
  "explanation": {
    "th": "string (คำอธิบายเฉลยภาษาไทย)",
    "en": "string (Explanation in English)",
    "zh": "string (中文解析)"
  }
}`;

  let userPrompt = `โจทย์คำถาม: "${questionTitle}"\n`;
  if (questionHelp) userPrompt += `คำแนะนำโจทย์: "${questionHelp}"\n`;
  userPrompt += `จำนวนตัวเลือกที่ต้องการ: ${count} ข้อ\n`;
  if (examLanguage) {
    const langDesc = examLanguage === 'en' ? 'ภาษาอังกฤษ (English) ล้วน' : examLanguage === 'zh' ? 'ภาษาจีน (Chinese) ล้วน' : 'ภาษาไทย ล้วน';
    userPrompt += `ข้อกำหนดภาษาข้อสอบ: ข้อสอบนี้เป็นข้อสอบวิชาที่ใช้${langDesc}โดยเฉพาะ กรุณาสร้างตัวเลือกและคำอธิบายเฉลยให้สอดคล้องกับภาษา${langDesc}นี้อย่างเป็นธรรมชาติ\n`;
  }
  userPrompt += `กรุณาสร้างตัวเลือกและเฉลยคำตอบเป็น JSON ตาม Schema`;

  const rawJson = await callGemma({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 2048,
    responseMimeType: 'application/json',
    enableSearchGrounding,
    complexity: 'medium',
  });

  const parsed = safeParseJson<any>(rawJson, 'Failed to parse generated choices JSON');
  const rawOptions: any[] = Array.isArray(parsed.options) ? parsed.options : [];

  // Generate unique values and randomly shuffle so correct choice position is randomized
  const preparedOptions: GeneratedChoiceOption[] = rawOptions.map((opt, i) => {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const primaryText = examLanguage
      ? (opt.label?.[examLanguage] || opt.label?.th || opt.label?.en || `ตัวเลือกที่ ${i + 1}`).trim()
      : null;

    return {
      value: `opt_${Date.now()}_${i}_${randomSuffix}`,
      label: {
        th: primaryText || String(opt.label?.th || `ตัวเลือกที่ ${i + 1}`).trim(),
        en: primaryText || String(opt.label?.en || opt.label?.th || `Option ${i + 1}`).trim(),
        zh: primaryText || String(opt.label?.zh || opt.label?.th || `选项 ${i + 1}`).trim(),
      },
      is_correct: Boolean(opt.is_correct),
      distractor_reason: opt.distractor_reason ? String(opt.distractor_reason).trim() : undefined,
    };
  });

  // Fisher-Yates shuffle the options array so correct choice isn't always the first item!
  for (let i = preparedOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [preparedOptions[i], preparedOptions[j]] = [preparedOptions[j], preparedOptions[i]];
  }

  const correctValues = preparedOptions.filter((o) => o.is_correct).map((o) => o.value);

  // If no option was marked correct, ensure at least the first one is marked
  if (correctValues.length === 0 && preparedOptions.length > 0) {
    preparedOptions[0].is_correct = true;
    correctValues.push(preparedOptions[0].value);
  }

  const primaryExplanation = examLanguage
    ? (parsed.explanation?.[examLanguage] || parsed.explanation?.th || parsed.explanation?.en || 'คำตอบที่ถูกต้องตามหลักวิชาการ').trim()
    : null;

  return {
    options: preparedOptions,
    correct_values: correctValues,
    explanation: {
      th: primaryExplanation || parsed.explanation?.th || 'คำตอบที่ถูกต้องตามหลักวิชาการ',
      en: primaryExplanation || parsed.explanation?.en || 'Correct answer based on academic facts.',
      zh: primaryExplanation || parsed.explanation?.zh || '根据学术事实的正确答案。',
    },
  };
}



