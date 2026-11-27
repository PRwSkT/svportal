import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { canAccessLeaveDashboard } from '@/lib/leave/workflow';

const BUCKET_NAME = 'form-attachments';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'ขนาดไฟล์ต้องไม่เกิน 5 MB' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์ PDF, JPG, PNG หรือ WebP เท่านั้น' },
        { status: 400 }
      );
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `staff-leave/${user.id}/${Date.now()}_${sanitizedName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const admin = getAdminClient();
    const { error: uploadErr } = await admin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      throw uploadErr;
    }

    return NextResponse.json({
      success: true,
      path: storagePath,
      fileName: file.name,
    });
  } catch (error: any) {
    console.error('POST /api/leave/upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'อัปโหลดไฟล์ไม่สำเร็จ' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const storagePath = searchParams.get('path') || '';
    if (!storagePath || !storagePath.startsWith('staff-leave/')) {
      return NextResponse.json({ error: 'ตำแหน่งไฟล์ไม่ถูกต้อง' }, { status: 400 });
    }

    const ownerPrefix = `staff-leave/${user.id}/`;
    const isOwner = storagePath.startsWith(ownerPrefix);

    const admin = getAdminClient();
    if (!isOwner) {
      const { data: appUser } = await admin
        .from('app_users')
        .select('role, assigned_features')
        .eq('id', user.id)
        .maybeSingle();

      const perms = await canAccessLeaveDashboard(
        user.id,
        appUser?.role,
        appUser?.assigned_features as string[] | null,
        user.email
      );

      if (!perms.canViewDashboard) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงเอกสารแนบนี้' }, { status: 403 });
      }
    }

    const { data, error } = await admin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 300);

    if (error || !data?.signedUrl) {
      throw error || new Error('ไม่สามารถสร้างลิงก์ดาวน์โหลดได้');
    }

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
    });
  } catch (error: any) {
    console.error('GET /api/leave/upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถเปิดเอกสารแนบได้' },
      { status: 500 }
    );
  }
}
