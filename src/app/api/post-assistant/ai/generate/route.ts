import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { generatePostWithAI } from '@/lib/post-assistant/ai-service';
import { getErrorMessage, isValidUuid, requirePostAssistantAuth } from '@/lib/post-assistant/api-helpers';
import { BrandId, SocialPostRecord } from '@/lib/post-assistant/types';

export async function POST(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const brand: BrandId = ['main', 'football', 'swimming', 'tutoring'].includes(body?.brand)
      ? body.brand
      : 'main';
    const mediaMode = body?.mediaMode === 'video' ? 'video' : 'photo';
    const brief = body?.brief;
    const imagesBase64: string[] = Array.isArray(body?.imagesBase64) ? body.imagesBase64.slice(0, 25) : [];
    const enableResearch = typeof body?.enableResearch === 'boolean' ? body.enableResearch : undefined;
    const draftId = isValidUuid(body?.draftId) ? body.draftId : null;

    if (!brief || typeof brief.activityName !== 'string' || !brief.activityName.trim()) {
      return NextResponse.json({ error: 'Activity name is required' }, { status: 400 });
    }

    // Fetch anti-repetition history & Gold Examples gracefully (never fail if pre-DDL)
    let recentPosts: Array<Partial<SocialPostRecord>> = [];
    let goldExamples: Array<Partial<SocialPostRecord>> = [];
    try {
      const admin = getAdminClient();
      const [recentRes, goldRes] = await Promise.all([
        admin
          .from('social_posts')
          .select('activity_brief, hook_archetype, captions')
          .eq('brand', brand)
          .in('status', ['published', 'scheduled', 'draft'])
          .order('created_at', { ascending: false })
          .limit(5),
        admin
          .from('social_posts')
          .select('activity_brief, captions, category')
          .eq('brand', brand)
          .eq('is_gold_example', true)
          .order('updated_at', { ascending: false })
          .limit(2),
      ]);
      if (!recentRes.error && Array.isArray(recentRes.data)) {
        recentPosts = recentRes.data as Array<Partial<SocialPostRecord>>;
      }
      if (!goldRes.error && Array.isArray(goldRes.data)) {
        goldExamples = goldRes.data as Array<Partial<SocialPostRecord>>;
      }
    } catch {
      // Graceful fallback before migration is applied
    }

    const result = await generatePostWithAI({
      brand,
      mediaMode,
      brief,
      imagesBase64,
      enableResearch,
      recentPosts,
      goldExamples,
    });

    // Persist AI snapshot to draft if draftId exists (best-effort)
    if (draftId) {
      try {
        const admin = getAdminClient();
        await admin
          .from('social_posts')
          .update({
            activity_brief: brief,
            cover_headline: result.cover_headline,
            ai_draft_captions: {
              social: result.social,
              website: result.website,
              hook_alternatives: result.hook_alternatives,
              observed_micro_moments: result.observed_micro_moments,
              cover_reason_th: result.cover_reason_th,
              quality: result.quality,
            },
            captions: {
              social: result.social,
              website: result.website,
              hook_alternatives: result.hook_alternatives,
              observed_micro_moments: result.observed_micro_moments,
              cover_reason_th: result.cover_reason_th,
              quality: result.quality,
              grade_warnings: result.grade_warnings,
            },
            hook_archetype: result.hook_archetype,
            category: result.website.category,
            updated_by: auth.user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId);
      } catch {
        // Non-fatal if pre-DDL
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    console.error('[PostAssistant AI Generate]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'AI generation failed') }, { status: 500 });
  }
}
