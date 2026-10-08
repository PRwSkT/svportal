import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปภาพ' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const formId = (formData.get('formId') as string) || 'common';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบไฟล์รูปภาพที่ส่งมา' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'อนุญาตให้อัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP, GIF, SVG)' },
        { status: 400 }
      );
    }

    // 10MB limit
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'ขนาดไฟล์เกิน 10MB กรุณาเลือกไฟล์ที่มีขนาดเล็กลง' },
        { status: 400 }
      );
    }

    const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
    const ext = allowedExts.includes(rawExt) ? rawExt : 'jpg';

    const safeFormId = formId.replace(/[^a-zA-Z0-9_-]/g, '') || 'common';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const filePath = `forms/questions/${safeFormId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from('website-content')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถบันทึกไฟล์ภาพลงพื้นที่จัดเก็บได้: ' + error.message },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('website-content').getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (err: any) {
    console.error('Upload image error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' },
      { status: 500 }
    );
  }
}
