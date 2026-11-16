import katex from 'katex';

/**
 * Escapes HTML control characters (&, <, >, ", ') to prevent Cross-Site Scripting (XSS).
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely parses and renders text with embedded math equations ($...$ and $$...$$ or raw LaTeX).
 * Escapes all surrounding normal text to prevent XSS injection, and renders KaTeX safely
 * with throwOnError: false, strict: 'ignore', and trust: false.
 */
export function renderSafeKaTeX(text: string): string {
  if (!text) return '';
  const str = String(text);

  // If text contains $ delimiters for math equations
  if (str.includes('$')) {
    // Matches display math ($$...$$) or inline math ($...$)
    const mathRegex = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^\$])+?)\$/g;
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mathRegex.exec(str)) !== null) {
      // Escape all normal text prior to this math expression
      if (match.index > lastIndex) {
        result += escapeHtml(str.slice(lastIndex, match.index));
      }

      if (match[1] !== undefined) {
        // Display mode equation ($$...$$)
        const eq = match[1];
        try {
          result += katex.renderToString(eq, {
            displayMode: true,
            throwOnError: false,
            strict: 'ignore',
            trust: false
          });
        } catch {
          result += escapeHtml(`$$${eq}$$`);
        }
      } else if (match[2] !== undefined) {
        // Inline mode equation ($...$)
        const eq = match[2];
        try {
          result += katex.renderToString(eq, {
            displayMode: false,
            throwOnError: false,
            strict: 'ignore',
            trust: false
          });
        } catch {
          result += escapeHtml(`$${eq}$`);
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Escape any remaining normal text after the last equation
    if (lastIndex < str.length) {
      result += escapeHtml(str.slice(lastIndex));
    }

    return result;
  }

  // Fallback: If text starts with raw LaTeX commands without $ delimiters (e.g. \frac{1}{2}, \sqrt{x})
  if (/^\s*\\(frac|sqrt|times|div|pm|cdot|le|ge|neq|approx|pi|theta|alpha|beta|Delta|Omega|sum|int|infty|angle|triangle|left|right|vec|text)\b/.test(str)) {
    try {
      return katex.renderToString(str, {
        displayMode: false,
        throwOnError: false,
        strict: 'ignore',
        trust: false
      });
    } catch {
      return escapeHtml(str);
    }
  }

  // Normal text without math expressions: escape completely
  return escapeHtml(str);
}

/**
 * Sanitizes SVG markup by stripping dangerous tags (<script>, <foreignObject>, <iframe>, <object>, <embed>, etc.),
 * all event handler attributes (on*), and dangerous URI schemes (javascript:, vbscript:, data:text/html),
 * while preserving valid educational diagram elements (paths, rects, circles, lines, polylines, texts, markers, defs, styles).
 */
export function sanitizeSvg(svg: string): string {
  if (!svg || typeof svg !== 'string') return '';
  let cleaned = svg;

  // Dangerous element tags whose entire block (opening, body, closing) must be removed
  const dangerousTags = [
    'script', 'foreignobject', 'iframe', 'object', 'embed', 'applet',
    'meta', 'link', 'audio', 'video', 'source', 'track', 'form',
    'input', 'button', 'textarea', 'select', 'option', 'handler', 'listener'
  ];

  // Repeat removal until stable to prevent recursive bypasses (e.g., <scr<script>ipt>)
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    for (const tag of dangerousTags) {
      // Container pair: <tag ...>...</tag>
      const pairedRegex = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi');
      cleaned = cleaned.replace(pairedRegex, '');
      // Self-closing or unclosed tag: <tag ... /> or <tag ...>
      const singleRegex = new RegExp(`<\\/?${tag}\\b[^>]*\\/?>`, 'gi');
      cleaned = cleaned.replace(singleRegex, '');
    }
  }

  // Strip all inline event handler attributes (on*, case-insensitive, unquoted or quoted)
  cleaned = cleaned.replace(/\s*\bon[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip dangerous URI schemes in any attribute (href, xlink:href, src, etc.)
  // Detects javascript:, vbscript:, and data:text/html
  cleaned = cleaned.replace(/\s*(?:[a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"\s*(?:javascript|vbscript|data:\s*text\/html)[\s\S]*?"|'\s*(?:javascript|vbscript|data:\s*text\/html)[\s\S]*?'|[^\s>]*?(?:javascript|vbscript):[^\s>]*)/gi, '');

  // Sanitize inside <style> tags (remove @import and expression/behavior while preserving valid SVG CSS)
  cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    const cleanCss = css
      .replace(/@import[^;]+;/gi, '')
      .replace(/url\s*\(\s*["']?\s*(?:javascript|data:text\/html)[^\)]*\)/gi, '')
      .replace(/expression\s*\([^\)]*\)/gi, '')
      .replace(/-moz-binding[^;]+;/gi, '');
    return `<style>${cleanCss}</style>`;
  });

  return cleaned.trim();
}
