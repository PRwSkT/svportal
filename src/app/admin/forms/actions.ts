'use server';

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
import { FormDefinition, FormField, FormResponse } from '@/types';

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('ระบบยังไม่ได้กำหนด SUPABASE_SERVICE_ROLE_KEY บน Server');
  }
  return createClient(url, key);
}

async function verifyAuth() {
  const auth = await requireAuth('admin', 'admin_forms');
  if (auth.error) {
    return {
      authorized: false,
      error: auth.error === 'Unauthorized'
        ? 'กรุณาเข้าสู่ระบบใหม่ (เซสชันหมดอายุ)'
        : 'คุณไม่มีสิทธิ์ในการจัดการระบบแบบฟอร์มนี้',
      user: null,
    };
  }
  return { authorized: true, user: auth.user };
}

/**
 * Fetch all forms for admin dashboard
 */
export async function getFormsList(): Promise<ActionResult<FormDefinition[]>> {
  try {
    const auth = await verifyAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('forms')
      .select('*, form_fields(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: (data || []) as FormDefinition[] };
  } catch (err: any) {
    console.error('getFormsList error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถโหลดรายการฟอร์มได้' };
  }
}

/**
 * Fetch single form with all fields
 */
export async function getFormWithFields(formId: string): Promise<ActionResult<{ form: FormDefinition; fields: FormField[] }>> {
  try {
    const auth = await verifyAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase = getAdminClient();

    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formErr) throw formErr;

    const { data: fields, error: fieldsErr } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('sort_order', { ascending: true });

    if (fieldsErr) throw fieldsErr;

    return {
      success: true,
      data: {
        form: form as FormDefinition,
        fields: (fields || []) as FormField[],
      },
    };
  } catch (err: any) {
    console.error('getFormWithFields error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถโหลดข้อมูลฟอร์มได้' };
  }
}

/**
 * Create a new form
 */
export async function createForm(payload: {
  title_th: string;
  slug: string;
  category: string;
  access_type: 'public' | 'internal_all' | 'internal_teacher';
  description_th?: string;
}): Promise<ActionResult<FormDefinition>> {
  try {
    const auth = await verifyAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase = getAdminClient();

    // Check slug uniqueness
    const cleanSlug = payload.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const { data: existing } = await supabase
      .from('forms')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Slug (URL) นี้ถูกใช้งานแล้ว กรุณาระบุชื่อ URL อื่น' };
    }

    const newForm = {
      slug: cleanSlug,
      title: { th: payload.title_th.trim() },
      description: payload.description_th ? { th: payload.description_th.trim() } : null,
      category: payload.category || 'general',
      access_type: payload.access_type || 'public',
      is_published: false,
      response_count: 0,
      thank_you_title: { th: 'ขอบคุณสำหรับการส่งข้อมูล' },
      thank_you_message: { th: 'โรงเรียนสมคิดวิทยาได้รับข้อมูลของท่านเรียบร้อยแล้ว' },
      created_by: auth.user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('forms')
      .insert([newForm])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: data as FormDefinition };
  } catch (err: any) {
    console.error('createForm error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถสร้างฟอร์มได้' };
  }
}

/**
 * Save form studio changes (Form properties + Form fields)
 */
export async function saveFormStudio(
  formId: string,
  formPayload: Partial<FormDefinition>,
  fields: FormField[]
): Promise<ActionResult> {
  try {
    const auth = await verifyAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase = getAdminClient();

    // 1. Update form definition
    const updateData: any = {
      title: formPayload.title,
      description: formPayload.description,
      banner_url: formPayload.banner_url,
      category: formPayload.category,
      access_type: formPayload.access_type,
      is_published: formPayload.is_published,
      starts_at: formPayload.starts_at || null,
      ends_at: formPayload.ends_at || null,
      max_responses: formPayload.max_responses || null,
      allow_multiple: formPayload.allow_multiple ?? true,
      thank_you_title: formPayload.thank_you_title,
      thank_you_message: formPayload.thank_you_message,
      notify_emails: formPayload.notify_emails || null,
      updated_at: new Date().toISOString(),
    };

    if (formPayload.slug) {
      updateData.slug = formPayload.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    }

    const { error: formErr } = await supabase
      .from('forms')
      .update(updateData)
      .eq('id', formId);

    if (formErr) throw formErr;

    // 2. Synchronize fields
    // Delete existing fields and re-insert updated fields to preserve sort_order
    const { error: delErr } = await supabase
      .from('form_fields')
      .delete()
      .eq('form_id', formId);

    if (delErr) throw delErr;

    if (fields.length > 0) {
      const fieldsToInsert = fields.map((f, idx) => ({
        form_id: formId,
        field_key: f.field_key || `field_${idx + 1}`,
        label: f.label || { th: 'คำถามที่ ' + (idx + 1) },
        help_text: f.help_text || null,
        field_type: f.field_type || 'text',
        is_required: Boolean(f.is_required),
        options: f.options || null,
        validation: f.validation || null,
        image_url: f.image_url || null,
        sort_order: idx,
        width: f.width || 'full',
      }));

      const { error: insErr } = await supabase
        .from('form_fields')
        .insert(fieldsToInsert);

      if (insErr) throw insErr;
    }

    return { success: true };
  } catch (err: any) {
    console.error('saveFormStudio error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถบันทึกข้อมูลฟอร์มได้' };
  }
}

/**
 * Toggle form publish status
 */
export async function toggleFormPublish(formId: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const auth = await verifyAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('forms')
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq('id', formId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('toggleFormPublish error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถเปลี่ยนสถานะได้' };
  }
}

/**
 * Delete a form and its responses
 */
export async function deleteForm(formId: string): Promise<ActionResult> {
  try {
    const auth = await verifyAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('forms')
      .delete()
      .eq('id', formId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('deleteForm error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถลบฟอร์มได้' };
  }
}

/**
 * Get form responses for analytics
 */
export async function getFormResponses(formId: string): Promise<ActionResult<{
  form: FormDefinition;
  fields: FormField[];
  responses: FormResponse[];
}>> {
  try {
    const auth = await verifyAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase = getAdminClient();

    const [formRes, fieldsRes, responsesRes] = await Promise.all([
      supabase.from('forms').select('*').eq('id', formId).single(),
      supabase.from('form_fields').select('*').eq('form_id', formId).order('sort_order', { ascending: true }),
      supabase.from('form_responses').select('*').eq('form_id', formId).order('submitted_at', { ascending: false }),
    ]);

    if (formRes.error) throw formRes.error;
    if (fieldsRes.error) throw fieldsRes.error;
    if (responsesRes.error) throw responsesRes.error;

    return {
      success: true,
      data: {
        form: formRes.data as FormDefinition,
        fields: (fieldsRes.data || []) as FormField[],
        responses: (responsesRes.data || []) as FormResponse[],
      },
    };
  } catch (err: any) {
    console.error('getFormResponses error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถโหลดการตอบกลับได้' };
  }
}

/**
 * Delete single response
 */
export async function deleteResponse(responseId: string, formId: string): Promise<ActionResult> {
  try {
    const auth = await verifyAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('form_responses')
      .delete()
      .eq('id', responseId);

    if (error) throw error;

    // Sync response count accurately
    const { count } = await supabase
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', formId);

    await supabase
      .from('forms')
      .update({ response_count: count ?? 0 })
      .eq('id', formId);

    return { success: true };
  } catch (err: any) {
    console.error('deleteResponse error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถลบการตอบกลับได้' };
  }
}
