import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data: devices, error } = await supabase
      .from('signage_devices')
      .select('*, group:signage_groups(name)')
      .order('name', { ascending: true });

    if (error) throw error;

    const now = Date.now();
    const result = (devices || []).map((d: any) => {
      let isOnline = false;
      if (d.last_heartbeat) {
        const last = new Date(d.last_heartbeat).getTime();
        isOnline = (now - last) <= (2 * 60 * 1000);
      }
      return {
        ...d,
        group_name: d.group?.name || null,
        computed_status: isOnline ? 'ONLINE' : 'OFFLINE',
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
    const { id, name, group_id, orientation, is_muted, volume } = body;

    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'Device ID and Name are required' }, { status: 400 });
    }

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const supabase = getAdminClient();

    const { data: existing } = await supabase
      .from('signage_devices')
      .select('id')
      .eq('id', cleanId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Device ID already exists' }, { status: 400 });
    }

    const { data: created, error } = await supabase
      .from('signage_devices')
      .insert({
        id: cleanId,
        name: name.trim(),
        group_id: group_id || null,
        orientation: orientation || 'PORTRAIT_90',
        is_muted: is_muted ? 1 : 0,
        volume: volume !== undefined ? parseInt(volume) : 20,
        status: 'OFFLINE',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: created });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
