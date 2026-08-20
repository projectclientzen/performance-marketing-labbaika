import { describe, expect, it } from 'vitest';
import { cppStatus, profit } from './profit';

describe('DS-09b efektivitas iklan (berbasis omset)', () => {
  it('contoh terverifikasi manual', () => {
    const r = profit({
      revenue: 10_000_000,
      ad_spend: 500_000,
      closing_count: 2,
    });
    expect(r.net_revenue).toBe(9_500_000);
    expect(r.roi).toBe(19); // (10jt - 500rb) / 500rb = 1.900%
    expect(r.roas).toBe(20); // 10jt / 500rb
    expect(r.cpp).toBe(250_000);
    expect(r.breakeven_cpp).toBe(5_000_000); // omset per closing
    expect(r.ad_cost_ratio).toBe(0.05);
  });

  it('roas selalu roi + 1', () => {
    const r = profit({ revenue: 3_000_000, ad_spend: 1_200_000, closing_count: 1 });
    expect(r.roas).toBeCloseTo((r.roi as number) + 1, 10);
  });

  it('ROI negatif saat spend melebihi omset', () => {
    const r = profit({ revenue: 1_000_000, ad_spend: 3_000_000, closing_count: 1 });
    expect(r.roi).toBeCloseTo(-0.6667, 3);
    expect(r.roas).toBeCloseTo(0.3333, 3);
    expect(r.net_revenue).toBe(-2_000_000);
  });

  it('penyebut nol → null, bukan 0/NaN', () => {
    const r = profit({ revenue: 0, ad_spend: 0, closing_count: 0 });
    expect(r.roi).toBe(null);
    expect(r.roas).toBe(null);
    expect(r.cpp).toBe(null);
    expect(r.breakeven_cpp).toBe(null);
    expect(r.ad_cost_ratio).toBe(null);
  });

  it('cppStatus ambang 70% dan 100%', () => {
    expect(cppStatus(699, 1000)).toBe('safe'); // di bawah 70%
    expect(cppStatus(700, 1000)).toBe('warning'); // tepat 70% = masuk warning
    expect(cppStatus(850, 1000)).toBe('warning');
    expect(cppStatus(999, 1000)).toBe('warning');
    expect(cppStatus(1000, 1000)).toBe('over');
    expect(cppStatus(1500, 1000)).toBe('over');
    expect(cppStatus(null, 1000)).toBe('safe');
    expect(cppStatus(1000, null)).toBe('safe');
    expect(cppStatus(1000, 0)).toBe('safe');
  });
});
