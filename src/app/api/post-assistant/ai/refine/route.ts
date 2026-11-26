import { NextResponse } from 'next/server';
import { refineCaptionWithAI } from '@/lib/post-assistant/ai-service';
import { getErrorMessage, requirePostAssistantAuth } from '@/lib/post-assistant/api-helpers';
import { BrandId, RefinePreset } from '@/lib/post-assistant/types';

const VALID_PRESETS: RefinePreset[] = ['warm', 'prestige', 'punchy_ig', 'admissions', 'new_hooks'];

export async function POST(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const brand: BrandId = ['main', 'football', 'swimming', 'tutoring'].includes(body?.brand)
      ? body.brand
      : 'main';
    const preset: RefinePreset = VALID_PRESETS.includes(body?.preset) ? body.preset : 'warm';
    const social = body?.social;
    const brief = body?.brief;

    if (!social || typeof social.fb_th !== 'string') {
      return NextResponse.json({ error: 'Current social captions are required' }, { status: 400 });
    }

    const result = await refineCaptionWithAI({
      brand,
      preset,
      social,
      brief: brief || { activityName: '' },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    console.error('[PostAssistant AI Refine]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Caption refinement failed') }, { status: 500 });
  }
}
