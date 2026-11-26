-- ============================================================================
-- SVPortal-Post Combined Idempotent Migration & Live Remediation Bundle (2026-11-26)
-- Target Supabase Project Ref: ufsqavndpjphowuacxfi
-- Run once in Supabase Dashboard -> SQL Editor (or via psql).
-- ============================================================================

-- >>> BEGIN supabase/migrations/20261126000001_post_assistant_and_website_v2.sql >>>
-- 1. Create public.social_posts
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL DEFAULT 'main' CHECK (brand IN ('main', 'football', 'swimming', 'tutoring')),
  media_mode TEXT NOT NULL DEFAULT 'photo' CHECK (media_mode IN ('photo', 'video')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'publishing', 'partial', 'published', 'scheduled', 'archived')),
  activity_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  cover_headline JSONB,
  captions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_draft_captions JSONB,
  hook_archetype TEXT,
  is_gold_example BOOLEAN NOT NULL DEFAULT false,
  category TEXT DEFAULT 'activity',
  media_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_channels JSONB NOT NULL DEFAULT '{}'::jsonb,
  fb_post_id TEXT,
  fb_permalink TEXT,
  ig_media_id TEXT,
  ig_permalink TEXT,
  website_news_id UUID,
  website_album_id UUID,
  signage_media_id TEXT,
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  channel_errors JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdpa_attested BOOLEAN NOT NULL DEFAULT false,
  pdpa_attested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pdpa_attested_at TIMESTAMPTZ,
  pdpa_flagged_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_brand_created
  ON public.social_posts (brand, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_gold_examples
  ON public.social_posts (brand, category)
  WHERE is_gold_example = true;

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_posts_admin_manage" ON public.social_posts;
CREATE POLICY "social_posts_admin_manage"
  ON public.social_posts FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive'))
  WITH CHECK (public.get_user_role() IN ('admin', 'executive'));

-- 2. Extend public.news
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS title_zh TEXT,
  ADD COLUMN IF NOT EXISTS content_zh TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_th TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_en TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_zh TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS site_targets TEXT[] NOT NULL DEFAULT ARRAY['somkidvittaya']::text[],
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'activity',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'cms',
  ADD COLUMN IF NOT EXISTS source_post_id UUID REFERENCES public.social_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS show_in_parent_portal BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_slug_unique
  ON public.news (slug)
  WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_source_post_id
  ON public.news (source_post_id)
  WHERE source_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_published_schedule
  ON public.news (is_published, scheduled_at, published_at DESC);

-- 3. Extend public.albums and public.album_photos
ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS title_zh TEXT,
  ADD COLUMN IF NOT EXISTS description_zh TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS site_targets TEXT[] NOT NULL DEFAULT ARRAY['somkidvittaya']::text[],
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'activity',
  ADD COLUMN IF NOT EXISTS cover_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_post_id UUID REFERENCES public.social_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_slug_unique
  ON public.albums (slug)
  WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_source_post_id
  ON public.albums (source_post_id)
  WHERE source_post_id IS NOT NULL;

ALTER TABLE public.album_photos
  ADD COLUMN IF NOT EXISTS caption_zh TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER;

-- 4. Hardened RLS Policies
DROP POLICY IF EXISTS "Allow admin full access on news" ON public.news;
DROP POLICY IF EXISTS "Allow public read-only access on news" ON public.news;
DROP POLICY IF EXISTS "news_public_read" ON public.news;
DROP POLICY IF EXISTS "news_admin_manage" ON public.news;

CREATE POLICY "news_public_read"
  ON public.news FOR SELECT TO anon, authenticated
  USING (is_published = true AND (scheduled_at IS NULL OR scheduled_at <= now()));

CREATE POLICY "news_admin_manage"
  ON public.news FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive'))
  WITH CHECK (public.get_user_role() IN ('admin', 'executive'));

DROP POLICY IF EXISTS "Allow public read-only access on albums" ON public.albums;
DROP POLICY IF EXISTS "albums_public_read" ON public.albums;
CREATE POLICY "albums_public_read"
  ON public.albums FOR SELECT TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Allow public read-only access on album_photos" ON public.album_photos;
DROP POLICY IF EXISTS "album_photos_public_read" ON public.album_photos;
CREATE POLICY "album_photos_public_read"
  ON public.album_photos FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.albums a
      WHERE a.id = album_id AND a.is_published = true
    )
  );

DROP POLICY IF EXISTS "Allow public read-only access on calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_public_read" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_staff_read" ON public.calendar_events;

CREATE POLICY "calendar_events_public_read"
  ON public.calendar_events FOR SELECT TO anon
  USING (publish_to_web = true AND COALESCE(is_duty, false) = false);

CREATE POLICY "calendar_events_staff_read"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (true);

-- 5. Storage Buckets & Public Read Policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = 'file_size_limit'
  ) THEN
    UPDATE storage.buckets
    SET
      file_size_limit = 15728640,
      allowed_mime_types = ARRAY[
        'image/webp',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    WHERE id = 'website-content';

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'post-media',
      'post-media',
      true,
      52428800,
      ARRAY['image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = true,
      file_size_limit = 52428800,
      allowed_mime_types = ARRAY['image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime'];
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('post-media', 'post-media', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND c.relrowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "Public Read post-media" ON storage.objects;
    CREATE POLICY "Public Read post-media"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'post-media');
  END IF;
END $$;
-- <<< END supabase/migrations/20261126000001_post_assistant_and_website_v2.sql <<<

-- >>> BEGIN Live Remediation for [object Object] News & Album (2026-11-21) >>>
UPDATE public.news
SET
  title_th = 'หุ่นยนต์แห่งอนาคต: ศิลปินน้อยปฐมวัยระบายฝัน',
  title_en = 'Future Robots: Kindergarten Artists in Action',
  title_zh = '未来机器人：幼教部创意绘画大赛',
  excerpt_th = 'นักเรียนระดับอนุบาล โรงเรียนสมคิดวิทยา ถ่ายทอดจินตนาการหุ่นยนต์แห่งอนาคตผ่านผลงานศิลปะสร้างสรรค์ในงานแข่งขันทักษะวิชาการ ประจำปี 2569',
  excerpt_en = 'Kindergarten students at Somkidvittaya School expressed bold imagination through robot crayon artworks at the 2026 Academic Skills Competition.',
  excerpt_zh = '在2026年度学术技能大赛中，somkidvittaya学校的幼儿园阶段孩子以未来机器人为主题展现无限想象力与自信。',
  content_th = E'จินตนาการของเด็กวัยเยาว์จะแต่งแต้มอนาคตได้งดงามเพียงใด?\n\nในงานแข่งขันทักษะวิชาการ ประจำปี 2569 นักเรียนระดับอนุบาล ณ โรงเรียนสมคิดวิทยา ได้ถ่ายทอดไอเดียหุ่นยนต์ในอนาคตผ่านผลงานวาดภาพระบายสีด้วยสีเทียนอย่างสดใส\n\nทุกกล้ามเนื้อมือและสมาธิถูกเจียระไนเป็นความมั่นใจในการแสดงออกทางศิลปะ เสริมสร้างทักษะความคิดสร้างสรรค์และการแก้ปัญหาอย่างสมวัย พ่อแม่จะสุขใจเมื่อได้เห็นลูกรักเติบโตอย่างมีความสุขและภูมิใจในทุกผลงานของตนเอง',
  content_en = E'Can young hands color the future with bold imagination?\n\nAt the 2026 Academic Skills Competition, our Kindergarten students transformed vivid thoughts into brilliant robot crayon artworks. Focused minds and bright smiles filled the room as little artists expressed their boundless creativity.\n\nThrough artistic creation, our young learners build self-confidence, fine motor skills, and creative problem-solving capabilities—discovering the joy of self-expression while turning big ideas into colorful reality.',
  content_zh = E'幼小的双手能否描绘出未来的精彩梦想？\n\n在2026年度学术技能大赛中，somkidvittaya学校的幼儿园阶段孩子用绚丽的蜡笔画作展现了对未来机器人的无限遐想。孩子们专注创作，绽放自信笑容。\n\n通过绘画实践，幼儿不仅提升了动手能力与审美创造力，更建立了敢于表达的自信心。看到孩子自豪地展示作品，您也能感受到这种充满乐趣的成长蜕变。',
  slug = 'future-robots-kindergarten-artists-2026',
  category = 'competition',
  brand = 'main',
  status = 'published',
  source = 'post_assistant',
  updated_at = now()
WHERE id = '4c2e4e4d-5bda-49ba-b2cd-d8f2517d2be2';

UPDATE public.albums
SET
  title_th = 'หุ่นยนต์แห่งอนาคต: ศิลปินน้อยปฐมวัยระบายฝัน',
  title_en = 'Future Robots: Kindergarten Artists in Action',
  title_zh = '未来机器人：幼教部创意绘画大赛',
  description_th = 'ประมวลภาพบรรยากาศนักเรียนระดับอนุบาล โรงเรียนสมคิดวิทยา ร่วมแข่งขันวาดภาพระบายสีหัวข้อหุ่นยนต์แห่งอนาคต ในงานแข่งขันทักษะวิชาการ ประจำปี 2569',
  description_en = 'Highlights of Kindergarten students at Somkidvittaya School creating imaginative robot crayon artworks at the 2026 Academic Skills Competition.',
  description_zh = '2026年度学术技能大赛中，somkidvittaya学校幼儿园阶段孩子创作未来机器人蜡笔画作的精彩瞬间。',
  slug = 'future-robots-kindergarten-artists-2026',
  category = 'competition',
  brand = 'main',
  is_published = true,
  updated_at = now()
WHERE id = '7b29af37-3423-451c-9886-be9b19523981';
-- <<< END Live Remediation <<<
