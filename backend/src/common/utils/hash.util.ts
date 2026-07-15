import { createHash, createHmac, randomBytes } from 'crypto';

/** Fixed-length hex digest of an opaque token — used to store refresh tokens & reset tokens. */
export const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

/** HMAC-SHA256 hex — used for QR signatures. */
export const hmacSha256 = (secret: string, input: string): string =>
  createHmac('sha256', secret).update(input).digest('hex');

/** URL-safe random token of arbitrary length (base64url without padding). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** Constant-time string compare. */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
};
