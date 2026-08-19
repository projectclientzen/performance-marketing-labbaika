import { describe, expect, it } from 'vitest';
import { cppStatus, profit } from './profit';

describe('DS-09b profit', () => {
  it('contoh terverifikasi manual', () => {
    const r = profit({
      revenue: 10_000_000,
      cost_of_sales: 6_000_000,
      ad_spend: 500_000,
      closing_count: 2,
    });
    expect(r.gross_profit).toBe(4_000_000);
    expect(r.margin_pct).toBe(0.4);
    expect(r.net_contribution).toBe(3_500_000);
    expect(r.roi).toBe(7); // 700%
    expect(r.cpp).toBe(250_000);
    expect(r.breakeven_cpp).toBe(2_000_000);
    expect(r.ad_cost_ratio).toBe(0.05);
  });

  it('ROI negatif saat rugi', () => {
    const r = profit({
      revenue: 1_000_000,
      cost_of_sales: 1_200_000,
      ad_spend: 300_000,
      closing_count: 1,
    });
    expect(r.roi).toBeCloseTo(-1.6667, 3);
    expect(r.net_contribution).toBe(-500_000);
  });

  it('penyebut nol → null, bukan 0/NaN', () => {
    const r = profit({ revenue: 0, cost_of_sales: 0, ad_spend: 0, closing_count: 0 });
    expect(r.margin_pct).toBe(null);
    expect(r.roi).toBe(null);
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
