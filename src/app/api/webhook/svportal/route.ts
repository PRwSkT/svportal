import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    // For production, ensure this secret is set
    if (process.env.SVPORTAL_WEBHOOK_SECRET && authHeader !== `Bearer ${process.env.SVPORTAL_WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const event = payload.event;
    const data = payload.data;

    if (!event || !data) {
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const supabase = await createClient();

    switch (event) {
      case 'student.updated':
        // Upsert student info
        await supabase.from('students').upsert({
          id: data.id,
          name: data.name,
          grade: data.grade,
          status: data.status || 'active',
          updated_at: new Date().toISOString()
        });
        break;
      
      case 'fee_type.created':
        await supabase.from('fee_types').upsert({
          id: data.id,
          name: data.name,
          amount: data.amount,
          is_active: data.is_active !== undefined ? data.is_active : true,
          created_at: data.created_at || new Date().toISOString()
        });
        break;

      case 'fee.assigned':
        // SVPortal assigned a new fee to a student
        await supabase.from('student_fees').upsert({
          id: data.id, 
          student_id: data.student_id,
          fee_type_id: data.fee_type_id,
          status: data.status || 'pending',
          due_date: data.due_date,
          created_at: data.created_at || new Date().toISOString()
        });
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
