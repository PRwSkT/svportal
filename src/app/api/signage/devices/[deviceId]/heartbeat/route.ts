import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const body = await request.json().catch(() => ({}));
    const { current_media_id, free_storage_mb, app_version, ip_address, current_fps, dropped_frames } = body;

    const supabase = getAdminClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('signage_devices')
      .select('id')
      .eq('id', deviceId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('signage_devices').insert({
        id: deviceId,
        name: `TV (${deviceId})`,
        ip_address: ip_address || null,
        app_version: app_version || '1.0.0',
        status: 'ONLINE',
        last_heartbeat: now,
        current_media_id: current_media_id || null,
        free_storage_mb: free_storage_mb || 0,
        current_fps: current_fps || 60,
        dropped_frames: dropped_frames || 0,
      });
    } else {
      await supabase
        .from('signage_devices')
        .update({
          status: 'ONLINE',
          last_heartbeat: now,
          current_media_id: current_media_id !== undefined ? current_media_id : undefined,
          free_storage_mb: free_storage_mb !== undefined ? free_storage_mb : undefined,
          app_version: app_version !== undefined ? app_version : undefined,
          ip_address: ip_address !== undefined ? ip_address : undefined,
          current_fps: current_fps !== undefined ? current_fps : undefined,
          dropped_frames: dropped_frames !== undefined ? dropped_frames : undefined,
        })
        .eq('id', deviceId);
    }

    return NextResponse.json({ success: true, message: 'Heartbeat acknowledged', timestamp: now });
  } catch (err: any) {
    console.error('Heartbeat error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
