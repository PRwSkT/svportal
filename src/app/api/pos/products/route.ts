import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth('cashier', 'pos_shop');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get('barcode');
    const category = searchParams.get('category');
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

    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (category && category !== 'ทั้งหมด') {
      query = query.eq('category', category);
    }

    if (q && q.trim()) {
      query = query.ilike('name', `%${q.trim()}%`);
    }

    const { data, error } = await query.order('name').limit(50);
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
