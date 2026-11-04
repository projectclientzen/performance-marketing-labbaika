/** An explicitly entered wall-clock time in Jakarta; never default legacy dates to now. */
export function jakartaPaymentTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Waktu pembayaran tidak valid');
  const date = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(date.getTime())) throw new Error('Waktu pembayaran tidak valid');
  const roundtrip = new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16);
  if (roundtrip !== value) throw new Error('Waktu pembayaran tidak valid');
  return date.toISOString();
}

export function isoToJakartaPaymentTime(value: string | null | undefined): string {
  if (!value) return '';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 7 * 3600000).toISOString().slice(0, 16) : '';
}
