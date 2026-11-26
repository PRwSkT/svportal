import { NextResponse } from 'next/server';
import { checkMetaHealth } from '@/lib/post-assistant/meta-client';
import { requirePostAssistantAuth } from '@/lib/post-assistant/api-helpers';

export async function GET() {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  const health = await checkMetaHealth();
  return NextResponse.json({ success: true, data: health });
}
