-- =============================================================================
-- In-House School Kitchen Engine (โรงครัวภายใน โรงเรียนสมคิดวิทยา)
-- นโยบาย: อาหารกลางวันรวมอยู่ในค่าเทอม ไม่รับเงินอุดหนุนอาหารกลางวันจากรัฐ
-- ทุกคนทานเมนูเดียวกัน ยกเว้นครู/บุคลากร และเด็กที่มีข้อจำกัดด้านอาหาร (แพ้/ศาสนา/โรค)
-- ต้นทุนวัตถุดิบบันทึกตามผังบัญชี สช. ม.32 รหัส 52200
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- 1. Student dietary profile (ข้อจำกัดด้านอาหารรายบุคคล)
CREATE TABLE IF NOT EXISTS public.student_dietary_profiles (
  student_id TEXT PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  diet_type TEXT NOT NULL DEFAULT 'REGULAR' CHECK (diet_type IN (
    'REGULAR', 'HALAL', 'VEGETARIAN', 'MEDICAL_SOFT', 'CUSTOM_ALLERGY'
  )),
  allergens TEXT[] NOT NULL DEFAULT '{}',
  forbidden_ingredients TEXT[] NOT NULL DEFAULT '{}',
  substitute_preference TEXT,
  medical_note TEXT,
  verified_by_nurse BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safety column migrations
ALTER TABLE public.student_dietary_profiles ADD COLUMN IF NOT EXISTS allergens TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.student_dietary_profiles ADD COLUMN IF NOT EXISTS forbidden_ingredients TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.student_dietary_profiles ADD COLUMN IF NOT EXISTS substitute_preference TEXT;
ALTER TABLE public.student_dietary_profiles ADD COLUMN IF NOT EXISTS medical_note TEXT;
ALTER TABLE public.student_dietary_profiles ADD COLUMN IF NOT EXISTS verified_by_nurse BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.student_dietary_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 2. Weekly cycle menu (เมนูมาตรฐาน + เมนูทดแทน)
CREATE TABLE IF NOT EXISTS public.kitchen_cycle_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_date DATE NOT NULL UNIQUE,
  standard_main_dish TEXT NOT NULL,
  standard_side_dish TEXT,
  standard_soup TEXT,
  standard_fruit TEXT,
  standard_allergens TEXT[] NOT NULL DEFAULT '{}',
  halal_substitute TEXT,
  vegetarian_substitute TEXT,
  allergy_free_substitute TEXT,
  soft_diet_substitute TEXT,
  staff_special_dish TEXT,
  target_cost_per_head NUMERIC(8, 2) NOT NULL DEFAULT 30,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safety column migrations
ALTER TABLE public.kitchen_cycle_menus ADD COLUMN IF NOT EXISTS standard_allergens TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.kitchen_cycle_menus ADD COLUMN IF NOT EXISTS halal_substitute TEXT;
ALTER TABLE public.kitchen_cycle_menus ADD COLUMN IF NOT EXISTS vegetarian_substitute TEXT;
ALTER TABLE public.kitchen_cycle_menus ADD COLUMN IF NOT EXISTS allergy_free_substitute TEXT;
ALTER TABLE public.kitchen_cycle_menus ADD COLUMN IF NOT EXISTS soft_diet_substitute TEXT;
ALTER TABLE public.kitchen_cycle_menus ADD COLUMN IF NOT EXISTS staff_special_dish TEXT;
ALTER TABLE public.kitchen_cycle_menus ADD COLUMN IF NOT EXISTS target_cost_per_head NUMERIC(8, 2) NOT NULL DEFAULT 30;

-- 3. Daily production sheet snapshot (ใบสั่งผลิตที่ล็อกแล้ว)
CREATE TABLE IF NOT EXISTS public.kitchen_daily_production_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prod_date DATE NOT NULL UNIQUE,
  cutoff_time TEXT NOT NULL DEFAULT '08:30',
  attendance_source TEXT NOT NULL DEFAULT 'LIVE_ATTENDANCE',
  nursery_standard INT NOT NULL DEFAULT 0,
  kindergarten_standard INT NOT NULL DEFAULT 0,
  primary_standard INT NOT NULL DEFAULT 0,
  special_tray_count INT NOT NULL DEFAULT 0,
  staff_count INT NOT NULL DEFAULT 0,
  staff_count_override INT,
  total_trays INT NOT NULL DEFAULT 0,
  special_tray_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('DRAFT', 'LOCKED')),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  raw_material_cost NUMERIC(12, 2),
  actual_cost_per_tray NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safety column migrations
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS nursery_standard INT NOT NULL DEFAULT 0;
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS kindergarten_standard INT NOT NULL DEFAULT 0;
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS primary_standard INT NOT NULL DEFAULT 0;
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS special_tray_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS staff_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS staff_count_override INT;
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS total_trays INT NOT NULL DEFAULT 0;
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS special_tray_manifest JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.kitchen_daily_production_sheets ADD COLUMN IF NOT EXISTS actual_cost_per_tray NUMERIC(10, 2);

-- 4. Raw material expense vouchers (ใบสำคัญจ่ายวัตถุดิบ — COA 52200)
CREATE TABLE IF NOT EXISTS public.kitchen_expense_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
  supplier_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER' CHECK (category IN (
    'MEAT', 'SEAFOOD', 'VEGETABLE', 'FRUIT', 'RICE_DRY', 'EGG_DAIRY', 'SEASONING', 'OIL_GAS', 'PACKAGING', 'OTHER'
  )),
  description TEXT NOT NULL,
  quantity NUMERIC(12, 3),
  unit TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  receipt_no TEXT,
  coa_code TEXT NOT NULL DEFAULT '52200',
  status TEXT NOT NULL DEFAULT 'RECORDED' CHECK (status IN ('RECORDED', 'VOID')),
  void_reason TEXT,
  voided_by TEXT,
  voided_at TIMESTAMPTZ,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_vouchers_date ON public.kitchen_expense_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_menus_date ON public.kitchen_cycle_menus(menu_date);

-- 5. Seed M-F cycle menus for the current school week in Bangkok if empty
DO $$
DECLARE
  v_mon DATE;
BEGIN
  -- Find Monday of current Bangkok week
  v_mon := date_trunc('week', (now() AT TIME ZONE 'Asia/Bangkok'))::date;
  
  -- Monday
  INSERT INTO public.kitchen_cycle_menus (
    menu_date, standard_main_dish, standard_side_dish, standard_soup, standard_fruit,
    standard_allergens, halal_substitute, vegetarian_substitute, allergy_free_substitute,
    soft_diet_substitute, staff_special_dish, target_cost_per_head
  ) VALUES (
    v_mon, 'ข้าวผัดหมูใส่ไข่', 'แตงกวา ต้นหอม', 'แกงจืดเต้าหู้หมูสับ', 'ส้ม',
    ARRAY['EGG', 'SOY'], 'ข้าวผัดไก่ใส่ไข่', 'ข้าวผัดเต้าหู้เห็ดหอม', 'ข้าวผัดผักไม่ใส่ไข่/ซีอิ๊วกลูเตนฟรี',
    'ข้าวต้มหมูสับเนื้อละเอียด', 'ข้าวผัดกะเพราหมูสับไข่ดาวกรอบ', 30
  ) ON CONFLICT (menu_date) DO NOTHING;

  -- Tuesday
  INSERT INTO public.kitchen_cycle_menus (
    menu_date, standard_main_dish, standard_side_dish, standard_soup, standard_fruit,
    standard_allergens, halal_substitute, vegetarian_substitute, allergy_free_substitute,
    soft_diet_substitute, staff_special_dish, target_cost_per_head
  ) VALUES (
    v_mon + 1, 'ไก่ทอดน้ำปลา ข้าวสวย', 'ผักลวกน้ำพริกอ่อง', 'ต้มจืดฟักไก่', 'กล้วยหอม',
    ARRAY['FISH'], 'ไก่ทอดน้ำปลา (ฮาลาล)', 'เต้าหู้ทอดกรอบซอสมะขาม', 'ไก่ย่างเกลือไม่หมักน้ำปลา',
    'โจ๊กไก่ฉีกขิงอ่อน', 'ต้มยำไก่บ้านน้ำใส ข้าวสวย', 30
  ) ON CONFLICT (menu_date) DO NOTHING;

  -- Wednesday
  INSERT INTO public.kitchen_cycle_menus (
    menu_date, standard_main_dish, standard_side_dish, standard_soup, standard_fruit,
    standard_allergens, halal_substitute, vegetarian_substitute, allergy_free_substitute,
    soft_diet_substitute, staff_special_dish, target_cost_per_head
  ) VALUES (
    v_mon + 2, 'ผัดผักรวมมิตรหมู ข้าวสวย', 'ไข่เจียวต้นหอม', 'แกงจืดวุ้นเส้น', 'แตงโม',
    ARRAY['EGG', 'SOY'], 'ผัดผักรวมมิตรไก่', 'ผัดผักรวมมิตรเต้าหู้ ไข่เจียวมังสวิรัติ', 'ผัดผักรวมมิตรไก่ไม่ใส่ไข่',
    'ข้าวต้มไก่สับนุ่ม', 'ผัดพริกแกงหมูกรอบ ไข่ดาว', 30
  ) ON CONFLICT (menu_date) DO NOTHING;

  -- Thursday
  INSERT INTO public.kitchen_cycle_menus (
    menu_date, standard_main_dish, standard_side_dish, standard_soup, standard_fruit,
    standard_allergens, halal_substitute, vegetarian_substitute, allergy_free_substitute,
    soft_diet_substitute, staff_special_dish, target_cost_per_head
  ) VALUES (
    v_mon + 3, 'แกงเขียวหวานไก่ ข้าวสวย', 'ไข่ต้ม', 'ผักกาดดองน้ำใส', 'ฝรั่ง',
    ARRAY['EGG', 'FISH'], 'แกงเขียวหวานไก่ (ฮาลาล)', 'แกงเขียวหวานเต้าหู้เห็ดรวม', 'ต้มจืดไก่ใส่ฟักไม่ใส่กะทิ',
    'ข้าวต้มไก่ผักนุ่ม', 'แกงเขียวหวานไก่ยอดมะพร้าว ไข่เค็ม', 30
  ) ON CONFLICT (menu_date) DO NOTHING;

  -- Friday
  INSERT INTO public.kitchen_cycle_menus (
    menu_date, standard_main_dish, standard_side_dish, standard_soup, standard_fruit,
    standard_allergens, halal_substitute, vegetarian_substitute, allergy_free_substitute,
    soft_diet_substitute, staff_special_dish, target_cost_per_head
  ) VALUES (
    v_mon + 4, 'ก๋วยเตี๋ยวหมูน้ำใส', 'ลูกชิ้นหมู เกี๊ยวทอด', 'น้ำซุปกระดูกหมูหอม', 'สับปะรด',
    ARRAY['SOY', 'WHEAT'], 'ก๋วยเตี๋ยวไก่น้ำใส', 'ก๋วยเตี๋ยวเห็ดหอมเต้าหู้ตุ๋น', 'เส้นเล็กไก่ต้มไม่ใส่ลูกชิ้น/เกี๊ยว',
    'เส้นหมี่ลวกเปื่อยน้ำซุปใส', 'ก๋วยเตี๋ยวต้มยำหมูมะนาวสด', 30
  ) ON CONFLICT (menu_date) DO NOTHING;
END $$;

-- 6. RLS: all kitchen tables are accessed only through server routes (service_role).
ALTER TABLE public.student_dietary_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_cycle_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_daily_production_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_expense_vouchers ENABLE ROW LEVEL SECURITY;
