/**
 * Isolated Print Sandbox Service
 * ระบบพิมพ์เอกสารผ่านกรอบกักกันอิสระ (Sandbox iFrame)
 * ป้องกันปัญหาส่วนติดต่อผู้ใช้ (UI Clutter) และ Dark Mode รั่วไหลลงกระดาษ
 * รองรับการพิมพ์ตรงไปยังเครื่องพิมพ์เลเซอร์, อิงค์เจ็ท, และเครื่องพิมพ์สลิปความร้อน (58mm/80mm)
 */

import { PAPER_CONFIGS, PaperSize, PrintDocumentOptions } from './types';

const THAI_PRINT_FONTS_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&display=swap');

@font-face {
  font-family: 'TH Sarabun New';
  src: local('TH Sarabun New'), local('THSarabunNew'), local('Sarabun');
}

* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

html, body {
  margin: 0 !important;
  padding: 0 !important;
  background-color: #ffffff !important;
  color: #000000 !important;
  font-family: 'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}

/* Remove default browser link styling in print */
a, a:visited {
  color: inherit !important;
  text-decoration: none !important;
}

/* Page break utilities */
.page-break-before {
  page-break-before: always !important;
  break-before: page !important;
}

.page-break-after {
  page-break-after: always !important;
  break-after: page !important;
}

.avoid-page-break {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

/* Table border collapse */
table {
  border-collapse: collapse;
  width: 100%;
}

th, td {
  border-color: #cbd5e1;
}

@media screen {
  body {
    padding: 20px;
    background: #f1f5f9 !important;
    display: flex;
    justify-content: center;
  }
  .print-page-screen-wrapper {
    background: white;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  }
}
`;

/**
 * สั่งพิมพ์เอกสารผ่าน iFrame Sandbox เพื่อให้ได้ไฟล์เวกเตอร์บริสุทธิ์ 100%
 */
export async function printDocumentViaSandbox(options: PrintDocumentOptions): Promise<void> {
  const {
    title,
    paperSize,
    contentHtml,
    extraCss = '',
    onBeforePrint,
    onAfterPrint,
    autoCloseTimeoutMs = 60000
  } = options;

  if (typeof window === 'undefined') return;

  onBeforePrint?.();

  // ดึงค่าการจัดหน้ากระดาษตามประเภท
  const config = PAPER_CONFIGS[paperSize] || PAPER_CONFIGS.A4_PORTRAIT;

  // สร้าง iFrame กักกันที่ซ่อนจากสายตาผู้ใช้
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '1000px';
  iframe.style.height = '1000px';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('ไม่สามารถเข้าถึงกรอบการพิมพ์อิสระ (Print Sandbox) ได้');
  }

  // สร้างโครงสร้าง HTML ฉบับสมบูรณ์
  const fullHtml = `
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title || 'เอกสารโรงเรียนสมคิดวิทยา'}</title>
        <style>
          @page {
            size: ${config.cssPageSize};
            margin: ${config.marginMm}mm;
          }
          ${THAI_PRINT_FONTS_CSS}
          ${extraCss}
        </style>
      </head>
      <body>
        <div id="print-content" class="print-page-screen-wrapper">
          ${contentHtml}
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(fullHtml);
  doc.close();

  // รอให้ฟอนต์และรูปภาพทั้งหมดโหลดเสร็จสมบูรณ์
  await waitForResourcesLoaded(doc);

  // ดำเนินการสั่งพิมพ์
  try {
    const win = iframe.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  } catch (err) {
    console.error('Error triggering iframe print:', err);
  } finally {
    onAfterPrint?.();
    // ทำลาย iFrame หลังจากปิดหน้าต่างพิมพ์แล้ว
    setTimeout(() => {
      try {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      } catch (e) {
        // ignore
      }
    }, 1500);
  }
}

/**
 * รอให้ฟอนต์และรูปภาพทั้งหมดในเอกสารพร้อมแสดงผล
 */
async function waitForResourcesLoaded(doc: Document): Promise<void> {
  const promises: Promise<unknown>[] = [];

  // รอ Font API
  if (doc.fonts && doc.fonts.ready) {
    promises.push(doc.fonts.ready);
  }

  // รอรูปภาพทั้งหมด
  const images = Array.from(doc.getElementsByTagName('img'));
  for (const img of images) {
    if (!img.complete) {
      promises.push(
        new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // ไม่บล็อกถ้าภาพโหลดไม่สำเร็จ
        })
      );
    }
  }

  // หน่วงเวลา safety margin 250ms เพื่อให้ CSS layout render สมบูรณ์
  promises.push(new Promise((resolve) => setTimeout(resolve, 250)));

  await Promise.all(promises);
}

/**
 * เปิดเอกสารในแท็บใหม่เพื่อดูตัวอย่าง (Preview Tab)
 */
export function openDocumentPreviewInTab(options: PrintDocumentOptions): void {
  const { title, paperSize, contentHtml, extraCss = '' } = options;
  const config = PAPER_CONFIGS[paperSize] || PAPER_CONFIGS.A4_PORTRAIT;

  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('กรุณาอนุญาตให้เปิดหน้าต่างป๊อปอัป (Popup) เพื่อดูตัวอย่างเอกสาร');
    return;
  }

  newWindow.document.write(`
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>${title || 'ตัวอย่างเอกสาร - โรงเรียนสมคิดวิทยา'}</title>
        <style>
          @page {
            size: ${config.cssPageSize};
            margin: ${config.marginMm}mm;
          }
          ${THAI_PRINT_FONTS_CSS}
          ${extraCss}
          @media screen {
            .preview-controls {
              position: sticky;
              top: 0;
              z-index: 1000;
              background: #0f172a;
              color: white;
              padding: 12px 24px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .preview-btn {
              background: #7B1C3E;
              color: white;
              border: none;
              padding: 8px 18px;
              border-radius: 8px;
              font-weight: bold;
              cursor: pointer;
              font-size: 13px;
              transition: all 0.2s;
            }
            .preview-btn:hover {
              background: #631430;
            }
          }
          @media print {
            .preview-controls {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="preview-controls">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-weight:bold;font-size:14px;">${title}</span>
            <span style="font-size:12px;opacity:0.75;">(ขนาดกระดาษ: ${config.cssPageSize})</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="preview-btn" onclick="window.print()">สั่งพิมพ์ (Print) / บันทึก PDF</button>
            <button class="preview-btn" style="background:#475569;" onclick="window.close()">ปิดหน้าต่าง</button>
          </div>
        </div>
        <div class="print-page-screen-wrapper">
          ${contentHtml}
        </div>
      </body>
    </html>
  `);
  newWindow.document.close();
}
