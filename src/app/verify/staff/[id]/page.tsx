import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import StaffVerificationView from './StaffVerificationView';
import { SCHOOL_INFO } from '@/lib/constants/school';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data: personnel } = await supabase
    .from('personnel')
    .select('name_th, name_en, position_th, position_en')
    .eq('id', id)
    .single();

  if (!personnel) {
    return {
      title: 'ตรวจสอบสถานะบุคลากร | โรงเรียนสมคิดวิทยา',
    };
  }

  return {
    title: `ตรวจสอบสถานะ: ${personnel.name_th} | โรงเรียนสมคิดวิทยา`,
    description: `ระบบตรวจสอบสถานะบุคลากรทางการศึกษา โรงเรียนสมคิดวิทยา อ.เมืองระยอง จ.ระยอง (${personnel.position_th})`,
  };
}

export default async function StaffVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data: personnel } = await supabase
    .from('personnel')
    .select('*')
    .eq('id', id)
    .single();

  return <StaffVerificationView personnel={personnel} requestedId={id} />;
}
