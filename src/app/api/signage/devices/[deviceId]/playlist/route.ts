import { NextResponse } from 'next/server';
import { resolvePlaylistForDevice } from '@/lib/signage/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'Device ID is required' }, { status: 400 });
    }

    const playlist = await resolvePlaylistForDevice(deviceId);
    return NextResponse.json({ success: true, data: playlist });
  } catch (err: any) {
    console.error('Playlist resolve error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
