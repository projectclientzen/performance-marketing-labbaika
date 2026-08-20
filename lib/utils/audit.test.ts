import { describe, expect, it } from 'vitest';
import { formatAuditMessage } from './audit';

describe('formatAuditMessage', () => {
  it('lead_reports INSERT', () => {
    expect(
      formatAuditMessage({
        action: 'INSERT',
        table_name: 'lead_reports',
        old_value: null,
        new_value: { report_date: '2026-08-19' },
      }),
    ).toBe('Simpan laporan harian 19 Agu 2026');
  });

  it('closings INSERT', () => {
    expect(
      formatAuditMessage({
        action: 'INSERT',
        table_name: 'closings',
        old_value: null,
        new_value: { first_name: 'Dina', last_name: null },
      }),
    ).toBe('Catat closing — Dina');
  });

  it('closings UPDATE ke cancelled dibedakan dari update biasa', () => {
    const base = { first_name: 'Dina', last_name: null };
    expect(
      formatAuditMessage({
        action: 'UPDATE',
        table_name: 'closings',
        old_value: { ...base, payment_status: 'lunas' },
        new_value: { ...base, payment_status: 'cancelled' },
      }),
    ).toBe('Batalkan closing — Dina');

    expect(
      formatAuditMessage({
        action: 'UPDATE',
        table_name: 'closings',
        old_value: { ...base, payment_status: 'dp' },
        new_value: { ...base, payment_status: 'lunas' },
      }),
    ).toBe('Ubah closing — Dina');
  });

  it('program_prices pakai nama program dari lookup', () => {
    expect(
      formatAuditMessage(
        {
          action: 'INSERT',
          table_name: 'program_prices',
          old_value: null,
          new_value: { program_id: 'p1', room_type: 'quad', price: 32900000 },
        },
        { p1: 'Turki 16D' },
      ),
    ).toBe('Tambah harga Turki 16D quad → Rp32.900.000');
  });

  it('period_locks kunci vs buka', () => {
    expect(
      formatAuditMessage({
        action: 'INSERT',
        table_name: 'period_locks',
        old_value: null,
        new_value: { year: 2026, month: 7 },
      }),
    ).toBe('Kunci periode 7/2026');

    expect(
      formatAuditMessage({
        action: 'DELETE',
        table_name: 'period_locks',
        old_value: { year: 2026, month: 7 },
        new_value: null,
      }),
    ).toBe('Buka kunci periode 7/2026');
  });

  it('tabel tak dikenal jatuh ke format lama', () => {
    expect(
      formatAuditMessage({
        action: 'INSERT',
        table_name: 'ad_performance',
        old_value: null,
        new_value: {},
      }),
    ).toBe('INSERT · ad_performance');
  });
});
