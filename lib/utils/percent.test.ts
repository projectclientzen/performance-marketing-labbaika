import { describe, expect, it } from 'vitest';
import { formatMultiple, formatPercent, formatROI } from './percent';

describe('DS-05b percent', () => {
  it('formatPercent', () => {
    expect(formatPercent(0.1234)).toBe('12,3%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(-0.05)).toBe('-5%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(null)).toBe('-');
    expect(formatPercent(undefined)).toBe('-');
  });

  it('formatROI', () => {
    expect(formatROI(9.08)).toBe('908%');
    expect(formatROI(0)).toBe('0%');
    expect(formatROI(-1.5)).toBe('-150%');
    expect(formatROI(12345.67)).toBe('1.234.567%');
    expect(formatROI(null)).toBe('-');
  });

  it('formatMultiple', () => {
    expect(formatMultiple(9.08)).toBe('9,1x');
    expect(formatMultiple(0)).toBe('0x');
    expect(formatMultiple(-2.34)).toBe('-2,3x');
    expect(formatMultiple(1_000_000.99)).toBe('1.000.001x');
    expect(formatMultiple(null)).toBe('-');
  });

  it('null menghasilkan "-", bukan 0% atau NaN%', () => {
    expect(formatPercent(null)).not.toMatch(/NaN|0%/);
    expect(formatROI(null)).toBe('-');
    expect(formatMultiple(undefined)).toBe('-');
  });
});
