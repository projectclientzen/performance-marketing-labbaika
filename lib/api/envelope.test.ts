import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../constants/enums';
import { fail, httpStatus, ok } from './envelope';

describe('DS-12 envelope', () => {
  it('ok membentuk respons sukses', () => {
    expect(ok({ id: 1 })).toEqual({ success: true, data: { id: 1 } });
    expect(ok([1, 2], { page: 1 })).toEqual({
      success: true,
      data: [1, 2],
      meta: { page: 1 },
    });
  });

  it('fail memakai pesan default Indonesia kalau tidak diberikan', () => {
    const r = fail('STAGE_UNDERFLOW');
    expect(r.success).toBe(false);
    expect(r.error.code).toBe('STAGE_UNDERFLOW');
    expect(r.error.message).toContain('tidak cukup');
  });

  it('fail dengan fields untuk validasi', () => {
    const r = fail('VALIDATION_ERROR', 'Ada yang salah', { date: 'Tidak boleh masa depan' });
    expect(r.error.fields).toEqual({ date: 'Tidak boleh masa depan' });
  });

  it('httpStatus memetakan semua kode', () => {
    expect(httpStatus('NOT_FOUND')).toBe(404);
    expect(httpStatus('VALIDATION_ERROR')).toBe(422);
    expect(httpStatus('UNAUTHORIZED')).toBe(401);
    expect(httpStatus('FORBIDDEN')).toBe(403);
    expect(httpStatus('RATE_LIMITED')).toBe(429);
    expect(httpStatus('INTERNAL_ERROR')).toBe(500);
    for (const code of Object.keys(ERROR_CODES) as Array<keyof typeof ERROR_CODES>) {
      expect(httpStatus(code)).toBeGreaterThanOrEqual(400);
    }
  });
});
