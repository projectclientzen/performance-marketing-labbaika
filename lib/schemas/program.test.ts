import { describe, expect, it } from 'vitest';
import { costSchema, departureSchema, priceSchema, programSchema } from './program';

describe('DS-15 program/departure/price/cost schema', () => {
  it('program valid', () => {
    const r = programSchema.safeParse({
      name: 'Umroh Reguler',
      destination: 'Mekah - Madinah',
      duration_days: 9,
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.status).toBe('active');
  });

  it('duration_days harus lebih dari 0', () => {
    expect(
      programSchema.safeParse({
        name: 'Umroh Reguler',
        destination: 'Mekah - Madinah',
        duration_days: 0,
      }).success,
    ).toBe(false);
  });

  it('departure butuh program_id, quota > 0 kalau diisi', () => {
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

  it('return_date sebelum departure_date ditolak', () => {
    expect(
      departureSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        departure_date: '2026-10-15',
        return_date: '2026-10-10',
      }).success,
    ).toBe(false);
  });

  it('price butuh room_type valid, harga positif, dan effective_date', () => {
    expect(
      priceSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'quad',
        price: 32_900_000,
        effective_date: '2026-08-01',
      }).success,
    ).toBe(true);
    expect(
      priceSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'suite',
        price: 32_900_000,
        effective_date: '2026-08-01',
      }).success,
    ).toBe(false);
    expect(
      priceSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'quad',
        price: 0,
        effective_date: '2026-08-01',
      }).success,
    ).toBe(false);
  });

  it('price end_date harus setelah effective_date', () => {
    expect(
      priceSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'quad',
        price: 32_900_000,
        effective_date: '2026-08-01',
        end_date: '2026-08-01',
      }).success,
    ).toBe(false);
  });

  it('room_type child dan infant valid untuk price dan cost', () => {
    expect(
      priceSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'infant',
        price: 5_000_000,
        effective_date: '2026-08-01',
      }).success,
    ).toBe(true);
    expect(
      costSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'child',
        cost_price: 20_000_000,
        effective_date: '2026-08-01',
      }).success,
    ).toBe(true);
  });

  it('cost_price negatif ditolak', () => {
    expect(
      costSchema.safeParse({
        program_id: '3b241101-e2bb-4255-8caf-4136c566a962',
        room_type: 'quad',
        cost_price: -1,
        effective_date: '2026-08-01',
      }).success,
    ).toBe(false);
  });
});
