/**
 * Konfigurasi kolom export operational — DS-17.
 * Array deklaratif: `{ key, header, accessor, format }`.
 * DRAFT: daftar kolom final mengikuti 02-PRD-v1.1.md §14.1 —
 * WAJIB dicek ulang ke PRD saat tersedia sebelum rilis.
 * File ini TIDAK berisi query apapun.
 */
import { formatDateID } from '../../utils/date';
import { formatRupiah } from '../../utils/rupiah';

export interface OperationalColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  accessor: (row: T) => unknown;
  format?: (value: unknown) => string;
}

const dateFmt = (v: unknown) => (typeof v === 'string' ? formatDateID(v) : String(v ?? ''));
const rupiahFmt = (v: unknown) =>
  typeof v === 'number' ? formatRupiah(v) : String(v ?? '');

export const operationalColumns: OperationalColumn[] = [
  { key: 'lead_date', header: 'Tanggal Lead', accessor: (r) => r.lead_date, format: dateFmt },
  { key: 'name', header: 'Nama', accessor: (r) => r.name },
  { key: 'whatsapp', header: 'WhatsApp', accessor: (r) => r.whatsapp },
  { key: 'city', header: 'Kota', accessor: (r) => r.city },
  { key: 'source', header: 'Sumber', accessor: (r) => r.source },
  { key: 'stage', header: 'Stage', accessor: (r) => r.stage },
  { key: 'closing_date', header: 'Tanggal Closing', accessor: (r) => r.closing_date, format: dateFmt },
  { key: 'program', header: 'Program', accessor: (r) => r.program },
  { key: 'room_type', header: 'Tipe Kamar', accessor: (r) => r.room_type },
  { key: 'pax', header: 'Pax', accessor: (r) => r.pax },
  { key: 'total_value', header: 'Nilai Total', accessor: (r) => r.total_value, format: rupiahFmt },
  { key: 'paid_amount', header: 'Terbayar', accessor: (r) => r.paid_amount, format: rupiahFmt },
  { key: 'status', header: 'Status', accessor: (r) => r.status },
];
