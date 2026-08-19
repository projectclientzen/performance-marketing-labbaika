import { describe, expect, it } from 'vitest';
import { departureSchema, priceSchema, programSchema } from './program';

describe('DS-15 program/departure/price schema', () => {
  it('program valid', () => {
    const r = programSchema.safeParse({
      name: 'Umroh Reguler',
      slug: 'umroh-reguler',
      effective_date: '2026-09-01',
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.status).toBe('active');
  });

  it('end_date harus setelah effective_date', () => {
    const r = programSchema.safeParse({
      name: 'Umroh Reguler',
      slug: 'umroh-reguler',
      effective_date: '2026-09-01',
      end_date: '2026-09-01',
    });
    expect(r.success).toBe(false);
    const ok = programSchema.safeParse({
      name: 'Umroh Reguler',
      slug: 'umroh-reguler',
      effective_date: '2026-09-01',
      end_date: '2026-12-31',
    });
    expect(ok.success).toBe(true);
  });

  it('departure butuh program_id dan quota > 0', () => {
    expect(
      departureSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        departure_date: '2026-10-15',
        quota: 30,
      }).success,
    ).toBe(true);
    expect(
      departureSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        departure_date: '2026-10-15',
        quota: 0,
      }).success,
    ).toBe(false);
  });

  it('price butuh room_type valid dan harga positif', () => {
    expect(
      priceSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'quad',
        price: 32_900_000,
      }).success,
    ).toBe(true);
    expect(
      priceSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'suite',
        price: 32_900_000,
      }).success,
    ).toBe(false);
    expect(
      priceSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'quad',
        price: 0,
      }).success,
    ).toBe(false);
  });
});
