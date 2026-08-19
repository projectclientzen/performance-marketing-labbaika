/**
 * Format rupiah — DS-06.
 */

/** 32900000 → 'Rp32.900.000'. */
export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  const sign = value < 0 ? '-' : '';
  return `${sign}Rp${Math.abs(value).toLocaleString('id-ID')}`;
}

/** 4200000000 → 'Rp4,2 M'. Skala: M (juta), M (miliar) → gunakan B untuk miliar? Task: Rp4,2 M untuk 4,2 MILYAR. */
export function formatRupiahShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    const n = abs / 1_000_000_000;
    return `${sign}Rp${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  }
  if (abs >= 1_000_000) {
    const n = abs / 1_000_000;
    return `${sign}Rp${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp${abs.toLocaleString('id-ID')}`;
  }
  return `${sign}Rp${abs}`;
}

/**
 * 'Rp32.900.000' → 32900000. Terima input kotor (spasi, 'Rp', titik).
 * Return null kalau bukan format rupiah.
 */
export function parseRupiah(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const cleaned = input.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}
