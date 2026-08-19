import { createHash } from 'node:crypto';

/**
 * Hashing & normalisasi Meta — DS-09.
 * Dipakai untuk export data ke Meta Ads (server-side). Normalisasi mengikuti
 * aturan 04-BRIEF-BE.md §7. Nilai kosong tetap kosong — jangan pernah hash
 * string kosong.
 */

export function sha256Hex(text: string | null | undefined): string {
  if (text === null || text === undefined || text === '') return '';
  return createHash('sha256').update(text).digest('hex');
}

/** '62 812-3456-789' → '628123456789'. null → ''. */
function normalizePhone(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.replace(/[^\d]/g, '');
}

/** Trim + lowercase + buang tanda baca + collapse spasi. null → ''. */
function normalizeText(
  value: string | null | undefined,
  keepEmailChars = false,
): string {
  if (value === null || value === undefined) return '';
  const cleaned = keepEmailChars
    ? value.toLowerCase().replace(/[^a-z0-9\s@.]/g, '')
    : value.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  return cleaned.replace(/\s+/g, ' ').trim();
}

export const normalizeForMeta = {
  phone: normalizePhone,
  email: (v: string | null | undefined) => normalizeText(v, true),
  name: (v: string | null | undefined) => normalizeText(v),
  city: (v: string | null | undefined) => normalizeText(v),
  state: (v: string | null | undefined) => normalizeText(v),
} as const;
