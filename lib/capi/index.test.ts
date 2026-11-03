import { describe, expect, it } from 'vitest';
import { buildPurchaseEvent, evaluatePurchaseEligibility, normalizeCapiEmail, hashCapiIdentifier, reuseOrCreatePurchaseSnapshot, type CapiClosing } from './index';
import { parseTrialCsv, summarizeTrialRows } from './trial';

const base: CapiClosing = { id: 'booking-1', brand_id: 'brand-1', first_name: 'Test', whatsapp_e164: '+6281234567890',
  email: 'Customer+tag_test-x@Example.invalid', pdp_consent: true, pdp_consent_at: '2026-10-06T12:00:00Z',
  payment_status: 'dp', paid_amount: 10000000, total_value: 60000000, pax: 2, price_at_transaction: 30000000,
  closing_date: '2026-10-06', first_payment_received_at: '2026-10-06T09:00:00+07:00', program_id: 'program-1' };
const now = new Date('2026-10-07T00:00:00Z');

describe('booking purchase policy', () => {
  it('uses full group booking value, original DP time, minimal server matching data', () => {
    const event = buildPurchaseEvent(base, { now });
    expect(event.custom_data).toEqual({ value: 60000000, currency: 'IDR' });
    expect(event.event_time).toBe(Date.parse(base.first_payment_received_at!) / 1000);
    expect(event.action_source).toBe('chat');
    expect(Object.keys(event.user_data).sort()).toEqual(['em', 'ph']);
    expect(JSON.stringify(event)).not.toContain(base.email);
    expect(JSON.stringify(event)).not.toContain(base.program_id);
  });
  it('retains existing snapshot and event ID after later installments/catalog changes', () => {
    const first = reuseOrCreatePurchaseSnapshot(base, null, { now });
    const later = { ...base, paid_amount: 60000000, payment_status: 'lunas', total_value: 70000000 };
    expect(reuseOrCreatePurchaseSnapshot(later, first, { now })).toBe(first);
    expect(first.event.custom_data.value).toBe(60000000);
    expect(buildPurchaseEvent({ ...base, paid_amount: 60000000, payment_status: 'lunas' }, { now }).event_id).toBe(first.event.event_id);
  });
  it.each([
    [{ paid_amount: 0 }, 'PAID_AMOUNT_INVALID'], [{ total_value: 0 }, 'BOOKING_VALUE_INVALID'],
    [{ payment_status: 'refunded' }, 'PAYMENT_STATUS_INELIGIBLE'], [{ payment_status: 'cancelled' }, 'PAYMENT_STATUS_INELIGIBLE'],
    [{ payment_status: 'lunas' }, 'LUNAS_AMOUNT_MISMATCH'], [{ pdp_consent: false }, 'CONSENT_REQUIRED'],
    [{ pdp_consent_at: null }, 'CONSENT_TIMESTAMP_REQUIRED'], [{ first_payment_received_at: null }, 'ORIGINAL_FIRST_PAYMENT_TIMESTAMP_REQUIRED'],
    [{ first_payment_received_at: '2026-10-06' }, 'ORIGINAL_FIRST_PAYMENT_TIMESTAMP_REQUIRED'],
    [{ first_payment_received_at: '2026-10-08T00:00:00Z' }, 'FIRST_PAYMENT_TIMESTAMP_FUTURE'],
    [{ first_payment_received_at: '2026-09-01T00:00:00Z' }, 'EVENT_TOO_OLD_FOR_SELECTED_POLICY'],
    [{ total_value: 61000000 }, 'BOOKING_VALUE_SNAPSHOT_MISMATCH'], [{ paid_amount: 61000000 }, 'PAID_EXCEEDS_BOOKING_VALUE'],
    [{ is_price_override: true }, 'PRICE_OVERRIDE_NOTE_REQUIRED'], [{ email: 'invalid' }, 'CUSTOMER_EMAIL_INVALID'],
  ])('blocks invalid event %j', (change, reason) => {
    expect(evaluatePurchaseEligibility({ ...base, ...change }, { now }).reasons).toContain(reason);
    expect(() => buildPurchaseEvent({ ...base, ...change }, { now })).toThrow();
  });
  it('keeps boundary and configured window independent from ad attribution', () => {
    const old = { ...base, first_payment_received_at: '2026-09-30T00:00:00Z' };
    expect(evaluatePurchaseEligibility(old, { now }).eligible).toBe(true);
    expect(evaluatePurchaseEligibility(old, { now: new Date(now.getTime() + 1) }).eligible).toBe(false);
    expect(evaluatePurchaseEligibility(old, { now, maxEventAgeSeconds: 86400 }).eligible).toBe(false);
  });
  it('preserves email local-part characters and never hashes empty identifiers', () => {
    expect(normalizeCapiEmail(' A+tag_b-c@EXAMPLE.invalid ')).toBe('a+tag_b-c@example.invalid');
    expect(hashCapiIdentifier('')).toBeNull();
    const event = buildPurchaseEvent({ ...base, email: '' }, { now });
    expect(event.user_data.em).toBeUndefined();
  });
  it('requires original time even if created/closing date exists', () => {
    expect(evaluatePurchaseEligibility({ ...base, first_payment_received_at: undefined }, { now }).eligible).toBe(false);
  });
  it('accepts PostgreSQL microseconds without inventing a customer country', () => {
    const event = buildPurchaseEvent({ ...base, pdp_consent_at: '2026-10-06T12:00:00.123456+00:00', first_payment_received_at: '2026-10-06T02:00:00.654321+00:00' }, { now });
    expect(event.event_time).toBe(Date.parse('2026-10-06T02:00:00Z') / 1000);
    expect(event.user_data).not.toHaveProperty('country');
  });
});

describe('offline trial', () => {
  it('reports only aggregates, deduplicates bookings and distinguishes DP from booking value', () => {
    const result = summarizeTrialRows([base, base, { ...base, id: 'other', payment_status: 'refunded' }, {}], { now });
    expect(result).toMatchObject({ totalRows: 4, eligibleRows: 1, ineligibleRows: 3, duplicateRows: 1, malformedRows: 1, eligibleBookingValueIdr: 60000000, eligiblePaidAmountIdr: 10000000 });
    expect(JSON.stringify(result)).not.toContain(base.whatsapp_e164);
    expect(JSON.stringify(result)).not.toContain(base.email);
    expect(JSON.stringify(result)).not.toContain(base.id);
  });
  it('parses quoted CSV, booleans, numbers and rejects malformed input', () => {
    expect(parseTrialCsv('id,paid_amount,pdp_consent,price_note\r\na,10,true,"x, y"')).toEqual([{ id: 'a', paid_amount: 10, pdp_consent: true, price_note: 'x, y' }]);
    expect(() => parseTrialCsv('id,id\na,b')).toThrow();
    expect(() => parseTrialCsv('id,note\na,"unclosed')).toThrow();
  });
});
