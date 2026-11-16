import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type FeeItemStatus = 'unpaid' | 'paid' | 'waived';

function normalizeFeeItemStatus(rawStatus: unknown): FeeItemStatus {
  const normalized = String(rawStatus ?? '').trim().toLowerCase();
  if (normalized === 'paid') return 'paid';
  if (normalized === 'waived' || normalized === 'cancelled' || normalized === 'canceled') {
    return 'waived';
  }
  // Map 'pending', 'unpaid', or unknown/empty statuses to 'unpaid'
  return 'unpaid';
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const webhookSecret = process.env.SVPORTAL_WEBHOOK_SECRET;
    if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const event = payload.event;
    const data = payload.data;

    if (!event || !data) {
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    switch (event) {
      case 'student.updated': {
        const { error: studentError } = await supabase.from('students').upsert({
          id: data.id,
          name: data.name,
          grade: data.grade,
          status: data.status || 'กำลังศึกษาอยู่',
          updated_at: nowIso,
        });
        if (studentError) {
          throw new Error(`Failed to upsert student: ${studentError.message}`);
        }
        break;
      }

      case 'fee_type.created': {
        const { error: feeTypeError } = await supabase.from('fee_types').upsert({
          id: data.id,
          name: data.name,
          amount: data.amount,
          academic_year: data.academic_year ?? undefined,
          semester: data.semester ?? undefined,
          due_date: data.due_date ?? undefined,
          is_active: data.is_active !== undefined ? data.is_active : true,
          created_at: data.created_at || nowIso,
        });
        if (feeTypeError) {
          throw new Error(`Failed to upsert fee_type: ${feeTypeError.message}`);
        }
        break;
      }

      case 'fee.assigned': {
        let resolvedAmount =
          data.amount !== undefined && data.amount !== null && data.amount !== ''
            ? Number(data.amount)
            : NaN;

        if (!Number.isFinite(resolvedAmount)) {
          if (!data.fee_type_id) {
            return NextResponse.json(
              { error: 'Missing amount and fee_type_id for fee.assigned' },
              { status: 400 }
            );
          }
          const { data: feeType, error: lookupError } = await supabase
            .from('fee_types')
            .select('amount')
            .eq('id', data.fee_type_id)
            .maybeSingle();

          if (lookupError) {
            throw new Error(`Failed to look up fee_type amount: ${lookupError.message}`);
          }
          if (!feeType || feeType.amount === null || feeType.amount === undefined) {
            return NextResponse.json(
              { error: 'Unable to resolve fee item amount from payload or fee_types' },
              { status: 400 }
            );
          }
          resolvedAmount = Number(feeType.amount);
        }

        const { error: feeItemError } = await supabase.from('fee_items').upsert({
          id: data.id,
          student_id: data.student_id,
          fee_type_id: data.fee_type_id,
          amount: resolvedAmount,
          status: normalizeFeeItemStatus(data.status),
          svportal_ref: data.svportal_ref || null,
          created_at: data.created_at || nowIso,
          updated_at: nowIso,
        });
        if (feeItemError) {
          throw new Error(`Failed to upsert fee_item: ${feeItemError.message}`);
        }
        break;
      }

      default:
        console.log('Unhandled webhook event:', event);
    }

    return NextResponse.json({ success: true, event });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Webhook error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
