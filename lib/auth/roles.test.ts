import { describe, expect, it } from 'vitest';
import { hasOwnerAccess } from './roles';

describe('hasOwnerAccess', () => {
  it('owner dan advertiser punya akses setara', () => {
    expect(hasOwnerAccess('owner')).toBe(true);
    expect(hasOwnerAccess('advertiser')).toBe(true);
  });

  it('cs tidak', () => {
    expect(hasOwnerAccess('cs')).toBe(false);
  });

  it('nilai kosong atau tak dikenal ditolak, bukan dianggap owner', () => {
    expect(hasOwnerAccess(undefined)).toBe(false);
    expect(hasOwnerAccess(null)).toBe(false);
    expect(hasOwnerAccess('')).toBe(false);
    expect(hasOwnerAccess('Owner')).toBe(false); // case-sensitive, cocokkan enum DB
    expect(hasOwnerAccess('admin')).toBe(false);
  });

  it('tidak tertipu properti prototipe', () => {
    expect(hasOwnerAccess('constructor')).toBe(false);
    expect(hasOwnerAccess('toString')).toBe(false);
  });
});
