import { describe, expect, it } from 'vitest';
import { formatRupiah, formatRupiahShort, parseRupiah } from './rupiah';

describe('DS-06 rupiah', () => {
  it('formatRupiah', () => {
    expect(formatRupiah(32_900_000)).toBe('Rp32.900.000');
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(-5_000)).toBe('-Rp5.000');
    expect(formatRupiah(1)).toBe('Rp1');
    expect(formatRupiah(null)).toBe('-');
  });

  it('formatRupiahShort', () => {
    expect(formatRupiahShort(4_200_000_000)).toBe('Rp4,2 M');
    expect(formatRupiahShort(2_000_000)).toBe('Rp2 jt');
    expect(formatRupiahShort(999_999)).toBe('Rp999.999');
    expect(formatRupiahShort(-1_500_000_000)).toBe('-Rp1,5 M');
    expect(formatRupiahShort(null)).toBe('-');
  });

  it('parseRupiah', () => {
    expect(parseRupiah('Rp32.900.000')).toBe(32_900_000);
    expect(parseRupiah('Rp 32.900.000 ')).toBe(32_900_000);
    expect(parseRupiah('32.900.000')).toBe(32_900_000);
    expect(parseRupiah('Rp4.200.000.000')).toBe(4_200_000_000);
    expect(parseRupiah('')).toBe(null);
    expect(parseRupiah('abc')).toBe(null);
    expect(parseRupiah(null)).toBe(null);
  });
});
