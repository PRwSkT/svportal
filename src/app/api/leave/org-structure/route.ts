import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  canAccessLeaveDashboard,
  inferDepartmentFromPosition,
  OrgRoleCategory,
} from '@/lib/leave/workflow';

const VALID_CATEGORIES: OrgRoleCategory[] = [
  'approver',
  'executive',
  'department_head',
  'operations',
  'notification',
];

async function requireOrgManager() {
  const user = await getServerUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const admin = getAdminClient();
  const { data: appUser } = await admin
    .from('app_users')
    .select('id, role, assigned_features')
    .eq('id', user.id)
    .maybeSingle();

  const permissions = await canAccessLeaveDashboard(
    user.id,
    appUser?.role,
    appUser?.assigned_features as string[] | null,
    user.email
  );

  if (!permissions.canManageOrg) {
    return {
      error: NextResponse.json(
        { error: 'เฉพาะผู้ดูแลระบบหรือผู้อำนวยการเท่านั้นที่แก้ไขโครงสร้างแจ้งเตือนได้' },
        { status: 403 }
      ),
    };
  }

  return { user, permissions };
}

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();
    const [{ data: roles, error: roleErr }, { data: users, error: userErr }, { data: personnel }] =
      await Promise.all([
        admin
          .from('org_responsibility_roles')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        admin
          .from('app_users')
          .select('id, full_name, role, personnel_id, is_active')
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
        admin
          .from('personnel')
          .select('id, user_id, name_th, position_th, category, is_active')
          .eq('is_active', true),
      ]);

    if (roleErr) throw roleErr;
    if (userErr) throw userErr;

    const personnelByUserId = new Map<string, any>();
    const personnelById = new Map<string, any>();
    for (const p of personnel || []) {
      if (p.user_id) personnelByUserId.set(p.user_id, p);
      personnelById.set(p.id, p);
    }

    const staff = (users || []).map((u) => {
      const p =
        personnelByUserId.get(u.id) ||
        (u.personnel_id ? personnelById.get(u.personnel_id) : null);
      const positionTh = p?.position_th || u.role;
      const department = inferDepartmentFromPosition(p?.position_th, p?.category || u.role);
      return {
        user_id: u.id,
        full_name: p?.name_th || u.full_name,
        role: u.role,
        position_th: positionTh,
        department,
      };
    });

    return NextResponse.json({
      success: true,
      roles: roles || [],
      staff,
    });
  } catch (error: any) {
    const msg = String(error?.message || '');
    const isMissingTable =
      error?.code === 'PGRST205' ||
      error?.code === '42P01' ||
      /schema cache|does not exist/i.test(msg);

    if (isMissingTable) {
      return NextResponse.json(
        {
          success: false,
          code: 'MIGRATION_REQUIRED',
          error:
            'ยังไม่ได้รันไฟล์ Migration สร้างตารางโครงสร้างใน Supabase (supabase/migrations/20261126000002_staff_leave_and_org_routing.sql)',
        },
        { status: 503 }
      );
    }

    console.error('GET /api/leave/org-structure error:', error);
    return NextResponse.json(
      { success: false, error: msg || 'ไม่สามารถโหลดโครงสร้างองค์กรได้' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireOrgManager();
    if ('error' in auth && auth.error) return auth.error;

    const body = await req.json();
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุ id ของบทบาทที่ต้องการแก้ไข' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: existing, error: fetchErr } = await admin
      .from('org_responsibility_roles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลบทบาทในโครงสร้าง' }, { status: 404 });
    }

    const assignedUserIds = Array.isArray(body.assigned_user_ids)
      ? Array.from(new Set(body.assigned_user_ids.map(String).filter(Boolean)))
      : existing.assigned_user_ids;

    const isActive =
      typeof body.is_active === 'boolean' ? body.is_active : existing.is_active;

    // Safety guard for director_approver
    if (existing.role_key === 'director_approver') {
      if (assignedUserIds.length === 0) {
        return NextResponse.json(
          { error: 'ต้องมีผู้อำนวยการ (ผู้อนุมัติหลัก) อย่างน้อย 1 ท่านเสมอ' },
          { status: 400 }
        );
      }
      if (!isActive) {
        return NextResponse.json(
          { error: 'ไม่สามารถปิดการใช้งานตำแหน่งผู้อำนวยการ (ผู้อนุมัติหลัก) ได้' },
          { status: 400 }
        );
      }
    }

    const titleTh = body.title_th ? String(body.title_th).trim() : existing.title_th;
    const descriptionTh =
      body.description_th !== undefined
        ? String(body.description_th || '').trim() || null
        : existing.description_th;
    const departmentScope = body.department_scope
      ? String(body.department_scope).trim()
      : existing.department_scope;
    const category = VALID_CATEGORIES.includes(body.category)
      ? body.category
      : existing.category;
    const leaveTypes = Array.isArray(body.leave_types)
      ? body.leave_types.map(String).filter(Boolean)
      : existing.leave_types;

    // Only allow director_approver to retain can_approve = true
    const canApprove = existing.role_key === 'director_approver' ? true : false;

    const { data: updated, error: updateErr } = await admin
      .from('org_responsibility_roles')
      .update({
        title_th: titleTh,
        description_th: descriptionTh,
        category,
        department_scope: departmentScope,
        assigned_user_ids: assignedUserIds,
        notify_on_submit:
          typeof body.notify_on_submit === 'boolean'
            ? body.notify_on_submit
            : existing.notify_on_submit,
        notify_on_approve:
          typeof body.notify_on_approve === 'boolean'
            ? body.notify_on_approve
            : existing.notify_on_approve,
        notify_on_reject:
          typeof body.notify_on_reject === 'boolean'
            ? body.notify_on_reject
            : existing.notify_on_reject,
        leave_types: leaveTypes,
        can_approve: canApprove,
        is_active: isActive,
        sort_order:
          typeof body.sort_order === 'number' ? body.sort_order : existing.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      role: updated,
      message: 'บันทึกโครงสร้างผู้รับผิดชอบเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    console.error('PUT /api/leave/org-structure error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถบันทึกข้อมูลได้' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOrgManager();
    if ('error' in auth && auth.error) return auth.error;

    const body = await req.json();
    const titleTh = String(body.title_th || '').trim();
    if (!titleTh) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อตำแหน่ง/หน่วยงาน' }, { status: 400 });
    }

    const category: OrgRoleCategory = VALID_CATEGORIES.includes(body.category)
      ? body.category === 'approver'
        ? 'notification'
        : body.category
      : 'operations';

    const departmentScope = String(body.department_scope || 'all').trim();
    const assignedUserIds = Array.isArray(body.assigned_user_ids)
      ? Array.from(new Set(body.assigned_user_ids.map(String).filter(Boolean)))
      : [];
    const leaveTypes = Array.isArray(body.leave_types) && body.leave_types.length > 0
      ? body.leave_types.map(String)
      : ['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other'];

    const roleKey = `custom_${Date.now()}`;
    const admin = getAdminClient();

    const { data: inserted, error: insertErr } = await admin
      .from('org_responsibility_roles')
      .insert({
        role_key: roleKey,
        title_th: titleTh,
        description_th: body.description_th ? String(body.description_th).trim() : null,
        category,
        department_scope: departmentScope,
        assigned_user_ids: assignedUserIds,
        notify_on_submit: Boolean(body.notify_on_submit),
        notify_on_approve: body.notify_on_approve !== false,
        notify_on_reject: Boolean(body.notify_on_reject),
        leave_types: leaveTypes,
        can_approve: false,
        is_active: true,
        sort_order: typeof body.sort_order === 'number' ? body.sort_order : 20,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json(
      {
        success: true,
        role: inserted,
        message: 'เพิ่มหน่วยงาน/ผู้รับผิดชอบในโครงสร้างเรียบร้อยแล้ว',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/leave/org-structure error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถเพิ่มหน่วยงานได้' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireOrgManager();
    if ('error' in auth && auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || '';
    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุ id ที่ต้องการลบ' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: existing, error: fetchErr } = await admin
      .from('org_responsibility_roles')
      .select('role_key, can_approve')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลที่ต้องการลบ' }, { status: 404 });
    }
    if (existing.role_key === 'director_approver' || existing.can_approve) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบตำแหน่งผู้อำนวยการ (ผู้อนุมัติหลัก) ออกจากระบบได้' },
        { status: 400 }
      );
    }

    const { error: delErr } = await admin
      .from('org_responsibility_roles')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    return NextResponse.json({
      success: true,
      message: 'ลบหน่วยงานออกจากโครงสร้างเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    console.error('DELETE /api/leave/org-structure error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถลบข้อมูลได้' },
      { status: 500 }
    );
  }
}
