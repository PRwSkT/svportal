-- ==========================================
-- SV Portal Phase 10: Forms Builder & Multilingual System
-- Description: Tables for creating, translating, and collecting forms
-- ==========================================

-- 1. Create forms table
CREATE TABLE IF NOT EXISTS public.forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title JSONB NOT NULL,
    description JSONB,
    banner_url TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    access_type TEXT NOT NULL DEFAULT 'public' CHECK (access_type IN ('public', 'internal_all', 'internal_teacher')),
    is_published BOOLEAN DEFAULT false,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    max_responses INTEGER,
    response_count INTEGER DEFAULT 0,
    allow_multiple BOOLEAN DEFAULT true,
    thank_you_title JSONB,
    thank_you_message JSONB,
    notify_emails TEXT[],
    created_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create form_fields table
CREATE TABLE IF NOT EXISTS public.form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    label JSONB NOT NULL,
    help_text JSONB,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'radio', 'checkbox', 'select', 'date', 'time', 'file_upload', 'rating', 'section_header')),
    is_required BOOLEAN DEFAULT false,
    options JSONB,
    validation JSONB,
    sort_order INTEGER NOT NULL DEFAULT 0,
    width TEXT DEFAULT 'full' CHECK (width IN ('full', 'half')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create form_responses table
CREATE TABLE IF NOT EXISTS public.form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    respondent_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    respondent_email TEXT,
    respondent_ip TEXT,
    submission_lang TEXT NOT NULL DEFAULT 'th',
    answers JSONB NOT NULL,
    attachments JSONB,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forms_slug ON public.forms(slug);
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON public.form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON public.form_responses(form_id);

-- Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

-- Storage bucket for form attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('form-attachments', 'form-attachments', true)
ON CONFLICT (id) DO NOTHING;
