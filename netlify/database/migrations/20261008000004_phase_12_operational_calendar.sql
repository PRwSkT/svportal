-- Migration: Phase 12 - Operational Work Calendar & School Website Synchronization
-- Description: Extends calendar_events with operational metadata, duty rosters, target roles, and notification dispatch tracking.

-- 1. Expand category check constraint
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_category_check;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_category_check 
  CHECK (category = ANY (ARRAY[
    'academic'::text, 
    'activity'::text, 
    'holiday'::text, 
    'other'::text, 
    'duty'::text, 
    'meeting'::text, 
    'administrative'::text
  ]));

-- 2. Add operational work calendar columns to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS target_role text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS assigned_personnel_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_duty boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS duty_type text,
  ADD COLUMN IF NOT EXISTS publish_to_web boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS color_code text,
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS notification_dispatched_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 3. Create indices for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON public.calendar_events (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON public.calendar_events (category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_publish ON public.calendar_events (publish_to_web);
CREATE INDEX IF NOT EXISTS idx_calendar_events_duty ON public.calendar_events (is_duty);
