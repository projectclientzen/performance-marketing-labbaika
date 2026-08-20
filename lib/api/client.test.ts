import { describe, expect, it, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from './client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('respons 500 tanpa body JSON menghasilkan ApiError, bukan SyntaxError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      }),
    );

    await expect(apiFetch('/api/whatever')).rejects.toBeInstanceOf(ApiError);
  });

  it('respons ok mengembalikan body.data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { foo: 'bar' } }),
      }),
    );

    await expect(apiFetch('/api/whatever')).resolves.toEqual({ foo: 'bar' });
  });
});
