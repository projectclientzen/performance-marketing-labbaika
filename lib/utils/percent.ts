/**
 * Format persentase dan rasio — DS-05b.
 * Catatan: sistem tidak memakai ROAS — jangan buat helper formatRoas.
 */

/** 0.1234 → '12,3%'. null/undefined → '-'. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${(value * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
}

/** 9.08 → '908%' (ROI sebagai persen, bisa minus). null → '-'. */
export function formatROI(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${(value * 100).toLocaleString('id-ID', { maximumFractionDigits: 0 })}%`;
}

/** 9.08 → '9,1x' untuk tooltip. null → '-'. */
export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}x`;
}
