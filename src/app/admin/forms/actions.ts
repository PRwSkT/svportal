'use server';

import { createClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth';
import { isSystemAdmin } from '@/lib/constants/auth';
import { FormDefinition, FormField, FormResponse, MultiLangText } from '@/types';

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  currentUserContext?: {
    userId: string | null;
    personnelId: string | null;
    isAdmin: boolean;
  };
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

/**
 * Shared helper to resolve user role, admin status, and personnel ID
 */
async function resolveFormUserContext(supabase: any): Promise<{
  userId: string | null;
  personnelId: string | null;
  isAdmin: boolean;
  user: any;
}> {
  try {
    const currentUser = await getServerUser();
    if (!currentUser) {
      return { userId: null, personnelId: null, isAdmin: false, user: null };
    }

    let isAdmin = false;
    let currentPersonnelId: string | null = null;

    if (isSystemAdmin(currentUser.email)) {
      isAdmin = true;
    }

    const { data: appUser } = await supabase
      .from('app_users')
      .select('role, personnel_id')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (appUser) {
      if (appUser.role === 'admin' || appUser.role === 'executive') {
        isAdmin = true;
      }
      if (appUser.personnel_id) {
        currentPersonnelId = appUser.personnel_id;
      }
    }

    if (!currentPersonnelId && currentUser.email) {
      const { data: pData } = await supabase
        .from('personnel')
        .select('id')
        .eq('email', currentUser.email)
        .maybeSingle();
      currentPersonnelId = pData?.id || null;
    }

    return {
      userId: currentUser.id,
      personnelId: currentPersonnelId,
      isAdmin,
      user: currentUser,
    };
  } catch (err) {
    console.error('resolveFormUserContext error:', err);
    return { userId: null, personnelId: null, isAdmin: false, user: null };
  }
}

async function verifyFormAuth() {
  const supabase = getAdminClient();
  const context = await resolveFormUserContext(supabase);
  if (!context.userId) {
    return {
      authorized: false,
      error: 'กรุณาเข้าสู่ระบบใหม่ (เซสชันหมดอายุ)',
      context: null,
    };
  }
  return { authorized: true, context };
}

/**
 * Fetch forms visible to current user:
 * - Admin sees ALL forms
 * - Non-admin sees ONLY forms created by them or where they are an assigned collaborator
 */
export async function getFormsList(): Promise<ActionResult<FormDefinition[]>> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    // 1. Fetch active personnel for creator & collaborator lookups
    const { data: allPersonnel } = await supabase
      .from('personnel')
      .select('id, name_th, name_en, position_th, category, email, image_url, user_id')
      .eq('is_active', true);

    const personnelList = allPersonnel || [];
    const pById = new Map(personnelList.map((p) => [p.id, p]));
    const pByUserId = new Map(personnelList.filter((p) => p.user_id).map((p) => [p.user_id, p]));

    // 2. Fetch all raw forms
    const { data, error } = await supabase
      .from('forms')
      .select('*, form_fields(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rawForms = data || [];

    // 3. Filter forms: Admin sees everything; Non-admin sees only owned or shared forms
    const visibleForms = rawForms.filter((f) => {
      if (context.isAdmin) return true;

      const isCreator =
        (f.created_by && f.created_by === context.userId) ||
        (context.personnelId && f.created_by === context.personnelId);

      const collabs: string[] = f.collaborator_ids || [];
      const isCollab =
        (context.userId && collabs.includes(context.userId)) ||
        (context.personnelId && collabs.includes(context.personnelId));

      return Boolean(isCreator || isCollab);
    });

    // 4. Enrich forms with creator profile, collaborator profiles, and permission flags
    const enrichedForms: FormDefinition[] = visibleForms.map((f) => {
      const isOwner = Boolean(
        (f.created_by && f.created_by === context.userId) ||
        (context.personnelId && f.created_by === context.personnelId)
      );

      const collabs: string[] = f.collaborator_ids || [];
      const isCollab = Boolean(
        (context.userId && collabs.includes(context.userId)) ||
        (context.personnelId && collabs.includes(context.personnelId))
      );

      const creatorP = f.created_by
        ? pByUserId.get(f.created_by) || pById.get(f.created_by)
        : null;

      const creator = creatorP
        ? {
            id: creatorP.id,
            name_th: creatorP.name_th,
            position_th: creatorP.position_th,
            email: creatorP.email,
            image_url: creatorP.image_url,
          }
        : null;

      const collaborators = collabs
        .map((cid: string) => {
          const p = pByUserId.get(cid) || pById.get(cid);
          return p
            ? {
                id: p.id,
                name_th: p.name_th,
                position_th: p.position_th,
                email: p.email,
                image_url: p.image_url,
              }
            : null;
        })
        .filter(Boolean) as any[];

      return {
        ...f,
        collaborator_ids: collabs,
        creator,
        collaborators,
        is_owner: isOwner,
        can_manage_permissions: context.isAdmin || isOwner,
        can_edit: context.isAdmin || isOwner || isCollab,
      };
    });

    return {
      success: true,
      data: enrichedForms,
      currentUserContext: {
        userId: context.userId,
        personnelId: context.personnelId,
        isAdmin: context.isAdmin,
      },
    };
  } catch (err: any) {
    console.error('getFormsList error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถโหลดรายการฟอร์มได้' };
  }
}

/**
 * Fetch single form with all fields (with permission check)
 */
export async function getFormWithFields(formId: string): Promise<ActionResult<{ form: FormDefinition; fields: FormField[] }>> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formErr || !form) throw new Error('ไม่พบข้อมูลแบบฟอร์ม');

    const isOwner = Boolean(
      (form.created_by && form.created_by === context.userId) ||
      (context.personnelId && form.created_by === context.personnelId)
    );
    const collabs: string[] = form.collaborator_ids || [];
    const isCollab = Boolean(
      (context.userId && collabs.includes(context.userId)) ||
      (context.personnelId && collabs.includes(context.personnelId))
    );

    if (!context.isAdmin && !isOwner && !isCollab) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ในการเข้าถึงหรือแก้ไขแบบฟอร์มนี้' };
    }

    const { data: fields, error: fieldsErr } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('sort_order', { ascending: true });

    if (fieldsErr) throw fieldsErr;

    const enrichedForm: FormDefinition = {
      ...form,
      is_owner: isOwner,
      can_manage_permissions: context.isAdmin || isOwner,
      can_edit: context.isAdmin || isOwner || isCollab,
    };

    return {
      success: true,
      data: {
        form: enrichedForm,
        fields: (fields || []) as FormField[],
      },
      currentUserContext: {
        userId: context.userId,
        personnelId: context.personnelId,
        isAdmin: context.isAdmin,
      },
    };
  } catch (err: any) {
    console.error('getFormWithFields error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถโหลดข้อมูลฟอร์มได้' };
  }
}

function isDummyHelp(text?: string | null): boolean {
  if (!text) return true;
  const t = text.trim();
  if (!t) return true;
  return (
    t === 'คำอธิบายเพิ่มเติมสำหรับส่วนนี้ (ถ้ามี)' ||
    t === 'Additional description for this section (optional)' ||
    t === '本节补充说明（可选）' ||
    t === 'คำอธิบายรูปภาพหรือคำแนะนำเพิ่มเติม (ถ้ามี)' ||
    t === 'Image caption or instructions (optional)' ||
    t === '图片说明或指引（可选）' ||
    t === 'ระบุเนื้อหา รายละเอียด กฎระเบียบ หรือข้อมูลสำคัญที่ต้องการแจ้งให้ผู้ตอบฟอร์มทราบโดยไม่ต้องให้ตอบคำถาม' ||
    (t.includes('(ถ้ามี)') && t.length <= 40) ||
    (t.includes('(optional)') && t.length <= 50) ||
    (t.includes('（可选）') && t.length <= 30)
  );
}

/**
 * Create a new form (sets current user as creator/owner)
 * Supports initial fields from Nong Fah AI template
 */
export async function createForm(payload: {
  title_th: string;
  slug: string;
  category: string;
  access_type: 'public' | 'internal_all' | 'internal_teacher';
  description_th?: string;
  title?: MultiLangText;
  description?: MultiLangText | null;
  initial_fields?: FormField[] | any[];
}): Promise<ActionResult<FormDefinition>> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    // Check slug uniqueness & sanitize
    let cleanSlug = payload.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanSlug) {
      cleanSlug = `sv-form-${Math.random().toString(36).substring(2, 8)}`;
    }

    const { data: existing } = await supabase
      .from('forms')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (existing) {
      cleanSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const formTitle = payload.title?.th
      ? payload.title
      : { th: payload.title_th.trim() };

    const formDesc = payload.description?.th
      ? payload.description
      : payload.description_th
      ? { th: payload.description_th.trim() }
      : null;

    const isUuid = (val?: string | null): boolean =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    const newForm = {
      slug: cleanSlug,
      title: formTitle,
      description: formDesc,
      banner_url: '/images/default-form-banner.png',
      category: payload.category || 'general',
      access_type: payload.access_type || 'public',
      is_published: false,
      response_count: 0,
      thank_you_title: { th: 'ขอบคุณสำหรับการส่งข้อมูล' },
      thank_you_message: { th: 'โรงเรียนสมคิดวิทยาได้รับข้อมูลของท่านเรียบร้อยแล้ว' },
      created_by: isUuid(context.userId) ? context.userId : null,
      collaborator_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('forms')
      .insert([newForm])
      .select()
      .single();

    if (error) throw error;

    // Insert initial fields if provided (e.g. from Nong Fah AI generator)
    if (payload.initial_fields && Array.isArray(payload.initial_fields) && payload.initial_fields.length > 0) {
      const fieldsToInsert = payload.initial_fields.map((f: any, idx: number) => {
        let cleanHelp = f.help_text;
        if (cleanHelp && isDummyHelp(cleanHelp.th) && isDummyHelp(cleanHelp.en) && isDummyHelp(cleanHelp.zh)) {
          cleanHelp = null;
        } else if (cleanHelp && !cleanHelp.th?.trim() && !cleanHelp.en?.trim() && !cleanHelp.zh?.trim()) {
          cleanHelp = null;
        }

        return {
          form_id: data.id,
          field_key: f.field_key || `field_${Date.now().toString(36)}_${idx}`,
          label: f.label || { th: 'คำถามที่ ' + (idx + 1) },
          help_text: cleanHelp || null,
          field_type: f.field_type || 'text',
          is_required: f.is_required !== undefined ? Boolean(f.is_required) : true,
          options: f.options ? (Array.isArray(f.options) ? f.options : null) : null,
          validation: f.validation || null,
          image_url: f.image_url || null,
          sort_order: idx,
          width: f.width || 'full',
        };
      });

      const { error: fieldsErr } = await supabase
        .from('form_fields')
        .insert(fieldsToInsert);

      if (fieldsErr) {
        console.error('Error inserting initial form fields from Nong Fah AI:', fieldsErr);
      }
    }

    return {
      success: true,
      data: {
        ...data,
        is_owner: true,
        can_manage_permissions: true,
        can_edit: true,
      } as FormDefinition,
    };
  } catch (err: any) {
    console.error('createForm error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถสร้างฟอร์มได้' };
  }
}

/**
 * Save form studio changes (Form properties + Form fields) with authorization check
 */
export async function saveFormStudio(
  formId: string,
  formPayload: Partial<FormDefinition>,
  fields: FormField[]
): Promise<ActionResult> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    // Check permissions
    const { data: currentForm, error: fetchErr } = await supabase
      .from('forms')
      .select('id, created_by, collaborator_ids')
      .eq('id', formId)
      .single();

    if (fetchErr || !currentForm) throw new Error('ไม่พบแบบฟอร์ม');

    const isOwner = Boolean(
      (currentForm.created_by && currentForm.created_by === context.userId) ||
      (context.personnelId && currentForm.created_by === context.personnelId)
    );
    const collabs: string[] = currentForm.collaborator_ids || [];
    const isCollab = Boolean(
      (context.userId && collabs.includes(context.userId)) ||
      (context.personnelId && collabs.includes(context.personnelId))
    );

    if (!context.isAdmin && !isOwner && !isCollab) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ในการแก้ไขแบบฟอร์มนี้' };
    }

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
    const { error: delErr } = await supabase
      .from('form_fields')
      .delete()
      .eq('form_id', formId);

    if (delErr) throw delErr;

    if (fields.length > 0) {
      const isDummyHelp = (text?: string | null) => {
        if (!text) return true;
        const t = text.trim();
        if (!t) return true;
        return (
          t === 'คำอธิบายเพิ่มเติมสำหรับส่วนนี้ (ถ้ามี)' ||
          t === 'Additional description for this section (optional)' ||
          t === '本节补充说明（可选）' ||
          t === 'คำอธิบายรูปภาพหรือคำแนะนำเพิ่มเติม (ถ้ามี)' ||
          t === 'Image caption or instructions (optional)' ||
          t === '图片说明或指引（可选）' ||
          t === 'ระบุเนื้อหา รายละเอียด กฎระเบียบ หรือข้อมูลสำคัญที่ต้องการแจ้งให้ผู้ตอบฟอร์มทราบโดยไม่ต้องให้ตอบคำถาม' ||
          (t.includes('(ถ้ามี)') && t.length <= 40) ||
          (t.includes('(optional)') && t.length <= 50) ||
          (t.includes('（可选）') && t.length <= 30)
        );
      };

      const fieldsToInsert = fields.map((f, idx) => {
        let cleanHelp = f.help_text;
        if (cleanHelp && isDummyHelp(cleanHelp.th) && isDummyHelp(cleanHelp.en) && isDummyHelp(cleanHelp.zh)) {
          cleanHelp = null;
        } else if (cleanHelp && !cleanHelp.th?.trim() && !cleanHelp.en?.trim() && !cleanHelp.zh?.trim()) {
          cleanHelp = null;
        }

        return {
          form_id: formId,
          field_key: f.field_key || `field_${idx + 1}`,
          label: f.label || { th: 'คำถามที่ ' + (idx + 1) },
          help_text: cleanHelp || null,
          field_type: f.field_type || 'text',
          is_required: Boolean(f.is_required),
          options: f.options || null,
          validation: f.validation || null,
          image_url: f.image_url || null,
          sort_order: idx,
          width: f.width || 'full',
        };
      });

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
 * Toggle form publish status (Only Owner, Collaborators or Admin)
 */
export async function toggleFormPublish(formId: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    const { data: currentForm, error: fetchErr } = await supabase
      .from('forms')
      .select('id, created_by, collaborator_ids')
      .eq('id', formId)
      .single();

    if (fetchErr || !currentForm) throw new Error('ไม่พบแบบฟอร์ม');

    const isOwner = Boolean(
      (currentForm.created_by && currentForm.created_by === context.userId) ||
      (context.personnelId && currentForm.created_by === context.personnelId)
    );
    const collabs: string[] = currentForm.collaborator_ids || [];
    const isCollab = Boolean(
      (context.userId && collabs.includes(context.userId)) ||
      (context.personnelId && collabs.includes(context.personnelId))
    );

    if (!context.isAdmin && !isOwner && !isCollab) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ในการเปลี่ยนสถานะแบบฟอร์มนี้' };
    }

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
 * Delete a form and its responses (Strict: Only Owner or Admin can delete)
 */
export async function deleteForm(formId: string): Promise<ActionResult> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    const { data: currentForm, error: fetchErr } = await supabase
      .from('forms')
      .select('id, created_by')
      .eq('id', formId)
      .single();

    if (fetchErr || !currentForm) throw new Error('ไม่พบแบบฟอร์ม');

    const isOwner = Boolean(
      (currentForm.created_by && currentForm.created_by === context.userId) ||
      (context.personnelId && currentForm.created_by === context.personnelId)
    );

    if (!context.isAdmin && !isOwner) {
      return { success: false, error: 'เฉพาะผู้สร้างแบบฟอร์มหรือผู้ดูแลระบบเท่านั้นที่สามารถลบแบบฟอร์มนี้ได้' };
    }

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
 * Get form responses for analytics (Owner, Collaborators or Admin)
 */
export async function getFormResponses(formId: string): Promise<ActionResult<{
  form: FormDefinition;
  fields: FormField[];
  responses: FormResponse[];
}>> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    const [formRes, fieldsRes, responsesRes] = await Promise.all([
      supabase.from('forms').select('*').eq('id', formId).single(),
      supabase.from('form_fields').select('*').eq('form_id', formId).order('sort_order', { ascending: true }),
      supabase.from('form_responses').select('*').eq('form_id', formId).order('submitted_at', { ascending: false }),
    ]);

    if (formRes.error || !formRes.data) throw new Error('ไม่พบข้อมูลแบบฟอร์ม');
    if (fieldsRes.error) throw fieldsRes.error;
    if (responsesRes.error) throw responsesRes.error;

    const currentForm = formRes.data;
    const isOwner = Boolean(
      (currentForm.created_by && currentForm.created_by === context.userId) ||
      (context.personnelId && currentForm.created_by === context.personnelId)
    );
    const collabs: string[] = currentForm.collaborator_ids || [];
    const isCollab = Boolean(
      (context.userId && collabs.includes(context.userId)) ||
      (context.personnelId && collabs.includes(context.personnelId))
    );

    if (!context.isAdmin && !isOwner && !isCollab) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ในการดูข้อมูลการตอบกลับของแบบฟอร์มนี้' };
    }

    return {
      success: true,
      data: {
        form: {
          ...currentForm,
          is_owner: isOwner,
          can_manage_permissions: context.isAdmin || isOwner,
          can_edit: context.isAdmin || isOwner || isCollab,
        } as FormDefinition,
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
 * Delete single response (Owner, Collaborators or Admin)
 */
export async function deleteResponse(responseId: string, formId: string): Promise<ActionResult> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    const { data: currentForm } = await supabase
      .from('forms')
      .select('id, created_by, collaborator_ids')
      .eq('id', formId)
      .single();

    if (!currentForm) throw new Error('ไม่พบแบบฟอร์ม');

    const isOwner = Boolean(
      (currentForm.created_by && currentForm.created_by === context.userId) ||
      (context.personnelId && currentForm.created_by === context.personnelId)
    );
    const collabs: string[] = currentForm.collaborator_ids || [];
    const isCollab = Boolean(
      (context.userId && collabs.includes(context.userId)) ||
      (context.personnelId && collabs.includes(context.personnelId))
    );

    if (!context.isAdmin && !isOwner && !isCollab) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ในการลบการตอบกลับนี้' };
    }

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

/**
 * Fetch candidates for form collaborators (all active personnel)
 */
export async function getFormCollaboratorCandidates(): Promise<ActionResult<{
  id: string;
  name_th: string;
  name_en?: string;
  position_th: string;
  category?: string;
  email: string | null;
  image_url?: string | null;
  user_id?: string | null;
}[]>> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('personnel')
      .select('id, name_th, name_en, position_th, category, email, image_url, user_id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('getFormCollaboratorCandidates error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถโหลดรายชื่อบุคลากรได้' };
  }
}

/**
 * Update collaborators for a form (Owner or Admin only)
 * Creator grants permission to other teachers/staff
 */
export async function updateFormCollaborators(
  formId: string,
  collaboratorIds: string[]
): Promise<ActionResult<{ collaborator_ids: string[] }>> {
  try {
    const auth = await verifyFormAuth();
    if (!auth.authorized || !auth.context) return { success: false, error: auth.error };

    const { context } = auth;
    const supabase = getAdminClient();

    const { data: currentForm, error: fetchErr } = await supabase
      .from('forms')
      .select('id, created_by')
      .eq('id', formId)
      .single();

    if (fetchErr || !currentForm) throw new Error('ไม่พบแบบฟอร์ม');

    const isOwner = Boolean(
      (currentForm.created_by && currentForm.created_by === context.userId) ||
      (context.personnelId && currentForm.created_by === context.personnelId)
    );

    if (!context.isAdmin && !isOwner) {
      return {
        success: false,
        error: 'เฉพาะผู้สร้างแบบฟอร์มหรือผู้ดูแลระบบเท่านั้นที่สามารถกำหนดสิทธิ์ผู้ร่วมจัดการได้',
      };
    }

    const { error } = await supabase
      .from('forms')
      .update({
        collaborator_ids: collaboratorIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', formId);

    if (error) throw error;

    return { success: true, data: { collaborator_ids: collaboratorIds } };
  } catch (err: any) {
    console.error('updateFormCollaborators error:', err);
    return { success: false, error: err?.message || 'ไม่สามารถบันทึกสิทธิ์ผู้ร่วมจัดการได้' };
  }
}
