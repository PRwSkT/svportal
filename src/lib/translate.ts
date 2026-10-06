/**
 * Translation service for Somkidvittaya School forms and content
 * Translates Thai or English text to English and Chinese (Simplified)
 */

async function translateSingle(text: string, targetLang: 'en' | 'zh'): Promise<string> {
  const trimmed = text?.trim();
  if (!trimmed) return '';

  const targetCode = targetLang === 'zh' ? 'zh-CN' : 'en';
  const isThai = /[\u0E00-\u0E7F]/.test(trimmed);
  const sourceLang = isThai ? 'th' : 'en';

  // If source is already English and target is English, return original
  if (!isThai && targetLang === 'en') {
    return trimmed;
  }

  // 1. Try Gemini API if key is available (Primary: gemini-3.5-flash-lite)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const prompt = `You are a professional educational translator for Somkidvittaya School.
Translate the following text to ${targetLang === 'zh' ? 'Simplified Chinese (中文)' : 'Professional English'}.
Keep tone formal, friendly, clear, and suitable for school forms and announcements.
Return ONLY the translation without any quotes or explanations.

Text:
${trimmed}`;

      for (const model of [
        'gemini-3.5-flash-lite',
        'gemma-4-31b-it',
        'gemma-4-26b-a4b-it',
        'gemini-3.1-flash-lite',
        'gemini-1.5-flash',
      ]) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
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
          // Continue to next model if this one fails
        }
      }
    } catch {
      // Fall through to next provider
    }
  }

  // 2. High-reliability MyMemory Translation API (fast, reliable JSON, no CAPTCHA)
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${sourceLang}|${targetCode}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (translated && !translated.startsWith('MYMEMORY WARNING')) {
        return translated.trim();
      }
    }
  } catch (err) {
    console.warn(`[Translate MyMemory] Error translating to ${targetLang}:`, err);
  }

  // 3. Fallback to Google Neural Machine Translation Endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetCode}&dt=t&q=${encodeURIComponent(
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
      const text = await res.text();
      if (text.startsWith('[') || text.startsWith('{')) {
        const data = JSON.parse(text);
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedParts = data[0].map((part: any) => part[0]).filter(Boolean);
          if (translatedParts.length > 0) {
            return translatedParts.join('').trim();
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Translate Google] Error translating to ${targetLang}:`, err);
  }

  // Fallback to original
  return trimmed;
}

/**
 * Translates a text to both English and Chinese in parallel
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
