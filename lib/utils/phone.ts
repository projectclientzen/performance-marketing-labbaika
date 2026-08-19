/**
 * Normalisasi nomor HP Indonesia — DS-07.
 * Perilaku harus sama persis dengan fungsi SQL `normalize_wa_id` (CC-B08).
 * Daftar kasus uji wajib disalin ke kedua sisi (TS + SQL).
 */

export function normalizePhoneID(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const cleaned = input.trim().replace(/[\s()-]/g, '');
  if (!cleaned) return null;
  if (!/^\+?\d+$/.test(cleaned)) return null;

  let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  if (digits.startsWith('62')) {
    // sudah format internasional
  } else if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  } else {
    return null; // prefix asing / landline non-0
  }

  const local = digits.slice(2);
  // Nomor mobile Indonesia: diawali 8, panjang lokal 8-13 digit.
  if (!local.startsWith('8') || local.length < 8 || local.length > 13) return null;

  return '+' + digits;
}
