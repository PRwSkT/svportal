export type BrandId = 'main' | 'football' | 'swimming' | 'tutoring';

export type MediaMode = 'photo' | 'video';

export type HookArchetype =
  | 'micro_moment'
  | 'parent_insight'
  | 'paradigm_shift'
  | 'process_over_product'
  | 'curiosity_question'
  | 'heritage_prestige';

export type PostCategory =
  | 'academic'
  | 'activity'
  | 'announcement'
  | 'award'
  | 'admission'
  | 'sports'
  | 'community'
  | 'competition'
  | 'general';

export type RefinePreset = 'warm' | 'prestige' | 'punchy_ig' | 'admissions' | 'new_hooks';

export interface ActivityBrief {
  activityName: string;
  eventDate: string; // YYYY-MM-DD or empty
  studentGroup: string;
  activityTypes: string[];
  details: string;
  objective: string;
  desiredHashtags: string;
  tone: string;
}

export interface CoverHeadline {
  headline: string;
  subhead: string;
  detail: string;
}

export interface FocalPoint {
  x: number; // 0.0 - 1.0
  y: number; // 0.0 - 1.0
}

export interface MediaManifestItem {
  id: string;
  fileName: string;
  kind: 'image' | 'video';
  excluded: boolean;
  aiRejected?: boolean;
  aiOrder?: number;
  focalPoint: FocalPoint;
  width?: number;
  height?: number;
  // Uploaded Supabase paths when staged/published
  fbStoragePath?: string;
  fbPublicUrl?: string;
  igStoragePath?: string;
  igPublicUrl?: string;
  websiteStoragePath?: string;
  websitePublicUrl?: string;
  ogStoragePath?: string;
  ogPublicUrl?: string;
  videoStoragePath?: string;
  videoPublicUrl?: string;
}

export interface SocialCaptions {
  fb_th: string;
  fb_en: string;
  fb_zh: string;
  ig_en: string;
  hashtags: string[];
  signature_en?: string;
}

export interface WebsiteEditorialContent {
  title: {
    th: string;
    en: string;
    zh: string;
  };
  excerpt: {
    th: string;
    en: string;
    zh: string;
  };
  body: {
    th: string;
    en: string;
    zh: string;
  };
  category: PostCategory;
  tags: string[];
  slug_en: string;
}

export interface HookAlternative {
  archetype: HookArchetype;
  label_th: string;
  hook_en: string;
  hook_th: string;
  hook_zh: string;
}

export interface PostQualityAssessment {
  brand: number;
  story: number;
  emotion: number;
  overall: number;
  suggestion_th: string;
}

export interface StructuredCaptions {
  social: SocialCaptions;
  website: WebsiteEditorialContent;
  hook_alternatives?: HookAlternative[];
  observed_micro_moments?: string[];
  cover_reason_th?: string;
  quality?: PostQualityAssessment;
  grade_warnings?: string[];
}

export interface AIGenerateResponse {
  observed_micro_moments: string[];
  hook_archetype: HookArchetype;
  hook_alternatives: HookAlternative[];
  ordered_image_indices: number[];
  cover_reason_th: string;
  cover_focal_point: FocalPoint;
  cover_headline: CoverHeadline | null;
  social: SocialCaptions;
  website: WebsiteEditorialContent;
  quality: PostQualityAssessment;
  grade_warnings: string[];
  model_used: string;
  research_used: boolean;
}

export interface TargetChannelsConfig {
  facebook: boolean;
  instagram: boolean;
  website: boolean;
  websiteMode: 'publish' | 'draft' | 'schedule';
  scheduledAt?: string | null;
  triggerRebuild?: boolean;
}

export interface SocialPostRecord {
  id: string;
  brand: BrandId;
  media_mode: MediaMode;
  status: 'draft' | 'publishing' | 'partial' | 'published' | 'scheduled' | 'archived';
  activity_brief: ActivityBrief;
  cover_headline: CoverHeadline | null;
  captions: StructuredCaptions;
  ai_draft_captions?: StructuredCaptions | null;
  hook_archetype?: HookArchetype | null;
  is_gold_example: boolean;
  category: PostCategory;
  media_manifest: MediaManifestItem[];
  target_channels: TargetChannelsConfig;
  fb_post_id?: string | null;
  fb_permalink?: string | null;
  ig_media_id?: string | null;
  ig_permalink?: string | null;
  website_news_id?: string | null;
  website_album_id?: string | null;
  signage_media_id?: string | null;
  calendar_event_id?: string | null;
  channel_errors: Record<string, string>;
  pdpa_attested: boolean;
  pdpa_attested_by?: string | null;
  pdpa_attested_at?: string | null;
  pdpa_flagged_count?: number;
  created_by?: string | null;
  updated_by?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebsitePublishPayload {
  mode: 'publish' | 'draft' | 'schedule' | 'unpublish' | 'delete';
  scheduled_at?: string | null;
  brand: BrandId;
  site_targets?: string[];
  category: PostCategory;
  tags: string[];
  event_date: string;
  calendar_event_id?: string | null;
  slug_en: string;
  titles: { th: string; en: string; zh: string };
  excerpts: { th: string; en: string; zh: string };
  contents: { th: string; en: string; zh: string };
  cover: { storage_path: string; og_jpeg_storage_path?: string } | null;
  gallery: Array<{
    storage_path: string;
    width?: number;
    height?: number;
    caption_th?: string;
    caption_en?: string;
    caption_zh?: string;
    sort_order: number;
  }>;
  video?: { storage_path?: string; fb_reel_url?: string; ig_reel_url?: string } | null;
  social_links?: { fb_url?: string; ig_url?: string; fb_post_id?: string; ig_media_id?: string };
  show_in_parent_portal?: boolean;
  trigger_static_rebuild?: boolean;
}
