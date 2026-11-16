-- Migration: Add user push subscriptions and in-app notifications
-- Author: Nong Fah & Antigravity AI
-- Date: 2026-10-07

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_role TEXT DEFAULT 'staff',
    user_email TEXT,
    device_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.user_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_role ON public.user_push_subscriptions(user_role);

CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_role TEXT DEFAULT 'all',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    action_url TEXT,
    sent_by TEXT DEFAULT 'nongfah_ai',
    is_read BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notif_recipient ON public.app_notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_app_notif_role ON public.app_notifications(recipient_role);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.user_push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
    ON public.user_push_subscriptions
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Admin can view all push subscriptions" ON public.user_push_subscriptions;
CREATE POLICY "Admin can view all push subscriptions"
    ON public.user_push_subscriptions
    FOR SELECT
    TO authenticated
    USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can view their notifications" ON public.app_notifications;
CREATE POLICY "Users can view their notifications"
    ON public.app_notifications
    FOR SELECT
    TO authenticated
    USING (
        recipient_user_id = auth.uid() OR
        recipient_role = 'all' OR
        recipient_role = public.get_user_role()
    );

DROP POLICY IF EXISTS "Users can mark own notifications as read" ON public.app_notifications;
CREATE POLICY "Users can mark own notifications as read"
    ON public.app_notifications
    FOR UPDATE
    TO authenticated
    USING (recipient_user_id = auth.uid())
    WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can manage all notifications" ON public.app_notifications;
CREATE POLICY "Admin can manage all notifications"
    ON public.app_notifications
    FOR ALL
    TO authenticated
    USING (public.get_user_role() = 'admin')
    WITH CHECK (public.get_user_role() = 'admin');
