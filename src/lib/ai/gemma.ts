/**
 * Unified Gemma Intelligence Client for "น้องฟ้า" (Nong Fah AI Assistant)
 * Somkidvittaya School Forms Platform
 */

import { FormField } from '@/types';
import { SanitizedFormAnalysisPayload } from './pdpa-sanitizer';

const GEMMA_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-pro',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
];

interface GemmaCallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: string;
  enableSearchGrounding?: boolean;
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
        signal: AbortSignal.timeout(25000),
      });

      // If search grounding was rejected by model/quota, fallback without tools immediately
      if (!res.ok && options.enableSearchGrounding) {
        delete requestBody.tools;
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Client': 'svportal-forms/1.0',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(25000),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`Model ${model} returned error ${res.status}:`, errorText.slice(0, 150));
        lastError = new Error(`AI Model (${model}) สถานะ ${res.status}: ${errorText.slice(0, 100)}`);
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
    maxTokens: 8192,
    responseMimeType: 'application/json',
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
  actionType: 'form_generated' | 'form_modified' | 'chat';
  generatedForm?: GeneratedFormDefinition | null;
  modifiedFields?: FormField[] | null;
  modificationSummary?: string | null;
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
5. Interactive Form Editing in Studio:
   - If the user is currently editing a form (context.currentFields is provided with >0 items) AND the user message asks to edit, add, update, remove, or adjust questions in the existing form (e.g. contains words like "เพิ่มช่อง", "เพิ่มข้อ", "แก้ข้อ", "เปลี่ยนตัวเลือก", "ลบข้อ", "สลับ", "เพิ่มตัวเลือก", "แก้ไข", "ปรับปรุง", "ตัดข้อ", "ใส่เพิ่ม"):
     - Set "actionType": "form_modified"
     - In "reply": Give a warm, polite Thai explanation describing the modification made and explaining why it benefits the school form.
     - In "modificationSummary": A concise 1-sentence Thai summary of the change (e.g. "เพิ่มช่อง 'เบอร์โทรศัพท์สำรองของผู้ปกครอง' (ข้อความสั้น)", "ปรับปรุงตัวเลือกไซส์เสื้อเป็น S, M, L, XL").
     - In "modifiedFields": Return the COMPLETE array of updated fields with the change applied. Preserve existing field_key and options where possible, generate a clean field_key for new fields, ensure localized label (th, en, zh), field_type, is_required, width, and options.
     - Set "generatedForm": null
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
     - In "generatedForm": Return a complete form definition conforming to the GeneratedFormDefinition schema (typically 12-22 detailed fields with logical section_headers, student info, parent contacts, options, file uploads, consent).
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
11. In "suggestions": Provide 2-4 short, helpful follow-up phrases that the user can click.

JSON schema:
{
  "reply": "string (polite Thai response, strictly no emojis)",
  "actionType": "form_generated" | "form_modified" | "chat",
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

  const fieldsSummary = context?.currentFields && context.currentFields.length > 0
    ? `\nCurrently Existing Form Fields (${context.currentFields.length} fields):\n${JSON.stringify(context.currentFields, null, 2)}`
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

  const userPrompt = `${contextNote}${fieldsSummary}${responsesDataText}
Conversation History:
${conversationHistoryText || '(No previous history)'}

Current User Message: "${message.trim()}"
Analyze the message and return strictly JSON.`;

  const rawJson = await callGemma({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 8192,
    responseMimeType: 'application/json',
  });

  return safeParseJson<NongFahChatResponse>(
    rawJson,
    'ผลลัพธ์จากน้องฟ้า AI ไม่อยู่ในรูปแบบ JSON ที่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
  );
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


