import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { evaluateLicenseStatus, TeacherLicenseRecord } from '@/lib/governance/license-guard';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getAdminClient();
    const { data: licenses, error } = await supabase
      .from('teacher_licenses')
      .select('*')
      .order('expire_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let activeCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    const enriched = (licenses || []).map((lic: any) => {
      const evalResult = evaluateLicenseStatus(lic.expire_date, lic.cpd_hours || 0);

      if (evalResult.alertTier === 'EXPIRED') expiredCount++;
      else if (evalResult.alertTier === 'EXPIRING_30D' || evalResult.alertTier === 'EXPIRING_90D') expiringSoonCount++;
      else activeCount++;

      return {
        ...lic,
        evaluation: evalResult
      };
    });

    return NextResponse.json({
      licenses: enriched,
      stats: {
        total: enriched.length,
        activeCount,
        expiringSoonCount,
        expiredCount
      }
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
    const {
      id,
      teacher_name,
      citizen_id,
      license_type = 'TEACHER',
      license_number,
      issue_date,
      expire_date,
      cpd_hours = 0,
      notes = ''
    } = body;

    if (!teacher_name || !citizen_id || !license_number || !issue_date || !expire_date) {
      return NextResponse.json({ error: 'Missing required license fields' }, { status: 400 });
    }

    const evalResult = evaluateLicenseStatus(expire_date, Number(cpd_hours));

    const recordToUpsert = {
      ...(id ? { id } : {}),
      teacher_name,
      citizen_id,
      license_type,
      license_number,
      issue_date,
      expire_date,
      cpd_hours: Number(cpd_hours),
      status: evalResult.alertTier === 'EXPIRED' ? 'EXPIRED' : (evalResult.alertTier === 'EXPIRING_30D' || evalResult.alertTier === 'EXPIRING_90D' ? 'EXPIRING_SOON' : 'ACTIVE'),
      notes,
      updated_at: new Date().toISOString()
    };

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('teacher_licenses')
      .upsert(recordToUpsert, {
        onConflict: 'citizen_id,license_number'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      license: data,
      evaluation: evalResult
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
