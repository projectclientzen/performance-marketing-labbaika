import { expect, it } from 'vitest';
import { jakartaPaymentTimeToIso, isoToJakartaPaymentTime } from './payment-time';
it('uses explicit WIB, independent of browser timezone and never invents legacy time', () => {
  expect(jakartaPaymentTimeToIso('2026-10-07T09:30')).toBe('2026-10-07T02:30:00.000Z');
  expect(isoToJakartaPaymentTime('2026-10-07T02:30:00Z')).toBe('2026-10-07T09:30');
  expect(jakartaPaymentTimeToIso('')).toBeUndefined();
  expect(isoToJakartaPaymentTime(null)).toBe('');
  expect(() => jakartaPaymentTimeToIso('2026-02-30T12:00')).toThrow();
});
