import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from './enums';
import { ERROR_MESSAGES, errorMessage } from './error-messages';

describe('DS-05 error-messages', () => {
  it('semua ERROR_CODES punya pesan dan tidak ada pesan tanpa kode', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_MESSAGES[code], `pesan hilang untuk ${code}`).toBeTruthy();
    }
    const extra = Object.keys(ERROR_MESSAGES).filter(
      (k) => !(Object.values(ERROR_CODES) as string[]).includes(k),
    );
    expect(extra).toEqual([]);
  });

  it('errorMessage mengembalikan pesan Indonesia yang actionable', () => {
    const msg = errorMessage('STAGE_UNDERFLOW');
    expect(msg).toContain('tidak cukup');
    expect(msg.length).toBeGreaterThan(20);
  });
});
