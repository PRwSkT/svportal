/**
 * Exam Image & Diagram Layout Utilities
 * Somkidvittaya School
 * 
 * Provides Word-like image sizing, alignment, captions, and choice-level image handling.
 */

export type ImageSizePreset = 'sm' | 'md' | 'lg' | 'full';
export type ImageAlignPreset = 'left' | 'center' | 'right';

export interface ImageLayoutMeta {
  url: string;
  size: ImageSizePreset; // sm: 25-30%, md: 50-60%, lg: 75-80%, full: 100%
  align: ImageAlignPreset;
  caption: string;
}

export function parseImageUrlMeta(rawUrl: string | null | undefined): ImageLayoutMeta {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { url: '', size: 'md', align: 'center', caption: '' };
  }

  const hashIdx = rawUrl.indexOf('#');
  if (hashIdx === -1) {
    return { url: rawUrl, size: 'md', align: 'center', caption: '' };
  }

  const baseUrl = rawUrl.slice(0, hashIdx);
  const hashPart = rawUrl.slice(hashIdx + 1);

  try {
    const params = new URLSearchParams(hashPart);
    const size = (params.get('size') as ImageSizePreset) || 'md';
    const align = (params.get('align') as ImageAlignPreset) || 'center';
    const caption = params.get('caption') || '';

    return {
      url: baseUrl,
      size: ['sm', 'md', 'lg', 'full'].includes(size) ? size : 'md',
      align: ['left', 'center', 'right'].includes(align) ? align : 'center',
      caption
    };
  } catch {
    return { url: baseUrl, size: 'md', align: 'center', caption: '' };
  }
}

export type ExamImageMeta = ImageLayoutMeta;

export function formatImageUrlMeta(
  metaOrUrl: string | ImageLayoutMeta,
  size: ImageSizePreset = 'md',
  align: ImageAlignPreset = 'center',
  caption: string = ''
): string {
  if (!metaOrUrl) return '';
  if (typeof metaOrUrl === 'object') {
    const cleanBase = (metaOrUrl.url || '').split('#')[0];
    const params = new URLSearchParams();
    if (metaOrUrl.size && metaOrUrl.size !== 'md') params.set('size', metaOrUrl.size);
    if (metaOrUrl.align && metaOrUrl.align !== 'center') params.set('align', metaOrUrl.align);
    if (metaOrUrl.caption && metaOrUrl.caption.trim()) params.set('caption', metaOrUrl.caption.trim());
    const qs = params.toString();
    return qs ? `${cleanBase}#${qs}` : cleanBase;
  }
  const cleanBase = metaOrUrl.split('#')[0];

  const params = new URLSearchParams();
  if (size !== 'md') params.set('size', size);
  if (align !== 'center') params.set('align', align);
  if (caption && caption.trim()) params.set('caption', caption.trim());

  const qs = params.toString();
  return qs ? `${cleanBase}#${qs}` : cleanBase;
}

/**
 * Detect if a choice string contains an image URL
 */
export function isImageChoice(choiceValue: string | null | undefined): boolean {
  if (!choiceValue || typeof choiceValue !== 'string') return false;
  const trimmed = choiceValue.trim();
  if (trimmed.startsWith('data:image/')) return true;

  const bracketMatch = trimmed.match(/^\[(.*?)\]\s*(https?:\/\/.*|data:image\/.*)$/);
  const candidate = bracketMatch ? bracketMatch[2].trim() : trimmed.split('|')[0].trim();

  if (candidate.startsWith('data:image/')) return true;
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return candidate.includes('website-content') || 
           candidate.includes('exams/images') || 
           /\.(png|jpe?g|webp|svg|gif)($|[?#])/i.test(candidate);
  }
  return false;
}

export interface ParsedChoiceContent {
  isImage: boolean;
  imageUrl: string | null;
  labelText: string;
  label: string;
}

/**
 * Parse choice value that may contain both image URL and caption text (e.g. "https://...|รูปทรงปริซึม" or "[รูปทรง] https://...")
 */
export function parseChoiceContent(choiceValue: string | null | undefined): ParsedChoiceContent {
  if (!choiceValue || typeof choiceValue !== 'string') {
    return { isImage: false, imageUrl: null, labelText: '', label: '' };
  }

  const trimmed = choiceValue.trim();

  // Support "[label] url" format first
  const bracketMatch = trimmed.match(/^\[(.*?)\]\s*(https?:\/\/.*|data:image\/.*)$/);
  if (bracketMatch && isImageChoice(bracketMatch[2].trim())) {
    return {
      isImage: true,
      imageUrl: bracketMatch[2].trim(),
      labelText: bracketMatch[1].trim(),
      label: bracketMatch[1].trim()
    };
  }

  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    const first = parts[0].trim();
    const second = parts.slice(1).join('|').trim();
    if (isImageChoice(first)) {
      return { isImage: true, imageUrl: first, labelText: second, label: second };
    }
  }

  if (isImageChoice(trimmed)) {
    return { isImage: true, imageUrl: trimmed, labelText: '', label: '' };
  }

  return { isImage: false, imageUrl: null, labelText: trimmed, label: trimmed };
}
