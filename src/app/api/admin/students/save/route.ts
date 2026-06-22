import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { studentData, isNew, addresses, parents } = body;

    const supabase = await createClient();

    let savedId = studentData.id;

    if (isNew) {
      const { data: newSt, error: createError } = await supabase
        .from('students')
        .insert([studentData])
        .select()
        .single();
        
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
      savedId = newSt.id;
    } else {
      const { error: updateError } = await supabase
        .from('students')
        .update({
          ...studentData,
          updated_at: new Date().toISOString()
        })
        .eq('id', savedId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

    // Save Addresses
    if (Array.isArray(addresses)) {
      for (const addr of addresses) {
        if (addr.house_number || addr.province) {
          const { error: addrError } = await supabase
            .from('student_addresses')
            .upsert({ ...addr, student_id: savedId });
            
          if (addrError) {
            console.error('Address upsert error:', addrError);
          }
        }
      }
    }

    // Save Parents
    if (Array.isArray(parents)) {
      for (const p of parents) {
        if (p.first_name || p.last_name || p.citizen_id) {
          const { error: parentError } = await supabase
            .from('student_parents')
            .upsert({ ...p, student_id: savedId });
            
          if (parentError) {
            console.error('Parent upsert error:', parentError);
          }
        }
      }
    }

    return NextResponse.json({ success: true, id: savedId });
  } catch (error: any) {
    console.error('Save Student API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
