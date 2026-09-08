import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { cart, paymentMethod, studentId } = body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'ตะกร้าสินค้าว่างเปล่า' }, { status: 400 });
    }

    if (!['cash', 'wallet'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'รูปแบบการชำระเงินไม่ถูกต้อง' }, { status: 400 });
    }

    for (const item of cart) {
      const qty = Number(item.quantity);
      if (!item.product?.id || isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: 'ข้อมูลสินค้าในตะกร้าไม่ถูกต้อง' }, { status: 400 });
      }
    }

    const totalAmount = cart.reduce((sum: number, item: any) => sum + (Number(item.subtotal) || (Number(item.product?.price || 0) * Number(item.quantity))), 0);
    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'ยอดรวมต้องมากกว่า 0 บาท' }, { status: 400 });
    }

    const transactionId = crypto.randomUUID();
    const supabase = await createClient();

    if (paymentMethod === 'wallet' && !studentId) {
      return NextResponse.json({ error: 'INSUFFICIENT_WALLET' }, { status: 400 });
    }

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
