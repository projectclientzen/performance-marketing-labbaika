import { describe, expect, it } from 'vitest';
import { normalizeForMeta, sha256Hex } from './normalize';

describe('DS-09 meta normalize', () => {
  it('sha256Hex mengembalikan hex huruf kecil', () => {
    expect(sha256Hex('test')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('Test')).not.toBe(sha256Hex('test'));
  });

  it('nilai kosong/null → "" bukan hash', () => {
    expect(sha256Hex('')).toBe('');
    expect(sha256Hex(null)).toBe('');
    expect(sha256Hex(undefined)).toBe('');
    expect(normalizeForMeta.phone(null)).toBe('');
    expect(normalizeForMeta.email('')).toBe('');
  });

  it('phone: buang spasi, plus, dash', () => {
    expect(normalizeForMeta.phone('+62 812-3456-789')).toBe('628123456789');
    expect(normalizeForMeta.phone('0812 3456 789')).toBe('08123456789');
    expect(normalizeForMeta.phone('+62 (812) 3456-789')).toBe('628123456789');
  });

  it('text: trim + lowercase + buang tanda baca', () => {
    expect(normalizeForMeta.email('  BUDI@Example.COM ')).toBe('budi@example.com');
    expect(normalizeForMeta.name('Budi  Santoso, S.E.')).toBe('budi santoso se');
    expect(normalizeForMeta.city('Jakarta Selatan')).toBe('jakarta selatan');
    expect(normalizeForMeta.state('DKI Jakarta')).toBe('dki jakarta');
  });
});
