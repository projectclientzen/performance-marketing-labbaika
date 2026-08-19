import { describe, expect, it } from 'vitest';
import { closingSchema } from './closing';

const base = {
  lead_id: '3b241101-e2bb-4255-8caf-4136c566a962',
  lead_date: '2026-08-10',
  closing_date: '2026-08-18',
  pax: 2,
  total_value: 60_000_000,
  paid_amount: 30_000_000,
  payment_status: 'partial',
  whatsapp: '08123456789',
};

describe('DS-14 closing schema', () => {
  it('closing valid', () => {
    expect(closingSchema.safeParse(base).success).toBe(true);
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
});
