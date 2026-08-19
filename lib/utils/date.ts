/**
 * Utilitas tanggal — DS-08. Semua operasi memakai waktu lokal (Asia/Jakarta).
 */

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
] as const;

const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

/** 'YYYY-MM-DD' → Date lokal (bukan UTC, hindari shift zona). */
export function parseDateID(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** '2026-08-19' → '19 Agu 2026'. */
export function formatDateID(dateStr: string): string {
  const d = parseDateID(dateStr);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** '2026-08-19' → '19 Agustus 2026'. */
export function formatDateLong(dateStr: string): string {
  const d = parseDateID(dateStr);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Hari ini di zona Asia/Jakarta → 'YYYY-MM-DD'. */
export function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Selisih hari; hari yang sama = 0. */
export function intervalDays(leadDate: string, closingDate: string): number {
  const a = parseDateID(leadDate).getTime();
  const b = parseDateID(closingDate).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** '2026-08-19' → '2026-08'. */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}
