import { NextResponse } from 'next/server';
import { translateCaptionFromThai } from '@/lib/post-assistant/ai-service';
import { getErrorMessage, requirePostAssistantAuth } from '@/lib/post-assistant/api-helpers';

export async function POST(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const thaiText = typeof body?.thaiText === 'string' ? body.thaiText.trim() : '';
    if (!thaiText) {
      return NextResponse.json({ error: 'thaiText is required' }, { status: 400 });
    }

    const result = await translateCaptionFromThai({
      thaiText,
      websiteTitleTh: typeof body?.websiteTitleTh === 'string' ? body.websiteTitleTh : undefined,
      websiteBodyTh: typeof body?.websiteBodyTh === 'string' ? body.websiteBodyTh : undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    console.error('[PostAssistant AI Translate]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Translation failed') }, { status: 500 });
  }
}
