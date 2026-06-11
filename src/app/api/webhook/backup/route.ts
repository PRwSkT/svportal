import { NextResponse } from 'next/server';
import { appendTransactionRow } from '@/lib/google/backup';
import { GoogleBackupPayload } from '@/types';

export async function POST(request: Request) {
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  
  // Try to get auth header from standard Authorization or custom x-webhook-secret
  const authHeader = request.headers.get('authorization') || request.headers.get('x-webhook-secret');
  
  if (webhookSecret && authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Supabase webhook payload structure
    const record = body.record;
    
    if (!record || !record.id) {
       return NextResponse.json({ error: 'Bad payload: missing record or record.id' }, { status: 400 });
    }

    const payload: GoogleBackupPayload = {
      transaction_id: record.id,
      timestamp: record.created_at || new Date().toISOString(),
      student_id: record.student_id,
      transaction_type: record.transaction_type,
      amount: record.amount, // stored in satang/decimal
      description: record.description || `${record.transaction_type} transaction`,
    };

    // Google backup logic is idempotent and handles its own rate limiting quietly
    await appendTransactionRow(payload);

    return NextResponse.json({ message: 'Backup processing successful' }, { status: 200 });
  } catch (error) {
    console.error('Backup API Route error:', error);
    return NextResponse.json({ error: 'Google API failure or internal error' }, { status: 500 });
  }
}
