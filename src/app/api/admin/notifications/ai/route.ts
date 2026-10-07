import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  draftNotificationWithNongFah,
  scanSystemRemindersWithNongFah,
} from '@/lib/notifications/nongfah-ai';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth('admin');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { action = 'draft', prompt, targetRole, contextCategory, urgency, destinationUrl } = body;

    if (action === 'scan-reminders') {
      const reminders = await scanSystemRemindersWithNongFah();
      return NextResponse.json({
        success: true,
        reminders,
        count: reminders.length,
      });
    }

    if (action === 'draft') {
      if (!prompt) {
        return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
      }

      const draft = await draftNotificationWithNongFah({
        userPrompt: prompt,
        targetRole,
        contextCategory,
        urgency,
        destinationUrl,
      });

      return NextResponse.json({
        success: true,
        draft,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[NongFah AI Notification API] Error:', err);
    return NextResponse.json({ error: err.message || 'AI processing error' }, { status: 500 });
  }
}
