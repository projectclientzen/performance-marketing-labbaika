/**
 * Peran pengguna dan tingkat aksesnya.
 *
 * `advertiser` ditambahkan di migrasi 024 dengan sudut pandang yang sama persis
 * dengan `owner` — satu dashboard utama untuk keduanya, yang membedakan hanya
 * sebutan jabatannya. Yang berdiri sendiri tetap `cs`.
 *
 * Padanan di database adalah fungsi `current_has_owner_access()`. Keduanya
 * harus selalu sepakat: kalau daftar di sini berubah, ubah juga fungsi SQL-nya.
 * Pengecekan di TypeScript ini bukan batas keamanan — RLS dan guard di dalam
 * fungsi SQL yang menjaga sungguhan (lihat 10-AUDIT-FE-BE.md #20b untuk apa
 * yang terjadi waktu pengecekan role cuma hidup di route).
 */

export type AppRole = 'owner' | 'advertiser' | 'cs';

const OWNER_LEVEL: readonly string[] = ['owner', 'advertiser'];

/** True untuk owner dan advertiser; false untuk cs, peran tak dikenal, dan undefined. */
export function hasOwnerAccess(role: string | null | undefined): boolean {
  return role != null && OWNER_LEVEL.includes(role);
}
