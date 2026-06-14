import { NextResponse } from 'next/server';
import { appendTransactionRow } from '@/lib/google/backup';
import { GoogleBackupPayload } from '@/types';

export async function POST(request: Request) {
  try {
    const payload: GoogleBackupPayload = await request.json();

    if (!payload.transaction_id) {
      return NextResponse.json({ error: 'Missing transaction_id' }, { status: 400 });
    }

    // Google Sheets backup — appendTransactionRow is idempotent
    await appendTransactionRow(payload);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Wallet backup API error:', err.message);
    return NextResponse.json({ error: err.message || 'Backup failed' }, { status: 500 });
  }
}
