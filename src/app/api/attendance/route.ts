import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    let userId = '';

    // DEV MODE BYPASS
    if (process.env.NODE_ENV === 'development') {
      userId = 'dev-user-id';
    } else {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    // Get today's local date YYYY-MM-DD
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localISODate = (new Date(today.getTime() - offset)).toISOString().split('T')[0];

    const supabase = await createClient();
    // Fetch today's attendance record
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', localISODate)
      .maybeSingle();

    if (error) {
      console.error('Error fetching attendance:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// School boundary configuration (Polygon)
// ระบุพิกัด (ละติจูด, ลองจิจูด) ของมุมที่ดินโรงเรียนเรียงตามลำดับ (ทวนเข็มหรือตามเข็มนาฬิกาก็ได้)
const SCHOOL_POLYGON = [
  { lat: 12.683577, lng: 101.279998 }, // จุด A
  { lat: 12.684056, lng: 101.280143 }, // จุด B
  { lat: 12.683867, lng: 101.280623 }, // จุด C
  { lat: 12.684017, lng: 101.280725 }, // จุด D
  { lat: 12.683962, lng: 101.280770 }, // จุด E
  { lat: 12.683674, lng: 101.280566 }, // จุด F
  { lat: 12.683634, lng: 101.280640 }, // จุด G
  { lat: 12.683207, lng: 101.280500 }, // จุด H
  { lat: 12.683243, lng: 101.280406 }, // จุด I
  { lat: 12.683300, lng: 101.280329 }, // จุด J
  { lat: 12.683197, lng: 101.280264 }, // จุด K
];

// Helper function to check if a point is inside a polygon (Ray-casting algorithm)
function isPointInPolygon(point: { lat: number, lng: number }, polygon: { lat: number, lng: number }[]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > point.lng) !== (yj > point.lng))
        && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

export async function POST(request: Request) {
  try {
    let userId = '';

    // DEV MODE BYPASS
    if (process.env.NODE_ENV === 'development') {
      userId = 'dev-user-id';
    } else {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    const { action, lat, lng } = await request.json();

    if (!['check_in', 'check_out'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Missing GPS coordinates' }, { status: 400 });
    }

    // Geofencing Check (Polygon)
    const inside = isPointInPolygon({ lat, lng }, SCHOOL_POLYGON);
    if (!inside) {
      return NextResponse.json({ 
        error: `คุณอยู่นอกเขตพื้นที่โรงเรียนที่กำหนดไว้` 
      }, { status: 403 });
    }

    // Get today's local date YYYY-MM-DD
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localISODate = (new Date(today.getTime() - offset)).toISOString().split('T')[0];

    // We use a service role key to insert/update the timestamp securely on the server
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Check if record exists
    const { data: existingRecord } = await supabaseAdmin
      .from('attendance_records')
      .select('id')
      .eq('user_id', userId)
      .eq('date', localISODate)
      .maybeSingle();

    const currentTime = new Date().toISOString();

    if (action === 'check_in') {
      if (existingRecord) {
        return NextResponse.json({ error: 'You have already checked in today.' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('attendance_records')
        .insert({
          user_id: userId,
          date: localISODate,
          check_in_time: currentTime,
          check_in_lat: lat,
          check_in_lng: lng
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, record: data });
    } 
    
    if (action === 'check_out') {
      if (!existingRecord) {
        return NextResponse.json({ error: 'You have not checked in today yet.' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('attendance_records')
        .update({
          check_out_time: currentTime,
          check_out_lat: lat,
          check_out_lng: lng,
          updated_at: currentTime
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, record: data });
    }

  } catch (err: any) {
    console.error('Attendance POST Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
