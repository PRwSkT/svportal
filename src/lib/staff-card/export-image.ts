import QRCode from 'qrcode';
import { Personnel } from '@/types';
import { formatStaffName, formatStaffPosition, getStaffVerificationUrl } from './utils';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('/')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders the Front or Back of the Staff Digital ID Card directly onto an HTML5 Canvas.
 * Avoids all WebKit / iOS Safari SVG foreignObject & CSS oklab/3D-transform bugs.
 */
export async function renderStaffCardToDataUrl(
  personnel: Partial<Personnel>,
  side: 'front' | 'back'
): Promise<string> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  const W = 1080;
  const H = 1710; // Exact 720:1140 aspect ratio
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const nameInfo = formatStaffName(personnel.name_en, personnel.name_th);
  const positionEn = formatStaffPosition(personnel.position_en, personnel.position_th);

  // Fill pure white base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (side === 'front') {
    // 1. Background Template
    const bgImg = await loadImage('/staff-card/card-bg.png');
    ctx.drawImage(bgImg, 0, 0, W, H);

    // 2. Portrait Photo (matching exact Illustrator matrix or placeholder)
    const isSampleKruChattraporn =
      !personnel.image_url &&
      (Boolean(personnel.name_th?.includes('ฉัตรพร')) ||
        Boolean(personnel.name_en?.toUpperCase().includes('CHATTRAPORN')));
    const photoUrl =
      personnel.image_url || (isSampleKruChattraporn ? '/staff-card/sample-teacher.png' : null);

    if (photoUrl) {
      try {
        const portrait = await loadImage(photoUrl);
        const destX = -0.0117 * W;
        const destW = 1.1024 * W;
        const destH = 0.9283 * H;
        const destY = H - destH;

        const imgAspect = portrait.naturalWidth / portrait.naturalHeight;
        const boxAspect = destW / destH;
        let sx = 0;
        let sy = 0;
        let sw = portrait.naturalWidth;
        let sh = portrait.naturalHeight;

        if (imgAspect > boxAspect) {
          sw = portrait.naturalHeight * boxAspect;
          sx = (portrait.naturalWidth - sw) / 2;
        } else {
          sh = portrait.naturalWidth / boxAspect;
          sy = 0;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, destY, W, destH);
        ctx.clip();
        ctx.drawImage(portrait, sx, sy, sw, sh, destX, destY, destW, destH);
        ctx.restore();
      } catch (err) {
        console.warn('Could not draw portrait onto canvas (CORS or load error):', err);
      }
    }

    // 3. Soft White Bottom Gradient Overlay
    const gradTop = H * 0.70;
    const grad = ctx.createLinearGradient(0, H, 0, gradTop);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.96)');
    grad.addColorStop(0.60, 'rgba(255,255,255,0.65)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gradTop, W, H - gradTop);

    // 4. Right-aligned Foreground Typography
    const padRight = Math.round(W * 0.0726);
    const padBottom = Math.round(H * 0.072);
    const rightX = W - padRight;

    ctx.fillStyle = '#183e66';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';

    // Position + underline at bottom
    const posFontSize = Math.max(24, Math.round(W * 0.024));
    ctx.font = `700 ${posFontSize}px "Sukhumvit Set", -apple-system, BlinkMacSystemFont, sans-serif`;
    const posY = H - padBottom;
    ctx.fillText(positionEn, rightX, posY);

    const posMetrics = ctx.measureText(positionEn);
    ctx.fillStyle = 'rgba(24, 62, 102, 0.8)';
    ctx.fillRect(rightX - posMetrics.width, posY + 8, posMetrics.width, 4);

    // Last Name
    ctx.fillStyle = '#183e66';
    let currentY = posY - posFontSize - 16;
    if (nameInfo.lastName) {
      const lastFontSize = Math.round(W * 0.068);
      ctx.font = `500 ${lastFontSize}px "Sukhumvit Set", -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(nameInfo.lastName, rightX, currentY);
      currentY -= lastFontSize * 0.96;
    }

    // First Name
    const firstFontSize = Math.round(W * 0.12);
    ctx.font = `700 ${firstFontSize}px "Sukhumvit Set", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(nameInfo.firstName, rightX, currentY);

    // 5. Crisp S1RI THAM Logo at bottom center (above gradient)
    try {
      const siriImg = await loadImage('/staff-card/siritham-logo.png');
      const targetH = Math.round(H * 0.03);
      const targetW = Math.round(targetH * (siriImg.naturalWidth / siriImg.naturalHeight));
      const siriX = Math.round((W - targetW) / 2);
      const siriY = H - Math.round(H * 0.018) - targetH;
      ctx.drawImage(siriImg, siriX, siriY, targetW, targetH);
    } catch {}
  } else {
    // =========================================================================
    // BACK SIDE
    // =========================================================================
    try {
      const bldgImg = await loadImage('/staff-card/building-bg.png');
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.drawImage(bldgImg, 0, 0, W, H);
      ctx.restore();
    } catch {}

    const padX = 72;
    const padY = 72;

    // 2. Top Official School Logo (logo2.png)
    try {
      const logoImg = await loadImage('/logo2.png');
      const logoH = 160;
      const logoW = Math.round(logoH * (logoImg.naturalWidth / logoImg.naturalHeight));
      ctx.drawImage(logoImg, Math.round((W - logoW) / 2), padY, logoW, logoH);
    } catch {}

    ctx.fillStyle = 'rgba(24, 62, 102, 0.1)';
    ctx.fillRect(padX, padY + 185, W - padX * 2, 2);

    // 3. QR Code in Somkid Navy
    const verificationUrl = getStaffVerificationUrl(personnel.id || 'preview');
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 480,
      margin: 1,
      color: { dark: '#183e66', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
    const qrImg = await loadImage(qrDataUrl);
    const qrBoxSize = 460;
    const qrBoxX = Math.round((W - qrBoxSize) / 2);
    const qrBoxY = 470;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(24, 62, 102, 0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    const qrPad = 30;
    ctx.drawImage(qrImg, qrBoxX + qrPad, qrBoxY + qrPad, qrBoxSize - qrPad * 2, qrBoxSize - qrPad * 2);

    // 4. Center-aligned Staff Name & Position (Thai)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#183e66';
    const thaiName = nameInfo.fullNameTh || personnel.name_th || nameInfo.fullNameEn;
    ctx.font = `700 44px "Sukhumvit Set", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(thaiName, W / 2, qrBoxY + qrBoxSize + 95);

    ctx.fillStyle = '#475569';
    ctx.font = `500 32px "Sukhumvit Set", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(personnel.position_th || positionEn, W / 2, qrBoxY + qrBoxSize + 150);

    // 5. Bottom Validity Dates & Footer
    const footerTopY = H - 270;
    ctx.fillStyle = 'rgba(24, 62, 102, 0.15)';
    ctx.fillRect(padX, footerTopY, W - padX * 2, 2);

    const colW = (W - padX * 2) / 3;
    const cols = [
      { label: 'ปีการศึกษา', value: personnel.academic_year || '2569' },
      { label: 'วันออกบัตร', value: personnel.card_issue_date || '16 พ.ค. 2569' },
      { label: 'วันหมดอายุ', value: personnel.card_expire_date || '15 พ.ค. 2571' },
    ];

    cols.forEach((col, i) => {
      const cx = padX + colW * i + colW / 2;
      ctx.fillStyle = '#94a3b8';
      ctx.font = `700 24px "Sukhumvit Set", -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(col.label, cx, footerTopY + 55);

      ctx.fillStyle = '#183e66';
      ctx.font = `700 30px "Sukhumvit Set", -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(col.value, cx, footerTopY + 102);
    });

    ctx.fillStyle = 'rgba(24, 62, 102, 0.08)';
    ctx.fillRect(padX, footerTopY + 135, W - padX * 2, 2);

    ctx.fillStyle = '#64748b';
    ctx.font = `500 24px "Sukhumvit Set", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText('โรงเรียนสมคิดวิทยา อ.เมืองระยอง จ.ระยอง • โทร. 038-611251 • www.somkidvittaya.ac.th', W / 2, H - 70);
  }

  return canvas.toDataURL('image/png');
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binaryStr = atob(parts[1]);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Triggers native Share Sheet (iOS Save Image to Photos) or standard file download.
 */
export async function shareOrDownloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const blob = dataUrlToBlob(dataUrl);
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
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

export async function exportStaffCardToPng(
  personnel: Partial<Personnel>,
  side: 'front' | 'back',
  filename: string
): Promise<string> {
  const dataUrl = await renderStaffCardToDataUrl(personnel, side);
  await shareOrDownloadDataUrl(dataUrl, filename);
  return dataUrl;
}
