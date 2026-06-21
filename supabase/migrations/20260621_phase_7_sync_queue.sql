-- Create sync queue table
CREATE TABLE public.sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL, -- e.g., 'payment', 'student', 'fee_type'
    entity_id TEXT NOT NULL, -- The ID of the record in POS system
    action TEXT NOT NULL, -- e.g., 'create', 'update', 'delete'
    payload JSONB NOT NULL, -- The actual data to send
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add index for efficient querying
CREATE INDEX idx_sync_queue_status ON public.sync_queue(status);
CREATE INDEX idx_sync_queue_entity ON public.sync_queue(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage sync queue"
ON public.sync_queue FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE app_users.id = auth.uid() 
    AND app_users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE app_users.id = auth.uid() 
    AND app_users.role = 'admin'
  )
);
