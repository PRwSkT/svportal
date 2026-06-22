import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'normal'; // 'normal' or 'e'

    const supabase = await createClient();

    // Fetch all student IDs to calculate max
    const { data: allIds, error } = await supabase
      .from('students')
      .select('id');

    if (error) {
      throw error;
    }

    let maxNormal = 0;
    let maxE = 0;

    for (const { id } of allIds || []) {
      if (!id) continue;
      
      if (id.toUpperCase().startsWith('E')) {
        const num = parseInt(id.substring(1), 10);
        if (!isNaN(num) && num > maxE) {
          maxE = num;
        }
      } else {
        const num = parseInt(id, 10);
        if (!isNaN(num) && num > maxNormal) {
          maxNormal = num;
        }
      }
    }

    let nextId = '';
    if (type === 'e') {
      const nextNum = maxE + 1;
      // Format as E + 4 digits minimum (e.g., E0001)
      nextId = `E${nextNum.toString().padStart(4, '0')}`;
    } else {
      const nextNum = maxNormal + 1;
      nextId = nextNum.toString();
    }

    return NextResponse.json({ nextId });
  } catch (error: any) {
    console.error('Next ID API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
