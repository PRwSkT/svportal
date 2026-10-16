import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { auditVanSafety, VanDailyLogItem } from '@/lib/safety/van';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const tripType = (searchParams.get('tripType') || 'morning') as 'morning' | 'evening';
    const routeId = searchParams.get('routeId');

    const supabase = getAdminClient();

    // 1. Fetch routes
    let routesQuery = supabase
      .from('school_van_routes')
      .select('*')
      .eq('is_active', true)
      .order('route_name');

    if (routeId) {
      routesQuery = routesQuery.eq('id', routeId);
    }

    const { data: routes, error: routesError } = await routesQuery;
    if (routesError) {
      return NextResponse.json({ error: routesError.message }, { status: 500 });
    }

    // 2. Collect all student IDs assigned to these routes
    const allAssignedStudentIds = new Set<string>();
    (routes || []).forEach(r => {
      (r.student_ids || []).forEach((sId: string) => allAssignedStudentIds.add(sId));
    });

    const studentIdArray = Array.from(allAssignedStudentIds);

    // 3. Fetch Student details
    let studentsMap = new Map<string, any>();
    if (studentIdArray.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, student_id, name, grade, classroom')
        .in('id', studentIdArray);

      (students || []).forEach(s => studentsMap.set(s.id, s));
    }

    // 4. Fetch logs for today's trip
    const routeIds = (routes || []).map(r => r.id);
    let logsQuery = supabase
      .from('school_van_daily_logs')
      .select('*')
      .eq('log_date', date)
      .eq('trip_type', tripType);

    if (routeIds.length > 0) {
      logsQuery = logsQuery.in('route_id', routeIds);
    }

    const { data: logs, error: logsError } = await logsQuery;
    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    // 5. Build enriched log list per route with safety audit
    const routesWithLogs = (routes || []).map(route => {
      const assignedIds: string[] = route.student_ids || [];
      const routeLogs = (logs || []).filter(l => l.route_id === route.id);
      
      const enrichedLogs: VanDailyLogItem[] = assignedIds.map(sId => {
        const student = studentsMap.get(sId);
        const existingLog = routeLogs.find(l => l.student_id === sId);

        return {
          id: existingLog?.id,
          routeId: route.id,
          logDate: date,
          tripType,
          studentId: sId,
          studentName: student?.name || 'นักเรียน',
          grade: student?.grade,
          boardedAt: existingLog?.boarded_at,
          disembarkedAt: existingLog?.disembarked_at,
          status: existingLog?.status || 'WAITING',
          notes: existingLog?.notes
        };
      });

      const audit = auditVanSafety(enrichedLogs);

      return {
        ...route,
        logs: enrichedLogs,
        audit
      };
    });

    return NextResponse.json({
      date,
      tripType,
      routes: routesWithLogs
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { action } = body;
    const supabase = getAdminClient();

    // Action: Update Student Passenger Status
    if (action === 'update_status') {
      const { route_id, student_id, status, log_date = new Date().toISOString().split('T')[0], trip_type = 'morning', notes = '' } = body;
      
      if (!route_id || !student_id || !status) {
        return NextResponse.json({ error: 'Missing route_id, student_id, or status' }, { status: 400 });
      }

      const now = new Date().toISOString();
      let boarded_at = null;
      let disembarked_at = null;

      if (status === 'BOARDED') {
        boarded_at = now;
      } else if (status === 'DISEMBARKED') {
        disembarked_at = now;
      }

      const updateData: any = {
        route_id,
        log_date,
        trip_type,
        student_id,
        status,
        notes,
        updated_at: now
      };

      if (boarded_at) updateData.boarded_at = boarded_at;
      if (disembarked_at) updateData.disembarked_at = disembarked_at;

      const { data, error } = await supabase
        .from('school_van_daily_logs')
        .upsert(updateData, {
          onConflict: 'route_id,log_date,trip_type,student_id'
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, log: data });
    }

    // Action: Create or Update Route
    if (action === 'save_route') {
      const { id, route_name, license_plate, driver_name, driver_phone, teacher_supervisor_name, max_capacity = 15, student_ids = [] } = body;

      if (!route_name || !license_plate || !driver_name) {
        return NextResponse.json({ error: 'Missing required route fields' }, { status: 400 });
      }

      const routeRecord = {
        ...(id ? { id } : {}),
        route_name,
        license_plate,
        driver_name,
        driver_phone,
        teacher_supervisor_name,
        max_capacity: Number(max_capacity),
        student_ids: Array.isArray(student_ids) ? student_ids : [],
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('school_van_routes')
        .upsert(routeRecord)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, route: data });
    }

    // Action: Delete / Deactivate Route
    if (action === 'delete_route') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'Missing route id' }, { status: 400 });
      }

      const { error } = await supabase
        .from('school_van_routes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'ยกเลิกสายรถรับส่งเรียบร้อยแล้ว' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing route id' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('school_van_routes')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'ยกเลิกสายรถเรียบร้อยแล้ว' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
