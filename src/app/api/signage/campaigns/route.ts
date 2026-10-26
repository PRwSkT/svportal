import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data: campaigns, error } = await supabase
      .from('signage_campaigns')
      .select(`
        *,
        campaign_media:signage_campaign_media (
          sort_order,
          media:signage_media (*)
        )
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (campaigns || []).map((c: any) => {
      let targets = [];
      try {
        targets = typeof c.target_ids === 'string' ? JSON.parse(c.target_ids) : (c.target_ids || []);
      } catch {
        targets = [];
      }

      const mediaItems = (c.campaign_media || [])
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((cm: any) => ({
          ...cm.media,
          sort_order: cm.sort_order,
        }))
        .filter((m: any) => !!m.id);

      return {
        ...c,
        target_ids: targets,
        media: mediaItems,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, target_type, target_ids, priority, media_ids } = body;

    if (!name || !target_type) {
      return NextResponse.json({ success: false, error: 'Name and Target Type are required' }, { status: 400 });
    }

    if (!['ALL', 'GROUP', 'SPECIFIC'].includes(target_type)) {
      return NextResponse.json({ success: false, error: 'Target type must be ALL, GROUP, or SPECIFIC' }, { status: 400 });
    }

    const campaignId = 'cmp_' + crypto.randomBytes(4).toString('hex');
    const supabase = getAdminClient();

    const { error: campErr } = await supabase.from('signage_campaigns').insert({
      id: campaignId,
      name: name.trim(),
      target_type,
      target_ids: Array.isArray(target_ids) ? target_ids : [],
      priority: parseInt(priority) || 0,
      is_active: 1,
    });

    if (campErr) throw campErr;

    if (Array.isArray(media_ids) && media_ids.length > 0) {
      const mediaInserts = media_ids.map((mediaId: string, idx: number) => ({
        id: 'cm_' + crypto.randomBytes(4).toString('hex'),
        campaign_id: campaignId,
        media_id: mediaId,
        sort_order: idx,
      }));

      const { error: mErr } = await supabase.from('signage_campaign_media').insert(mediaInserts);
      if (mErr) throw mErr;
    }

    return NextResponse.json({ success: true, message: 'Campaign created', campaign_id: campaignId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
