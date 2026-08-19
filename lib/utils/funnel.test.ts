import { describe, expect, it } from 'vitest';
import { funnel } from './funnel';

describe('DS-10 funnel', () => {
  it('contoh terverifikasi manual', () => {
    const r = funnel({
      total_lead: 100,
      cold: 100,
      consultation: 40,
      offering: 15,
      closing: 5,
    });
    expect(r.stages.cold.rate_of_total).toBe(1);
    expect(r.stages.cold.rate_of_previous).toBe(null);
    expect(r.stages.consultation.rate_of_total).toBe(0.4);
    expect(r.stages.consultation.rate_of_previous).toBe(0.4);
    expect(r.stages.offering.rate_of_total).toBe(0.15);
    expect(r.stages.offering.rate_of_previous).toBeCloseTo(0.375, 3);
    expect(r.stages.closing.rate_of_total).toBe(0.05);
    expect(r.stages.closing.rate_of_previous).toBeCloseTo(0.3333, 3);
    expect(r.overall_conversion).toBe(0.05);
  });

  it('penyebut nol → null, bukan 0/NaN', () => {
    const r = funnel({ total_lead: 0, cold: 0, consultation: 0, offering: 0, closing: 0 });
    expect(r.stages.cold.rate_of_total).toBe(null);
    expect(r.stages.closing.rate_of_previous).toBe(null);
    expect(r.overall_conversion).toBe(null);
    expect(r.stages.cold.count).toBe(0);
  });

  it('cold 0 tapi consultation > 0 → rate_of_previous null', () => {
    const r = funnel({ total_lead: 10, cold: 0, consultation: 3, offering: 1, closing: 0 });
    expect(r.stages.consultation.rate_of_previous).toBe(null);
    expect(r.stages.consultation.rate_of_total).toBe(0.3);
  });
});
