import { describe, expect, it } from 'vitest';
import { normalizePhoneID } from './phone';

/**
 * Daftar kasus uji DS-07 — WAJIB disalin identik ke test SQL `normalize_wa_id`
 * (CC-B08). Kalau hasil beda, SQL yang menang.
 */
describe('DS-07 normalizePhoneID', () => {
  const cases: Array<[string, string | null]> = [
    ['08123456789', '+628123456789'],
    ['8123456789', '+628123456789'],
    ['628123456789', '+628123456789'],
    ['+62 812-3456-789', '+628123456789'],
    ['+62812 3456 789', '+628123456789'],
    ['0812-3456-789', '+628123456789'],
    ['+6281234567890', '+6281234567890'],
    ['021555000', null],
    ['+60123456789', null],
    ['', null],
    ['08 12 34', null],
    ['0812345678a', null],
  ];

  it.each(cases)('normalizePhoneID(%j) → %j', (input, expected) => {
    expect(normalizePhoneID(input)).toBe(expected);
  });
});
