/**
 * Translation service for Somkidvittaya School forms and content
 * Translates Thai text to English and Chinese (Simplified)
 */

async function translateSingle(text: string, targetLang: 'en' | 'zh'): Promise<string> {
  const trimmed = text?.trim();
  if (!trimmed) return '';

  const targetCode = targetLang === 'zh' ? 'zh-CN' : 'en';

  // 1. Try Gemini API if key is available
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const prompt = `You are a professional educational translator for Somkidvittaya School.
Translate the following Thai text to ${targetLang === 'zh' ? 'Simplified Chinese (中文)' : 'Professional English'}.
Keep tone formal, friendly, clear, and suitable for school forms and announcements.
Return ONLY the translation without any quotes or explanations.

Text:
${trimmed}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(6000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (translated) return translated;
      }
    } catch {
      // Fall through to Google Translate
    }
  }

  // 2. Google Neural Machine Translation Endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=${targetCode}&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translatedParts = data[0].map((part: any) => part[0]).filter(Boolean);
        if (translatedParts.length > 0) {
          return translatedParts.join('').trim();
        }
      }
    }
  } catch (err) {
    console.warn(`[Translate] Error translating to ${targetLang}:`, err);
  }

  // Fallback to original
  return trimmed;
}

/**
 * Translates a Thai text to both English and Chinese
 */
export async function translateThaiToEnZh(text: string): Promise<{ en: string; zh: string }> {
  if (!text || !text.trim()) {
    return { en: '', zh: '' };
  }

  const [en, zh] = await Promise.all([
    translateSingle(text, 'en'),
    translateSingle(text, 'zh'),
  ]);

  return { en, zh };
}
