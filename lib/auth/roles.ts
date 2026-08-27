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

export type AppRole = 'owner' | 'advertiser' | 'hrd' | 'cs';

// HRD setara owner/advertiser (migrasi 030) sampai ada UI/UX khususnya.
// Harus selalu sepakat dengan current_has_owner_access() di DB.
const OWNER_LEVEL: readonly string[] = ['owner', 'advertiser', 'hrd'];

/** True untuk owner, advertiser, dan hrd; false untuk cs, peran tak dikenal, dan undefined. */
export function hasOwnerAccess(role: string | null | undefined): boolean {
  return role != null && OWNER_LEVEL.includes(role);
}

// ---------------------------------------------------------------------------
// Modul HR (SDM). Aksesnya SENGAJA berbeda dari hasOwnerAccess: hanya owner
// (superadmin) dan hrd — advertiser TIDAK termasuk, karena advertiser fokus
// iklan/marketing, bukan kepegawaian. Dipakai untuk menjaga rute /hr dan
// endpoint HR nanti. Saat ini HRD masih punya akses owner-level penuh juga
// (OWNER_LEVEL); pemisahan ini menyiapkan modul HR yang UI/UX-nya menyusul.
const HR_LEVEL: readonly string[] = ['owner', 'hrd'];

/** True untuk owner dan hrd; false untuk advertiser, cs, dan peran tak dikenal. */
export function hasHrdAccess(role: string | null | undefined): boolean {
  return role != null && HR_LEVEL.includes(role);
}
