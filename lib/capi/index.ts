import { createHash } from 'node:crypto';
import { normalizePhoneID } from '../utils/phone';

/** Phase 1 only. Hermes must verify the selected Meta route before live delivery. */
export const PROVISIONAL_MAX_EVENT_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface CapiClosing {
  id: string;
  brand_id: string;
  first_name: string;
  last_name?: string | null;
  whatsapp_e164: string;
  email?: string | null;
  pdp_consent: boolean;
  pdp_consent_at?: string | null;
  payment_status: string;
  paid_amount: number;
  total_value: number;
  pax: number;
  price_at_transaction: number;
  is_price_override?: boolean;
  price_note?: string | null;
  closing_date: string;
  lead_date?: string | null;
  first_payment_received_at?: string | null;
  program_id: string;
}

export interface EligibilityOptions {
  now?: Date;
  /** Provisional seven-day limit; not a guarantee that a route accepts this age. */
  maxEventAgeSeconds?: number;
}

export interface PurchaseEligibility {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  eventTime: number | null;
  value: number | null;
}

/** Returns milliseconds only for explicit, real, timezone-bearing timestamps. */
function timestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  if (!calendarDate(value.slice(0, 10))) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function calendarDate(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function normalizeCapiEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  // Preserve +, _, -, and all other valid local-part characters; never rewrite identity.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function normalizeCapiPhone(value: string | null | undefined): string | null {
  return normalizePhoneID(value)?.slice(1) ?? null;
}

export function hashCapiIdentifier(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return createHash('sha256').update(value).digest('hex');
}

export function evaluatePurchaseEligibility(closing: CapiClosing, options: EligibilityOptions = {}): PurchaseEligibility {
  const now = (options.now ?? new Date()).getTime();
  const maxAge = options.maxEventAgeSeconds ?? PROVISIONAL_MAX_EVENT_AGE_SECONDS;
  if (!Number.isFinite(now) || !Number.isSafeInteger(maxAge) || maxAge <= 0) throw new Error('Invalid eligibility clock or age policy');
  const reasons: string[] = [];
  const warnings = ['META_ROUTE_AND_AGE_POLICY_REQUIRE_VERIFICATION'];
  if (!closing.id?.trim() || !closing.brand_id?.trim() || !closing.program_id?.trim()) reasons.push('MISSING_BOOKING_IDENTITY');
  if (closing.pdp_consent !== true) reasons.push('CONSENT_REQUIRED');
  const consentTime = timestamp(closing.pdp_consent_at);
  if (consentTime === null) reasons.push('CONSENT_TIMESTAMP_REQUIRED');
  else if (consentTime > now) reasons.push('CONSENT_TIMESTAMP_FUTURE');
  if (!['dp', 'partial', 'lunas'].includes(closing.payment_status)) reasons.push('PAYMENT_STATUS_INELIGIBLE');
  if (!positiveInteger(closing.paid_amount)) reasons.push('PAID_AMOUNT_INVALID');
  if (!positiveInteger(closing.total_value)) reasons.push('BOOKING_VALUE_INVALID');
  if (!positiveInteger(closing.pax)) reasons.push('PAX_INVALID');
  if (!positiveInteger(closing.price_at_transaction)) reasons.push('TRANSACTION_PRICE_INVALID');
  if (closing.paid_amount > closing.total_value) reasons.push('PAID_EXCEEDS_BOOKING_VALUE');
  if (closing.payment_status === 'lunas' && closing.paid_amount !== closing.total_value) reasons.push('LUNAS_AMOUNT_MISMATCH');
  if (closing.is_price_override) {
    if (!closing.price_note?.trim()) reasons.push('PRICE_OVERRIDE_NOTE_REQUIRED');
  } else if (closing.total_value !== closing.pax * closing.price_at_transaction) reasons.push('BOOKING_VALUE_SNAPSHOT_MISMATCH');
  const paymentTime = timestamp(closing.first_payment_received_at);
  if (paymentTime === null) reasons.push('ORIGINAL_FIRST_PAYMENT_TIMESTAMP_REQUIRED');
  else {
    if (paymentTime > now) reasons.push('FIRST_PAYMENT_TIMESTAMP_FUTURE');
    if (now - paymentTime > maxAge * 1000) reasons.push('EVENT_TOO_OLD_FOR_SELECTED_POLICY');
    // Business dates are in Asia/Jakarta; do not compare a UTC date with a local date.
    const paymentDate = new Date(paymentTime + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (closing.lead_date && calendarDate(closing.lead_date) && closing.lead_date > paymentDate) reasons.push('FIRST_PAYMENT_BEFORE_LEAD_DATE');
  }
  if (!calendarDate(closing.closing_date)) reasons.push('CLOSING_DATE_INVALID');
  if (closing.lead_date && !calendarDate(closing.lead_date)) reasons.push('LEAD_DATE_INVALID');
  if (!normalizeCapiPhone(closing.whatsapp_e164)) reasons.push('CUSTOMER_PHONE_INVALID');
  if (closing.email?.trim() && !normalizeCapiEmail(closing.email)) reasons.push('CUSTOMER_EMAIL_INVALID');
  if (!closing.email?.trim()) warnings.push('EMAIL_UNAVAILABLE');
  return { eligible: reasons.length === 0, reasons, warnings, eventTime: paymentTime === null ? null : Math.floor(paymentTime / 1000), value: positiveInteger(closing.total_value) ? closing.total_value : null };
}

export interface PurchaseEvent {
  event_name: 'Purchase';
  event_time: number;
  event_id: string;
  action_source: 'chat';
  user_data: { ph: string[]; em?: string[] };
  custom_data: { currency: 'IDR'; value: number };
}

export interface BuildPurchaseOptions extends EligibilityOptions {
  /** Separates synthetic test IDs; never use a changing prefix for live retries. */
  testPrefix?: string;
}

export function getPurchaseEventId(id: string, testPrefix?: string): string {
  if (!id?.trim() || /[\s:]/.test(id)) throw new Error('Invalid booking identifier');
  if (testPrefix !== undefined && !/^[a-zA-Z0-9_-]+$/.test(testPrefix)) throw new Error('Invalid test prefix');
  return `${testPrefix ? `test:${testPrefix}:` : ''}labbaika:booking:${id}:purchase:v1`;
}

export function buildPurchaseEvent(closing: CapiClosing, options: BuildPurchaseOptions = {}): PurchaseEvent {
  const eligibility = evaluatePurchaseEligibility(closing, options);
  if (!eligibility.eligible) throw new Error(`Purchase ineligible: ${eligibility.reasons.join(', ')}`);
  const phone = hashCapiIdentifier(normalizeCapiPhone(closing.whatsapp_e164))!;
  const email = hashCapiIdentifier(normalizeCapiEmail(closing.email));
  return {
    event_name: 'Purchase',
    event_time: eligibility.eventTime!,
    event_id: getPurchaseEventId(closing.id, options.testPrefix),
    action_source: 'chat',
    user_data: { ph: [phone], ...(email ? { em: [email] } : {}) },
    custom_data: { currency: 'IDR', value: closing.total_value },
  };
}

export interface PurchaseSnapshot {
  readonly bookingId: string;
  readonly brandId: string;
  readonly programId: string;
  readonly bookingValue: number;
  readonly paidAmountAtTrigger: number;
  readonly event: PurchaseEvent;
}

/** Store atomically once per booking. Retry from this snapshot, never rebuild from later edits. */
export function createPurchaseSnapshot(closing: CapiClosing, options: BuildPurchaseOptions = {}): PurchaseSnapshot {
  return { bookingId: closing.id, brandId: closing.brand_id, programId: closing.program_id, bookingValue: closing.total_value, paidAmountAtTrigger: closing.paid_amount, event: buildPurchaseEvent(closing, options) };
}

/** Pure retry selection; persistence must separately enforce a unique booking/event constraint. */
export function reuseOrCreatePurchaseSnapshot(closing: CapiClosing, existing: PurchaseSnapshot | null, options: BuildPurchaseOptions = {}): PurchaseSnapshot {
  if (existing) {
    if (existing.bookingId !== closing.id || existing.brandId !== closing.brand_id) throw new Error('Snapshot booking identity mismatch');
    return existing;
  }
  return createPurchaseSnapshot(closing, options);
}
