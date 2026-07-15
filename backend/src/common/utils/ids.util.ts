import { customAlphabet } from 'nanoid';

const NUM = customAlphabet('0123456789', 6);
const ALPHA_UPPER = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

/**
 * Generate a sequential-looking code such as `STU-000123` given a numeric counter.
 * Falls back to a nanoid when no counter is provided.
 */
export function formatEntityCode(prefix: string, counter?: number, width = 5): string {
  if (typeof counter === 'number' && Number.isFinite(counter) && counter > 0) {
    return `${prefix}-${counter.toString().padStart(width, '0')}`;
  }
  return `${prefix}-${NUM()}`;
}

/** Non-sequential public code (used for certificate numbers, event slugs). */
export const opaqueCode = (prefix: string): string => `${prefix}-${ALPHA_UPPER()}`;

/** Slugify a string for safe URL use. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}
