-- ============================================================================
-- Phase 18: Nong Fah Collective Memory, Conversation Learning, and Expanded Student Schema
-- ============================================================================

-- 1. Expand students table with missing real-world school fields
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS ethnicity TEXT DEFAULT 'ไทย',
  ADD COLUMN IF NOT EXISTS current_address TEXT,
  ADD COLUMN IF NOT EXISTS line_id TEXT;

-- 2. Expand student_parents table with line_id
ALTER TABLE public.student_parents
  ADD COLUMN IF NOT EXISTS line_id TEXT;

-- 3. Create Nong Fah Conversations Logging for Teacher Learning
CREATE TABLE IF NOT EXISTS public.nongfah_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT,
  user_name TEXT,
  user_role TEXT,
  pathname TEXT,
  user_prompt TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  action_type TEXT,
  action_payload JSONB,
  key_learnings TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Nong Fah Collective Knowledge & Memory Table
CREATE TABLE IF NOT EXISTS public.nongfah_collective_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'general',
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  source_teacher TEXT,
  reference_url TEXT,
  frequency_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Enable RLS and setup policies
ALTER TABLE public.nongfah_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nongfah_collective_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read and write to nongfah_conversations" ON public.nongfah_conversations;
CREATE POLICY "Allow authenticated read and write to nongfah_conversations"
  ON public.nongfah_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read and write to nongfah_collective_memory" ON public.nongfah_collective_memory;
CREATE POLICY "Allow authenticated read and write to nongfah_collective_memory"
  ON public.nongfah_collective_memory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Initial Seed of School Knowledge
INSERT INTO public.nongfah_collective_memory (category, topic, content, source_teacher, frequency_count)
VALUES 
  ('academic', 'การตัดเกรดและส่งเล่ม ปพ.5', 'ครูวิชาการแจ้งแนวปฏิบัติ: ให้กรอกคะแนนระหว่างภาคและปลายภาคให้ครบ 100 คะแนน แล้วจึงคำนวณเกรด 8 ระดับ (4, 3.5, 3, 2.5, 2, 1.5, 1, 0) พร้อมตรวจเวลาเรียนเกิน 80%', 'ฝ่ายวิชาการ', 5),
  ('opec', 'การส่งออก สช. REGIS และ ORSS', 'การส่งออกไฟล์ข้อมูล สช. ต้องตรวจสอบความถูกต้องของเลข 13 หลัก และแปลงวันเกิดเป็น พ.ศ. 8 หลัก ระบบมีฟังก์ชันตรวจสอบอัตโนมัติ 100%', 'ฝ่ายทะเบียน', 4),
  ('forms', 'การคลีนข้อมูลสำรวจนักเรียน', 'ผู้ปกครองที่ตอบแบบสำรวจมักใส่ขีดในเบอร์โทร และตอบคำว่า ไม่มี ในช่องแพ้อาหาร/ยา ให้ระบบทำความสะอาดตัดขีดและแปลงเป็นค่าว่างก่อนเข้าฐานข้อมูล', 'คุณครูธุรการ', 6),
  ('nutrition', 'เงินอุดหนุนอาหารกลางวันและนม', 'เด็กอนุบาลได้รับเงินอาหารกลางวันทุกคน ส่วนประถมคัดกรองตามเกณฑ์รายได้ไม่เกิน 40,000 บาท/ปี หรือภาวะทุพโภชนาการ นมโรงเรียนแจก 200 วัน/ปี', 'ฝ่ายโภชนาการ', 3)
ON CONFLICT DO NOTHING;
