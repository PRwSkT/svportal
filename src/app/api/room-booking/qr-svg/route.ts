import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || 'https://sv-portal.somkidvittaya.ac.th/room-checkin?room=LLC';

    const svgString = await QRCode.toString(text, {
      type: 'svg',
      margin: 2,
      width: 280,
      color: {
        dark: '#1A1A1A',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });

    return new NextResponse(svgString, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'QR error' }, { status: 500 });
  }
}
