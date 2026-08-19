/**
 * Konfigurasi kolom export Meta — DS-18.
 * Struktur sama dengan operational, plus penanda kolom yang di-hash dan
 * normalizer yang dipakai.
 *
 * ⚠️ WAJIB dicek ulang ke dokumentasi Meta sebelum rilis:
 * skema hash/format normalisasi (phone, email, name, city, state) berubah
 * dari waktu ke waktu di sisi Meta. Verifikasi ke dokumentasi resmi saat
 * fitur ini mau diaktifkan.
 */
import { normalizeForMeta, sha256Hex } from './normalize';

export interface MetaColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  accessor: (row: T) => unknown;
  /** Normalizer dari normalizeForMeta (phone/email/name/city/state). */
  normalize?: (value: unknown) => string;
  /** true → nilai di-hash SHA-256 setelah dinormalisasi. */
  hashed: boolean;
}

export const metaColumns: MetaColumn[] = [
  {
    key: 'phone',
    header: 'Phone',
    accessor: (r) => r.phone,
    normalize: (v) => normalizeForMeta.phone(v as string | null | undefined),
    hashed: true,
  },
  {
    key: 'email',
    header: 'Email',
    accessor: (r) => r.email,
    normalize: (v) => normalizeForMeta.email(v as string | null | undefined),
    hashed: true,
  },
  {
    key: 'name',
    header: 'Name',
    accessor: (r) => r.name,
    normalize: (v) => normalizeForMeta.name(v as string | null | undefined),
    hashed: true,
  },
  {
    key: 'city',
    header: 'City',
    accessor: (r) => r.city,
    normalize: (v) => normalizeForMeta.city(v as string | null | undefined),
    hashed: false,
  },
  {
    key: 'state',
    header: 'State',
    accessor: (r) => r.state,
    normalize: (v) => normalizeForMeta.state(v as string | null | undefined),
    hashed: false,
  },
];

/** Terapkan normalizer + hash sesuai konfigurasi kolom. */
export function buildMetaRow<T extends Record<string, unknown>>(
  row: T,
  columns: MetaColumn<T>[] = metaColumns as MetaColumn<T>[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns) {
    const raw = col.accessor(row);
    const normalized = col.normalize ? col.normalize(raw) : String(raw ?? '');
    out[col.header] = col.hashed ? sha256Hex(normalized) : normalized;
  }
  return out;
}
