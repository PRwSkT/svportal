import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get('barcode');
    const q = searchParams.get('q');
    const supabase = await createClient();

    if (barcode) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('barcode', barcode)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return NextResponse.json(data || null);
    }

    if (q) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .ilike('name', `%${q}%`)
        .limit(20);
        
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    return NextResponse.json({ error: 'Require barcode or q parameter' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
