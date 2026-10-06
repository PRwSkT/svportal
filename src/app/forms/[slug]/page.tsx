import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import FormViewerClient from './FormViewerClient';
import { FormDefinition, FormField } from '@/types';
import { getServerUser } from '@/lib/auth';

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getPublicClient();

  const { data: form } = await supabase
    .from('forms')
    .select('title, description')
    .eq('slug', slug)
    .single();

  if (!form) return { title: 'แบบฟอร์ม - โรงเรียนสมคิดวิทยา' };

  return {
    title: `${form.title?.th || 'แบบฟอร์มออนไลน์'} | โรงเรียนสมคิดวิทยา`,
    description: form.description?.th || 'แบบฟอร์มออนไลน์ โรงเรียนสมคิดวิทยา อ.เมือง จ.ระยอง',
  };
}

export default async function FormViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getPublicClient();

  // 1. Fetch form
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('*')
    .eq('slug', slug)
    .single();

  if (formErr || !form) {
    notFound();
  }

  // 2. Fetch fields
  const { data: fields, error: fieldsErr } = await supabase
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order', { ascending: true });

  const currentUser = await getServerUser();

  return (
    <FormViewerClient
      initialForm={form as FormDefinition}
      initialFields={(fields || []) as FormField[]}
      currentUser={currentUser ? { id: currentUser.id, email: currentUser.email || '' } : null}
    />
  );
}
