import { formatDateID } from './date';
import { formatRupiah } from './rupiah';

/**
 * Turns a raw audit_logs row (action=INSERT/UPDATE/DELETE, table_name,
 * old_value/new_value JSONB snapshots from trigger write_audit_log) into
 * the human-readable sentence F-18 shows — e.g. "Reza Simpan laporan
 * harian 19 Agu" instead of "INSERT · lead_reports". Presentation only:
 * every field it reads was already being stored, this just describes it.
 */

export interface AuditLogRow {
  action: string;
  table_name: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

/** programId → name lookup is optional — falls back to a generic phrase without it. */
export function formatAuditMessage(
  log: AuditLogRow,
  programNameById: Record<string, string> = {},
): string {
  const n = log.new_value ?? {};
  const o = log.old_value ?? {};

  switch (log.table_name) {
    case 'lead_reports': {
      const date = str(n.report_date);
      if (log.action === 'INSERT') return `Simpan laporan harian${date ? ' ' + formatDateID(date) : ''}`;
      return `Ubah laporan harian${date ? ' ' + formatDateID(date) : ''}`;
    }
    case 'closings': {
      const name = [str(n.first_name), str(n.last_name)].filter(Boolean).join(' ') || 'closing';
      if (log.action === 'INSERT') return `Catat closing — ${name}`;
      if (str(n.payment_status) === 'cancelled' && str(o.payment_status) !== 'cancelled') {
        return `Batalkan closing — ${name}`;
      }
      return `Ubah closing — ${name}`;
    }
    case 'program_prices': {
      const programId = str(n.program_id);
      const programName = (programId && programNameById[programId]) || 'program';
      const roomType = str(n.room_type) ?? '';
      const price = num(n.price);
      const priceText = price !== undefined ? ` → ${formatRupiah(price)}` : '';
      const verb = log.action === 'INSERT' ? 'Tambah harga' : 'Ubah harga';
      return `${verb} ${programName} ${roomType}${priceText}`.trim();
    }
    case 'period_locks': {
      const month = num(n.month) ?? num(o.month);
      const year = num(n.year) ?? num(o.year);
      const period = month && year ? `${month}/${year}` : '';
      return log.action === 'DELETE' ? `Buka kunci periode ${period}` : `Kunci periode ${period}`;
    }
    case 'app_users': {
      const role = str(n.role);
      return role ? `Ubah role → ${role}` : 'Ubah user';
    }
    default:
      return `${log.action} · ${log.table_name}`;
  }
}
