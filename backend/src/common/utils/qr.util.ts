import * as QRCode from 'qrcode';
import { hmacSha256, timingSafeEqual } from './hash.util';

/**
 * Build a signed QR payload of the form `TSKK|<academyId>|<studentCode>|<sig>`
 * where `sig = HMAC-SHA256(secret, "TSKK|<academyId>|<studentCode>")` truncated
 * to 16 hex chars for compactness.
 */
export function buildStudentQrPayload(params: {
  secret: string;
  academyId: string;
  studentCode: string;
}): { payload: string; signature: string } {
  const base = `TSKK|${params.academyId}|${params.studentCode}`;
  const signature = hmacSha256(params.secret, base).slice(0, 16);
  return { payload: `${base}|${signature}`, signature };
}

export function verifyStudentQrPayload(payload: string, secret: string): {
  valid: boolean;
  academyId?: string;
  studentCode?: string;
} {
  const parts = payload.split('|');
  if (parts.length !== 4 || parts[0] !== 'TSKK') return { valid: false };
  const [, academyId, studentCode, sig] = parts;
  const expected = hmacSha256(secret, `TSKK|${academyId}|${studentCode}`).slice(0, 16);
  const valid = timingSafeEqual(expected, sig);
  return valid ? { valid, academyId, studentCode } : { valid: false };
}

export async function renderQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'H',
    margin: 1,
    scale: 8,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

export async function renderQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    margin: 1,
    scale: 6,
  });
}
