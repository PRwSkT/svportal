-- ==========================================
-- SV Portal Phase 8: Website Content Schema
-- Description: Tables for serving data to the Somkidvittaya Website
-- ==========================================

-- 1. Personnel (บุคลากร)
CREATE TABLE personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_th TEXT NOT NULL,
    name_en TEXT,
    position_th TEXT NOT NULL,
    position_en TEXT,
    category TEXT NOT NULL CHECK (category IN ('executive', 'teacher', 'staff')),
    image_url TEXT,
    bio_th TEXT,
    bio_en TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. News (ข่าวสารและประกาศ)
CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_th TEXT NOT NULL,
    title_en TEXT,
    content_th TEXT NOT NULL,
    content_en TEXT,
    cover_image_url TEXT,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Albums (แกลลอรี่)
CREATE TABLE albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_th TEXT NOT NULL,
    title_en TEXT,
    description_th TEXT,
    description_en TEXT,
    cover_image_url TEXT,
    event_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Album Photos (รูปภาพในแกลลอรี่)
CREATE TABLE album_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption_th TEXT,
    caption_en TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Calendar Events (ปฏิทินโรงเรียน)
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_th TEXT NOT NULL,
    title_en TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_holiday BOOLEAN DEFAULT false,
    category TEXT NOT NULL CHECK (category IN ('academic', 'holiday', 'activity')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Documents (ศูนย์ดาวน์โหลดเอกสาร)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_th TEXT NOT NULL,
    title_en TEXT,
    file_url TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('forms', 'manuals', 'policies')),
    file_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (Allow public read for the website)
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access on personnel" ON personnel FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public read-only access on news" ON news FOR SELECT USING (is_published = true);
CREATE POLICY "Allow public read-only access on albums" ON albums FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access on album_photos" ON album_photos FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access on calendar_events" ON calendar_events FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access on documents" ON documents FOR SELECT USING (true);
