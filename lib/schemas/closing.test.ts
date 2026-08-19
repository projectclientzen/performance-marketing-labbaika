import { describe, expect, it } from 'vitest';
import { closingSchema } from './closing';

const base = {
  first_name: 'Budi',
  whatsapp: '08123456789',
  source_id: '11111111-1111-1111-1111-111111111111',
  lead_date: '2026-08-10',
  previous_stage: 'offering',
  closing_date: '2026-08-18',
  program_id: '22222222-2222-2222-2222-222222222222',
  departure_id: '33333333-3333-3333-3333-333333333333',
  room_type: 'quad',
  pax: 2,
  price_at_transaction: 30_000_000,
  total_value: 60_000_000,
  paid_amount: 30_000_000,
  payment_status: 'partial',
};

describe('DS-14 closing schema', () => {
  it('closing valid', () => {
    const r = closingSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('closing_date sebelum lead_date ditolak', () => {
    const r = closingSchema.safeParse({ ...base, closing_date: '2026-08-09' });
    expect(r.success).toBe(false);
  });

  it('pax < 1 ditolak', () => {
    expect(closingSchema.safeParse({ ...base, pax: 0 }).success).toBe(false);
  });

  it('paid_amount > total_value ditolak', () => {
    expect(
      closingSchema.safeParse({ ...base, paid_amount: 61_000_000 }).success,
    ).toBe(false);
  });

  it('whatsapp harus nomor ID valid', () => {
    expect(closingSchema.safeParse({ ...base, whatsapp: '021555000' }).success).toBe(false);
    expect(closingSchema.safeParse({ ...base, whatsapp: '+60123456789' }).success).toBe(false);
  });

  it('price_note wajib saat is_price_override true', () => {
    expect(
      closingSchema.safeParse({ ...base, is_price_override: true }).success,
    ).toBe(false);
    expect(
      closingSchema.safeParse({
        ...base,
        is_price_override: true,
        price_note: 'Diskon khusus',
      }).success,
    ).toBe(true);
  });

  it('pdp_consent_at wajib saat pdp_consent true', () => {
    expect(closingSchema.safeParse({ ...base, pdp_consent: true }).success).toBe(false);
    expect(
      closingSchema.safeParse({
        ...base,
        pdp_consent: true,
        pdp_consent_at: '2026-08-18T09:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('previous_stage tidak boleh closing (pakai endpoint cancel/link, bukan create biasa)', () => {
    expect(closingSchema.safeParse({ ...base, previous_stage: 'closing' }).success).toBe(false);
  });

  it('room_type menerima child dan infant', () => {
    expect(closingSchema.safeParse({ ...base, room_type: 'child' }).success).toBe(true);
    expect(closingSchema.safeParse({ ...base, room_type: 'infant' }).success).toBe(true);
  });

  it('payment_status cancelled ditolak saat create (pakai endpoint cancel)', () => {
    expect(closingSchema.safeParse({ ...base, payment_status: 'cancelled' }).success).toBe(false);
  });
});
