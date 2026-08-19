import { describe, expect, it, vi } from 'vitest';
import {
  formatDateID,
  formatDateLong,
  intervalDays,
  monthKey,
  parseDateID,
  todayJakarta,
} from './date';

describe('DS-08 date', () => {
  it('formatDateID dan formatDateLong', () => {
    expect(formatDateID('2026-08-19')).toBe('19 Agu 2026');
    expect(formatDateLong('2026-08-19')).toBe('19 Agustus 2026');
    expect(formatDateID('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDateLong('2026-12-31')).toBe('31 Desember 2026');
  });

  it('intervalDays: sama = 0, beda bulan, kabisat', () => {
    expect(intervalDays('2026-08-19', '2026-08-19')).toBe(0);
    expect(intervalDays('2026-07-31', '2026-08-01')).toBe(1);
    expect(intervalDays('2024-02-28', '2024-03-01')).toBe(2); // tahun kabisat
    expect(intervalDays('2026-08-19', '2026-08-10')).toBe(-9); // closing sebelum lead (invalid, tapi math tetap)
  });

  it('monthKey', () => {
    expect(monthKey('2026-08-19')).toBe('2026-08');
    expect(monthKey('2025-12-31')).toBe('2025-12');
  });

  it('parseDateID tidak kena shift UTC', () => {
    const d = parseDateID('2026-08-19');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(19);
  });

  it('todayJakarta: konsisten dengan zona Asia/Jakarta walau UTC beda hari', () => {
    // Jumat 2026-08-21 17:30 UTC = Sabtu 2026-08-22 00:30 WIB
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T17:30:00Z'));
    expect(todayJakarta()).toBe('2026-08-22');
    // Masih Jumat di UTC → UTC-nya 2026-08-21
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-08-21');
    vi.useRealTimers();
  });
});
