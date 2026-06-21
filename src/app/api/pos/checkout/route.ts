import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { cart, paymentMethod, studentId } = body;
    const totalAmount = cart.reduce((sum: number, item: any) => sum + item.subtotal, 0);

    const transactionId = crypto.randomUUID();
    const supabase = await createClient();

    if (paymentMethod === 'wallet') {
      if (!studentId) return NextResponse.json({ error: 'INSUFFICIENT_WALLET' }, { status: 400 });

      // Call deduct_wallet_balance directly
      const payload = {
        student_id: studentId,
        amount: totalAmount,
        reference_id: transactionId,
      };
      const { data: deductData, error: deductErr } = await supabase.rpc('deduct_wallet_balance', { payload });
      if (deductErr) throw new Error(deductErr.message);

      // Save shop transaction via RPC
      const shopPayload = {
        id: transactionId,
        student_id: studentId,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        cashier_note: null,
        items: cart,
      };
      const { error: shopErr } = await supabase.rpc('checkout_shop_transaction', { payload: shopPayload });
      if (shopErr) throw shopErr;

    } else {
      // Cash payment
      const shopPayload = {
        id: transactionId,
        student_id: studentId || null,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        cashier_note: null,
        items: cart,
      };
      const { error: shopErr } = await supabase.rpc('checkout_shop_transaction', { payload: shopPayload });
      if (shopErr) throw shopErr;
    }

    return NextResponse.json({
      id: transactionId,
      student_id: studentId || null,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      cashier_note: null,
      items: cart,
      created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
