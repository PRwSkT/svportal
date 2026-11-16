import { toPng } from 'html-to-image';

/**
 * High-resolution PNG exporter for staff digital ID cards using html-to-image.
 * Natively supports modern CSS color spaces (oklch, oklab, display-p3) without
 * throwing 'unsupported color function' errors.
 *
 * On iOS / Safari, native Web Share API with File payload allows the user to
 * tap 'Save Image' (บันทึกภาพ) directly to their Camera Roll / Photos Gallery.
 */
export async function exportCardToPng(
  element: HTMLElement,
  filename: string
): Promise<string> {
  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: '#ffffff',
      style: {
        transform: 'none',
        opacity: '1',
        visibility: 'visible',
      },
    });

    // Check if on iOS or device supporting Web Share with files
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });

    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: 'บัตรประจำตัวบุคลากร โรงเรียนสมคิดวิทยา',
          text: 'แตะ "บันทึกภาพ" (Save Image) เพื่อเก็บรูปลงแกลเลอรี่ / คลังภาพ',
        });
        return dataUrl;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          // User closed share dialog, still return dataUrl
          return dataUrl;
        }
      }
    }

    // Fallback: standard anchor download for desktop / Android
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return dataUrl;
  } catch (err: any) {
    console.error('Error in exportCardToPng:', err);
    throw new Error(err?.message || 'ไม่สามารถสร้างรูปภาพบัตรได้');
  }
}
