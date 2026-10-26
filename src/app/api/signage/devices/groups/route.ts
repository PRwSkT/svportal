import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data: groups, error } = await supabase
      .from('signage_groups')
      .select('*, devices:signage_devices(id)')
      .order('name', { ascending: true });

    if (error) throw error;

    const result = (groups || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      device_count: g.devices ? g.devices.length : 0,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description } = body;

    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุรหัสโซนและชื่อโซน' }, { status: 400 });
    }

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const supabase = getAdminClient();

    const { data: existing } = await supabase
      .from('signage_groups')
      .select('id')
      .eq('id', cleanId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: 'รหัสโซนนี้มีอยู่แล้วในระบบ' }, { status: 400 });
    }

    const { data: created, error } = await supabase
      .from('signage_groups')
      .insert({
        id: cleanId,
        name: name.trim(),
        description: description ? description.trim() : '',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: created });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
