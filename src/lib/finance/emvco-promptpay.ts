/**
 * EMVCo-compliant Thai QR Payment (PromptPay) payload generator.
 *
 *  - Tag 30  = "Bill Payment" (BOT Thai QR Payment standard): Biller ID + Ref1 + Ref2.
 *              Used for tuition so every incoming baht can be auto-reconciled:
 *                Ref1 = student id, Ref2 = invoice / installment number.
 *  - Tag 29  = "Credit Transfer" to a mobile number / national ID / e-wallet
 *              (used only when no references are supplied).
 *  - Tag 63  = CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) over the whole payload
 *              including the literal "6304".
 *
 * Pure module: no Node/DOM dependencies except the optional data-URL helper,
 * which lazy-loads `qrcode`.
 */

export const PROMPTPAY_AID_BILL_PAYMENT = 'A000000677010112';
export const PROMPTPAY_AID_CREDIT_TRANSFER = 'A000000677010111';
const CURRENCY_THB = '764';
const COUNTRY_TH = 'TH';

export interface PromptPayPayloadInput {
  /**
   * Bill payment: 13-digit tax ID (suffix "00" is appended automatically) or a full
   * 15-digit Biller ID. Credit transfer: mobile (0812345678), 13-digit national/tax ID
   * or 15-digit e-wallet ID.
   */
  targetId: string;
  /** Amount in THB. Omit/0 for a static (any-amount) QR. */
  amount?: number;
  /** Reference 1 (student id). Presence of ref1 or ref2 switches to Tag 30 bill payment. */
  ref1?: string;
  /** Reference 2 (invoice / installment number). */
  ref2?: string;
  /** Optional merchant name shown by some banking apps (Tag 59, max 25 chars, ASCII only). */
  merchantName?: string;
}

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC-16/CCITT-FALSE, returned as 4 upper-case hex chars. */
export function crc16CcittFalse(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= (input.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Bill-payment reference rule: A–Z 0–9 only, max 20 characters. */
export function sanitizePromptPayRef(value: string | undefined | null): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

function normalizeCreditTransferTarget(raw: string): { subTag: string; value: string } {
  const digits = raw.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) {
    // mobile number: drop leading 0, prefix country code, left-pad to 13 digits
    return { subTag: '01', value: `0066${digits.slice(1)}` };
  }
  if (/^66\d{9}$/.test(digits)) {
    return { subTag: '01', value: `00${digits}` };
  }
  if (/^\d{13}$/.test(digits)) {
    return { subTag: '02', value: digits };
  }
  if (/^\d{15}$/.test(digits)) {
    return { subTag: '03', value: digits };
  }
  throw new Error('รูปแบบหมายเลขพร้อมเพย์ไม่ถูกต้อง (ต้องเป็นเบอร์มือถือ 10 หลัก, เลข 13 หลัก หรือ 15 หลัก)');
}

function normalizeBillerId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (/^\d{13}$/.test(digits)) return `${digits}00`; // tax id + suffix 00
  if (/^\d{15}$/.test(digits)) return digits;
  throw new Error('Biller ID ต้องเป็นเลขประจำตัวผู้เสียภาษี 13 หลัก หรือ Biller ID 15 หลัก');
}

/** Builds the full EMVCo QR string (ready to be rendered as a QR code). */
export function formatPromptPayPayload(input: PromptPayPayloadInput): string {
  const amount = typeof input.amount === 'number' && input.amount > 0 ? Math.round(input.amount * 100) / 100 : 0;
  const ref1 = sanitizePromptPayRef(input.ref1);
  const ref2 = sanitizePromptPayRef(input.ref2);
  const isBillPayment = Boolean(ref1 || ref2);

  const parts: string[] = [];
  parts.push(tlv('00', '01'));
  parts.push(tlv('01', amount > 0 ? '12' : '11')); // 12 = dynamic (one-time amount), 11 = static

  if (isBillPayment) {
    const billerId = normalizeBillerId(input.targetId);
    let merchant = tlv('00', PROMPTPAY_AID_BILL_PAYMENT) + tlv('01', billerId);
    // Ref1 is mandatory in Tag 30; fall back to a dash-free placeholder if only ref2 is given.
    merchant += tlv('02', ref1 || '0');
    if (ref2) merchant += tlv('03', ref2);
    parts.push(tlv('30', merchant));
  } else {
    const { subTag, value } = normalizeCreditTransferTarget(input.targetId);
    parts.push(tlv('29', tlv('00', PROMPTPAY_AID_CREDIT_TRANSFER) + tlv(subTag, value)));
  }

  parts.push(tlv('53', CURRENCY_THB));
  if (amount > 0) parts.push(tlv('54', amount.toFixed(2)));
  parts.push(tlv('58', COUNTRY_TH));

  const merchantName = (input.merchantName ?? '').replace(/[^\x20-\x7E]/g, '').trim().slice(0, 25);
  if (merchantName) parts.push(tlv('59', merchantName));

  const withoutCrc = `${parts.join('')}6304`;
  return `${withoutCrc}${crc16CcittFalse(withoutCrc)}`;
}

/** Verifies the trailing CRC of a scanned/received payload. */
export function verifyPromptPayPayload(payload: string): boolean {
  if (payload.length < 8 || payload.slice(-8, -4) !== '6304') return false;
  return crc16CcittFalse(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}

/** Ref1 = student id, Ref2 = invoice number for auto-matching incoming bank credits. */
export function buildTuitionQrRefs(studentId: string, invoiceNo: string): { ref1: string; ref2: string } {
  return { ref1: sanitizePromptPayRef(studentId), ref2: sanitizePromptPayRef(invoiceNo) };
}

/** Parses Ref1/Ref2/amount from a Tag 30 payload (used by slip/webhook matchers and tests). */
export function parsePromptPayBillPayload(payload: string): {
  billerId: string | null;
  ref1: string | null;
  ref2: string | null;
  amount: number | null;
} {
  const readTlv = (s: string): Array<{ tag: string; value: string }> => {
    const out: Array<{ tag: string; value: string }> = [];
    let i = 0;
    while (i + 4 <= s.length) {
      const tag = s.slice(i, i + 2);
      const len = Number(s.slice(i + 2, i + 4));
      if (!Number.isFinite(len)) break;
      out.push({ tag, value: s.slice(i + 4, i + 4 + len) });
      i += 4 + len;
    }
    return out;
  };
  const top = readTlv(payload);
  const t30 = top.find((t) => t.tag === '30');
  const amountRaw = top.find((t) => t.tag === '54')?.value;
  const sub = t30 ? readTlv(t30.value) : [];
  return {
    billerId: sub.find((t) => t.tag === '01')?.value ?? null,
    ref1: sub.find((t) => t.tag === '02')?.value ?? null,
    ref2: sub.find((t) => t.tag === '03')?.value ?? null,
    amount: amountRaw ? Number(amountRaw) : null,
  };
}

/** Browser/server helper: renders the payload to a PNG data URL (lazy-loads `qrcode`). */
export async function generatePromptPayQrDataUrl(payload: string, width = 320): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width });
}
