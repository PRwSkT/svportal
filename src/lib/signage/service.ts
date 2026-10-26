import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function resolvePlaylistForDevice(deviceId: string) {
  const supabase = getAdminClient();

  // 1. Fetch device
  let { data: device } = await supabase
    .from('signage_devices')
    .select('*')
    .eq('id', deviceId)
    .maybeSingle();

  if (!device) {
    // Auto-register device
    const { data: newDev } = await supabase
      .from('signage_devices')
      .insert({
        id: deviceId,
        name: `TV เครื่องใหม่ (${deviceId})`,
        status: 'ONLINE',
        last_heartbeat: new Date().toISOString(),
        orientation: 'PORTRAIT_90',
        volume: 20,
      })
      .select()
      .single();
    device = newDev;
  }

  const deviceGroupId = device?.group_id;

  // 2. Fetch active campaigns
  const { data: campaigns } = await supabase
    .from('signage_campaigns')
    .select(`
      *,
      campaign_media:signage_campaign_media (
        sort_order,
        media:signage_media (*)
      )
    `)
    .eq('is_active', 1)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  const activeCampaigns = campaigns || [];

  // 3. Filter campaigns that match device
  const matchedCampaigns = activeCampaigns.filter(campaign => {
    let targetIds: string[] = [];
    try {
      targetIds = typeof campaign.target_ids === 'string'
        ? JSON.parse(campaign.target_ids)
        : (campaign.target_ids || []);
    } catch {
      targetIds = [];
    }

    if (campaign.target_type === 'ALL') return true;
    if (campaign.target_type === 'GROUP') {
      return deviceGroupId && targetIds.includes(deviceGroupId);
    }
    if (campaign.target_type === 'SPECIFIC') {
      return targetIds.includes(deviceId);
    }
    return false;
  });

  // 4. Gather media items
  const mediaList: any[] = [];
  for (const c of matchedCampaigns) {
    const cms = (c.campaign_media as any[]) || [];
    cms.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    for (const cm of cms) {
      if (cm.media) {
        mediaList.push({
          id: cm.media.id,
          title: cm.media.title,
          type: cm.media.type,
          url: cm.media.file_url,
          checksum_sha256: cm.media.checksum_sha256,
          duration_seconds: cm.media.duration_seconds,
          campaign: c.name,
        });
      }
    }
  }

  // 5. Ticker text
  let tickerText = 'ยินดีต้อนรับสู่โรงเรียนสมคิดวิทยา (Somkidvittaya School) • ระบบสื่อประชาสัมพันธ์ภายในองค์กร SV Portal Signage Suite • ติดต่อสอบถามแผนกธุรการ';
  const { data: tickerRow } = await supabase
    .from('signage_settings')
    .select('value')
    .eq('key', 'ticker_text')
    .maybeSingle();
  if (tickerRow?.value) {
    tickerText = tickerRow.value;
  }

  const orientation = device?.orientation || 'PORTRAIT_90';
  const isMuted = device?.is_muted === 1;
  const volume = device?.volume !== undefined && device?.volume !== null ? device.volume : 20;

  const versionString = `${orientation}|${isMuted}|${volume}|${tickerText}|` + mediaList.map(m => `${m.id}-${m.duration_seconds}-${m.url}`).join('|');
  const versionHash = crypto.createHash('md5').update(versionString || 'empty').digest('hex');

  return {
    device_id: device?.id || deviceId,
    device_name: device?.name || `TV (${deviceId})`,
    group_id: device?.group_id || null,
    orientation: orientation,
    is_muted: isMuted,
    volume: volume,
    ticker_text: tickerText,
    version: versionHash,
    generated_at: new Date().toISOString(),
    total_items: mediaList.length,
    items: mediaList
  };
}
