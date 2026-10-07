import { NextResponse } from 'next/server';
import { uploadReceiptPDF, appendTransactionRow } from '@/lib/google/backup';
import { createClient } from '@/lib/supabase/server';
import { GoogleBackupPayload } from '@/types';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth('cashier', 'pos_fees');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { payment_id, receipt_number, student_id, total_amount, base64Image } = await request.json();

    if (!payment_id || !base64Image) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify that payment record actually exists in database
    const supabase = await createClient();
    const { data: paymentRecord, error: fetchErr } = await supabase
      .from('tuition_payments')
      .select('id, student_id, receipt_number, total_amount')
      .eq('id', payment_id)
      .single();

    if (fetchErr || !paymentRecord) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรายการชำระเงินในระบบ' }, { status: 404 });
    }

    // 2. Upload base64 image to Google Drive as image/receipt
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const verifiedReceiptNo = paymentRecord.receipt_number || receipt_number;
    const slip_url = await uploadReceiptPDF(buffer, `${verifiedReceiptNo}.png`);

    // 3. Update tuition_payment record with slip_url
    const { error: updateErr } = await supabase
      .from('tuition_payments')
      .update({ slip_url })
      .eq('id', payment_id);

    if (updateErr) {
      console.error('Failed to update slip_url in DB:', updateErr);
    }

    // 4. Append to Google Sheets with database-verified amounts and IDs
    const payload: GoogleBackupPayload = {
      transaction_id: paymentRecord.id,
      timestamp: new Date().toISOString(),
      student_id: paymentRecord.student_id,
      transaction_type: 'tuition_payment',
      amount: Number(paymentRecord.total_amount),
      description: `Tuition Payment Receipt: ${verifiedReceiptNo}`,
      receipt_url: slip_url,
    };

    await appendTransactionRow(payload);

    return NextResponse.json({ success: true, slip_url });
  } catch (error: any) {
    console.error('Receipt API Route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
