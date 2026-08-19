/**
 * Konstanta dan tipe enum — DS-04.
 * Semua nilai diketik sekali di sini (`as const`), tipe union diturunkan otomatis.
 * Jangan mengetik string literal di tempat lain.
 */

// ===== Stage funnel lead =====
export const LEAD_STAGES = {
  cold: { label: 'Cold', color: '#64748B' },
  consultation: { label: 'Konsultasi', color: '#F59E0B' },
  offering: { label: 'Offering', color: '#8B5CF6' },
  closing: { label: 'Closing', color: '#10B981' },
} as const;
export type LeadStage = keyof typeof LEAD_STAGES;
export const LEAD_STAGE_ORDER: readonly LeadStage[] = [
  'cold',
  'consultation',
  'offering',
  'closing',
] as const;

// ===== Tipe kamar program umroh =====
export const ROOM_TYPES = {
  quad: { label: 'Kamar 4' },
  triple: { label: 'Kamar 3' },
  double: { label: 'Kamar 2' },
} as const;
export type RoomType = keyof typeof ROOM_TYPES;

// ===== Status pembayaran closing =====
export const PAYMENT_STATUS = {
  paid: { label: 'Lunas' },
  partial: { label: 'DP' },
  unpaid: { label: 'Belum Bayar' },
} as const;
export type PaymentStatus = keyof typeof PAYMENT_STATUS;

// ===== Level iklan Meta =====
export const AD_LEVELS = {
  campaign: { label: 'Campaign' },
  adset: { label: 'Ad Set' },
  ad: { label: 'Iklan' },
} as const;
export type AdLevel = keyof typeof AD_LEVELS;

// ===== Role pengguna =====
export const USER_ROLES = {
  owner: { label: 'Owner' },
  admin: { label: 'Admin' },
  cs: { label: 'CS' },
} as const;
export type UserRole = keyof typeof USER_ROLES;

// ===== Kode error API (dipakai DS-05 error-messages & DS-12 envelope) =====
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  STAGE_UNDERFLOW: 'STAGE_UNDERFLOW',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;
export type ErrorCodeValue = (typeof ERROR_CODES)[ErrorCode];
