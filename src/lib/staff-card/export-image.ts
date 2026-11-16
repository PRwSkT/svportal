import { toPng } from 'html-to-image';

/**
 * High-resolution PNG exporter for staff digital ID cards using html-to-image.
 * Natively supports modern CSS color spaces (oklch, oklab, display-p3) without
 * throwing 'unsupported color function' errors.
 */
export async function exportCardToPng(
  element: HTMLElement,
  filename: string
): Promise<void> {
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

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err: any) {
    console.error('Error in exportCardToPng:', err);
    throw new Error(err?.message || 'ไม่สามารถสร้างรูปภาพบัตรได้');
  }
}
