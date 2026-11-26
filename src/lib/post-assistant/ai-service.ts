import {
  ANTI_AI_SLOP_PROMPT,
  BRAND_PROFILES,
  GRADE_RULES_PROMPT,
  normalizeChineseSchoolName,
  sanitizeBriefForAI,
  validateAndFixGradeNotation,
} from './brand-glossary';
import {
  AIGenerateResponse,
  ActivityBrief,
  BrandId,
  CoverHeadline,
  HookArchetype,
  MediaMode,
  PostCategory,
  RefinePreset,
  SocialCaptions,
  SocialPostRecord,
  WebsiteEditorialContent,
} from './types';

const POST_ASSISTANT_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'] as const;

const VALID_HOOK_ARCHETYPES: HookArchetype[] = [
  'micro_moment',
  'parent_insight',
  'paradigm_shift',
  'process_over_product',
  'curiosity_question',
  'heritage_prestige',
];

const VALID_CATEGORIES: PostCategory[] = [
  'academic',
  'activity',
  'announcement',
  'award',
  'admission',
  'sports',
  'community',
  'competition',
  'general',
];

function getGeminiApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured in server environment');
  }
  return key;
}

interface GeminiCandidateEnvelope {
  error?: { message?: string };
  candidates?: Array<{
    content?: {
      parts?: Array<{ thought?: boolean; text?: string }>;
    };
  }>;
}

type JsonObject = Record<string, unknown>;

function extractAnswerText(data: GeminiCandidateEnvelope): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const answerPart =
    parts.find((p) => !p.thought && typeof p.text === 'string' && p.text.trim()) ||
    parts[parts.length - 1];
  const raw = typeof answerPart?.text === 'string' ? answerPart.text.trim() : '';
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function buildPayloadForModel(
  payload: Record<string, unknown>,
  model: (typeof POST_ASSISTANT_MODELS)[number]
): Record<string, unknown> {
  if (model !== 'gemini-3.5-flash-lite') return payload;
  const rawGenConfig = payload.generationConfig as Record<string, unknown> | undefined;
  if (!rawGenConfig || !('thinkingConfig' in rawGenConfig)) return payload;
  const restGenConfig = { ...rawGenConfig };
  delete restGenConfig.thinkingConfig;
  return {
    ...payload,
    generationConfig: restGenConfig,
  };
}

async function fetchSingleGeminiModel(params: {
  model: (typeof POST_ASSISTANT_MODELS)[number];
  payload: Record<string, unknown>;
  apiKey: string;
  signal: AbortSignal;
}): Promise<{ json: JsonObject; modelUsed: string }> {
  const { model, payload, apiKey, signal } = params;
  const requestPayload = buildPayloadForModel(payload, model);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestPayload),
      signal,
    }
  );

  const rawText = await res.text();
  let parsedEnvelope: GeminiCandidateEnvelope;
  try {
    parsedEnvelope = JSON.parse(rawText) as GeminiCandidateEnvelope;
  } catch {
    throw new Error(`${model}: non-JSON response (${res.status})`);
  }

  if (res.status === 503 || res.status === 429) {
    throw new Error(`${model} (${res.status}): ${parsedEnvelope?.error?.message || 'Service busy'}`);
  }

  if (!res.ok || parsedEnvelope?.error) {
    throw new Error(`${model} (${res.status}): ${parsedEnvelope?.error?.message || 'API error'}`);
  }

  const answerText = extractAnswerText(parsedEnvelope);
  if (!answerText) {
    throw new Error(`${model}: Empty response`);
  }

  const json = JSON.parse(answerText) as JsonObject;
  return { json, modelUsed: model };
}

/**
 * Hedged parallel cascade:
 * - t=0ms: launch primary (gemini-3.8-flash)
 * - t=3500ms (or sooner if 3.8 fails): hedge launch fallback 1 (gemini-3.6-flash)
 * - t=7500ms (or sooner if both 3.8 & 3.6 fail): hedge launch emergency fallback (gemini-3.5-flash-lite)
 * First valid JSON wins immediately and aborts all remaining in-flight requests.
 */
async function callGeminiWithFallback(params: {
  payload: Record<string, unknown>;
  timeoutMs?: number;
  maxTotalMs?: number;
}): Promise<{ json: JsonObject; modelUsed: string }> {
  const apiKey = getGeminiApiKey();
  const maxTotalMs = params.maxTotalMs ?? 23500;
  const hedgeDelaysMs = [0, 3500, 7500];

  return await new Promise<{ json: JsonObject; modelUsed: string }>((resolve, reject) => {
    let settled = false;
    const totalModels = POST_ASSISTANT_MODELS.length;
    const launched = new Array<boolean>(totalModels).fill(false);
    const failed = new Array<boolean>(totalModels).fill(false);
    const errors: string[] = [];
    const controllers: AbortController[] = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const cleanup = () => {
      for (const t of timers) clearTimeout(t);
      for (const c of controllers) {
        try {
          c.abort();
        } catch {
          // ignore
        }
      }
    };

    const overallTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      const lastErr = errors[errors.length - 1] || 'Gemini API timed out';
      reject(new Error(lastErr));
    }, maxTotalMs);
    timers.push(overallTimer);

    const launchModel = (idx: number) => {
      if (settled || idx < 0 || idx >= totalModels || launched[idx]) return;
      launched[idx] = true;

      const model = POST_ASSISTANT_MODELS[idx];
      const controller = new AbortController();
      controllers.push(controller);

      fetchSingleGeminiModel({
        model,
        payload: params.payload,
        apiKey,
        signal: controller.signal,
      })
        .then((result) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        })
        .catch((err: unknown) => {
          if (settled) return;
          failed[idx] = true;
          const msg = err instanceof Error ? err.message : `${model}: Request failed`;
          errors.push(msg);

          if (failed.every(Boolean)) {
            settled = true;
            cleanup();
            reject(new Error(errors[errors.length - 1] || 'Gemini API unavailable'));
            return;
          }

          // Immediately trigger next unlaunched model if all preceding models have failed
          const nextIdx = launched.findIndex((wasLaunched) => !wasLaunched);
          if (nextIdx !== -1 && failed.slice(0, nextIdx).every(Boolean)) {
            launchModel(nextIdx);
          }
        });
    };

    // t=0 launch primary + schedule staggered hedges
    launchModel(0);
    for (let i = 1; i < totalModels; i++) {
      const delay = hedgeDelaysMs[i] ?? i * 3500;
      if (delay < maxTotalMs - 2000) {
        const timer = setTimeout(() => launchModel(i), delay);
        timers.push(timer);
      }
    }
  });
}

function shouldRunSearchGrounding(brief: ActivityBrief, forceEnable?: boolean): boolean {
  if (forceEnable === false) return false;
  if (forceEnable === true) return true;
  const combined = `${brief.activityName} ${brief.details} ${brief.objective}`;
  // Auto-trigger grounding only when external proper nouns, competitions, organizations, or acronyms likely appear
  return /(?:แข่งขัน|โอลิมปิก|สพฐ|สช|รางวัล|ชิงแชมป์|นานาชาติ|Cambridge|STEM|Robotics|AI|VEX|WRO|STEAM|UNESCO|UNICEF|มูลนิธิ|สมาคม|มหาวิทยาลัย|ศูนย์วิทยาศาสตร์)/i.test(
    combined
  );
}

async function runConditionalSearchGrounding(brief: ActivityBrief): Promise<string> {
  const apiKey = getGeminiApiKey();
  const queryText = sanitizeBriefForAI(`${brief.activityName}\n${brief.details}`).cleanText;
  if (queryText.trim().length < 6) return '';

  const searchPrompt = [
    'You are a concise terminology & fact verification assistant for a bilingual Thai school.',
    'Use Google Search to verify official English and Chinese proper nouns, competition names, organization names, or technical terms referenced below.',
    'Return ONLY a short bullet list of verified facts and terminology (max 120 words). Do not write a social caption.',
    '',
    `<activity_context>\n${queryText}\n</activity_context>`,
  ].join('\n');

  const groundingOrder: Array<(typeof POST_ASSISTANT_MODELS)[number]> = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
  ];
  const totalDeadline = Date.now() + 3500;

  for (let i = 0; i < groundingOrder.length; i++) {
    const model = groundingOrder[i];
    const remainingMs = totalDeadline - Date.now();
    if (remainingMs < (i === 0 ? 1000 : 1500)) break;

    const payload = buildPayloadForModel(
      {
        contents: [{ role: 'user', parts: [{ text: searchPrompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400,
          thinkingConfig: { thinkingLevel: 'LOW' },
        },
      },
      model
    );

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(remainingMs),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = extractAnswerText(data);
      if (text) return text;
    } catch {
      // Non-fatal: continue quickly without search grounding
    }
  }
  return '';
}

function formatRecentPostsContext(recentPosts: Array<Partial<SocialPostRecord>>): string {
  if (!recentPosts.length) return '';
  const items = recentPosts.slice(0, 5).map((p, idx) => {
    const title = p.activity_brief?.activityName || 'Untitled';
    const hook = p.hook_archetype || 'unknown';
    const firstEn = (p.captions?.social?.fb_en || '').split('\n')[0]?.slice(0, 120) || '';
    const firstTh = (p.captions?.social?.fb_th || '').split('\n')[0]?.slice(0, 120) || '';
    return `${idx + 1}. [${hook}] "${title}" | EN opening: "${firstEn}" | TH opening: "${firstTh}"`;
  });
  return `<recent_posts_avoid_repeating>\nDo NOT repeat the exact opening hook archetype, phrasing, or headline rhythm of these recent school posts:\n${items.join('\n')}\n</recent_posts_avoid_repeating>`;
}

function formatGoldExamplesContext(goldExamples: Array<Partial<SocialPostRecord>>): string {
  if (!goldExamples.length) return '';
  const items = goldExamples.slice(0, 2).map((p, idx) => {
    const briefName = p.activity_brief?.activityName || 'Example';
    const th = (p.captions?.social?.fb_th || '').slice(0, 500);
    const en = (p.captions?.social?.fb_en || '').slice(0, 500);
    const ig = (p.captions?.social?.ig_en || '').slice(0, 320);
    return `Gold Example ${idx + 1} (${briefName}):\n- TH: ${th}\n- EN: ${en}\n- IG: ${ig}`;
  });
  return `<school_gold_style_examples>\nMatch the voice, warmth, pacing, and editorial restraint of these approved school examples:\n${items.join('\n\n')}\n</school_gold_style_examples>`;
}

function buildMainPhotoSystemInstruction(): string {
  return `
You are the Editorial & Brand Communications Director of Somkidvittaya School (Rayong, Thailand).
Write like the communications team at a leading international/bilingual school (e.g., Bangkok Patana, Shrewsbury, UWCSEA, Harvard/Stanford IG voice).

${GRADE_RULES_PROMPT}

${ANTI_AI_SLOP_PROMPT}

[PLATFORM-NATIVE & CULTURE-NATIVE STRATEGY]
1. VISUAL-FIRST GROUNDING: First inspect the attached labeled images ([Image 0], [Image 1], ...). Extract 2-3 specific, concrete observed micro-moments (facial expressions, handcraft details, teacher mentoring moments, teamwork gestures) into "observed_micro_moments". Anchor your opening hook in what is visibly happening.
2. NARRATIVE PHOTO SEQUENCING (B-M-E):
   - Index 0 of "ordered_image_indices" MUST be the strongest emotional stopping cover photo (clear focus, expressive faces or compelling action, clean framing).
   - Indices 1-4 should establish context -> process -> collaboration/joy -> pride.
   - Keep ~80% of valid photos; ONLY exclude severely blurry, black, accidental floor shots, or near-identical duplicates.
   - Provide "cover_focal_point" { x, y } in [0.0, 1.0] centered on the main subject/faces so cover cropping never decapitates anyone.
3. HOOK ARCHETYPE SELECTION: Choose one archetype that differs from <recent_posts_avoid_repeating>:
   - micro_moment | parent_insight | paradigm_shift | process_over_product | curiosity_question | heritage_prestige
   Also generate 3 distinct "hook_alternatives" so PR staff can switch angles with 1 click.
4. COVER HEADLINE (ENGLISH ONLY):
   - "headline": UPPERCASE English, 2-5 punchy words (avoid generic "Activity", "Event", "Program").
   - "subhead": Title Case English, 3-8 words capturing the educational soul.
   - "detail": Short English date/location/level detail <= 40 chars (e.g. "Nov 26, 2026 · Prep School" or "Academic Skills · G.1–G.6").
5. FACEBOOK CAPTIONS (TH / EN / ZH — Parent Decision Engine):
   - "fb_th": 2-3 crisp paragraphs, warm & parent-centered, explain WHY this experience matters for child confidence/growth, <= 650 chars. NO contact footer, NO hashtags, NO "___" dividers.
   - "fb_en": Natural international-school copy, micro-moment hook + learning transformation + parent emotion + warm invitation, <= 650 chars. NO contact footer, NO hashtags.
   - "fb_zh": Culture-native Chinese transcreation (NOT stiff machine translation) tailored to Chinese families in Thailand/EEC (快乐成长, 国际视野, 全人教育, 自信表达). Must use "somkidvittaya学校" (lowercase s). <= 260 Chinese chars. NO contact footer, NO hashtags.
6. INSTAGRAM CAPTION (GLOBAL SCHOOL STYLE — ENGLISH ONLY):
   - "ig_en": Freshly written for Instagram (NOT truncated FB). Hook line + generous whitespace + 1-2 short evocative sentences + soft parent/community prompt + 1-3 tasteful emojis max. <= 340 chars. NO contact footer, NO hashtags.
7. WEBSITE EDITORIAL COPY (for somkidvittaya.ac.th):
   - Clean journalistic school news copy in TH, EN, and ZH ("title", "excerpt" 1-2 sentences, "body" 2-3 polished paragraphs). Zero social contact footers, zero dividers, zero hashtags.
   - "slug_en": concise lowercase kebab-case URL slug (3-6 words).
   - "category": one of academic, activity, announcement, award, admission, sports, community, competition, general.
8. HASHTAGS: 5-8 clean, non-repeating hashtags mixing brand (#Somkidvittaya #SomkidvittayaSchool) + learning/activity tags.

Never reveal internal reasoning. Output strictly valid JSON matching the schema.
`.trim();
}

function buildSubBrandSystemInstruction(brand: BrandId): string {
  const personas: Record<Exclude<BrandId, 'main'>, string> = {
    football:
      'You are the Brand Communications Lead for SV Lion Football Academy (อคาเดมี่ฟุตบอลสมคิดวิทยา). Tone: Energetic, disciplined, sporty, encouraging, focused on football technique, teamwork, resilience, and joy.',
    swimming:
      'You are the Brand Communications Lead for SV Aquatics Centre (สโมสรว่ายน้ำสมคิดวิทยา). Tone: Fresh, confident, safety-first, encouraging, focused on water safety, stroke technique, physical health, and overcoming fear.',
    tutoring:
      'You are the Brand Communications Lead for Somkid+ (ศูนย์เรียนพิเศษและพัฒนาทักษะสมคิดวิทยา). Tone: Supportive, academically clear, focused on conceptual mastery, personalized coaching, confidence, and goal achievement.',
  };

  const persona = brand === 'main' ? '' : personas[brand];
  return `
${persona}
Write engaging social media posts in THAI ONLY (except standard sport/program terms where natural).

${GRADE_RULES_PROMPT}

${ANTI_AI_SLOP_PROMPT}

Rules:
- Ground the opening hook in observed micro-moments from the attached photos (or brief if video mode).
- Explain the skill/character benefit for students without sounding like a government notice.
- Keep "fb_th" 2 short, punchy paragraphs (<= 650 chars). Do NOT include contact lines or hashtags inside "fb_th" (put 4-6 relevant Thai/brand hashtags in "hashtags").
- For Photo mode: select the strongest cover at index 0 of "ordered_image_indices" (keep ~80% of good shots, remove only severely blurry/black/duplicate frames) and provide "cover_focal_point" { x, y }.
- Also generate 3 Thai "hook_alternatives" and clean Thai website summary ("website.title.th", "website.excerpt.th", "website.body.th") in case PR cross-posts to Somkid+.

Output strictly valid JSON matching the schema.
`.trim();
}

function buildResponseSchema(brand: BrandId, mediaMode: MediaMode): Record<string, unknown> {
  const hookAltSchema = {
    type: 'OBJECT',
    properties: {
      archetype: { type: 'STRING', enum: VALID_HOOK_ARCHETYPES },
      label_th: { type: 'STRING' },
      hook_en: { type: 'STRING' },
      hook_th: { type: 'STRING' },
      hook_zh: { type: 'STRING' },
    },
    required: ['archetype', 'label_th', 'hook_th'],
  };

  if (brand === 'main') {
    const props: Record<string, unknown> = {
      observed_micro_moments: { type: 'ARRAY', items: { type: 'STRING' } },
      hook_archetype: { type: 'STRING', enum: VALID_HOOK_ARCHETYPES },
      hook_alternatives: { type: 'ARRAY', items: hookAltSchema },
      social: {
        type: 'OBJECT',
        properties: {
          fb_th: { type: 'STRING' },
          fb_en: { type: 'STRING' },
          fb_zh: { type: 'STRING' },
          ig_en: { type: 'STRING' },
          hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
          signature_en: { type: 'STRING' },
        },
        required: ['fb_th', 'fb_en', 'fb_zh', 'ig_en', 'hashtags', 'signature_en'],
      },
      website: {
        type: 'OBJECT',
        properties: {
          title: {
            type: 'OBJECT',
            properties: { th: { type: 'STRING' }, en: { type: 'STRING' }, zh: { type: 'STRING' } },
            required: ['th', 'en', 'zh'],
          },
          excerpt: {
            type: 'OBJECT',
            properties: { th: { type: 'STRING' }, en: { type: 'STRING' }, zh: { type: 'STRING' } },
            required: ['th', 'en', 'zh'],
          },
          body: {
            type: 'OBJECT',
            properties: { th: { type: 'STRING' }, en: { type: 'STRING' }, zh: { type: 'STRING' } },
            required: ['th', 'en', 'zh'],
          },
          category: { type: 'STRING', enum: VALID_CATEGORIES },
          tags: { type: 'ARRAY', items: { type: 'STRING' } },
          slug_en: { type: 'STRING' },
        },
        required: ['title', 'excerpt', 'body', 'category', 'tags', 'slug_en'],
      },
      quality: {
        type: 'OBJECT',
        properties: {
          brand: { type: 'INTEGER' },
          story: { type: 'INTEGER' },
          emotion: { type: 'INTEGER' },
          overall: { type: 'INTEGER' },
          suggestion_th: { type: 'STRING' },
        },
        required: ['brand', 'story', 'emotion', 'overall', 'suggestion_th'],
      },
    };

    const required = [
      'observed_micro_moments',
      'hook_archetype',
      'hook_alternatives',
      'social',
      'website',
      'quality',
    ];

    if (mediaMode === 'photo') {
      props.ordered_image_indices = { type: 'ARRAY', items: { type: 'INTEGER' } };
      props.cover_reason_th = { type: 'STRING' };
      props.cover_focal_point = {
        type: 'OBJECT',
        properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } },
        required: ['x', 'y'],
      };
      props.cover_headline = {
        type: 'OBJECT',
        properties: {
          headline: { type: 'STRING' },
          subhead: { type: 'STRING' },
          detail: { type: 'STRING' },
        },
        required: ['headline', 'subhead', 'detail'],
      };
      required.push('ordered_image_indices', 'cover_reason_th', 'cover_focal_point', 'cover_headline');
    }

    return { type: 'OBJECT', properties: props, required };
  }

  // Sub-brands (football, swimming, tutoring) — Thai-only lean schema
  const subProps: Record<string, unknown> = {
    observed_micro_moments: { type: 'ARRAY', items: { type: 'STRING' } },
    hook_archetype: { type: 'STRING', enum: VALID_HOOK_ARCHETYPES },
    hook_alternatives: { type: 'ARRAY', items: hookAltSchema },
    fb_th: { type: 'STRING' },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
    website_title_th: { type: 'STRING' },
    website_excerpt_th: { type: 'STRING' },
    website_body_th: { type: 'STRING' },
    category: { type: 'STRING', enum: VALID_CATEGORIES },
    quality: {
      type: 'OBJECT',
      properties: {
        brand: { type: 'INTEGER' },
        story: { type: 'INTEGER' },
        emotion: { type: 'INTEGER' },
        overall: { type: 'INTEGER' },
        suggestion_th: { type: 'STRING' },
      },
      required: ['brand', 'story', 'emotion', 'overall', 'suggestion_th'],
    },
  };
  const subReq = [
    'observed_micro_moments',
    'hook_archetype',
    'hook_alternatives',
    'fb_th',
    'hashtags',
    'website_title_th',
    'website_excerpt_th',
    'website_body_th',
    'category',
    'quality',
  ];

  if (mediaMode === 'photo') {
    subProps.ordered_image_indices = { type: 'ARRAY', items: { type: 'INTEGER' } };
    subProps.cover_reason_th = { type: 'STRING' };
    subProps.cover_focal_point = {
      type: 'OBJECT',
      properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } },
      required: ['x', 'y'],
    };
    subReq.push('ordered_image_indices', 'cover_reason_th', 'cover_focal_point');
  }

  return { type: 'OBJECT', properties: subProps, required: subReq };
}

function sanitizeAndFixAllFields(rawInput: JsonObject, brand: BrandId, mediaMode: MediaMode, imageCount: number): {
  result: Omit<AIGenerateResponse, 'model_used' | 'research_used'>;
} {
  const raw = rawInput as Record<string, unknown>;
  const warnings: string[] = [];
  const fix = (val: unknown, isZh = false): string => {
    let str = typeof val === 'string' ? val.trim() : '';
    if (isZh) str = normalizeChineseSchoolName(str);
    const { fixedText, warnings: w } = validateAndFixGradeNotation(str);
    for (const item of w) {
      if (!warnings.includes(item)) warnings.push(item);
    }
    return fixedText;
  };

  // Normalize ordered_image_indices safely (0-based, deduplicated, in range)
  let orderedIndices: number[] = [];
  if (mediaMode === 'photo' && imageCount > 0) {
    const rawIndices = Array.isArray(raw?.ordered_image_indices) ? raw.ordered_image_indices : [];
    const seen = new Set<number>();
    for (const idx of rawIndices) {
      const n = Number(idx);
      if (Number.isInteger(n) && n >= 0 && n < imageCount && !seen.has(n)) {
        seen.add(n);
        orderedIndices.push(n);
      }
    }
    if (orderedIndices.length === 0) {
      orderedIndices = Array.from({ length: imageCount }, (_, i) => i);
    }
  }

  const clamp01 = (n: unknown, fallback = 0.5): number => {
    const num = Number(n);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(1, Number(num.toFixed(3))));
  };

  const hookArchetype: HookArchetype = VALID_HOOK_ARCHETYPES.includes(raw?.hook_archetype as HookArchetype)
    ? (raw.hook_archetype as HookArchetype)
    : 'micro_moment';

  const hookAlternatives = Array.isArray(raw?.hook_alternatives)
    ? raw.hook_alternatives.slice(0, 3).map((item: unknown) => {
        const h = (item || {}) as Record<string, unknown>;
        return {
          archetype: VALID_HOOK_ARCHETYPES.includes(h?.archetype as HookArchetype)
            ? (h.archetype as HookArchetype)
            : hookArchetype,
          label_th: fix(h?.label_th) || 'มุมมองใหม่',
          hook_en: fix(h?.hook_en),
          hook_th: fix(h?.hook_th),
          hook_zh: fix(h?.hook_zh, true),
        };
      })
    : [];

  let social: SocialCaptions;
  let website: WebsiteEditorialContent;
  let coverHeadline: CoverHeadline | null = null;

  if (brand === 'main') {
    const s = (raw?.social || {}) as Record<string, unknown>;
    const w = (raw?.website || {}) as Record<string, unknown>;
    const wTitle = (w.title || {}) as Record<string, unknown>;
    const wExcerpt = (w.excerpt || {}) as Record<string, unknown>;
    const wBody = (w.body || {}) as Record<string, unknown>;
    const rawHeadline = (raw?.cover_headline || {}) as Record<string, unknown>;

    social = {
      fb_th: fix(s.fb_th),
      fb_en: fix(s.fb_en),
      fb_zh: fix(s.fb_zh, true),
      ig_en: fix(s.ig_en),
      hashtags: Array.isArray(s.hashtags)
        ? s.hashtags.map((t: unknown) => String(t || '').trim()).filter(Boolean)
        : ['#Somkidvittaya', '#SomkidvittayaSchool'],
      signature_en: fix(s.signature_en) || 'Experience creates confidence.',
    };

    const cat: PostCategory = VALID_CATEGORIES.includes(w.category as PostCategory)
      ? (w.category as PostCategory)
      : 'activity';
    website = {
      title: {
        th: fix(wTitle.th),
        en: fix(wTitle.en),
        zh: fix(wTitle.zh, true),
      },
      excerpt: {
        th: fix(wExcerpt.th),
        en: fix(wExcerpt.en),
        zh: fix(wExcerpt.zh, true),
      },
      body: {
        th: fix(wBody.th),
        en: fix(wBody.en),
        zh: fix(wBody.zh, true),
      },
      category: cat,
      tags: Array.isArray(w.tags) ? w.tags.map((t: unknown) => String(t || '').trim()).filter(Boolean) : [],
      slug_en:
        String(w.slug_en || '')
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'somkidvittaya-activity',
    };

    if (mediaMode === 'photo' && raw?.cover_headline) {
      coverHeadline = {
        headline: fix(rawHeadline.headline).toUpperCase() || 'SOMKIDVITTAYA SCHOOL',
        subhead: fix(rawHeadline.subhead) || 'Learning Beyond the Classroom',
        detail: fix(rawHeadline.detail) || 'Somkidvittaya School, Rayong',
      };
    }
  } else {
    const cat: PostCategory = VALID_CATEGORIES.includes(raw?.category as PostCategory)
      ? (raw.category as PostCategory)
      : 'activity';
    social = {
      fb_th: fix(raw?.fb_th),
      fb_en: '',
      fb_zh: '',
      ig_en: '',
      hashtags: Array.isArray(raw?.hashtags)
        ? raw.hashtags.map((t: unknown) => String(t || '').trim()).filter(Boolean)
        : [`#${BRAND_PROFILES[brand].labelEn.replace(/\s+/g, '')}`],
    };
    website = {
      title: { th: fix(raw?.website_title_th), en: '', zh: '' },
      excerpt: { th: fix(raw?.website_excerpt_th), en: '', zh: '' },
      body: { th: fix(raw?.website_body_th), en: '', zh: '' },
      category: cat,
      tags: [],
      slug_en: `${brand}-update`,
    };
  }

  const rawQuality = (raw?.quality || {}) as Record<string, unknown>;
  const rawFocal = (raw?.cover_focal_point || {}) as Record<string, unknown>;

  return {
    result: {
      observed_micro_moments: Array.isArray(raw?.observed_micro_moments)
        ? raw.observed_micro_moments.map((m: unknown) => fix(m)).filter(Boolean)
        : [],
      hook_archetype: hookArchetype,
      hook_alternatives: hookAlternatives,
      ordered_image_indices: orderedIndices,
      cover_reason_th: fix(raw?.cover_reason_th) || 'เลือกภาพที่คมชัดและสื่อสารอารมณ์ของกิจกรรมได้ดีที่สุด',
      cover_focal_point: {
        x: clamp01(rawFocal.x, 0.5),
        y: clamp01(rawFocal.y, 0.5),
      },
      cover_headline: coverHeadline,
      social,
      website,
      quality: {
        brand: Number(rawQuality.brand) || 90,
        story: Number(rawQuality.story) || 90,
        emotion: Number(rawQuality.emotion) || 90,
        overall: Number(rawQuality.overall) || 90,
        suggestion_th: fix(rawQuality.suggestion_th),
      },
      grade_warnings: warnings,
    },
  };
}

export async function generatePostWithAI(params: {
  brand: BrandId;
  mediaMode: MediaMode;
  brief: ActivityBrief;
  imagesBase64: string[];
  enableResearch?: boolean;
  recentPosts?: Array<Partial<SocialPostRecord>>;
  goldExamples?: Array<Partial<SocialPostRecord>>;
}): Promise<AIGenerateResponse> {
  const { brand, mediaMode, brief, imagesBase64 } = params;

  const cleanDetails = sanitizeBriefForAI(brief.details || '').cleanText;
  const cleanName = sanitizeBriefForAI(brief.activityName || '').cleanText;
  const cleanObjective = sanitizeBriefForAI(brief.objective || '').cleanText;
  const cleanGroup = sanitizeBriefForAI(brief.studentGroup || '').cleanText;

  const runSearch = shouldRunSearchGrounding(brief, params.enableResearch);
  const searchStartMs = Date.now();
  const verifiedFacts = runSearch ? await runConditionalSearchGrounding(brief) : '';
  const searchElapsedMs = Date.now() - searchStartMs;

  const briefXml = [
    '<activity_brief>',
    `  <brand>${BRAND_PROFILES[brand].labelEn}</brand>`,
    `  <media_mode>${mediaMode}</media_mode>`,
    `  <activity_name>${cleanName}</activity_name>`,
    brief.eventDate ? `  <event_date>${brief.eventDate}</event_date>` : '',
    cleanGroup ? `  <student_group>${cleanGroup}</student_group>` : '',
    brief.activityTypes?.length ? `  <activity_types>${brief.activityTypes.join(', ')}</activity_types>` : '',
    cleanDetails ? `  <details>\n${cleanDetails}\n  </details>` : '',
    cleanObjective ? `  <objective>${cleanObjective}</objective>` : '',
    brief.desiredHashtags ? `  <desired_hashtags>${brief.desiredHashtags}</desired_hashtags>` : '',
    `  <requested_tone>${brief.tone || 'อบอุ่น ภาคภูมิใจ เป็นกันเอง'}</requested_tone>`,
    '</activity_brief>',
  ]
    .filter(Boolean)
    .join('\n');

  const recentContext = formatRecentPostsContext(params.recentPosts || []);
  const goldContext = formatGoldExamplesContext(params.goldExamples || []);
  const factsContext = verifiedFacts
    ? `<verified_search_facts>\n${verifiedFacts}\n</verified_search_facts>`
    : '';

  const userTextPrompt = [
    briefXml,
    recentContext,
    goldContext,
    factsContext,
    mediaMode === 'photo' && imagesBase64.length > 0
      ? `Analyze the ${imagesBase64.length} labeled images below (0-based indices 0 to ${imagesBase64.length - 1}).`
      : 'No images attached (video/reels brief mode).',
  ]
    .filter(Boolean)
    .join('\n\n');

  const parts: Array<Record<string, unknown>> = [{ text: userTextPrompt }];
  imagesBase64.forEach((b64, idx) => {
    parts.push({ text: `[Image ${idx}]` });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
  });

  const systemInstruction =
    brand === 'main' ? buildMainPhotoSystemInstruction() : buildSubBrandSystemInstruction(brand);

  const { json, modelUsed } = await callGeminiWithFallback({
    maxTotalMs: Math.max(17000, 23500 - searchElapsedMs),
    payload: {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(brand, mediaMode),
        temperature: 0.6,
        topP: 0.95,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: 'LOW' },
      },
    },
  });

  const { result } = sanitizeAndFixAllFields(json, brand, mediaMode, imagesBase64.length);
  return {
    ...result,
    model_used: modelUsed,
    research_used: Boolean(verifiedFacts),
  };
}

export async function translateCaptionFromThai(params: {
  thaiText: string;
  websiteTitleTh?: string;
  websiteBodyTh?: string;
}): Promise<{
  en: string;
  zh: string;
  ig_en: string;
  website_title_en: string;
  website_title_zh: string;
  website_body_en: string;
  website_body_zh: string;
  model_used: string;
  grade_warnings: string[];
}> {
  const cleanTh = sanitizeBriefForAI(params.thaiText || '').cleanText;
  const cleanWebTitle = sanitizeBriefForAI(params.websiteTitleTh || '').cleanText;
  const cleanWebBody = sanitizeBriefForAI(params.websiteBodyTh || '').cleanText;

  const systemInstruction = `
You are the Bilingual Editorial Director of Somkidvittaya School.
Translate the edited Thai content faithfully into natural, premium English and culture-native Simplified Chinese (中文).

${GRADE_RULES_PROMPT}

RULES:
1. STRICT FIDELITY: Preserve all facts, dates, student groups, and leadership names verbatim. Never invent awards or details.
2. CHINESE TONE: Sound natural to Chinese parents in Thailand/EEC while strictly writing "somkidvittaya学校" (lowercase s).
3. IG VERSION ("ig_en"): Rewrite the English summary into a crisp Instagram-native caption (hook line, whitespace, max 340 chars, 1-2 tasteful emojis, NO contact block, NO hashtags).
4. NO EXTRAS: Do NOT add contact info, divider lines, or hashtags.

Output valid JSON matching the schema.
`.trim();

  const schema = {
    type: 'OBJECT',
    properties: {
      en: { type: 'STRING' },
      zh: { type: 'STRING' },
      ig_en: { type: 'STRING' },
      website_title_en: { type: 'STRING' },
      website_title_zh: { type: 'STRING' },
      website_body_en: { type: 'STRING' },
      website_body_zh: { type: 'STRING' },
    },
    required: [
      'en',
      'zh',
      'ig_en',
      'website_title_en',
      'website_title_zh',
      'website_body_en',
      'website_body_zh',
    ],
  };

  const userPrompt = [
    `<thai_facebook_caption>\n${cleanTh}\n</thai_facebook_caption>`,
    cleanWebTitle ? `<thai_website_title>\n${cleanWebTitle}\n</thai_website_title>` : '',
    cleanWebBody ? `<thai_website_body>\n${cleanWebBody}\n</thai_website_body>` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const { json, modelUsed } = await callGeminiWithFallback({
    timeoutMs: 10000,
    maxTotalMs: 21000,
    payload: {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.2,
        maxOutputTokens: 2500,
        thinkingConfig: { thinkingLevel: 'LOW' },
      },
    },
  });

  const warnings: string[] = [];
  const cleanField = (val: unknown, isZh = false): string => {
    let s = typeof val === 'string' ? val.trim() : '';
    if (isZh) s = normalizeChineseSchoolName(s);
    const res = validateAndFixGradeNotation(s);
    for (const w of res.warnings) if (!warnings.includes(w)) warnings.push(w);
    return res.fixedText;
  };

  return {
    en: cleanField(json?.en),
    zh: cleanField(json?.zh, true),
    ig_en: cleanField(json?.ig_en),
    website_title_en: cleanField(json?.website_title_en),
    website_title_zh: cleanField(json?.website_title_zh, true),
    website_body_en: cleanField(json?.website_body_en),
    website_body_zh: cleanField(json?.website_body_zh, true),
    model_used: modelUsed,
    grade_warnings: warnings,
  };
}

export async function refineCaptionWithAI(params: {
  brand: BrandId;
  preset: RefinePreset;
  social: SocialCaptions;
  brief: ActivityBrief;
}): Promise<{
  social: SocialCaptions;
  model_used: string;
  grade_warnings: string[];
}> {
  const presetInstructions: Record<RefinePreset, string> = {
    warm: 'Deepen emotional warmth and parent empathy ("my child would feel safe and proud here") while preserving every fact.',
    prestige: 'Elevate into an understated, prestigious international-school editorial voice (like Bangkok Patana / Shrewsbury / Oxford).',
    punchy_ig: 'Sharpen the Instagram EN caption and opening hooks so the first line stops scrolling immediately with crisp whitespace.',
    admissions: 'Weave a natural, non-pushy campus visit / admissions invitation into the closing lines across languages.',
    new_hooks: 'Keep the core story identical, but rewrite the opening hook lines across languages using a fresh micro-moment/question angle.',
  };

  const systemInstruction = `
You are refining an existing Somkidvittaya School social media draft (${BRAND_PROFILES[params.brand].labelEn}).
GOAL: ${presetInstructions[params.preset]}

${GRADE_RULES_PROMPT}

${ANTI_AI_SLOP_PROMPT}

Keep all facts accurate. Do NOT add contact blocks or divider lines.
${params.brand !== 'main' ? 'This is a Thai-only sub-brand: only populate "fb_th" and "hashtags"; leave fb_en, fb_zh, ig_en as empty strings.' : ''}
`.trim();

  const schema = {
    type: 'OBJECT',
    properties: {
      fb_th: { type: 'STRING' },
      fb_en: { type: 'STRING' },
      fb_zh: { type: 'STRING' },
      ig_en: { type: 'STRING' },
      hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
      signature_en: { type: 'STRING' },
    },
    required: ['fb_th', 'fb_en', 'fb_zh', 'ig_en', 'hashtags'],
  };

  const { json, modelUsed } = await callGeminiWithFallback({
    timeoutMs: 10000,
    maxTotalMs: 21000,
    payload: {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `<activity_name>${sanitizeBriefForAI(params.brief.activityName).cleanText}</activity_name>\n<current_captions>\n${JSON.stringify(params.social, null, 2)}\n</current_captions>`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.45,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: 'LOW' },
      },
    },
  });

  const warnings: string[] = [];
  const cleanField = (val: unknown, isZh = false): string => {
    let s = typeof val === 'string' ? val.trim() : '';
    if (isZh) s = normalizeChineseSchoolName(s);
    const res = validateAndFixGradeNotation(s);
    for (const w of res.warnings) if (!warnings.includes(w)) warnings.push(w);
    return res.fixedText;
  };

  const refined: SocialCaptions = {
    fb_th: cleanField(json?.fb_th) || params.social.fb_th,
    fb_en: params.brand === 'main' ? cleanField(json?.fb_en) || params.social.fb_en : '',
    fb_zh: params.brand === 'main' ? cleanField(json?.fb_zh, true) || params.social.fb_zh : '',
    ig_en: params.brand === 'main' ? cleanField(json?.ig_en) || params.social.ig_en : '',
    hashtags: Array.isArray(json?.hashtags) && json.hashtags.length
      ? json.hashtags.map((h: unknown) => String(h || '').trim()).filter(Boolean)
      : params.social.hashtags,
    signature_en: cleanField(json?.signature_en) || params.social.signature_en,
  };

  return { social: refined, model_used: modelUsed, grade_warnings: warnings };
}
