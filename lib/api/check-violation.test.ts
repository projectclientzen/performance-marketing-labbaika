import { describe, expect, it } from 'vitest';
import { checkViolationMessage } from './check-violation';

describe('checkViolationMessage', () => {
  it('maps the CAPI payment triggers to the payment message', () => {
    expect(checkViolationMessage('Invalid actual first payment time')).toMatch(/pembayaran/);
    expect(checkViolationMessage('Verified payment requires positive amount; settled amount must equal booking value')).toMatch(/pembayaran/);
  });
  it('does not blame payment for unrelated check constraints', () => {
    const msg = checkViolationMessage('new row for relation "closings" violates check constraint "closing_price_override_note"');
    expect(msg).not.toMatch(/pembayaran/);
    expect(msg).toMatch(/harga khusus/);
  });
});
