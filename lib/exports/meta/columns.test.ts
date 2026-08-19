import { describe, expect, it } from 'vitest';
import { operationalColumns } from '../operational/columns';
import { buildMetaRow } from './columns';

describe('DS-18 meta columns', () => {
  it('kolom phone/email/name di-hash, city/state tidak', () => {
    const row = buildMetaRow({
      phone: '+62 812-3456-789',
      email: 'BUDI@Example.COM',
      name: 'Budi  Santoso, S.E.',
      city: 'Jakarta Selatan',
      state: 'DKI Jakarta',
    });
    expect(row['Phone']).toMatch(/^[0-9a-f]{64}$/);
    expect(row['Email']).toMatch(/^[0-9a-f]{64}$/);
    expect(row['Name']).toMatch(/^[0-9a-f]{64}$/);
    expect(row['City']).toBe('jakarta selatan');
    expect(row['State']).toBe('dki jakarta');
  });

  it('nilai kosong tidak di-hash', () => {
    const row = buildMetaRow({ phone: null, email: '', name: undefined, city: '', state: '' });
    expect(row['Phone']).toBe('');
    expect(row['Email']).toBe('');
  });

  it('operationalColumns deklaratif tanpa query', () => {
    expect(operationalColumns.length).toBeGreaterThan(0);
    for (const c of operationalColumns) {
      expect(typeof c.key).toBe('string');
      expect(typeof c.header).toBe('string');
      expect(typeof c.accessor).toBe('function');
    }
  });
});
