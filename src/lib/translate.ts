/**
 * Translation service for Somkidvittaya School forms and content
 * Translates Thai or English text to English and Chinese (Simplified)
 */

function cleanTranslationResult(text: string, targetLang: 'en' | 'zh'): string {
  let result = (text || '').trim();
  if (targetLang === 'zh') {
    result = result
      .replace(/松吉威提雅学校/g, 'Somkidvittaya学校')
      .replace(/松吉学校/g, 'Somkidvittaya学校')
      .replace(/森吉威提雅学校/g, 'Somkidvittaya学校')
      .replace(/森吉学校/g, 'Somkidvittaya学校');
  }
  return result;
}

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

  // 1. Try Gemini API if key is available (Primary: gemini-2.5-flash-lite)
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const prompt = `You are a professional educational translator for Somkidvittaya School.
Translate the following text to ${targetLang === 'zh' ? 'Simplified Chinese (中文)' : 'Professional English'}.
Keep tone formal, friendly, clear, and suitable for school forms and announcements.
${targetLang === 'zh' ? 'IMPORTANT: When translating or mentioning the school name "โรงเรียนสมคิดวิทยา" into Chinese, ALWAYS use "Somkidvittaya学校" exactly (do NOT transliterate as 松吉 or 森吉).' : ''}
Return ONLY the translation without any quotes or explanations.

Text:
${trimmed}`;

      for (const model of [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash-lite',
        'gemma-4-26b-a4b-it',
        'gemma-4-31b-it',
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
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const answerPart = parts.find((p: any) => !p.thought) || parts[parts.length - 1];
            const translated = answerPart?.text?.trim();
            if (translated) return cleanTranslationResult(translated, targetLang);
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
        return cleanTranslationResult(translated, targetLang);
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
            return cleanTranslationResult(translatedParts.join(''), targetLang);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Translate Google] Error translating to ${targetLang}:`, err);
  }

  // Fallback to original
  return cleanTranslationResult(trimmed, targetLang);
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
